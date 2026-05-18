const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const Media = require('../models/Media')
const { protect } = require('../middleware/auth')

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, `${unique}${path.extname(file.originalname)}`)
  },
})

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|mp4|avi|mov|mp3|wav|aac|ogg/
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '')
  if (allowed.test(ext)) cb(null, true)
  else cb(new Error('Type de fichier non autorisé'), false)
}

const upload = multer({ storage, fileFilter, limits: { fileSize: 100 * 1024 * 1024 } })

// @route  GET /api/media  (public)
router.get('/', async (req, res) => {
  try {
    const { type, school, category, sort = 'recent', page = 1, limit = 12 } = req.query
    const query = { isPublic: true }

    if (type) query.type = type
    if (school) query.school = school
    if (category) query.category = category

    const sortOptions = {
      recent: { createdAt: -1 },
      popular: { 'stats.likes': -1 },
      views: { 'stats.views': -1 },
    }

    const total = await Media.countDocuments(query)
    const media = await Media.find(query)
      .populate('school', 'name logo')
      .populate('uploadedBy', 'name')
      .sort(sortOptions[sort] || sortOptions.recent)
      .skip((page - 1) * limit)
      .limit(Number(limit))

    res.json({ success: true, total, page: Number(page), data: media })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// @route  POST /api/media  (authenticated)
router.post('/', protect, upload.array('files', 10), async (req, res) => {
  try {
    const files = req.files?.map((f) => ({
      url: `/uploads/${f.filename}`,
      filename: f.originalname,
      size: f.size,
    })) || []

    const media = await Media.create({
      ...req.body,
      school: req.user.school,
      uploadedBy: req.user._id,
      files,
    })

    res.status(201).json({ success: true, data: media })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// @route  PUT /api/media/:id/like  (authenticated)
router.put('/:id/like', protect, async (req, res) => {
  try {
    const media = await Media.findById(req.params.id)
    if (!media) return res.status(404).json({ message: 'Contenu non trouvé' })

    const alreadyLiked = media.likedBy.includes(req.user._id)
    if (alreadyLiked) {
      media.likedBy.pull(req.user._id)
      media.stats.likes = Math.max(0, media.stats.likes - 1)
    } else {
      media.likedBy.push(req.user._id)
      media.stats.likes += 1
    }
    await media.save()

    res.json({ success: true, liked: !alreadyLiked, likes: media.stats.likes })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// @route  DELETE /api/media/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const media = await Media.findById(req.params.id)
    if (!media) return res.status(404).json({ message: 'Contenu non trouvé' })
    if (media.school.toString() !== req.user.school.toString()) {
      return res.status(403).json({ message: 'Non autorisé' })
    }
    await media.deleteOne()
    res.json({ success: true, message: 'Contenu supprimé' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
