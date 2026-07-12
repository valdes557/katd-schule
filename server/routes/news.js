const express = require('express')
const router = express.Router()
const RecruitmentPost = require('../models/RecruitmentPost')
const TutoringPost = require('../models/TutoringPost')
const PlatformNews = require('../models/PlatformNews')
const { protect, authorize } = require('../middleware/auth')
const { upload } = require('../config/cloudinary')

// Normalise une annonce de recrutement en item de feed unifié
const mapRecruitment = (p) => ({
  kind: 'recrutement',
  _id: p._id,
  title: p.title,
  description: p.description,
  poste: p.poste,
  location: p.location,
  contractType: p.contractType,
  deadline: p.deadline,
  school: p.school,
  createdAt: p.createdAt,
})

// Normalise une annonce de répétition
const mapTutoring = (p) => ({
  kind: 'repetition',
  _id: p._id,
  title: p.title,
  description: p.description,
  subjects: p.subjects,
  price: p.price,
  photo: p.photo,
  contactWhatsapp: p.contactWhatsapp,
  contactEmail: p.contactEmail,
  location: p.location,
  schedule: p.schedule,
  teacherName: p.teacherName,
  school: p.school,
  createdAt: p.createdAt,
})

// Normalise un contenu démo/News admin
const mapDemo = (p) => ({
  kind: p.category === 'pub' ? 'pub' : 'demo',
  category: p.category || 'demo',
  _id: p._id,
  title: p.title,
  description: p.description,
  type: p.type,
  mediaUrl: p.mediaUrl,
  link: p.link,
  createdAt: p.createdAt,
})

/* ─────────────── FEED PUBLIC UNIFIÉ ─────────────── */

// GET /api/news/public — fusionne recrutement + répétitions + démos admin (tri récent)
router.get('/public', async (req, res) => {
  try {
    const [recruit, tutoring, demos] = await Promise.all([
      RecruitmentPost.find({ status: 'published' }).populate('school', 'name logo').sort({ createdAt: -1 }).limit(200),
      TutoringPost.find({ status: 'published' }).populate('school', 'name logo').sort({ createdAt: -1 }).limit(200),
      PlatformNews.find().sort({ createdAt: -1 }).limit(200),
    ])
    const feed = [
      ...recruit.map(mapRecruitment),
      ...tutoring.map(mapTutoring),
      ...demos.map(mapDemo),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    res.json({ success: true, data: feed })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/news/public/count?since=<ISO> — nb de contenus (3 sources) depuis une date (badges)
router.get('/public/count', async (req, res) => {
  try {
    const sinceFilter = {}
    if (req.query.since) {
      const d = new Date(req.query.since)
      if (!Number.isNaN(d.getTime())) sinceFilter.createdAt = { $gt: d }
    }
    const [r, t, d, rt, tt, dt] = await Promise.all([
      RecruitmentPost.countDocuments({ status: 'published', ...sinceFilter }),
      TutoringPost.countDocuments({ status: 'published', ...sinceFilter }),
      PlatformNews.countDocuments({ ...sinceFilter }),
      RecruitmentPost.countDocuments({ status: 'published' }),
      TutoringPost.countDocuments({ status: 'published' }),
      PlatformNews.countDocuments({}),
    ])
    res.json({ success: true, data: { count: r + t + d, total: rt + tt + dt } })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

/* ─────────────── ADMIN : DÉMOS / NEWS PLATEFORME (super_admin) ─────────────── */

// GET /api/news/admin — liste des contenus démo/News
router.get('/admin', protect, authorize('super_admin'), async (req, res) => {
  try {
    const items = await PlatformNews.find().sort({ createdAt: -1 })
    res.json({ success: true, data: items })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/news/admin — créer un contenu démo (upload vidéo/pdf/image)
router.post('/admin', protect, authorize('super_admin'), upload.single('media'), async (req, res) => {
  try {
    const { title, description, type, link, category } = req.body
    if (!title) return res.status(400).json({ message: 'Le titre est requis' })
    const item = await PlatformNews.create({
      title: title.trim(),
      description: description?.trim() || '',
      type: ['video', 'pdf', 'image', 'link'].includes(type) ? type : 'video',
      category: category === 'pub' ? 'pub' : 'demo',
      mediaUrl: req.file?.path || '',
      link: link?.trim() || '',
      createdBy: req.user._id,
    })
    res.status(201).json({ success: true, data: item })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/news/admin/:id — modifier un contenu démo
router.put('/admin/:id', protect, authorize('super_admin'), upload.single('media'), async (req, res) => {
  try {
    const item = await PlatformNews.findById(req.params.id)
    if (!item) return res.status(404).json({ message: 'Contenu non trouvé' })
    const fields = ['title', 'description', 'type', 'link', 'category']
    fields.forEach((f) => { if (req.body[f] !== undefined) item[f] = req.body[f] })
    if (req.file?.path) item.mediaUrl = req.file.path
    await item.save()
    res.json({ success: true, data: item })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// DELETE /api/news/admin/:id — supprimer un contenu démo
router.delete('/admin/:id', protect, authorize('super_admin'), async (req, res) => {
  try {
    const item = await PlatformNews.findByIdAndDelete(req.params.id)
    if (!item) return res.status(404).json({ message: 'Contenu non trouvé' })
    res.json({ success: true, message: 'Contenu supprimé' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
