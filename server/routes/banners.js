const express = require('express')
const router = express.Router()
const Banner = require('../models/Banner')
const { protect, authorize } = require('../middleware/auth')
const { upload } = require('../config/cloudinary')

const adminOnly = [protect, authorize('super_admin')]

// GET /api/banners — Public : bannières actives (page d'accueil)
router.get('/', async (req, res) => {
  try {
    const banners = await Banner.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 })
    res.json({ success: true, data: banners })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/banners/all — Admin : toutes les bannières
router.get('/all', ...adminOnly, async (req, res) => {
  try {
    const banners = await Banner.find({}).sort({ sortOrder: 1, createdAt: -1 })
    res.json({ success: true, data: banners })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/banners — Admin : créer une bannière (image uploadée)
router.post('/', ...adminOnly, upload.single('image'), async (req, res) => {
  try {
    const image = req.file?.path || req.body.image
    if (!image) return res.status(400).json({ message: 'Image de la bannière requise' })
    const banner = await Banner.create({
      title: req.body.title || '',
      subtitle: req.body.subtitle || '',
      image,
      link: req.body.link || '',
      isActive: req.body.isActive !== undefined ? req.body.isActive === 'true' || req.body.isActive === true : true,
      sortOrder: Number(req.body.sortOrder) || 0,
      createdBy: req.user._id,
    })
    res.status(201).json({ success: true, data: banner })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/banners/:id — Admin : modifier (image optionnelle)
router.put('/:id', ...adminOnly, upload.single('image'), async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id)
    if (!banner) return res.status(404).json({ message: 'Bannière introuvable' })
    if (req.file?.path) banner.image = req.file.path
    const fields = ['title', 'subtitle', 'link']
    for (const f of fields) if (req.body[f] !== undefined) banner[f] = req.body[f]
    if (req.body.isActive !== undefined) banner.isActive = req.body.isActive === 'true' || req.body.isActive === true
    if (req.body.sortOrder !== undefined) banner.sortOrder = Number(req.body.sortOrder) || 0
    await banner.save()
    res.json({ success: true, data: banner })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// DELETE /api/banners/:id — Admin
router.delete('/:id', ...adminOnly, async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id)
    if (!banner) return res.status(404).json({ message: 'Bannière introuvable' })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
