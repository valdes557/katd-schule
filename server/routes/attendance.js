const express = require('express')
const router = express.Router()
const Attendance = require('../models/Attendance')
const { protect, authorize } = require('../middleware/auth')

// GET /api/attendance
router.get('/', protect, async (req, res) => {
  try {
    const { classId, from, to, page = 1, limit = 30 } = req.query
    const query = { school: req.user.school._id || req.user.school }
    if (classId) query.class = classId
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
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
