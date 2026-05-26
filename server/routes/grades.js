const express = require('express')
const router = express.Router()
const Grade = require('../models/Grade')
const Student = require('../models/Student')
const { protect, authorize } = require('../middleware/auth')
const { sendEmail } = require('../utils/emailService')

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

    // Notify parent (async, non-blocking)
    Student.findById(grade.student).populate('parentUser', 'email name').then((student) => {
      if (student?.parentUser?.email) {
        const periodLabel = grade.sequence || grade.term || ''
        sendEmail({
          to: student.parentUser.email,
          subject: `📊 Nouvelle note — ${grade.subject} (${grade.value}/20)`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:#7C3AED;padding:20px;border-radius:8px 8px 0 0"><h2 style="color:white;margin:0">Nouvelle note enregistrée</h2></div><div style="background:#F9FAFB;padding:20px;border:1px solid #E5E7EB;border-top:0;border-radius:0 0 8px 8px"><p>Bonjour <strong>${student.parentUser.name}</strong>,</p><p>Votre enfant <strong>${student.lastName} ${student.firstName}</strong> a reçu une nouvelle note :</p><table style="width:100%;border-collapse:collapse;font-size:14px"><tr><td style="padding:8px;border-bottom:1px solid #E5E7EB;color:#6B7280">Matière</td><td style="padding:8px;border-bottom:1px solid #E5E7EB;font-weight:700">${grade.subject}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #E5E7EB;color:#6B7280">Note</td><td style="padding:8px;border-bottom:1px solid #E5E7EB;font-size:20px;font-weight:900;color:${grade.value >= 10 ? '#16A34A' : '#DC2626'}">${grade.value}/20</td></tr><tr><td style="padding:8px;border-bottom:1px solid #E5E7EB;color:#6B7280">Type</td><td style="padding:8px;border-bottom:1px solid #E5E7EB">${grade.type}</td></tr>${periodLabel ? `<tr><td style="padding:8px;color:#6B7280">Période</td><td style="padding:8px">${periodLabel}</td></tr>` : ''}${grade.comment ? `<tr><td style="padding:8px;color:#6B7280">Commentaire</td><td style="padding:8px;font-style:italic">${grade.comment}</td></tr>` : ''}</table><div style="text-align:center;margin-top:20px"><a href="${process.env.CLIENT_URL || 'https://katd-schule.vercel.app'}/login" style="background:#7C3AED;color:white;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px">Voir le bulletin</a></div></div></div>`,
        }).catch(() => {})
      }
    }).catch(() => {})
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
