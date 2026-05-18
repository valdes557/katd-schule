const express = require('express')
const router = express.Router()
const School = require('../models/School')
const { protect, authorize } = require('../middleware/auth')

// @route  GET /api/schools  (public)
router.get('/', async (req, res) => {
  try {
    const { search, cycle, page = 1, limit = 20 } = req.query
    const query = { isValidated: true, isActive: true }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { 'address.city': { $regex: search, $options: 'i' } },
      ]
    }
    if (cycle) {
      query.cycles = { $in: [cycle] }
    }

    const total = await School.countDocuments(query)
    const schools = await School.find(query)
      .select('name slug logo cycles address stats')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 })

    res.json({ success: true, total, page: Number(page), data: schools })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// @route  GET /api/schools/:id  (public)
router.get('/:id', async (req, res) => {
  try {
    const school = await School.findById(req.params.id).populate('director', 'name email')
    if (!school) return res.status(404).json({ message: 'École non trouvée' })
    res.json({ success: true, data: school })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// @route  POST /api/schools  (super_admin)
router.post('/', protect, authorize('super_admin'), async (req, res) => {
  try {
    const school = await School.create(req.body)
    res.status(201).json({ success: true, data: school })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// @route  PUT /api/schools/:id  (directeur or super_admin)
router.put('/:id', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const school = await School.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
    if (!school) return res.status(404).json({ message: 'École non trouvée' })
    res.json({ success: true, data: school })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// @route  GET /api/schools/:id/stats  (directeur)
router.get('/:id/stats', protect, async (req, res) => {
  try {
    const school = await School.findById(req.params.id).select('stats subscription')
    if (!school) return res.status(404).json({ message: 'École non trouvée' })
    res.json({ success: true, data: school })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
