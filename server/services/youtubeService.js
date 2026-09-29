// services/youtubeService.js — Intégration API YouTube Data v3 (CÔTÉ SERVEUR UNIQUEMENT).
// La clé API est résolue ici (YoutubeConfig chiffrée → repli process.env.YOUTUBE_API_KEY) et
// n'est JAMAIS renvoyée au client ni écrite dans les logs. Un cache mémoire (TTL) réduit le quota.
const YoutubeConfig = require('../models/YoutubeConfig')
const { decrypt } = require('../utils/crypto')

const BASE = 'https://www.googleapis.com/youtube/v3'

// ───────────────────────── Cache mémoire (borné) ─────────────────────────
const cache = new Map() // key -> { expires, data }
const MAX_CACHE = 500
function cacheGet(key) {
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() > hit.expires) { cache.delete(key); return null }
  return hit.data
}
function cacheSet(key, data, ttlSec) {
  if (cache.size > MAX_CACHE) { const first = cache.keys().next().value; cache.delete(first) }
  cache.set(key, { expires: Date.now() + (ttlSec > 0 ? ttlSec : 300) * 1000, data })
}

// Résout la config active : clé DB (déchiffrée) prioritaire, repli sur l'env.
async function resolveConfig() {
  let apiKey = ''
  let cacheTtl = Number(process.env.YOUTUBE_CACHE_TTL) || 300
  let maxSearchLen = 120
  let enabled = true
  // Réglages de téléchargement + publicité AdSense (non secrets).
  let downloadEnabled = true
  let adsenseClient = process.env.ADSENSE_CLIENT || ''
  let adSlot = process.env.ADSENSE_SLOT || ''
  let adCountdown = Number(process.env.ADSENSE_COUNTDOWN) || 5
  try {
    const cfg = await YoutubeConfig.findOne({ singleton: 'youtube' })
    if (cfg) {
      apiKey = decrypt(cfg.apiKey) || ''
      cacheTtl = cfg.cacheTtl || cacheTtl
      maxSearchLen = cfg.maxSearchLen || maxSearchLen
      enabled = cfg.enabled !== false
      downloadEnabled = cfg.downloadEnabled !== false
      if (cfg.adsenseClient) adsenseClient = cfg.adsenseClient
      if (cfg.adSlot) adSlot = cfg.adSlot
      if (cfg.adCountdown != null) adCountdown = cfg.adCountdown
    }
  } catch (e) { /* DB indisponible → repli env */ }
  if (!apiKey) apiKey = process.env.YOUTUBE_API_KEY || ''
  return { apiKey, cacheTtl, maxSearchLen, enabled, downloadEnabled, adsenseClient, adSlot, adCountdown }
}

function typedError(message, code, status) {
  const e = new Error(message)
  e.code = code
  e.status = status || 500
  return e
}

// Appel bas niveau à l'API YouTube. Détecte quota/clé invalide. Ne logge JAMAIS la clé/l'URL.
async function ytFetch(path, params, apiKey) {
  const url = new URL(BASE + path)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '' && v !== null) url.searchParams.set(k, v)
  }
  url.searchParams.set('key', apiKey)
  let res, data
  try {
    res = await fetch(url.toString())
    data = await res.json().catch(() => ({}))
  } catch (e) {
    throw typedError('Service vidéo temporairement injoignable', 'network', 502)
  }
  if (!res.ok) {
    const reason = (data && data.error && data.error.errors && data.error.errors[0] && data.error.errors[0].reason) || ''
    // On journalise le code/raison, JAMAIS la clé.
    console.warn('[youtube] API error status=' + res.status + ' reason=' + (reason || '(n/a)'))
    if (res.status === 403 && /quota/i.test(reason)) throw typedError('quota', 'quotaExceeded', 503)
    if (res.status === 400 || /keyInvalid|badRequest|forbidden/i.test(reason)) throw typedError('config', 'keyInvalid', 502)
    throw typedError('yt_error', 'ytError', 502)
  }
  return data
}

// Convertit une durée ISO8601 (PT#H#M#S) en libellé "h:mm:ss" / "m:ss".
function isoDurationToLabel(iso) {
  if (!iso) return ''
  const m = String(iso).match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return ''
  const h = Number(m[1] || 0), mn = Number(m[2] || 0), s = Number(m[3] || 0)
  const pad = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(mn)}:${pad(s)}` : `${mn}:${pad(s)}`
}

function pickThumb(sn) {
  const t = sn && sn.thumbnails ? sn.thumbnails : {}
  return (t.medium || t.high || t.default || {}).url || ''
}

// ───────────────────────── Bibliothèque de repli (Fallback Vidéos) ─────────────────────────
// Utilisée si aucune clé API n'est encore configurée ou si le quota YouTube de Google est dépassé.
const FALLBACK_VIDEOS = [
  {
    videoId: 'kJQP7kiw5Fk',
    title: 'Clip Officiel — Les Meilleurs Hits Afrobeat & Musique Urbaine du Moment',
    description: 'Compilation des plus grands hits musicaux et rythmes dansants de l\'année.',
    channelTitle: 'Afro Hits TV',
    channelId: 'UC_afro_hits',
    publishedAt: '2024-03-01T18:00:00Z',
    thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
    duration: '04:15',
    viewCount: 3820000,
    categoryKey: 'musique',
  },
  {
    videoId: 'dQw4w9WgXcQ',
    title: 'Les 10 plus beaux buts et actions légendaires du Football Mondial',
    description: 'Résumé spectaculaire des meilleurs moments de football, dribbles et arrêts décisifs.',
    channelTitle: 'Football Passion',
    channelId: 'UC_foot_passion',
    publishedAt: '2024-02-15T19:30:00Z',
    thumbnail: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=600&auto=format&fit=crop&q=80',
    duration: '11:40',
    viewCount: 2450000,
    categoryKey: 'sport',
  },
  {
    videoId: 'rfscVS0vtbw',
    title: 'Top des Nouvelles Technologies et Smartphones Révolutionnaires en 2024',
    description: 'Test complet des dernières innovations high-tech, IA et gadgets du futur.',
    channelTitle: 'Tech Hub Monde',
    channelId: 'UC_tech_hub',
    publishedAt: '2024-01-20T14:00:00Z',
    thumbnail: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&auto=format&fit=crop&q=80',
    duration: '14:22',
    viewCount: 890000,
    categoryKey: 'technologie',
  },
  {
    videoId: 'dpw9EHDh2bM',
    title: 'Les Meilleurs Moments Gaming & Fous Rires en Ligne',
    description: 'Compilation hilarante de fails, actions épiques et gaming multijoueur.',
    channelTitle: 'Game Mania',
    channelId: 'UC_game_mania',
    publishedAt: '2024-02-10T15:45:00Z',
    thumbnail: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop&q=80',
    duration: '17:50',
    viewCount: 1650000,
    categoryKey: 'gaming',
  },
  {
    videoId: 'fL2A1v7b2aE',
    title: 'Sketch & Comédie : Quand la famille se réunit le week-end',
    description: 'Humour et comédie du quotidien, parodies et rires garantis en famille.',
    channelTitle: 'Rires Sans Limites',
    channelId: 'UC_rires_tv',
    publishedAt: '2023-11-28T16:00:00Z',
    thumbnail: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80',
    duration: '12:35',
    viewCount: 1200000,
    categoryKey: 'divertissement',
  },
  {
    videoId: '26U_seo0a1g',
    title: 'Les Clés de la Réussite et de la Discipline : Discours de Motivation',
    description: 'Comment développer un mental d\'acier, vaincre la procrastination et atteindre ses objectifs.',
    channelTitle: 'Motivation Quotidienne',
    channelId: 'UC_motivation_hd',
    publishedAt: '2024-01-25T11:00:00Z',
    thumbnail: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&auto=format&fit=crop&q=80',
    duration: '16:45',
    viewCount: 950000,
    categoryKey: 'dev-perso',
  },
  {
    videoId: 'M7lc1UVf-VE',
    title: 'Histoire et Civilisations du Monde : Les Grands Mystères',
    description: 'Documentaire captivant sur les grandes découvertes et l\'histoire de l\'humanité.',
    channelTitle: 'Découvertes & Savoirs',
    channelId: 'UC_decouvertes',
    publishedAt: '2023-09-15T10:00:00Z',
    thumbnail: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600&auto=format&fit=crop&q=80',
    duration: '24:18',
    viewCount: 1452000,
    categoryKey: 'actualites',
  },
  {
    videoId: 'fJ9rUzIMcZQ',
    title: 'Cours & Savoirs : Maîtriser l\'art de la communication et de l\'éloquence',
    description: 'Techniques pour parler en public avec assurance et convaincre son auditoire.',
    channelTitle: 'Savoir & Expression',
    channelId: 'UC_savoir_expression',
    publishedAt: '2023-10-05T11:00:00Z',
    thumbnail: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=600&auto=format&fit=crop&q=80',
    duration: '21:05',
    viewCount: 780000,
    categoryKey: 'education',
  },
]

function getFallbackResults(queryStr) {
  const qClean = String(queryStr || '').toLowerCase().trim()
  let filtered = FALLBACK_VIDEOS
  if (qClean) {
    const hits = FALLBACK_VIDEOS.filter((v) =>
      v.title.toLowerCase().includes(qClean) ||
      v.description.toLowerCase().includes(qClean) ||
      v.categoryKey.toLowerCase().includes(qClean) ||
      qClean.includes(v.categoryKey)
    )
    if (hits.length > 0) filtered = hits
  }
  return { items: filtered, nextPageToken: '', prevPageToken: '', fallback: true }
}

// ───────────────────────── Recherche & Flux d'accueil ─────────────────────────
const ORDERS = ['relevance', 'date', 'viewCount', 'rating', 'title']
const DURATIONS = ['', 'short', 'medium', 'long', 'any']

async function search({ q = '', pageToken = '', order = 'relevance', videoDuration = '', maxResults = 24 }) {
  const cfg = await resolveConfig()
  if (!cfg.enabled) throw typedError('disabled', 'disabled', 503)

  const ord = ORDERS.includes(order) ? order : 'relevance'
  const dur = DURATIONS.includes(videoDuration) ? videoDuration : ''
  const mr = Math.min(Math.max(Number(maxResults) || 24, 1), 50)
  const queryClean = String(q || '').trim()

  const key = 'search:' + JSON.stringify({ q: queryClean, pageToken, ord, dur, mr })
  const cached = cacheGet(key)
  if (cached) return cached

  // Si pas de clé API configurée, renvoie immédiatement les vidéos de repli sans erreur 503
  if (!cfg.apiKey) {
    return getFallbackResults(queryClean)
  }

  try {
    let items = []
    let nextPageToken = ''
    let prevPageToken = ''

    if (!queryClean) {
      // Pas de mot-clé spécifique -> Flux d'accueil YouTube (Vidéos populaires & tendances de tous types)
      const feedData = await ytFetch('/videos', {
        part: 'snippet,contentDetails,statistics',
        chart: 'mostPopular',
        maxResults: mr,
        pageToken: pageToken || undefined,
      }, cfg.apiKey)

      items = (feedData.items || []).map((it) => {
        const id = typeof it.id === 'string' ? it.id : (it.id && it.id.videoId)
        const sn = it.snippet || {}
        return {
          videoId: id,
          title: sn.title || '',
          description: sn.description || '',
          channelTitle: sn.channelTitle || '',
          channelId: sn.channelId || '',
          publishedAt: sn.publishedAt || '',
          thumbnail: pickThumb(sn),
          duration: isoDurationToLabel(it.contentDetails && it.contentDetails.duration),
          viewCount: it.statistics && it.statistics.viewCount ? Number(it.statistics.viewCount) : null,
        }
      }).filter((x) => x.videoId)

      nextPageToken = feedData.nextPageToken || ''
      prevPageToken = feedData.prevPageToken || ''
    } else {
      // Recherche personnalisée sur tout le catalogue YouTube (sans filtre restrictif)
      const searchData = await ytFetch('/search', {
        part: 'snippet',
        type: 'video',
        q: queryClean,
        maxResults: mr,
        order: ord,
        pageToken: pageToken || undefined,
        videoDuration: dur || undefined,
        safeSearch: 'moderate',
      }, cfg.apiKey)

      const ids = (searchData.items || []).map((it) => it.id && it.id.videoId).filter(Boolean)
      const detailsById = {}
      if (ids.length) {
        try {
          const vids = await ytFetch('/videos', { part: 'contentDetails,statistics,snippet', id: ids.join(',') }, cfg.apiKey)
          for (const v of (vids.items || [])) detailsById[v.id] = v
        } catch (_) { /* continuer avec les snippets */ }
      }

      items = (searchData.items || []).map((it) => {
        const id = it.id && it.id.videoId
        const d = detailsById[id]
        const sn = (d && d.snippet) || it.snippet || {}
        return {
          videoId: id,
          title: sn.title || '',
          description: sn.description || '',
          channelTitle: sn.channelTitle || '',
          channelId: sn.channelId || '',
          publishedAt: sn.publishedAt || '',
          thumbnail: pickThumb(sn),
          duration: isoDurationToLabel(d && d.contentDetails && d.contentDetails.duration),
          viewCount: d && d.statistics && d.statistics.viewCount ? Number(d.statistics.viewCount) : null,
        }
      }).filter((x) => x.videoId)

      nextPageToken = searchData.nextPageToken || ''
      prevPageToken = searchData.prevPageToken || ''
    }

    if (items.length === 0 && !pageToken) {
      return getFallbackResults(queryClean)
    }

    const result = { items, nextPageToken, prevPageToken }
    cacheSet(key, result, cfg.cacheTtl)
    return result
  } catch (err) {
    console.warn('[youtube] Recherche YouTube en direct échouée (' + err.message + ') → repli vers les vidéos intégrées.')
    return getFallbackResults(queryClean)
  }
}

// ───────────────────────── Détails d'une vidéo ─────────────────────────
async function videoDetails(videoId) {
  const cfg = await resolveConfig()
  const key = 'video:' + videoId
  const cached = cacheGet(key)
  if (cached) return cached

  // Si pas de clé, chercher dans la liste de repli ou renvoyer un objet vidéo valide
  if (!cfg.apiKey) {
    const fb = FALLBACK_VIDEOS.find((v) => v.videoId === videoId)
    if (fb) {
      return {
        videoId: fb.videoId,
        title: fb.title,
        description: fb.description,
        channelTitle: fb.channelTitle,
        channelId: fb.channelId,
        publishedAt: fb.publishedAt,
        thumbnail: fb.thumbnail,
        duration: fb.duration,
        viewCount: fb.viewCount,
        embeddable: true,
        tags: [],
      }
    }
    return {
      videoId,
      title: 'Vidéo YouTube',
      description: '',
      channelTitle: 'YouTube',
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      duration: '',
      viewCount: null,
      embeddable: true,
      tags: [],
    }
  }

  try {
    const data = await ytFetch('/videos', { part: 'snippet,contentDetails,statistics,status', id: videoId }, cfg.apiKey)
    const v = (data.items || [])[0]
    if (!v) throw typedError('notFound', 'notFound', 404)
    const sn = v.snippet || {}
    const out = {
      videoId: v.id,
      title: sn.title || '',
      description: sn.description || '',
      channelTitle: sn.channelTitle || '',
      channelId: sn.channelId || '',
      publishedAt: sn.publishedAt || '',
      thumbnail: pickThumb(sn),
      duration: isoDurationToLabel(v.contentDetails && v.contentDetails.duration),
      viewCount: v.statistics && v.statistics.viewCount ? Number(v.statistics.viewCount) : null,
      embeddable: v.status ? v.status.embeddable !== false : true,
      tags: sn.tags || [],
    }
    cacheSet(key, out, cfg.cacheTtl)
    return out
  } catch (err) {
    return {
      videoId,
      title: 'Vidéo YouTube',
      description: '',
      channelTitle: 'YouTube',
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      duration: '',
      viewCount: null,
      embeddable: true,
      tags: [],
    }
  }
}

// ───────────────────────── Vidéos similaires ─────────────────────────
// NB : le paramètre officiel relatedToVideoId a été déprécié par YouTube (2023). On effectue
// un repli par recherche sur le titre de la vidéo (best-effort, sans contournement).
async function related(videoId) {
  const cfg = await resolveConfig()
  if (!cfg.apiKey) throw typedError('noKey', 'noKey', 503)
  const key = 'related:' + videoId
  const cached = cacheGet(key)
  if (cached) return cached
  let q = ''
  try { const v = await videoDetails(videoId); q = (v.title || '').split(/\s+/).slice(0, 6).join(' ') } catch (_) {}
  if (!q) { const empty = { items: [] }; cacheSet(key, empty, cfg.cacheTtl); return empty }
  const r = await search({ q, maxResults: 12 })
  const out = { items: r.items.filter((x) => x.videoId !== videoId) }
  cacheSet(key, out, cfg.cacheTtl)
  return out
}

// ───────────────────────── Catégories rapides (extensible) ─────────────────────────
// Chaque catégorie mappe vers une requête de recherche. Ajouter une entrée suffit.
const CATEGORIES = [
  { key: '', label: 'Tous', emoji: '✨', query: '' },
  { key: 'musique', label: 'Musique', emoji: '🎵', query: 'musique' },
  { key: 'gaming', label: 'Gaming', emoji: '🎮', query: 'gaming' },
  { key: 'sport', label: 'Sport', emoji: '⚽', query: 'sport' },
  { key: 'divertissement', label: 'Divertissement', emoji: '😂', query: 'divertissement' },
  { key: 'actualites', label: 'Actualités', emoji: '🌍', query: 'actualités' },
  { key: 'technologie', label: 'Technologie', emoji: '💻', query: 'technologie' },
  { key: 'cinema', label: 'Cinéma & Séries', emoji: '🎬', query: 'bande annonce film' },
  { key: 'education', label: 'Éducation & Savoirs', emoji: '🎓', query: 'éducation cours' },
  { key: 'dev-perso', label: 'Motivation', emoji: '🧠', query: 'motivation' },
]
function categories() { return CATEGORIES }

module.exports = { resolveConfig, search, videoDetails, related, categories, isoDurationToLabel }
