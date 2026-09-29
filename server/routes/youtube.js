// routes/youtube.js — API YouTube (espace utilisateur). Toutes les routes exigent l'authentification.
// La clé API vit uniquement dans youtubeService (DB chiffrée → env) : jamais exposée au client.
const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/auth')
const youtube = require('../services/youtubeService')
const YouTubeFavorite = require('../models/YouTubeFavorite')
const YouTubeHistory = require('../models/YouTubeHistory')
const SchoolPost = require('../models/SchoolPost')

const VIDEO_ID_RE = /^[\w-]{11}$/
const HISTORY_CAP = 100

// ── Rate-limit ciblé sur la recherche (Map mémoire par utilisateur ; aucune dépendance) ──
const RL_MAX = 20
const RL_WINDOW_MS = 60 * 1000
const rlHits = new Map()
function searchRateLimited(userId) {
  const now = Date.now()
  const arr = (rlHits.get(String(userId)) || []).filter((t) => now - t < RL_WINDOW_MS)
  if (arr.length >= RL_MAX) { rlHits.set(String(userId), arr); return true }
  arr.push(now); rlHits.set(String(userId), arr); return false
}

// ── Rate-limit dédié au téléchargement (opération lourde : 5/min/utilisateur) ──
const DL_MAX = 5
const dlHits = new Map()
function downloadRateLimited(userId) {
  const now = Date.now()
  const arr = (dlHits.get(String(userId)) || []).filter((t) => now - t < RL_WINDOW_MS)
  if (arr.length >= DL_MAX) { dlHits.set(String(userId), arr); return true }
  arr.push(now); dlHits.set(String(userId), arr); return false
}

// Traduit une erreur du service en réponse utilisateur explicite
function handleYtError(res, err) {
  const code = err && err.code
  if (code === 'noKey') {
    return res.status(503).json({ code: 'noKey', message: "L'API YouTube n'est pas encore configurée. Ajoutez votre clé API dans l'administration (Plateforme > Clés API)." })
  }
  if (code === 'keyInvalid') {
    return res.status(502).json({ code: 'keyInvalid', message: "La clé API YouTube est invalide ou restreinte dans Google Cloud Console. Veillez à activer 'YouTube Data API v3' sans restriction de domaine web." })
  }
  if (code === 'quotaExceeded') {
    return res.status(503).json({ code: 'quotaExceeded', message: "Le quota journalier de l'API YouTube a été atteint. Il se réinitialise à minuit." })
  }
  if (code === 'disabled') {
    return res.status(503).json({ code: 'disabled', message: "Le service vidéo est temporairement désactivé par l'administrateur." })
  }
  if (code === 'notFound') return res.status(404).json({ message: 'Vidéo introuvable.' })
  return res.status((err && err.status) || 500).json({ message: err?.message || 'Erreur du service vidéo.' })
}

// GET /api/youtube/categories — liste de catégories rapides (statique côté serveur)
router.get('/categories', protect, (req, res) => {
  res.json({ success: true, categories: youtube.categories() })
})

// GET /api/youtube/search?q=&pageToken=&order=&duration=
router.get('/search', protect, async (req, res) => {
  try {
    if (searchRateLimited(req.user._id)) return res.status(429).json({ message: 'Trop de recherches. Réessayez dans un instant.' })
    const q = String(req.query.q || '').trim()
    if (!q) return res.status(400).json({ message: 'Terme de recherche requis.' })
    const cfg = await youtube.resolveConfig()
    if (q.length > (cfg.maxSearchLen || 120)) return res.status(400).json({ message: 'Terme de recherche trop long.' })
    const data = await youtube.search({
      q,
      pageToken: String(req.query.pageToken || ''),
      order: String(req.query.order || 'relevance'),
      videoDuration: String(req.query.duration || ''),
    })
    res.json({ success: true, ...data })
  } catch (err) { handleYtError(res, err) }
})

// GET /api/youtube/videos/:videoId — détails d'une vidéo
router.get('/videos/:videoId', protect, async (req, res) => {
  try {
    if (!VIDEO_ID_RE.test(req.params.videoId)) return res.status(400).json({ message: 'Identifiant vidéo invalide.' })
    const video = await youtube.videoDetails(req.params.videoId)
    res.json({ success: true, video })
  } catch (err) { handleYtError(res, err) }
})

// GET /api/youtube/related/:videoId — vidéos similaires (best-effort)
router.get('/related/:videoId', protect, async (req, res) => {
  try {
    if (!VIDEO_ID_RE.test(req.params.videoId)) return res.status(400).json({ message: 'Identifiant vidéo invalide.' })
    const data = await youtube.related(req.params.videoId)
    res.json({ success: true, ...data })
  } catch (err) { handleYtError(res, err) }
})

// GET /api/youtube/ad-config — réglages publicité/téléchargement (NON secrets : l'ID éditeur
// AdSense figure de toute façon dans la page). Sert au « gate » publicitaire avant téléchargement.
router.get('/ad-config', protect, async (req, res) => {
  try {
    const cfg = await youtube.resolveConfig()
    res.json({
      success: true,
      downloadEnabled: cfg.downloadEnabled !== false,
      adsenseClient: cfg.adsenseClient || '',
      adSlot: cfg.adSlot || '',
      adCountdown: Number(cfg.adCountdown) > 0 ? Number(cfg.adCountdown) : 5,
    })
  } catch (err) { res.json({ success: true, downloadEnabled: true, adsenseClient: '', adSlot: '', adCountdown: 5 }) }
})

// Helper pour générer les miroirs de téléchargement directs et rapides
function getDownloadMirrors(vid, rawTitle = '') {
  const title = (rawTitle || vid).replace(/[^\w\s.-]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || vid
  return {
    success: true,
    fallback: true,
    videoId: vid,
    title,
    mirrors: [
      { id: 'ssyoutube', name: 'Miroir Rapide 1 (MP4 direct)', url: `https://www.ssyoutube.com/watch?v=${vid}` },
      { id: 'y2mate', name: 'Miroir Rapide 2 (1080p / 720p / MP4)', url: `https://www.y2mate.is/en/youtube-downloader/${vid}` },
      { id: '10downloader', name: 'Miroir Rapide 3 (MP4 HD)', url: `https://10downloader.com/download?v=${vid}` },
    ]
  }
}

// GET /api/youtube/download/:videoId — télécharge la vidéo (flux MP4 progressif audio+vidéo,
// ≤720p, sans ffmpeg) avec bascule automatique vers miroirs directs si YouTube bloque le serveur hôte.
router.get('/download/:videoId', protect, async (req, res) => {
  const videoId = req.params.videoId
  if (!VIDEO_ID_RE.test(videoId)) return res.status(400).json({ message: 'Identifiant vidéo invalide.' })
  try {
    const cfg = await youtube.resolveConfig()
    if (cfg.downloadEnabled === false) return res.status(403).json({ message: 'Le téléchargement des vidéos est désactivé.' })
  } catch (_) { /* on continue : repli permissif */ }
  if (downloadRateLimited(req.user._id)) return res.status(429).json({ message: 'Trop de téléchargements. Réessayez dans un instant.' })

  let ytdl
  try { ytdl = require('@distube/ytdl-core') }
  catch (e) { return res.json(getDownloadMirrors(videoId)) }

  const url = 'https://www.youtube.com/watch?v=' + videoId
  try {
    // Timeout de 6 secondes pour éviter de bloquer l'utilisateur si YouTube throttle l'IP hôte
    const infoPromise = ytdl.getInfo(url, {
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
        }
      }
    })
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 6000))
    const info = await Promise.race([infoPromise, timeoutPromise])

    const raw = (info.videoDetails && info.videoDetails.title) || videoId
    const title = raw.replace(/[^\w\s.-]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || videoId
    res.setHeader('Content-Type', 'video/mp4')
    res.setHeader('Content-Disposition', `attachment; filename="${title}.mp4"`)
    const stream = ytdl.downloadFromInfo(info, { filter: 'audioandvideo', quality: 'highest' })
    stream.on('error', (err) => {
      console.warn('[youtube] download stream error:', err.message)
      if (!res.headersSent) {
        res.json(getDownloadMirrors(videoId, title))
      } else {
        try { res.destroy() } catch (_) {}
      }
    })
    req.on('close', () => { try { stream.destroy() } catch (_) {} })
    stream.pipe(res)
  } catch (err) {
    console.warn('[youtube] download direct stream failed (' + err.message + ') -> repli automatique miroirs')
    if (!res.headersSent) {
      res.json(getDownloadMirrors(videoId))
    }
  }
})

// ───────────────────────── FAVORIS ─────────────────────────
router.get('/favorites', protect, async (req, res) => {
  try {
    const rows = await YouTubeFavorite.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(200)
    res.json({ success: true, data: rows })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

router.post('/favorites', protect, async (req, res) => {
  try {
    const { videoId, title, thumbnail, channelTitle } = req.body
    if (!VIDEO_ID_RE.test(String(videoId || ''))) return res.status(400).json({ message: 'Identifiant vidéo invalide.' })
    const doc = await YouTubeFavorite.findOneAndUpdate(
      { user: req.user._id, youtubeVideoId: videoId },
      { $set: { title: title || '', thumbnail: thumbnail || '', channelTitle: channelTitle || '' } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
    res.status(201).json({ success: true, data: doc })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

router.delete('/favorites/:videoId', protect, async (req, res) => {
  try {
    await YouTubeFavorite.deleteOne({ user: req.user._id, youtubeVideoId: req.params.videoId })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ───────────────────────── HISTORIQUE ─────────────────────────
router.get('/history', protect, async (req, res) => {
  try {
    const rows = await YouTubeHistory.find({ user: req.user._id }).sort({ watchedAt: -1 }).limit(HISTORY_CAP)
    res.json({ success: true, data: rows })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

router.post('/history', protect, async (req, res) => {
  try {
    const { videoId, title, thumbnail, channelTitle } = req.body
    if (!VIDEO_ID_RE.test(String(videoId || ''))) return res.status(400).json({ message: 'Identifiant vidéo invalide.' })
    await YouTubeHistory.findOneAndUpdate(
      { user: req.user._id, youtubeVideoId: videoId },
      { $set: { title: title || '', thumbnail: thumbnail || '', channelTitle: channelTitle || '', watchedAt: new Date() } },
      { upsert: true, setDefaultsOnInsert: true }
    )
    // Purge best-effort au-delà de la limite (garde les HISTORY_CAP plus récentes).
    const extra = await YouTubeHistory.find({ user: req.user._id }).sort({ watchedAt: -1 }).skip(HISTORY_CAP).select('_id')
    if (extra.length) await YouTubeHistory.deleteMany({ _id: { $in: extra.map((e) => e._id) } })
    res.status(201).json({ success: true })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

router.delete('/history', protect, async (req, res) => {
  try {
    await YouTubeHistory.deleteMany({ user: req.user._id })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ───────────────────────── PARTAGE DANS LE FIL KATD ─────────────────────────
// Crée une publication SchoolPost de type 'youtube' (lecteur intégré dans le feed).
// On ne télécharge JAMAIS la vidéo : uniquement les métadonnées + l'identifiant.
router.post('/share', protect, async (req, res) => {
  try {
    const { videoId, title, thumbnail, channelTitle, caption } = req.body
    if (!VIDEO_ID_RE.test(String(videoId || ''))) return res.status(400).json({ message: 'Identifiant vidéo invalide.' })
    const post = await SchoolPost.create({
      school: req.user.school?._id || req.user.school || null,
      author: req.user._id,
      content: caption || title || 'Vidéo YouTube',
      title: title || '',
      type: 'youtube',
      youtubeVideoId: videoId,
      channelTitle: channelTitle || '',
      thumbnail: thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      isPublic: true,
      isPlatform: req.user.role === 'super_admin',
    })
    const populated = await post.populate('author', 'name avatar')
    res.status(201).json({ success: true, data: populated })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
