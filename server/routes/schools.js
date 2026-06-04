const express = require('express')
const router = express.Router()
const School = require('../models/School')
const User = require('../models/User')
const { protect, authorize } = require('../middleware/auth')
const { upload } = require('../config/cloudinary')

// @route  GET /api/schools  (public)
router.get('/', async (req, res) => {
  try {
    const { search, cycle, page = 1, limit = 50 } = req.query
    const query = { isActive: { $ne: false } }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { 'address.city': { $regex: search, $options: 'i' } },
      ]
    }
    if (cycle) query.cycles = { $in: [cycle] }
    const total = await School.countDocuments(query)
    const schools = await School.find(query)
      .select('name slug logo description cycles address stats isValidated subscription')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 })
    res.json({ success: true, total, page: Number(page), data: schools })
  } catch (err) {
    console.error('GET /api/schools error:', err)
    res.status(500).json({ message: err.message })
  }
})

// @route  GET /api/schools/mine  (directeur — get own school)
router.get('/mine', protect, async (req, res) => {
  try {
    const school = await School.findOne({ director: req.user._id }).populate('director', 'name email')
    if (!school) return res.status(404).json({ message: 'Aucune école associée' })
    res.json({ success: true, data: school })
  } catch (err) {
    console.error('GET /api/schools/mine error:', err)
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
    console.error('GET /api/schools/:id error:', err)
    res.status(500).json({ message: err.message })
  }
})

// @route  POST /api/schools  (directeur or super_admin)
router.post('/', protect, authorize('directeur', 'super_admin'), upload.single('logo'), async (req, res) => {
  try {
    const existing = await School.findOne({ director: req.user._id })
    if (existing && req.user.role === 'directeur') {
      return res.status(400).json({ message: 'Vous avez déjà une école enregistrée' })
    }
    const logoUrl = req.file?.path || req.body.logo || ''
    const school = await School.create({
      ...req.body,
      logo: logoUrl,
      director: req.user._id,
    })
    await User.findByIdAndUpdate(req.user._id, { school: school._id })
    res.status(201).json({ success: true, data: school })
  } catch (err) {
    console.error('POST /api/schools error:', err)
    res.status(500).json({ message: err.message })
  }
})

// @route  PUT /api/schools/:id  (directeur or super_admin) — supports logo upload
router.put('/:id', protect, authorize('directeur', 'super_admin'), upload.single('logo'), async (req, res) => {
  try {
    const updates = { ...req.body }
    if (req.file?.path) updates.logo = req.file.path
    // Parse nested fields sent as JSON strings from FormData
    if (typeof updates.address === 'string') { try { updates.address = JSON.parse(updates.address) } catch (e) { console.warn('Invalid JSON for address:', e.message) } }
    if (typeof updates.contact === 'string') { try { updates.contact = JSON.parse(updates.contact) } catch (e) { console.warn('Invalid JSON for contact:', e.message) } }
    if (typeof updates.cycles === 'string') { try { updates.cycles = JSON.parse(updates.cycles) } catch (e) { console.warn('Invalid JSON for cycles, treating as single value:', e.message); updates.cycles = [updates.cycles] } }
    if (typeof updates.socials === 'string') { try { updates.socials = JSON.parse(updates.socials) } catch (e) { console.warn('Invalid JSON for socials:', e.message) } }
    if (typeof updates.mobileMoneyAccounts === 'string') { try { updates.mobileMoneyAccounts = JSON.parse(updates.mobileMoneyAccounts) } catch (e) { console.warn('Invalid JSON for mobileMoneyAccounts:', e.message) } }
    if (updates.enrollmentFee !== undefined) updates.enrollmentFee = Number(updates.enrollmentFee) || 0

    const school = await School.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
    if (!school) return res.status(404).json({ message: 'École non trouvée' })
    res.json({ success: true, data: school })
  } catch (err) {
    console.error('PUT /api/schools/:id error:', err)
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
    console.error('GET /api/schools/:id/stats error:', err)
    res.status(500).json({ message: err.message })
  }
})

// @route  DELETE /api/schools/:id  (super_admin)
router.delete('/:id', protect, authorize('super_admin'), async (req, res) => {
  try {
    const school = await School.findByIdAndDelete(req.params.id)
    if (!school) return res.status(404).json({ message: 'École non trouvée' })
    // Unlink the director
    if (school.director) await User.findByIdAndUpdate(school.director, { $unset: { school: 1 } })
    res.json({ success: true, message: 'École supprimée' })
  } catch (err) {
    console.error('DELETE /api/schools/:id error:', err)
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
