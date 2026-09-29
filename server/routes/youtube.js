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

// GET /api/youtube/search?q=&pageToken=&order=&duration= (si q est vide, renvoie le flux d'accueil YouTube)
router.get('/search', protect, async (req, res) => {
  try {
    if (searchRateLimited(req.user._id)) return res.status(429).json({ message: 'Trop de recherches. Réessayez dans un instant.' })
    const q = String(req.query.q || '').trim()
    const cfg = await youtube.resolveConfig()
    if (q && q.length > (cfg.maxSearchLen || 120)) return res.status(400).json({ message: 'Terme de recherche trop long.' })
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

const { Readable } = require('stream')
const { Innertube, Platform } = require('youtubei.js')

// Évaluateur JavaScript requis par youtubei.js pour déchiffrer les signatures de flux
Platform.shim.eval = async (data, env) => {
  const code = data.output + '\nreturn { ...env }'
  return new Function('env', code)(env)
}

let innertubeInstance = null
let innertubePromise = null
async function getInnertube() {
  if (innertubeInstance) return innertubeInstance
  if (!innertubePromise) {
    innertubePromise = Innertube.create({ generate_session_locally: true })
      .then((yt) => {
        innertubeInstance = yt
        return yt
      })
      .catch((err) => {
        innertubePromise = null
        throw err
      })
  }
  return innertubePromise
}

// GET /api/youtube/download/:videoId — télécharge directement la vidéo dans l'appareil
// de l'utilisateur (flux MP4 natif audio+vidéo) SANS AUCUNE REDIRECTION vers un site tiers.
router.get('/download/:videoId', protect, async (req, res) => {
  const videoId = req.params.videoId
  if (!VIDEO_ID_RE.test(videoId)) return res.status(400).json({ message: 'Identifiant vidéo invalide.' })
  try {
    const cfg = await youtube.resolveConfig()
    if (cfg.downloadEnabled === false) return res.status(403).json({ message: 'Le téléchargement des vidéos est désactivé.' })
  } catch (_) { /* on continue : repli permissif */ }
  if (downloadRateLimited(req.user._id)) return res.status(429).json({ message: 'Trop de téléchargements. Réessayez dans un instant.' })

  try {
    const yt = await getInnertube()

    // Récupération du titre réel pour nommer proprement le fichier MP4 téléchargé
    let title = videoId
    try {
      const basic = await yt.getBasicInfo(videoId)
      const raw = basic?.basic_info?.title || ''
      if (raw) title = raw.replace(/[^\w\s.-]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || videoId
    } catch (_) {}

    // Obtenir le flux MP4 direct audio+vidéo
    let stream = null
    try {
      stream = await yt.download(videoId, { type: 'video+audio', quality: 'best' })
    } catch (e1) {
      try {
        stream = await yt.download(videoId, { client: 'ANDROID', type: 'video+audio', quality: 'best' })
      } catch (e2) {
        try {
          stream = await yt.download(videoId, { client: 'ANDROID_VR', type: 'video+audio' })
        } catch (e3) {
          stream = await yt.download(videoId, { quality: 'best' })
        }
      }
    }

    if (!stream) {
      throw new Error('Aucun flux vidéo direct accessible.')
    }

    const filename = `${title}.mp4`
    res.setHeader('Content-Type', 'video/mp4')
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}"`)

    const nodeStream = Readable.fromWeb(stream)
    nodeStream.on('error', (err) => {
      console.warn('[youtube] download stream error:', err.message)
      try { res.destroy() } catch (_) {}
    })
    req.on('close', () => {
      try { nodeStream.destroy() } catch (_) {}
    })

    nodeStream.pipe(res)
  } catch (err) {
    console.error('[youtube] download direct stream failed (' + err.message + ')')
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Téléchargement direct impossible pour cette vidéo. Veuillez réessayer.' })
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
