const express = require('express')
const router = express.Router()
const TutoringPost = require('../models/TutoringPost')
const { protect, authorize } = require('../middleware/auth')
const { upload } = require('../config/cloudinary')
const pushService = require('../services/pushService')

/* ─────────────── ROUTES PUBLIQUES (feed News — sans authentification) ─────────────── */

// GET /api/tutoring/public — toutes les annonces de répétition publiées
router.get('/public', async (req, res) => {
  try {
    const posts = await TutoringPost.find({ status: 'published' })
      .populate('school', 'name logo')
      .sort({ createdAt: -1 })
      .limit(200)
    res.json({ success: true, data: posts })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/tutoring/public/:id — détail d'une annonce publiée
router.get('/public/:id', async (req, res) => {
  try {
    const post = await TutoringPost.findOne({ _id: req.params.id, status: 'published' })
      .populate('school', 'name logo')
    if (!post) return res.status(404).json({ message: 'Annonce non trouvée' })
    res.json({ success: true, data: post })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

/* ─────────────── ROUTES ENSEIGNANT (authentifiées) ─────────────── */

// GET /api/tutoring — mes annonces de répétition
router.get('/', protect, authorize('enseignant'), async (req, res) => {
  try {
    const posts = await TutoringPost.find({ teacher: req.user._id }).sort({ createdAt: -1 })
    res.json({ success: true, data: posts })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/tutoring — créer une annonce (photo optionnelle)
router.post('/', protect, authorize('enseignant'), upload.single('photo'), async (req, res) => {
  try {
    const { title, description, subjects, price, contactWhatsapp, contactEmail, location, schedule, status } = req.body
    if (!title || !description) return res.status(400).json({ message: 'Le titre et la description sont requis' })

    const post = await TutoringPost.create({
      teacher: req.user._id,
      teacherName: req.user.name,
      school: req.user.school?._id || req.user.school || undefined,
      title: title.trim(),
      description: description.trim(),
      subjects: subjects?.trim() || '',
      price: price?.trim() || '',
      photo: req.file?.path || '',
      contactWhatsapp: contactWhatsapp?.trim() || '',
      contactEmail: contactEmail?.trim() || '',
      location: location?.trim() || '',
      schedule: schedule?.trim() || '',
      status: ['published', 'closed'].includes(status) ? status : 'published',
    })
    res.status(201).json({ success: true, data: post })

    // Push global (feed News public) si l'annonce est publiée — best-effort.
    if (post.status === 'published') {
      pushService.sendToAllSubscribers({
        title: '🎓 Nouvelle offre de répétitions',
        body: `${post.title}${post.subjects ? ' • ' + post.subjects : ''}`,
        url: '/dashboard/news',
        tag: 'tut_' + post._id.toString(),
      }, req.user._id).catch(() => {})
    }
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/tutoring/:id — modifier une annonce (photo optionnelle)
router.put('/:id', protect, authorize('enseignant'), upload.single('photo'), async (req, res) => {
  try {
    const post = await TutoringPost.findOne({ _id: req.params.id, teacher: req.user._id })
    if (!post) return res.status(404).json({ message: 'Annonce non trouvée' })

    const fields = ['title', 'description', 'subjects', 'price', 'contactWhatsapp', 'contactEmail', 'location', 'schedule', 'status']
    fields.forEach((f) => { if (req.body[f] !== undefined) post[f] = req.body[f] })
    if (req.file?.path) post.photo = req.file.path
    await post.save()
    res.json({ success: true, data: post })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// DELETE /api/tutoring/:id — supprimer une annonce
router.delete('/:id', protect, authorize('enseignant'), async (req, res) => {
  try {
    const post = await TutoringPost.findOneAndDelete({ _id: req.params.id, teacher: req.user._id })
    if (!post) return res.status(404).json({ message: 'Annonce non trouvée' })
    res.json({ success: true, message: 'Annonce supprimée' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
