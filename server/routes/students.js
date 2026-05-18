const express = require('express')
const router = express.Router()
const Student = require('../models/Student')
const { protect, authorize } = require('../middleware/auth')

// @route  GET /api/students
router.get('/', protect, async (req, res) => {
  try {
    const { search, class: className, cycle, page = 1, limit = 50 } = req.query
    const query = { school: req.user.school }

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { matricule: { $regex: search, $options: 'i' } },
      ]
    }
    if (className) query.class = className
    if (cycle) query.cycle = cycle

    const total = await Student.countDocuments(query)
    const students = await Student.find(query)
      .populate('class', 'name level')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ lastName: 1 })

    res.json({ success: true, total, data: students })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// @route  GET /api/students/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).populate('class school')
    if (!student) return res.status(404).json({ message: 'Élève non trouvé' })
    res.json({ success: true, data: student })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// @route  POST /api/students
router.post('/', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const student = await Student.create({ ...req.body, school: req.user.school })
    res.status(201).json({ success: true, data: student })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// @route  PUT /api/students/:id
router.put('/:id', protect, authorize('directeur', 'enseignant', 'super_admin'), async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true,
    })
    if (!student) return res.status(404).json({ message: 'Élève non trouvé' })
    res.json({ success: true, data: student })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// @route  DELETE /api/students/:id
router.delete('/:id', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id)
    if (!student) return res.status(404).json({ message: 'Élève non trouvé' })
    res.json({ success: true, message: 'Élève supprimé' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
