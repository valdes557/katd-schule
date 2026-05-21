const express = require('express')
const router = express.Router()
const Student = require('../models/Student')
const Teacher = require('../models/Teacher')
const Class = require('../models/Class')
const Grade = require('../models/Grade')
const Attendance = require('../models/Attendance')
const Media = require('../models/Media')
const Message = require('../models/Message')
const { protect } = require('../middleware/auth')

// GET /api/dashboard/stats — all KPIs for the school
router.get('/stats', protect, async (req, res) => {
  try {
    const schoolId = req.user.school._id || req.user.school

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
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
