const express = require('express')
const router = express.Router()
const Subject = require('../models/Subject')
const { protect, authorize } = require('../middleware/auth')

router.get('/', protect, async (req, res) => {
  try {
    const query = { school: req.user.school?._id || req.user.school }
    if (!query.school) return res.json({ success: true, data: [] })
    if (req.query.cycle) query.cycle = req.query.cycle
    const subjects = await Subject.find(query)
      .populate('teacher', 'firstName lastName')
      .populate('classes', 'name level')
      .sort({ cycle: 1, name: 1 })
    res.json({ success: true, data: subjects })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/:id', protect, async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id).populate('teacher classes')
    if (!subject) return res.status(404).json({ message: 'Matière non trouvée' })
    res.json({ success: true, data: subject })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const subject = await Subject.create({ ...req.body, school: req.user.school?._id || req.user.school })
    res.status(201).json({ success: true, data: subject })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.put('/:id', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const subject = await Subject.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    if (!subject) return res.status(404).json({ message: 'Matière non trouvée' })
    res.json({ success: true, data: subject })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.delete('/:id', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    await Subject.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: 'Matière supprimée' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
