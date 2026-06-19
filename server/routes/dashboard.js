const express = require('express')
const router = express.Router()
const Student = require('../models/Student')
const Teacher = require('../models/Teacher')
const Class = require('../models/Class')
const Grade = require('../models/Grade')
const Attendance = require('../models/Attendance')
const Media = require('../models/Media')
const Message = require('../models/Message')
const Homework = require('../models/Homework')
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
  } catch (err) { res.status(500).json({ message: err.message }) }
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
  } catch (err) { res.status(500).json({ message: err.message }) }
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
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/dashboard/homework-overview — supervision des devoirs par classe (directeur)
// Permet au directeur de vérifier que les enseignants donnent ET corrigent les devoirs.
router.get('/homework-overview', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const schoolId = req.user.school?._id || req.user.school
    if (!schoolId) return res.json({ success: true, data: { classes: [], summary: {} } })

    const [classes, homeworks] = await Promise.all([
      Class.find({ school: schoolId }).select('name level cycle').sort({ name: 1 }).lean(),
      Homework.find({ school: schoolId })
        .populate('class', 'name level')
        .populate('teacher', 'firstName lastName')
        .sort({ dueDate: -1 })
        .lean(),
    ])

    const now = new Date()
    // Nombre d'élèves actifs par classe (une seule passe)
    const studentCounts = {}
    await Promise.all(
      classes.map(async (c) => {
        studentCounts[c._id.toString()] = await Student.countDocuments({ class: c._id, status: 'active' })
      })
    )

    const enrichHw = (h) => {
      const submissionCount = (h.submissions || []).length
      const gradedCount = (h.submissions || []).filter((s) => s.status === 'graded').length
      const totalStudents = studentCounts[(h.class?._id || h.class || '').toString()] || 0
      return {
        _id: h._id,
        title: h.title,
        subject: h.subject,
        type: h.type,
        dueDate: h.dueDate,
        teacherId: (h.teacher?._id || '').toString(),
        teacherName: h.teacher ? `${h.teacher.firstName || ''} ${h.teacher.lastName || ''}`.trim() : 'Direction',
        className: h.class?.name || '',
        classId: (h.class?._id || h.class || '').toString(),
        totalStudents,
        submissionCount,
        gradedCount,
        notSubmitted: Math.max(0, totalStudents - submissionCount),
        isOverdue: new Date(h.dueDate) < now,
        fullyGraded: submissionCount > 0 && gradedCount === submissionCount,
      }
    }

    const enriched = homeworks.map(enrichHw)

    // Regrouper par classe (toutes les classes apparaissent, même sans devoir)
    const byClass = classes.map((c) => {
      const id = c._id.toString()
      const items = enriched.filter((h) => h.classId === id)
      const ungraded = items.reduce((n, h) => n + (h.submissionCount - h.gradedCount), 0)
      return {
        classId: id,
        className: c.name,
        level: c.level,
        cycle: c.cycle,
        totalHomeworks: items.length,
        ungradedSubmissions: ungraded,
        overdueWithMissing: items.filter((h) => h.isOverdue && h.notSubmitted > 0).length,
        homeworks: items,
      }
    })

    // Regrouper par enseignant : qui a donné et corrigé les devoirs, et de quel type.
    const teacherMap = {}
    for (const h of enriched) {
      const key = h.teacherId || 'direction'
      if (!teacherMap[key]) {
        teacherMap[key] = {
          teacherId: h.teacherId || null,
          teacherName: h.teacherName || 'Direction',
          classes: new Set(),
          totalHomeworks: 0,
          correctedHomeworks: 0,
          pendingCorrection: 0,
          byType: {},
        }
      }
      const t = teacherMap[key]
      if (h.className) t.classes.add(h.className)
      t.totalHomeworks += 1
      if (h.fullyGraded) t.correctedHomeworks += 1
      t.pendingCorrection += Math.max(0, h.submissionCount - h.gradedCount)
      t.byType[h.type] = (t.byType[h.type] || 0) + 1
    }
    const byTeacher = Object.values(teacherMap)
      .map((t) => ({ ...t, classes: Array.from(t.classes).sort() }))
      .sort((a, b) => b.totalHomeworks - a.totalHomeworks)

    const totalHomeworks = enriched.length
    const totalGraded = enriched.filter((h) => h.fullyGraded).length
    const summary = {
      totalHomeworks,
      totalClasses: classes.length,
      classesWithoutHomework: byClass.filter((c) => c.totalHomeworks === 0).length,
      fullyGradedHomeworks: totalGraded,
      pendingCorrection: enriched.reduce((n, h) => n + (h.submissionCount - h.gradedCount), 0),
      gradedRate: totalHomeworks > 0 ? Math.round((totalGraded / totalHomeworks) * 100) : 0,
    }

    res.json({ success: true, data: { classes: byClass, byTeacher, summary } })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
