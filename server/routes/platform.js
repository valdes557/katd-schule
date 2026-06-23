const express = require('express')
const router = express.Router()
const PlatformPage = require('../models/PlatformPage')
const SchoolPost = require('../models/SchoolPost')
const SchoolReview = require('../models/SchoolReview')
const PlatformPaymentMethod = require('../models/PlatformPaymentMethod')
const SubscriptionPlan = require('../models/SubscriptionPlan')
const Resource = require('../models/Resource')
const { protect, authorize } = require('../middleware/auth')
const { upload, videoThumbnailUrl } = require('../config/cloudinary')
const http = require('http')
const https = require('https')

// ===================== PLATFORM PAGE CONTENT =====================

// GET /api/platform — Public: get platform page content
router.get('/', async (req, res) => {
  try {
    let page = await PlatformPage.findOne()
    if (!page) page = await PlatformPage.create({})
    res.json({ success: true, data: page })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/platform — Super Admin: update platform page content
router.put('/', protect, authorize('super_admin'), async (req, res) => {
  try {
    let page = await PlatformPage.findOne()
    if (!page) page = await PlatformPage.create({})
    Object.assign(page, req.body)
    await page.save()
    res.json({ success: true, data: page })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/platform/upload — Super Admin: upload images
router.post('/upload', protect, authorize('super_admin'), upload.array('images', 5), async (req, res) => {
  try {
    const urls = req.files?.map((f) => f.path) || []
    res.json({ success: true, data: urls })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ===================== SOCIAL FEED (platform-level posts) =====================

// GET /api/platform/feed — Public: get all public posts (platform + all schools)
router.get('/feed', async (req, res) => {
  try {
    const { page = 1, limit = 20, category } = req.query
    const query = { isPublic: true }
    if (category) query.category = category
    const total = await SchoolPost.countDocuments(query)
    const posts = await SchoolPost.find(query)
      .populate('author', 'name avatar')
      .populate('school', 'name logo')
      .populate('comments.authorId', 'name avatar')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
    res.json({ success: true, total, data: posts })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/platform/posts — Super Admin, directors and teachers: create social post
router.post('/posts', protect, authorize('super_admin', 'directeur', 'enseignant'), upload.fields([{ name: 'images', maxCount: 5 }, { name: 'audio', maxCount: 1 }, { name: 'video', maxCount: 1 }]), async (req, res) => {
  try {
    const imageFiles = req.files?.images || []
    const images = imageFiles.map((f) => f.path)
    const videoFileObj = req.files?.video?.[0]
    const audioFile = req.files?.audio?.[0]?.path || ''
    const videoFile = videoFileObj?.path || ''
    const mediaType = req.body.mediaType || 'text'

    let type = 'text'
    let videoUrl = req.body.videoUrl || videoFile || ''
    let audioUrl = audioFile
    if (mediaType === 'audio' || audioFile) type = 'audio'
    else if (mediaType === 'video' || videoUrl) type = 'video'
    else if (images.length > 0 || mediaType === 'photo') type = 'photo'

    // Miniature : pour une vidéo, 1re frame Cloudinary ; sinon 1re image
    let thumbnail = req.body.thumbnail || ''
    if (type === 'video') thumbnail = videoThumbnailUrl(videoUrl) || thumbnail
    else if (images.length > 0) thumbnail = images[0]

    // Dimensions réelles du média principal (orientation portrait/paysage)
    const mainMedia = type === 'video' ? videoFileObj : imageFiles[0]
    const mediaWidth = mainMedia?.width
    const mediaHeight = mainMedia?.height
    const aspectRatio = mediaWidth && mediaHeight ? mediaWidth / mediaHeight : undefined

    const isPlatform = req.user.role === 'super_admin'
    const schoolId = !isPlatform && (req.user.school?._id || req.user.school) ? (req.user.school._id || req.user.school) : null

    const post = await SchoolPost.create({
      school: schoolId,
      author: req.user._id,
      content: req.body.content,
      title: req.body.title || '',
      category: req.body.category || '',
      images,
      thumbnail,
      type,
      mediaWidth,
      mediaHeight,
      aspectRatio,
      videoUrl: videoUrl || undefined,
      audioUrl: audioUrl || undefined,
      duration: req.body.duration || '',
      isPlatform,
      isPublic: true,
    })
    const populated = await post.populate('author', 'name avatar')
    res.status(201).json({ success: true, data: populated })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/platform/posts/:id — Super Admin: edit post
router.put('/posts/:id', protect, authorize('super_admin'), async (req, res) => {
  try {
    const { title, content, category, isPublic } = req.body
    const post = await SchoolPost.findByIdAndUpdate(
      req.params.id,
      { ...(title !== undefined && { title }), ...(content !== undefined && { content }), ...(category !== undefined && { category }), ...(isPublic !== undefined && { isPublic }) },
      { new: true }
    ).populate('author', 'name avatar')
    if (!post) return res.status(404).json({ message: 'Post non trouvé' })
    res.json({ success: true, data: post })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// DELETE /api/platform/posts/:id — Super Admin OU l'auteur de la publication
router.delete('/posts/:id', protect, async (req, res) => {
  try {
    const post = await SchoolPost.findById(req.params.id)
    if (!post) return res.status(404).json({ message: 'Post non trouvé' })
    const isAuthor = post.author?.toString() === req.user._id.toString()
    const isAdmin = req.user.role === 'super_admin'
    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ message: 'Vous ne pouvez supprimer que vos propres publications.' })
    }
    await post.deleteOne()
    res.json({ success: true, message: 'Post supprimé' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/platform/posts/:id/like — Authenticated user toggles like
router.put('/posts/:id/like', protect, async (req, res) => {
  try {
    const post = await SchoolPost.findById(req.params.id)
    if (!post) return res.status(404).json({ message: 'Post non trouvé' })
    const idx = post.likes.indexOf(req.user._id)
    if (idx > -1) post.likes.splice(idx, 1)
    else post.likes.push(req.user._id)
    await post.save()
    res.json({ success: true, data: post })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/platform/posts/:id/comment — Authenticated user comments
router.post('/posts/:id/comment', protect, async (req, res) => {
  try {
    const post = await SchoolPost.findById(req.params.id)
    if (!post) return res.status(404).json({ message: 'Post non trouvé' })
    post.comments.push({ author: req.user.name, authorId: req.user._id, content: req.body.content })
    await post.save()
    const populated = await post.populate([
      { path: 'author', select: 'name avatar' },
      { path: 'comments.authorId', select: 'name avatar' },
    ])
    res.json({ success: true, data: populated })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/platform/posts/:id/share — Increment share count (public)
router.put('/posts/:id/share', async (req, res) => {
  try {
    const post = await SchoolPost.findByIdAndUpdate(req.params.id, { $inc: { shares: 1 } }, { new: true })
    res.json({ success: true, data: post })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/platform/posts/:id/download — Increment download count (authenticated)
router.put('/posts/:id/download', protect, async (req, res) => {
  try {
    const post = await SchoolPost.findByIdAndUpdate(req.params.id, { $inc: { downloads: 1 } }, { new: true })
    res.json({ success: true, data: post })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/platform/proxy-download?url=...&filename=... — Authenticated: stream remote media with attachment
router.get('/proxy-download', protect, async (req, res) => {
  try {
    const src = req.query.url
    let filename = (req.query.filename || 'media').toString()
    if (!src) return res.status(400).json({ message: 'Paramètre url requis' })
    let u
    try { u = new URL(src) } catch (_) { return res.status(400).json({ message: 'URL invalide' }) }
    if (!/^https?:$/.test(u.protocol)) return res.status(400).json({ message: 'Protocole non supporté' })
    const host = u.hostname
    if (host === 'localhost' || host === '127.0.0.1' || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) {
      return res.status(400).json({ message: 'Hôte non autorisé' })
    }

    filename = filename.toLowerCase().replace(/[^a-z0-9-_.]+/g, '-').replace(/^-+|-+$/g, '') || 'media'

    const headers = {}
    const range = req.headers['range']
    if (range) headers['range'] = range

    const client = u.protocol === 'https:' ? https : http
    const remote = client.get({ hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80), path: u.pathname + (u.search || ''), headers }, (r) => {
      if ((r.statusCode || 0) >= 400) {
        res.status(r.statusCode || 502).end()
        return
      }
      const ct = r.headers['content-type'] || 'application/octet-stream'
      const cl = r.headers['content-length']
      const ar = r.headers['accept-ranges']
      const cr = r.headers['content-range']

      const outHeaders = {
        'Content-Type': ct,
        'Content-Disposition': `attachment; filename="${filename}"`,
      }
      if (cl) outHeaders['Content-Length'] = cl
      if (ar) outHeaders['Accept-Ranges'] = ar
      if (cr) outHeaders['Content-Range'] = cr

      const status = r.statusCode === 206 ? 206 : 200
      res.writeHead(status, outHeaders)
      r.pipe(res)
    })
    remote.on('error', () => res.status(502).json({ message: 'Erreur de téléchargement' }))
    remote.setTimeout(15000, () => { try { remote.destroy(new Error('timeout')) } catch (_) {} })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/platform/posts/:id/view — Increment view count
router.put('/posts/:id/view', async (req, res) => {
  try {
    const post = await SchoolPost.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } }, { new: true })
    res.json({ success: true, data: post })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ===================== EXPERIENCES (Testimonials) =====================

// GET /api/platform/experiences — Public: approved reviews for the platform
router.get('/experiences', async (req, res) => {
  try {
    const reviews = await SchoolReview.find({ school: null, isApproved: true }).sort({ createdAt: -1 })
    res.json({ success: true, data: reviews })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/platform/experiences — Public: submit platform-level review
router.post('/experiences', async (req, res) => {
  try {
    const review = await SchoolReview.create({ ...req.body, school: null })
    res.status(201).json({ success: true, message: 'Témoignage soumis, en attente de validation.', data: review })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/platform/experiences/all — Super Admin: all reviews
router.get('/experiences/all', protect, authorize('super_admin'), async (req, res) => {
  try {
    const reviews = await SchoolReview.find({ school: null }).sort({ createdAt: -1 })
    res.json({ success: true, data: reviews })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/platform/experiences/:id/approve — Super Admin
router.put('/experiences/:id/approve', protect, authorize('super_admin'), async (req, res) => {
  try {
    const review = await SchoolReview.findByIdAndUpdate(req.params.id, { isApproved: true }, { new: true })
    res.json({ success: true, data: review })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// DELETE /api/platform/experiences/:id — Super Admin
router.delete('/experiences/:id', protect, authorize('super_admin'), async (req, res) => {
  try {
    await SchoolReview.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: 'Témoignage supprimé' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ===================== PAYMENT METHODS =====================

// GET /api/platform/payment-methods — Public
router.get('/payment-methods', async (req, res) => {
  try {
    const methods = await PlatformPaymentMethod.find({ isActive: true }).sort({ sortOrder: 1, createdAt: 1 })
    res.json({ success: true, data: methods })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/platform/payment-methods/all — Super Admin (includes inactive)
router.get('/payment-methods/all', protect, authorize('super_admin'), async (req, res) => {
  try {
    const methods = await PlatformPaymentMethod.find().sort({ sortOrder: 1, createdAt: 1 })
    res.json({ success: true, data: methods })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/platform/payment-methods — Super Admin
router.post('/payment-methods', protect, authorize('super_admin'), async (req, res) => {
  try {
    const method = await PlatformPaymentMethod.create(req.body)
    res.status(201).json({ success: true, data: method })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/platform/payment-methods/:id — Super Admin
router.put('/payment-methods/:id', protect, authorize('super_admin'), async (req, res) => {
  try {
    const method = await PlatformPaymentMethod.findByIdAndUpdate(req.params.id, req.body, { new: true })
    res.json({ success: true, data: method })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// DELETE /api/platform/payment-methods/:id — Super Admin
router.delete('/payment-methods/:id', protect, authorize('super_admin'), async (req, res) => {
  try {
    await PlatformPaymentMethod.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: 'Méthode supprimée' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ===================== SUBSCRIPTION PLANS =====================

// GET /api/platform/plans — Public: list active plans
router.get('/plans', async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true }).sort({ sortOrder: 1, cycle: 1 })
    res.json({ success: true, data: plans })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/platform/plans/all — Super Admin: all plans
router.get('/plans/all', protect, authorize('super_admin'), async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find().sort({ sortOrder: 1, cycle: 1 })
    res.json({ success: true, data: plans })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/platform/plans — Super Admin
router.post('/plans', protect, authorize('super_admin'), async (req, res) => {
  try {
    const plan = await SubscriptionPlan.create(req.body)
    res.status(201).json({ success: true, data: plan })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/platform/plans/:id — Super Admin
router.put('/plans/:id', protect, authorize('super_admin'), async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findByIdAndUpdate(req.params.id, req.body, { new: true })
    res.json({ success: true, data: plan })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// DELETE /api/platform/plans/:id — Super Admin
router.delete('/plans/:id', protect, authorize('super_admin'), async (req, res) => {
  try {
    await SubscriptionPlan.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: 'Plan supprimé' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ===================== RESOURCES =====================

// GET /api/platform/resources — Public: list public resources
router.get('/resources', async (req, res) => {
  try {
    const { category } = req.query
    const query = { isPublic: true }
    if (category) query.category = category
    const resources = await Resource.find(query).sort({ createdAt: -1 })
    res.json({ success: true, data: resources })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/platform/resources/all — Super Admin: all resources
router.get('/resources/all', protect, authorize('super_admin'), async (req, res) => {
  try {
    const resources = await Resource.find().sort({ createdAt: -1 })
    res.json({ success: true, data: resources })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/platform/resources — Super Admin: create resource
router.post('/resources', protect, authorize('super_admin'), upload.single('file'), async (req, res) => {
  try {
    const fileUrl = req.file?.path || req.body.url || ''
    const resource = await Resource.create({
      title: req.body.title,
      description: req.body.description || '',
      type: req.body.type || 'document',
      category: req.body.category || 'Général',
      url: fileUrl,
      fileSize: req.body.fileSize || '',
      isPublic: req.body.isPublic !== 'false',
      author: req.user._id,
    })
    res.status(201).json({ success: true, data: resource })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/platform/resources/:id — Super Admin: update resource
router.put('/resources/:id', protect, authorize('super_admin'), upload.single('file'), async (req, res) => {
  try {
    const update = {
      title: req.body.title,
      description: req.body.description,
      type: req.body.type,
      category: req.body.category,
      isPublic: req.body.isPublic !== 'false',
    }
    if (req.file?.path) update.url = req.file.path
    else if (req.body.url) update.url = req.body.url
    const resource = await Resource.findByIdAndUpdate(req.params.id, update, { new: true })
    if (!resource) return res.status(404).json({ message: 'Ressource non trouvée' })
    res.json({ success: true, data: resource })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// DELETE /api/platform/resources/:id — Super Admin
router.delete('/resources/:id', protect, authorize('super_admin'), async (req, res) => {
  try {
    await Resource.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: 'Ressource supprimée' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/platform/resources/:id/download — Track download
router.put('/resources/:id/download', async (req, res) => {
  try {
    await Resource.findByIdAndUpdate(req.params.id, { $inc: { downloads: 1 } })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
