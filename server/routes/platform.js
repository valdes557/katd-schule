const express = require('express')
const router = express.Router()
const PlatformPage = require('../models/PlatformPage')
const SchoolPost = require('../models/SchoolPost')
const SchoolReview = require('../models/SchoolReview')
const PlatformPaymentMethod = require('../models/PlatformPaymentMethod')
const SubscriptionPlan = require('../models/SubscriptionPlan')
const { protect, authorize } = require('../middleware/auth')
const { upload } = require('../config/cloudinary')

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
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
    res.json({ success: true, total, data: posts })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/platform/posts — Super Admin: create platform-level post
router.post('/posts', protect, authorize('super_admin'), upload.fields([{ name: 'images', maxCount: 5 }, { name: 'audio', maxCount: 1 }, { name: 'video', maxCount: 1 }]), async (req, res) => {
  try {
    const images = (req.files?.images || []).map((f) => f.path)
    const audioFile = req.files?.audio?.[0]?.path || ''
    const videoFile = req.files?.video?.[0]?.path || ''
    const mediaType = req.body.mediaType || 'text'

    let type = 'text'
    let videoUrl = req.body.videoUrl || videoFile || ''
    let audioUrl = audioFile
    if (mediaType === 'audio' || audioFile) type = 'audio'
    else if (mediaType === 'video' || videoUrl) type = 'video'
    else if (images.length > 0 || mediaType === 'photo') type = 'photo'

    const post = await SchoolPost.create({
      author: req.user._id,
      content: req.body.content,
      title: req.body.title || '',
      category: req.body.category || '',
      images,
      thumbnail: images[0] || req.body.thumbnail || '',
      type,
      videoUrl: videoUrl || undefined,
      audioUrl: audioUrl || undefined,
      duration: req.body.duration || '',
      isPlatform: true,
      isPublic: true,
    })
    const populated = await post.populate('author', 'name avatar')
    res.status(201).json({ success: true, data: populated })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// DELETE /api/platform/posts/:id — Super Admin
router.delete('/posts/:id', protect, authorize('super_admin'), async (req, res) => {
  try {
    await SchoolPost.findByIdAndDelete(req.params.id)
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
    const populated = await post.populate('author', 'name avatar')
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

module.exports = router
