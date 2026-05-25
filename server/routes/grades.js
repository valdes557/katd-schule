const express = require('express')
const router = express.Router()
const Grade = require('../models/Grade')
const Student = require('../models/Student')
const { protect, authorize } = require('../middleware/auth')

// GET /api/grades
router.get('/', protect, async (req, res) => {
  try {
    const { classId, student, subject, term, sequence, page = 1, limit = 200 } = req.query
    const query = { school: req.user.school._id || req.user.school }
    if (classId) query.class = classId
    if (student) query.student = student
    if (subject) query.subject = subject
    if (term) query.term = term
    if (sequence) query.sequence = sequence
    const total = await Grade.countDocuments(query)
    const grades = await Grade.find(query)
      .populate('student', 'firstName lastName matricule')
      .populate('teacher', 'firstName lastName')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ date: -1 })
    res.json({ success: true, total, data: grades })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/grades/stats
router.get('/stats', protect, async (req, res) => {
  try {
    const schoolId = req.user.school._id || req.user.school
    const { classId, term } = req.query
    const match = { school: schoolId }
    if (classId) match.class = require('mongoose').Types.ObjectId(classId)
    if (term) match.term = term

    const stats = await Grade.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$subject',
          average: { $avg: '$value' },
          min: { $min: '$value' },
          max: { $max: '$value' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])

    const overall = await Grade.aggregate([
      { $match: match },
      { $group: { _id: null, average: { $avg: '$value' }, count: { $sum: 1 } } },
    ])

    res.json({ success: true, data: { bySubject: stats, overall: overall[0] || { average: 0, count: 0 } } })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/grades/bulletin/:studentId
router.get('/bulletin/:studentId', protect, async (req, res) => {
  try {
    const { term } = req.query
    const query = { student: req.params.studentId }
    if (term) query.term = term
    const grades = await Grade.find(query).populate('student', 'firstName lastName matricule class').sort({ subject: 1 })

    const grouped = {}
    grades.forEach((g) => {
      if (!grouped[g.subject]) grouped[g.subject] = []
      grouped[g.subject].push(g)
    })

    const bulletin = Object.entries(grouped).map(([subject, list]) => {
      const avg = list.reduce((s, g) => s + g.value * g.coefficient, 0) / list.reduce((s, g) => s + g.coefficient, 0)
      return { subject, grades: list, average: Math.round(avg * 100) / 100, coefficient: list[0].coefficient }
    })

    const generalAvg = bulletin.length > 0
      ? bulletin.reduce((s, b) => s + b.average * b.coefficient, 0) / bulletin.reduce((s, b) => s + b.coefficient, 0)
      : 0

    res.json({ success: true, data: { bulletin, generalAverage: Math.round(generalAvg * 100) / 100 } })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/grades (single or batch)
router.post('/', protect, authorize('directeur', 'enseignant', 'super_admin'), async (req, res) => {
  try {
    const schoolId = req.user.school._id || req.user.school
    if (Array.isArray(req.body)) {
      const grades = await Grade.insertMany(req.body.map((g) => ({ ...g, school: schoolId })))
      return res.status(201).json({ success: true, data: grades })
    }
    const grade = await Grade.create({ ...req.body, school: schoolId })
    res.status(201).json({ success: true, data: grade })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/grades/:id
router.put('/:id', protect, authorize('directeur', 'enseignant', 'super_admin'), async (req, res) => {
  try {
    const grade = await Grade.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    if (!grade) return res.status(404).json({ message: 'Note non trouvée' })
    res.json({ success: true, data: grade })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/grades/:id
router.delete('/:id', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    await Grade.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: 'Note supprimée' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
