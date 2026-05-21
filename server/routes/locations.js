const express = require('express')
const router = express.Router()
const Location = require('../models/Location')
const { protect, authorize } = require('../middleware/auth')

// GET /api/locations/countries — Public
router.get('/countries', async (req, res) => {
  try {
    const countries = await Location.find({ type: 'country' }).sort({ name: 1 })
    res.json({ success: true, data: countries })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/locations/cities/:countryId — Public
router.get('/cities/:countryId', async (req, res) => {
  try {
    const cities = await Location.find({ type: 'city', parent: req.params.countryId }).sort({ name: 1 })
    res.json({ success: true, data: cities })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/locations/neighborhoods/:cityId — Public
router.get('/neighborhoods/:cityId', async (req, res) => {
  try {
    const neighborhoods = await Location.find({ type: 'neighborhood', parent: req.params.cityId }).sort({ name: 1 })
    res.json({ success: true, data: neighborhoods })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/locations — Super admin: list all
router.get('/', protect, authorize('super_admin'), async (req, res) => {
  try {
    const { type } = req.query
    const query = type ? { type } : {}
    const locations = await Location.find(query).populate('parent', 'name type').sort({ type: 1, name: 1 })
    res.json({ success: true, data: locations })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/locations — Super admin: create
router.post('/', protect, authorize('super_admin'), async (req, res) => {
  try {
    const { type, name, parent, code } = req.body
    if (!type || !name) return res.status(400).json({ message: 'Type et nom requis' })
    if ((type === 'city' || type === 'neighborhood') && !parent) {
      return res.status(400).json({ message: 'Le parent est requis pour ce type' })
    }
    const location = await Location.create({ type, name, parent: parent || undefined, code })
    res.status(201).json({ success: true, data: location })
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Cette localité existe déjà' })
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/locations/:id — Super admin: update
router.put('/:id', protect, authorize('super_admin'), async (req, res) => {
  try {
    const location = await Location.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    if (!location) return res.status(404).json({ message: 'Localité non trouvée' })
    res.json({ success: true, data: location })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/locations/:id — Super admin
router.delete('/:id', protect, authorize('super_admin'), async (req, res) => {
  try {
    // Delete children too
    const loc = await Location.findById(req.params.id)
    if (!loc) return res.status(404).json({ message: 'Localité non trouvée' })

    if (loc.type === 'country') {
      const cities = await Location.find({ parent: loc._id })
      for (const city of cities) {
        await Location.deleteMany({ parent: city._id })
      }
      await Location.deleteMany({ parent: loc._id })
    } else if (loc.type === 'city') {
      await Location.deleteMany({ parent: loc._id })
    }
    await Location.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: 'Localité supprimée' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
