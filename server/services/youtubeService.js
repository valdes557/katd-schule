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
    videoId: 'M7lc1UVf-VE',
    title: 'Histoire de l\'Afrique et des grandes civilisations',
    description: 'Documentaire pédagogique complet sur l\'histoire des grands empires et civilisations africaines.',
    channelTitle: 'Éducation & Découverte',
    channelId: 'UC_edu_afrique',
    publishedAt: '2023-09-15T10:00:00Z',
    thumbnail: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600&auto=format&fit=crop&q=80',
    duration: '24:18',
    viewCount: 145200,
    categoryKey: 'education',
  },
  {
    videoId: 'dQw4w9WgXcQ',
    title: 'Cours de Mathématiques : Géométrie dans l\'espace et Trigonométrie',
    description: 'Leçon claire et détaillée avec exercices corrigés pour élèves du secondaire et lycée.',
    channelTitle: 'Maths Faciles',
    channelId: 'UC_maths_faciles',
    publishedAt: '2024-01-10T14:30:00Z',
    thumbnail: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=600&auto=format&fit=crop&q=80',
    duration: '18:45',
    viewCount: 98400,
    categoryKey: 'cours',
  },
  {
    videoId: 'kJQP7kiw5Fk',
    title: 'Sciences de la Vie et de la Terre (SVT) : La Génétique et l\'ADN',
    description: 'Comprendre facilement la transmission des gènes, la mitose et la méiose en classe.',
    channelTitle: 'SVT Pour Tous',
    channelId: 'UC_svt_cours',
    publishedAt: '2023-11-20T09:15:00Z',
    thumbnail: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=600&auto=format&fit=crop&q=80',
    duration: '15:20',
    viewCount: 67300,
    categoryKey: 'cours',
  },
  {
    videoId: 'fJ9rUzIMcZQ',
    title: 'Cours de Français & Expression écrite : Rédiger une dissertation parfaite',
    description: 'Méthodologie pas à pas pour réussir l\'introduction, le plan dialectique et la conclusion.',
    channelTitle: 'Lettres & Langue',
    channelId: 'UC_lettres_fr',
    publishedAt: '2023-10-05T11:00:00Z',
    thumbnail: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=600&auto=format&fit=crop&q=80',
    duration: '21:05',
    viewCount: 82500,
    categoryKey: 'education',
  },
  {
    videoId: 'rfscVS0vtbw',
    title: 'Apprendre la Programmation Python en partant de zéro (Débutant complet)',
    description: 'Tutoriel complet pour apprendre à coder en Python : variables, boucles, conditions et fonctions.',
    channelTitle: 'Tech Afrique Code',
    channelId: 'UC_tech_code',
    publishedAt: '2024-02-12T16:00:00Z',
    thumbnail: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=80',
    duration: '32:40',
    viewCount: 210000,
    categoryKey: 'technologie',
  },
  {
    videoId: 'dpw9EHDh2bM',
    title: 'Intelligence Artificielle et Robotique : L\'avenir technologique',
    description: 'Comment l\'IA transforme l\'éducation, l\'agriculture et la médecine en Afrique et dans le monde.',
    channelTitle: 'Innovations Digitales',
    channelId: 'UC_innovations_ia',
    publishedAt: '2024-03-01T12:00:00Z',
    thumbnail: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=600&auto=format&fit=crop&q=80',
    duration: '19:15',
    viewCount: 134000,
    categoryKey: 'technologie',
  },
  {
    videoId: '4f4lT2kP-5M',
    title: 'Musique Traditionnelle et Acoustique d\'Afrique de l\'Ouest (Kora, Balafon, Djembé)',
    description: 'Une immersion sonore apaisante et inspirante dans le patrimoine musical d\'Afrique subsaharienne.',
    channelTitle: 'Rythmes d\'Afrique',
    channelId: 'UC_musique_afrique',
    publishedAt: '2023-08-14T18:00:00Z',
    thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
    duration: '45:10',
    viewCount: 389000,
    categoryKey: 'musique',
  },
  {
    videoId: '7wtfhZwyrcc',
    title: 'Entraînement Athlétique & Préparation Physique Scolaire',
    description: 'Exercices d\'échauffement, endurance et agilité pour les cours d\'EPS et les sportifs en herbe.',
    channelTitle: 'Sport & Santé Éducation',
    channelId: 'UC_sport_sante',
    publishedAt: '2023-12-05T08:00:00Z',
    thumbnail: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=600&auto=format&fit=crop&q=80',
    duration: '14:22',
    viewCount: 54000,
    categoryKey: 'sport',
  },
  {
    videoId: 'g7Y_Z7g3q5s',
    title: 'L\'essor de l\'Éducation Numérique en Afrique — Grand Reportage',
    description: 'Documentaire captivant sur les écoles connectées, la digitalisation scolaire et les réussites locales.',
    channelTitle: 'Afrique Horizons',
    channelId: 'UC_afrique_horizons',
    publishedAt: '2024-02-18T19:30:00Z',
    thumbnail: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=600&auto=format&fit=crop&q=80',
    duration: '26:50',
    viewCount: 178000,
    categoryKey: 'actualites',
  },
  {
    videoId: '26U_seo0a1g',
    title: 'Comment mémoriser plus vite et réussir ses examens sans stress',
    description: 'Techniques prouvées de révision active, carte mentale et gestion du temps de travail.',
    channelTitle: 'Réussite Scolaire',
    channelId: 'UC_reussite_scolaire',
    publishedAt: '2024-01-25T11:00:00Z',
    thumbnail: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&auto=format&fit=crop&q=80',
    duration: '16:45',
    viewCount: 112000,
    categoryKey: 'dev-perso',
  },
  {
    videoId: 'fL2A1v7b2aE',
    title: 'Quiz de Culture Générale Spécial Écoles & Collèges',
    description: '30 questions amusantes pour tester vos connaissances en géographie, sciences, histoire et littérature.',
    channelTitle: 'Culture & Jeux',
    channelId: 'UC_culture_quiz',
    publishedAt: '2023-09-28T15:00:00Z',
    thumbnail: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80',
    duration: '12:35',
    viewCount: 95000,
    categoryKey: 'divertissement',
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

// ───────────────────────── Recherche ─────────────────────────
const ORDERS = ['relevance', 'date', 'viewCount', 'rating', 'title']
const DURATIONS = ['', 'short', 'medium', 'long', 'any']

async function search({ q, pageToken = '', order = 'relevance', videoDuration = '', maxResults = 24 }) {
  const cfg = await resolveConfig()
  if (!cfg.enabled) throw typedError('disabled', 'disabled', 503)

  const ord = ORDERS.includes(order) ? order : 'relevance'
  const dur = DURATIONS.includes(videoDuration) ? videoDuration : ''
  const mr = Math.min(Math.max(Number(maxResults) || 24, 1), 50)

  const key = 'search:' + JSON.stringify({ q, pageToken, ord, dur, mr })
  const cached = cacheGet(key)
  if (cached) return cached

  // Si pas de clé API configurée, renvoie immédiatement les vidéos de la catégorie sans erreur 503
  if (!cfg.apiKey) {
    return getFallbackResults(q)
  }

  try {
    const searchData = await ytFetch('/search', {
      part: 'snippet', type: 'video', q, maxResults: mr, order: ord, pageToken,
      videoDuration: dur || undefined, safeSearch: 'moderate',
    }, cfg.apiKey)

    const ids = (searchData.items || []).map((it) => it.id && it.id.videoId).filter(Boolean)
    const detailsById = {}
    if (ids.length) {
      try {
        const vids = await ytFetch('/videos', { part: 'contentDetails,statistics,snippet', id: ids.join(',') }, cfg.apiKey)
        for (const v of (vids.items || [])) detailsById[v.id] = v
      } catch (_) { /* continuer avec les snippets */ }
    }

    const items = (searchData.items || []).map((it) => {
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

    if (items.length === 0 && !pageToken) {
      return getFallbackResults(q)
    }

    const result = { items, nextPageToken: searchData.nextPageToken || '', prevPageToken: searchData.prevPageToken || '' }
    cacheSet(key, result, cfg.cacheTtl)
    return result
  } catch (err) {
    console.warn('[youtube] Recherche YouTube en direct échouée (' + err.message + ') → repli vers les vidéos intégrées.')
    return getFallbackResults(q)
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
  { key: 'education', label: 'Éducation', emoji: '🎓', query: 'éducation cours' },
  { key: 'cours', label: 'Cours', emoji: '📚', query: 'cours scolaire' },
  { key: 'musique', label: 'Musique', emoji: '🎵', query: 'musique' },
  { key: 'sport', label: 'Sport', emoji: '⚽', query: 'sport' },
  { key: 'gaming', label: 'Gaming', emoji: '🎮', query: 'gaming jeux vidéo' },
  { key: 'technologie', label: 'Technologie', emoji: '💻', query: 'technologie' },
  { key: 'actualites', label: 'Actualités', emoji: '🌍', query: 'actualités' },
  { key: 'divertissement', label: 'Divertissement', emoji: '😂', query: 'divertissement' },
  { key: 'dev-perso', label: 'Développement personnel', emoji: '🧠', query: 'développement personnel motivation' },
]
function categories() { return CATEGORIES }

module.exports = { resolveConfig, search, videoDetails, related, categories, isoDurationToLabel }
