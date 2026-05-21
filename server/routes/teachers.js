const express = require('express')
const router = express.Router()
const Teacher = require('../models/Teacher')
const { protect, authorize } = require('../middleware/auth')

// GET /api/teachers
router.get('/', protect, async (req, res) => {
  try {
    const { search, status, page = 1, limit = 50 } = req.query
    const query = { school: req.user.school._id || req.user.school }
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ]
    }
    if (status) query.status = status
    const total = await Teacher.countDocuments(query)
    const teachers = await Teacher.find(query)
      .populate('classes', 'name level')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ lastName: 1 })
    res.json({ success: true, total, data: teachers })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/teachers/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id).populate('classes school')
    if (!teacher) return res.status(404).json({ message: 'Enseignant non trouvé' })
    res.json({ success: true, data: teacher })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/teachers
router.post('/', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const teacher = await Teacher.create({ ...req.body, school: req.user.school._id || req.user.school })
    res.status(201).json({ success: true, data: teacher })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/teachers/:id
router.put('/:id', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const teacher = await Teacher.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    if (!teacher) return res.status(404).json({ message: 'Enseignant non trouvé' })
    res.json({ success: true, data: teacher })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/teachers/:id
router.delete('/:id', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const teacher = await Teacher.findByIdAndDelete(req.params.id)
    if (!teacher) return res.status(404).json({ message: 'Enseignant non trouvé' })
    res.json({ success: true, message: 'Enseignant supprimé' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
