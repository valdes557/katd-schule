const express = require('express')
const router = express.Router()
const Student = require('../models/Student')
const Teacher = require('../models/Teacher')
const Class = require('../models/Class')
const Grade = require('../models/Grade')
const Attendance = require('../models/Attendance')
const Media = require('../models/Media')
const Message = require('../models/Message')
const { protect, authorize } = require('../middleware/auth')
const DailyReport = require('../models/DailyReport')

// GET /api/dashboard/stats — all KPIs for the school
router.get('/stats', protect, async (req, res) => {
  try {
    const schoolId = req.user.school?._id || req.user.school
    if (!schoolId) {
      return res.json({ success: true, data: { totalStudents: 0, totalTeachers: 0, totalClasses: 0, totalMedia: 0, averageGrade: 0, attendanceRate: 0, unreadMessages: 0, gradesBySubject: [], recentAttendance: [], studentsByCycle: [] } })
    }

    const [totalStudents, totalTeachers, totalClasses, totalMedia] = await Promise.all([
      Student.countDocuments({ school: schoolId, status: 'active' }),
      Teacher.countDocuments({ school: schoolId, status: 'active' }),
      Class.countDocuments({ school: schoolId }),
      Media.countDocuments({ school: schoolId }),
    ])

    const gradeStats = await Grade.aggregate([
      { $match: { school: schoolId } },
      { $group: { _id: null, average: { $avg: '$value' }, count: { $sum: 1 } } },
    ])

    const attendanceStats = await Attendance.aggregate([
      { $match: { school: schoolId } },
      {
        $group: {
          _id: null,
          totalPresent: { $sum: '$summary.present' },
          total: { $sum: '$summary.total' },
        },
      },
    ])

    const unreadMessages = await Message.countDocuments({ recipient: req.user._id, read: false })

    const avgGrade = gradeStats[0]?.average || 0
    const attData = attendanceStats[0] || { totalPresent: 0, total: 0 }
    const attendanceRate = attData.total > 0 ? Math.round((attData.totalPresent / attData.total) * 100) : 0

    // Recent grades by subject for chart
    const gradesBySubject = await Grade.aggregate([
      { $match: { school: schoolId } },
      { $group: { _id: '$subject', average: { $avg: '$value' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $limit: 10 },
    ])

    // Attendance last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const recentAttendance = await Attendance.aggregate([
      { $match: { school: schoolId, date: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          present: { $sum: '$summary.present' },
          absent: { $sum: '$summary.absent' },
          total: { $sum: '$summary.total' },
        },
      },
      { $sort: { _id: 1 } },
    ])

    // Students by cycle
    const studentsByCycle = await Student.aggregate([
      { $match: { school: schoolId, status: 'active' } },
      { $group: { _id: '$cycle', count: { $sum: 1 } } },
    ])

    res.json({
      success: true,
      data: {
        totalStudents,
        totalTeachers,
        totalClasses,
        totalMedia,
        averageGrade: Math.round(avgGrade * 100) / 100,
        attendanceRate,
        unreadMessages,
        gradesBySubject,
        recentAttendance,
        studentsByCycle,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: err.message })
  }
})

// GET /api/dashboard/admin-stats — super_admin platform KPIs
router.get('/admin-stats', protect, async (req, res) => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ message: 'Accès refusé' })
  try {
    const School = require('../models/School')
    const User = require('../models/User')
    const SchoolRegistration = require('../models/SchoolRegistration')

    const [totalSchools, totalDirectors, totalTeachers, totalStudents, pendingRegistrations, totalClasses] = await Promise.all([
      School.countDocuments({}),
      User.countDocuments({ role: 'directeur' }),
      Teacher.countDocuments({}),
      Student.countDocuments({}),
      SchoolRegistration.countDocuments({ status: 'pending' }),
      Class.countDocuments({}),
    ])

    const recentSchools = await School.find({}).sort({ createdAt: -1 }).limit(5).select('name cycles address createdAt subscription')
    const recentRegistrations = await SchoolRegistration.find({}).sort({ createdAt: -1 }).limit(5).select('schoolName directorName email cycle plan amount status createdAt')

    // Revenue from approved registrations
    const revenueAgg = await SchoolRegistration.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ])

    res.json({
      success: true,
      data: {
        totalSchools, totalDirectors, totalTeachers, totalStudents,
        totalClasses, pendingRegistrations,
        totalRevenue: revenueAgg[0]?.total || 0,
        approvedCount: revenueAgg[0]?.count || 0,
        recentSchools, recentRegistrations,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: err.message })
  }
})

router.get('/reports', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const schoolId = req.user.school?._id || req.user.school
    if (!schoolId) return res.json({ success: true, data: [] })
    const { classId, teacherId, status, limit = 100 } = req.query
    const q = { school: schoolId }
    if (classId) q.classes = classId
    if (teacherId) q.teacher = teacherId
    if (status && ['submitted', 'reviewed'].includes(status)) q.status = status
    const items = await DailyReport.find(q)
      .populate('teacher', 'firstName lastName')
      .populate('classes', 'name level')
      .sort({ date: -1, createdAt: -1 })
      .limit(Number(limit))
    res.json({ success: true, data: items })
  } catch (err) { console.error(err); res.status(500).json({ message: err.message }) }
})

router.put('/reports/:id/review', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const r = await DailyReport.findOneAndUpdate(
      { _id: req.params.id, school: req.user.school?._id || req.user.school },
      { status: 'reviewed', reviewedAt: new Date(), reviewedBy: req.user._id },
      { new: true }
    ).populate('teacher', 'firstName lastName').populate('classes', 'name level')
    if (!r) return res.status(404).json({ message: 'Rapport non trouvé' })
    res.json({ success: true, data: r })
  } catch (err) { console.error(err); res.status(500).json({ message: err.message }) }
})

router.put('/reports/:id/unreview', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const r = await DailyReport.findOneAndUpdate(
      { _id: req.params.id, school: req.user.school?._id || req.user.school },
      { status: 'submitted', reviewedAt: null, reviewedBy: null },
      { new: true }
    ).populate('teacher', 'firstName lastName').populate('classes', 'name level')
    if (!r) return res.status(404).json({ message: 'Rapport non trouvé' })
    res.json({ success: true, data: r })
  } catch (err) { console.error(err); res.status(500).json({ message: err.message }) }
})

module.exports = router
