const express = require('express')
const router = express.Router()
const Attendance = require('../models/Attendance')
const Student = require('../models/Student')
const Class = require('../models/Class')
const Teacher = require('../models/Teacher')
const { protect, authorize } = require('../middleware/auth')
const { sendEmail } = require('../utils/emailService')

// GET /api/attendance
router.get('/', protect, async (req, res) => {
  try {
    const { classId, from, to, page = 1, limit = 30 } = req.query
    const query = { school: req.user.school._id || req.user.school }
    if (classId) query.class = classId

    // Scope by role
    if (req.user.role === 'enseignant') {
      const teacher = await Teacher.findOne({ user: req.user._id })
      if (!teacher) return res.json({ success: true, total: 0, data: [] })
      const teacherClassIds = (teacher.classes || []).map((c) => c.toString())
      if (classId && !teacherClassIds.includes(classId.toString())) {
        return res.json({ success: true, total: 0, data: [] })
      }
      if (!classId) query.class = { $in: teacherClassIds }
    } else if (req.user.role === 'parent') {
      const children = await Student.find({ parentUser: req.user._id }).select('class')
      const ids = children.map((s) => s.class).filter(Boolean)
      if (ids.length === 0) return res.json({ success: true, total: 0, data: [] })
      if (!classId) query.class = { $in: ids }
    }
    if (from || to) {
      query.date = {}
      if (from) query.date.$gte = new Date(from)
      if (to) query.date.$lte = new Date(to)
    }
    const total = await Attendance.countDocuments(query)
    const records = await Attendance.find(query)
      .populate('class', 'name level')
      .populate('records.student', 'firstName lastName matricule')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ date: -1 })
    res.json({ success: true, total, data: records })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/attendance/stats
router.get('/stats', protect, async (req, res) => {
  try {
    const schoolId = req.user.school._id || req.user.school
    const { classId } = req.query
    const match = { school: schoolId }
    if (classId) match.class = require('mongoose').Types.ObjectId(classId)

    const stats = await Attendance.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          totalPresent: { $sum: '$summary.present' },
          totalAbsent: { $sum: '$summary.absent' },
          totalLate: { $sum: '$summary.late' },
          totalExcused: { $sum: '$summary.excused' },
          totalStudents: { $sum: '$summary.total' },
        },
      },
    ])

    const s = stats[0] || { totalSessions: 0, totalPresent: 0, totalAbsent: 0, totalLate: 0, totalExcused: 0, totalStudents: 0 }
    const rate = s.totalStudents > 0 ? Math.round((s.totalPresent / s.totalStudents) * 10000) / 100 : 0

    res.json({ success: true, data: { ...s, attendanceRate: rate } })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/attendance
router.post('/', protect, authorize('directeur', 'enseignant', 'super_admin'), async (req, res) => {
  try {
    const schoolId = req.user.school._id || req.user.school
    const { classId, date, records } = req.body

    // Teacher can only submit attendance for his own classes
    if (req.user.role === 'enseignant') {
      const teacher = await Teacher.findOne({ user: req.user._id })
      if (!teacher) return res.status(403).json({ message: 'Profil enseignant non trouvé' })
      const teacherClassIds = (teacher.classes || []).map((c) => c.toString())
      if (!classId || !teacherClassIds.includes(classId.toString())) {
        return res.status(403).json({ message: "Vous ne pouvez marquer la présence que pour vos classes assignées" })
      }
    }

    const summary = {
      total: records.length,
      present: records.filter((r) => r.status === 'present').length,
      absent: records.filter((r) => r.status === 'absent').length,
      late: records.filter((r) => r.status === 'late').length,
      excused: records.filter((r) => r.status === 'excused').length,
    }

    let attendance = await Attendance.findOne({ class: classId, date: new Date(date) })
    if (attendance) {
      attendance.records = records
      attendance.summary = summary
      await attendance.save()
    } else {
      attendance = await Attendance.create({
        class: classId,
        school: schoolId,
        teacher: req.user._id,
        date: new Date(date),
        records,
        summary,
      })
    }

    res.status(201).json({ success: true, data: attendance })

    // Notify parents of absent/late students (async, non-blocking)
    const flagged = records.filter((r) => r.status === 'absent' || r.status === 'late')
    if (flagged.length > 0) {
      const ids = flagged.map((r) => r.student)
      Student.find({ _id: { $in: ids } })
        .populate('parentUser', 'email name')
        .populate('class', 'name')
        .then((students) => {
          students.forEach((s) => {
            const status = flagged.find((r) => r.student.toString() === s._id.toString())?.status
            if (s.parentUser?.email) {
              sendEmail({
                to: s.parentUser.email,
                subject: `📋 Présence — ${s.lastName} ${s.firstName} (${status === 'absent' ? 'Absent' : 'Retard'})`,
                html: `<p>Bonjour,</p>
                  <p>Votre enfant <strong>${s.lastName} ${s.firstName}</strong> (${s.class?.name || ''}) a été marqué(e) <strong style="color:${status === 'absent' ? '#DC2626' : '#D97706'}">${status === 'absent' ? 'absent(e)' : 'en retard'}</strong> le <strong>${new Date(date).toLocaleDateString('fr-FR')}</strong>.</p>
                  <p>Connectez-vous à votre espace parent pour plus de détails.</p>
                  <p style="color:#6B7280;font-size:12px;margin-top:24px">— KATD-SCHÜLE</p>`,
              }).catch(() => {})
            }
          })
        }).catch(() => {})
    }
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
