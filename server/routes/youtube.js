const express = require('express')
const router = express.Router()
const { protect, protectOptional } = require('../middleware/auth')
const youtube = require('../services/youtubeService')
const YouTubeFavorite = require('../models/YouTubeFavorite')
const YouTubeHistory = require('../models/YouTubeHistory')
const SchoolPost = require('../models/SchoolPost')

const VIDEO_ID_RE = /^[\w-]{11}$/
const HISTORY_CAP = 100

// ── Rate-limit ciblé sur la recherche (Map mémoire par utilisateur/IP) ──
const RL_MAX = 30
const RL_WINDOW_MS = 60 * 1000
const rlHits = new Map()
function searchRateLimited(userOrIp) {
  const key = String(userOrIp || 'anon')
  const now = Date.now()
  const arr = (rlHits.get(key) || []).filter((t) => now - t < RL_WINDOW_MS)
  if (arr.length >= RL_MAX) { rlHits.set(key, arr); return true }
  arr.push(now); rlHits.set(key, arr); return false
}

// ── Rate-limit dédié au téléchargement (opération lourde : 8/min/utilisateur) ──
const DL_MAX = 8
const dlHits = new Map()
function downloadRateLimited(userOrIp) {
  const key = String(userOrIp || 'anon')
  const now = Date.now()
  const arr = (dlHits.get(key) || []).filter((t) => now - t < RL_WINDOW_MS)
  if (arr.length >= DL_MAX) { dlHits.set(key, arr); return true }
  arr.push(now); dlHits.set(key, arr); return false
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

// GET /api/youtube/categories — liste de catégories rapides (accessible publiquement)
router.get('/categories', protectOptional, (req, res) => {
  res.json({ success: true, categories: youtube.categories() })
})

// GET /api/youtube/search?q=&pageToken=&order=&duration= (accessible publiquement)
router.get('/search', protectOptional, async (req, res) => {
  try {
    const rateKey = req.user?._id || req.ip || 'anon'
    if (searchRateLimited(rateKey)) return res.status(429).json({ message: 'Trop de recherches. Réessayez dans un instant.' })
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

// GET /api/youtube/videos/:videoId — détails d'une vidéo (accessible publiquement)
router.get('/videos/:videoId', protectOptional, async (req, res) => {
  try {
    if (!VIDEO_ID_RE.test(req.params.videoId)) return res.status(400).json({ message: 'Identifiant vidéo invalide.' })
    const video = await youtube.videoDetails(req.params.videoId)
    res.json({ success: true, video })
  } catch (err) { handleYtError(res, err) }
})

// GET /api/youtube/related/:videoId — vidéos similaires (accessible publiquement)
router.get('/related/:videoId', protectOptional, async (req, res) => {
  try {
    if (!VIDEO_ID_RE.test(req.params.videoId)) return res.status(400).json({ message: 'Identifiant vidéo invalide.' })
    const data = await youtube.related(req.params.videoId)
    res.json({ success: true, ...data })
  } catch (err) { handleYtError(res, err) }
})

// GET /api/youtube/ad-config — réglages publicité AdSense & AdMob (accessible publiquement)
router.get('/ad-config', protectOptional, async (req, res) => {
  try {
    const cfg = await youtube.resolveConfig()
    res.json({
      success: true,
      downloadEnabled: cfg.downloadEnabled !== false,
      adsenseClient: cfg.adsenseClient || '',
      adSlot: cfg.adSlot || '',
      adCountdown: Number(cfg.adCountdown) > 0 ? Number(cfg.adCountdown) : 5,
      admobEnabled: cfg.admobEnabled !== false,
      admobAppId: cfg.admobAppId || '',
      admobBannerSlot: cfg.admobBannerSlot || '',
      admobInterstitialSlot: cfg.admobInterstitialSlot || '',
      admobRewardedSlot: cfg.admobRewardedSlot || '',
    })
  } catch (err) {
    res.json({
      success: true,
      downloadEnabled: true,
      adsenseClient: '',
      adSlot: '',
      adCountdown: 5,
      admobEnabled: false,
      admobAppId: '',
      admobBannerSlot: '',
      admobInterstitialSlot: '',
      admobRewardedSlot: '',
    })
  }
})

// ───────────────────────── MOTEUR DE TÉLÉCHARGEMENT MULTI-FORMAT (SNAPTUBE ENGINE) ─────────────────────────
// Normalise les formats demandés (musique: mp3, m4a ; vidéo: 360, 480, 720, 1080)
function normalizeDownloadFormat(format, quality) {
  const f = String(format || '').toLowerCase().trim()
  const q = String(quality || '').toLowerCase().trim()
  if (f === 'm4a' || q === 'm4a') return 'm4a'
  if (f.includes('mp3') || f === 'music' || f === 'audio') return 'mp3'
  if (f === '360' || q === '360p' || q === '360') return '360'
  if (f === '480' || q === '480p' || q === '480') return '480'
  if (f === '1080' || q === '1080p' || q === '1080') return '1080'
  return '720' // Qualité vidéo par défaut : 720p HD
}

// 1. Initialise la tâche de conversion
async function initDownloadJob(videoId, format) {
  const fmt = normalizeDownloadFormat(format)
  const initUrl = `https://loader.to/ajax/download.php?button=1&start=1&end=1&format=${encodeURIComponent(fmt)}&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`

  const res = await fetch(initUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`Moteur de conversion indisponible (${res.status})`)
  const data = await res.json()
  if (!data || !data.success) throw new Error(data?.message || 'Impossible d\'initialiser le téléchargement.')
  return {
    id: data.id,
    progressUrl: data.progress_url,
    title: data.title || '',
    format: fmt,
  }
}

// 2. Vérifie la progression d'un téléchargement en cours
async function pollDownloadProgress(progressUrl) {
  const res = await fetch(progressUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`Erreur lors du suivi de conversion (${res.status})`)
  const data = await res.json()
  return {
    progress: Number(data.progress) || 0,
    text: data.text || '',
    downloadUrl: data.download_url || null,
    title: data.title || '',
    format: data.format || '',
  }
}

// POST /api/youtube/download/init — Démarre la préparation d'un fichier audio ou vidéo
router.post('/download/init', protectOptional, async (req, res) => {
  const { videoId, format, quality } = req.body || {}
  if (!VIDEO_ID_RE.test(String(videoId || ''))) return res.status(400).json({ message: 'Identifiant vidéo invalide.' })
  try {
    const cfg = await youtube.resolveConfig()
    if (cfg.downloadEnabled === false) return res.status(403).json({ message: 'Le téléchargement des vidéos est désactivé.' })
  } catch (_) {}
  const rateKey = req.user?._id || req.ip || 'anon'
  if (downloadRateLimited(rateKey)) return res.status(429).json({ message: 'Trop de requêtes de téléchargement. Réessayez dans un instant.' })

  try {
    const job = await initDownloadJob(videoId, format || quality)
    res.json({ success: true, ...job })
  } catch (err) {
    console.error('[youtube] download init error:', err.message)
    res.status(502).json({ success: false, message: 'Impossible d\'initialiser la conversion du fichier. Réessayez.' })
  }
})

// GET /api/youtube/download/progress — Vérifie l'état de conversion pour la barre de progression SnapTube
router.get('/download/progress', protectOptional, async (req, res) => {
  const progressUrl = String(req.query.url || '').trim()
  if (!progressUrl) return res.status(400).json({ message: 'URL de suivi manquante.' })

  // Sécurité : autoriser uniquement les domaines du moteur de conversion
  try {
    const parsed = new URL(progressUrl)
    const allowed = ['loader.to', 'affadaffa.com', 'savenow.to', 'oceansaver.net']
    if (!allowed.some((d) => parsed.hostname === d || parsed.hostname.endsWith('.' + d))) {
      return res.status(400).json({ message: 'Domaine de conversion non autorisé.' })
    }
  } catch (_) {
    return res.status(400).json({ message: 'URL de progression invalide.' })
  }

  try {
    const status = await pollDownloadProgress(progressUrl)
    res.json({ success: true, ...status })
  } catch (err) {
    res.status(502).json({ success: false, message: err.message })
  }
})

// GET /api/youtube/download/:videoId — Téléchargement direct avec redirection 302 vers le flux préparé
// Compatible avec les liens <a href="..." download> directs sur mobile et PC
router.get('/download/:videoId', protectOptional, async (req, res) => {
  const videoId = req.params.videoId
  if (!VIDEO_ID_RE.test(videoId)) return res.status(400).json({ message: 'Identifiant vidéo invalide.' })
  try {
    const cfg = await youtube.resolveConfig()
    if (cfg.downloadEnabled === false) return res.status(403).json({ message: 'Le téléchargement des vidéos est désactivé.' })
  } catch (_) {}
  const rateKey = req.user?._id || req.ip || 'anon'
  if (downloadRateLimited(rateKey)) return res.status(429).json({ message: 'Trop de téléchargements. Réessayez dans un instant.' })

  const fmt = normalizeDownloadFormat(req.query.format, req.query.quality)

  try {
    const job = await initDownloadJob(videoId, fmt)
    const pUrl = job.progressUrl
    if (!pUrl) throw new Error('URL de conversion introuvable.')

    // Attend la fin de la conversion (jusqu'à 25 secondes)
    const maxWaitMs = 25000
    const start = Date.now()
    let finalUrl = null

    while (Date.now() - start < maxWaitMs) {
      await new Promise((r) => setTimeout(r, 1200))
      try {
        const pStatus = await pollDownloadProgress(pUrl)
        if (pStatus.downloadUrl) {
          finalUrl = pStatus.downloadUrl
          break
        }
      } catch (_) {}
    }

    if (!finalUrl) {
      return res.status(504).json({
        success: false,
        message: 'La conversion prend plus de temps que prévu. Veuillez utiliser la fenêtre de téléchargement pour suivre la progression.',
      })
    }

    // Redirection directe vers le fichier final avec Content-Disposition: attachment
    res.redirect(302, finalUrl)
  } catch (err) {
    console.error('[youtube] direct download failed:', err.message)
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Téléchargement direct impossible pour cette vidéo. Veuillez réessayer avec un autre format.' })
    }
  }
})

// GET /api/youtube/download-file?url=...&name=... — Relai de téléchargement pour forcer l'enregistrement direct
// Résout le problème des navigateurs mobiles qui bloquent les redirections tierces ou les balises <a> cross-origin.
router.get('/download-file', async (req, res) => {
  const fileUrl = String(req.query.url || '').trim()
  const rawName = String(req.query.name || 'katdtube-media').trim()
  if (!fileUrl) return res.status(400).send('URL de fichier manquante')

  try {
    const parsed = new URL(fileUrl)
    const allowed = ['loader.to', 'affadaffa.com', 'savenow.to', 'oceansaver.net']
    if (!allowed.some((d) => parsed.hostname === d || parsed.hostname.endsWith('.' + d))) {
      return res.status(400).send('Domaine non autorisé')
    }

    const safeFilename = rawName.replace(/[^\w\s.-]+/g, '_').slice(0, 100) || 'media.mp4'

    const remoteRes = await fetch(fileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!remoteRes.ok) {
      return res.redirect(302, fileUrl)
    }

    const contentType = remoteRes.headers.get('content-type') || 'application/octet-stream'
    const contentLength = remoteRes.headers.get('content-length')

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeFilename)}"`)
    res.setHeader('Content-Type', contentType)
    if (contentLength) res.setHeader('Content-Length', contentLength)

    const { Readable } = require('stream')
    if (remoteRes.body && typeof Readable.fromWeb === 'function') {
      Readable.fromWeb(remoteRes.body).pipe(res)
    } else {
      res.redirect(302, fileUrl)
    }
  } catch (err) {
    console.error('[youtube] download relay error:', err.message)
    try {
      res.redirect(302, fileUrl)
    } catch (_) {
      if (!res.headersSent) res.status(500).send('Erreur de téléchargement')
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
