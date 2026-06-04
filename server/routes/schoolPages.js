const express = require('express')
const router = express.Router()
const SchoolPage = require('../models/SchoolPage')
const TeamMember = require('../models/TeamMember')
const SchoolPost = require('../models/SchoolPost')
const SchoolReview = require('../models/SchoolReview')
const PaymentModality = require('../models/PaymentModality')
const { protect, authorize } = require('../middleware/auth')
const { upload } = require('../config/cloudinary')

// ===================== SCHOOL PAGE (about, terms, privacy, help, donations, contacts) =====================

// GET /api/school-pages/:schoolId — Public: get school page
router.get('/:schoolId', async (req, res) => {
  try {
    let page = await SchoolPage.findOne({ school: req.params.schoolId })
    if (!page) page = { about: { content: '', images: [] }, terms: '', privacy: '', help: '', donationAccounts: [], contacts: [] }
    res.json({ success: true, data: page })
  } catch (err) { console.error(err); res.status(500).json({ message: err.message }) }
})

// PUT /api/school-pages/:schoolId — Director: update school page
router.put('/:schoolId', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const page = await SchoolPage.findOneAndUpdate(
      { school: req.params.schoolId },
      { ...req.body, school: req.params.schoolId },
      { new: true, upsert: true, runValidators: true }
    )
    res.json({ success: true, data: page })
  } catch (err) { console.error(err); res.status(500).json({ message: err.message }) }
})

// POST /api/school-pages/:schoolId/upload — Upload images for about section
router.post('/:schoolId/upload', protect, authorize('directeur', 'super_admin'), upload.array('images', 5), async (req, res) => {
  try {
    const urls = req.files?.map((f) => f.path) || []
    res.json({ success: true, data: urls })
  } catch (err) { console.error(err); res.status(500).json({ message: err.message }) }
})

// ===================== TEAM MEMBERS =====================

// GET /api/school-pages/:schoolId/team — Public
router.get('/:schoolId/team', async (req, res) => {
  try {
    const members = await TeamMember.find({ school: req.params.schoolId, isPublic: true }).sort({ order: 1 })
    res.json({ success: true, data: members })
  } catch (err) { console.error(err); res.status(500).json({ message: err.message }) }
})

// POST /api/school-pages/:schoolId/team — Director
router.post('/:schoolId/team', protect, authorize('directeur', 'super_admin'), upload.single('photo'), async (req, res) => {
  try {
    const data = { ...req.body, school: req.params.schoolId }
    if (req.file) data.photo = req.file.path
    const member = await TeamMember.create(data)
    res.status(201).json({ success: true, data: member })
  } catch (err) { console.error(err); res.status(500).json({ message: err.message }) }
})

// PUT /api/school-pages/team/:id — Director
router.put('/team/:id', protect, authorize('directeur', 'super_admin'), upload.single('photo'), async (req, res) => {
  try {
    const data = { ...req.body }
    if (req.file) data.photo = req.file.path
    const member = await TeamMember.findByIdAndUpdate(req.params.id, data, { new: true })
    if (!member) return res.status(404).json({ message: 'Membre non trouvé' })
    res.json({ success: true, data: member })
  } catch (err) { console.error(err); res.status(500).json({ message: err.message }) }
})

// DELETE /api/school-pages/team/:id — Director
router.delete('/team/:id', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    await TeamMember.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: 'Membre supprimé' })
  } catch (err) { console.error(err); res.status(500).json({ message: err.message }) }
})

// ===================== SOCIAL POSTS =====================

// GET /api/school-pages/:schoolId/posts — Public
router.get('/:schoolId/posts', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query
    const total = await SchoolPost.countDocuments({ school: req.params.schoolId, isPublic: true })
    const posts = await SchoolPost.find({ school: req.params.schoolId, isPublic: true })
      .populate('author', 'name avatar')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
    res.json({ success: true, total, data: posts })
  } catch (err) { console.error(err); res.status(500).json({ message: err.message }) }
})

// POST /api/school-pages/:schoolId/posts — Director
router.post('/:schoolId/posts', protect, authorize('directeur', 'super_admin'), upload.array('images', 5), async (req, res) => {
  try {
    const images = req.files?.map((f) => f.path) || []
    const post = await SchoolPost.create({
      school: req.params.schoolId,
      author: req.user._id,
      content: req.body.content,
      title: req.body.title || '',
      category: req.body.category || '',
      images,
      thumbnail: images[0] || req.body.thumbnail || '',
      type: req.body.videoUrl ? 'video' : images.length > 0 ? 'photo' : 'text',
      videoUrl: req.body.videoUrl || undefined,
      duration: req.body.duration || '',
    })
    const populated = await post.populate('author', 'name avatar')
    res.status(201).json({ success: true, data: populated })
  } catch (err) { console.error(err); res.status(500).json({ message: err.message }) }
})

// PUT /api/school-pages/posts/:id/like — Toggle like
router.put('/posts/:id/like', protect, async (req, res) => {
  try {
    const post = await SchoolPost.findById(req.params.id)
    if (!post) return res.status(404).json({ message: 'Post non trouvé' })
    const idx = post.likes.indexOf(req.user._id)
    if (idx > -1) post.likes.splice(idx, 1)
    else post.likes.push(req.user._id)
    await post.save()
    res.json({ success: true, data: post })
  } catch (err) { console.error(err); res.status(500).json({ message: err.message }) }
})

// POST /api/school-pages/posts/:id/comment — Add comment
router.post('/posts/:id/comment', protect, async (req, res) => {
  try {
    const post = await SchoolPost.findById(req.params.id)
    if (!post) return res.status(404).json({ message: 'Post non trouvé' })
    post.comments.push({ author: req.user.name, authorId: req.user._id, content: req.body.content })
    await post.save()
    res.json({ success: true, data: post })
  } catch (err) { console.error(err); res.status(500).json({ message: err.message }) }
})

// DELETE /api/school-pages/posts/:id — Director
router.delete('/posts/:id', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    await SchoolPost.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: 'Post supprimé' })
  } catch (err) { console.error(err); res.status(500).json({ message: err.message }) }
})

// ===================== REVIEWS =====================

// GET /api/school-pages/:schoolId/reviews — Public (approved only)
router.get('/:schoolId/reviews', async (req, res) => {
  try {
    const reviews = await SchoolReview.find({ school: req.params.schoolId, isApproved: true }).sort({ createdAt: -1 })
    res.json({ success: true, data: reviews })
  } catch (err) { console.error(err); res.status(500).json({ message: err.message }) }
})

// GET /api/school-pages/:schoolId/reviews/all — Director (all reviews)
router.get('/:schoolId/reviews/all', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const reviews = await SchoolReview.find({ school: req.params.schoolId }).sort({ createdAt: -1 })
    res.json({ success: true, data: reviews })
  } catch (err) { console.error(err); res.status(500).json({ message: err.message }) }
})

// POST /api/school-pages/:schoolId/reviews — Public: submit review
router.post('/:schoolId/reviews', async (req, res) => {
  try {
    const review = await SchoolReview.create({ school: req.params.schoolId, ...req.body })
    res.status(201).json({ success: true, message: 'Avis soumis, en attente de validation.', data: review })
  } catch (err) { console.error(err); res.status(500).json({ message: err.message }) }
})

// PUT /api/school-pages/reviews/:id/approve — Director approves review
router.put('/reviews/:id/approve', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const review = await SchoolReview.findByIdAndUpdate(req.params.id, { isApproved: true }, { new: true })
    res.json({ success: true, data: review })
  } catch (err) { console.error(err); res.status(500).json({ message: err.message }) }
})

// DELETE /api/school-pages/reviews/:id — Director
router.delete('/reviews/:id', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    await SchoolReview.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: 'Avis supprimé' })
  } catch (err) { console.error(err); res.status(500).json({ message: err.message }) }
})

// ===================== PAYMENT MODALITIES =====================

// GET /api/school-pages/:schoolId/payments — Public
router.get('/:schoolId/payments', async (req, res) => {
  try {
    const modalities = await PaymentModality.find({ school: req.params.schoolId }).sort({ order: 1 })
    res.json({ success: true, data: modalities })
  } catch (err) { console.error(err); res.status(500).json({ message: err.message }) }
})

// POST /api/school-pages/:schoolId/payments — Director
router.post('/:schoolId/payments', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const modality = await PaymentModality.create({ school: req.params.schoolId, ...req.body })
    res.status(201).json({ success: true, data: modality })
  } catch (err) { console.error(err); res.status(500).json({ message: err.message }) }
})

// PUT /api/school-pages/payments/:id — Director
router.put('/payments/:id', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const modality = await PaymentModality.findByIdAndUpdate(req.params.id, req.body, { new: true })
    if (!modality) return res.status(404).json({ message: 'Modalité non trouvée' })
    res.json({ success: true, data: modality })
  } catch (err) { console.error(err); res.status(500).json({ message: err.message }) }
})

// DELETE /api/school-pages/payments/:id — Director
router.delete('/payments/:id', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    await PaymentModality.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: 'Modalité supprimée' })
  } catch (err) { console.error(err); res.status(500).json({ message: err.message }) }
})

module.exports = router
