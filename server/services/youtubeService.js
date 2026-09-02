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

// ───────────────────────── Recherche ─────────────────────────
const ORDERS = ['relevance', 'date', 'viewCount', 'rating', 'title']
const DURATIONS = ['', 'short', 'medium', 'long', 'any']

async function search({ q, pageToken = '', order = 'relevance', videoDuration = '', maxResults = 24 }) {
  const cfg = await resolveConfig()
  if (!cfg.enabled) throw typedError('disabled', 'disabled', 503)
  if (!cfg.apiKey) throw typedError('noKey', 'noKey', 503)
  const ord = ORDERS.includes(order) ? order : 'relevance'
  const dur = DURATIONS.includes(videoDuration) ? videoDuration : ''
  const mr = Math.min(Math.max(Number(maxResults) || 24, 1), 50)

  const key = 'search:' + JSON.stringify({ q, pageToken, ord, dur, mr })
  const cached = cacheGet(key)
  if (cached) return cached

  const searchData = await ytFetch('/search', {
    part: 'snippet', type: 'video', q, maxResults: mr, order: ord, pageToken,
    videoDuration: dur || undefined, safeSearch: 'moderate',
  }, cfg.apiKey)

  const ids = (searchData.items || []).map((it) => it.id && it.id.videoId).filter(Boolean)
  const detailsById = {}
  if (ids.length) {
    const vids = await ytFetch('/videos', { part: 'contentDetails,statistics,snippet', id: ids.join(',') }, cfg.apiKey)
    for (const v of (vids.items || [])) detailsById[v.id] = v
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

  const result = { items, nextPageToken: searchData.nextPageToken || '', prevPageToken: searchData.prevPageToken || '' }
  cacheSet(key, result, cfg.cacheTtl)
  return result
}

// ───────────────────────── Détails d'une vidéo ─────────────────────────
async function videoDetails(videoId) {
  const cfg = await resolveConfig()
  if (!cfg.apiKey) throw typedError('noKey', 'noKey', 503)
  const key = 'video:' + videoId
  const cached = cacheGet(key)
  if (cached) return cached
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
    // status.embeddable = false → la vidéo interdit l'intégration externe.
    embeddable: v.status ? v.status.embeddable !== false : true,
    tags: sn.tags || [],
  }
  cacheSet(key, out, cfg.cacheTtl)
  return out
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
