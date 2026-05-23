const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')
const { protect } = require('../middleware/auth')
const Teacher = require('../models/Teacher')
const Student = require('../models/Student')
const Grade = require('../models/Grade')
const Attendance = require('../models/Attendance')
const Homework = require('../models/Homework')
const Class = require('../models/Class')
const Subject = require('../models/Subject')

const teacherOnly = (req, res, next) => {
  if (req.user.role !== 'enseignant') return res.status(403).json({ message: 'Accès réservé aux enseignants' })
  next()
}

// Helper: get teacher profile from User
async function getTeacherProfile(userId) {
  return Teacher.findOne({ user: userId }).populate('classes', 'name level cycle stats')
}

// ─── DASHBOARD ───
router.get('/dashboard', protect, teacherOnly, async (req, res) => {
  try {
    const teacher = await getTeacherProfile(req.user._id)
    if (!teacher) return res.status(404).json({ message: 'Profil enseignant non trouvé' })

    const classIds = (teacher.classes || []).map((c) => c._id)
    const schoolId = teacher.school

    const [studentCount, recentGrades, attendanceAgg, homeworkAgg, upcomingHomework] = await Promise.all([
      Student.countDocuments({ class: { $in: classIds }, status: 'active' }),
      Grade.find({ teacher: teacher._id }).sort({ date: -1 }).limit(10)
        .populate('student', 'firstName lastName'),
      // Attendance rate for my classes
      Attendance.aggregate([
        { $match: { class: { $in: classIds } } },
        { $unwind: '$records' },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            present: { $sum: { $cond: [{ $eq: ['$records.status', 'present'] }, 1, 0] } },
            absent: { $sum: { $cond: [{ $eq: ['$records.status', 'absent'] }, 1, 0] } },
            late: { $sum: { $cond: [{ $eq: ['$records.status', 'late'] }, 1, 0] } },
          },
        },
      ]),
      // Homework stats
      Homework.aggregate([
        { $match: { teacher: teacher._id } },
        {
          $project: {
            submissionCount: { $size: '$submissions' },
            isPastDue: { $lt: ['$dueDate', new Date()] },
            classStudents: 1,
            class: 1,
            dueDate: 1,
            title: 1,
            subject: 1,
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            withSubmissions: { $sum: { $cond: [{ $gt: ['$submissionCount', 0] }, 1, 0] } },
            pastDue: { $sum: { $cond: ['$isPastDue', 1, 0] } },
            totalSubmissions: { $sum: '$submissionCount' },
          },
        },
      ]),
      // Upcoming due homeworks
      Homework.find({ teacher: teacher._id, dueDate: { $gte: new Date() } })
        .sort({ dueDate: 1 }).limit(5).populate('class', 'name'),
    ])

    const att = attendanceAgg[0] || { total: 0, present: 0, absent: 0, late: 0 }
    const hw = homeworkAgg[0] || { total: 0, withSubmissions: 0, pastDue: 0, totalSubmissions: 0 }

    // Smart alerts
    const alerts = []

    // Late homework submissions
    const lateHomeworks = await Homework.find({
      teacher: teacher._id,
      dueDate: { $lt: new Date() },
    }).populate('class', 'name')
    for (const h of lateHomeworks) {
      const classStudents = await Student.countDocuments({ class: h.class._id, status: 'active' })
      const notSubmitted = classStudents - h.submissions.length
      if (notSubmitted > 0) {
        alerts.push({
          type: 'warning',
          message: `${notSubmitted} élève(s) n'ont pas rendu "${h.title}" (${h.class.name})`,
        })
      }
    }

    // Low grades
    const lowGradeStudents = await Grade.aggregate([
      { $match: { teacher: teacher._id } },
      { $group: { _id: '$student', avg: { $avg: '$value' } } },
      { $match: { avg: { $lt: 8 } } },
    ])
    if (lowGradeStudents.length > 0) {
      alerts.push({
        type: 'danger',
        message: `${lowGradeStudents.length} élève(s) avec une moyenne en dessous de 8/20`,
      })
    }

    // Attendance
    if (att.total > 0 && (att.absent / att.total) > 0.15) {
      alerts.push({
        type: 'warning',
        message: `Taux d'absence élevé: ${Math.round((att.absent / att.total) * 100)}% dans vos classes`,
      })
    }

    res.json({
      success: true,
      data: {
        teacher: {
          _id: teacher._id,
          firstName: teacher.firstName,
          lastName: teacher.lastName,
          subjects: teacher.subjects,
          classes: teacher.classes,
        },
        stats: {
          totalStudents: studentCount,
          totalClasses: classIds.length,
          totalSubjects: teacher.subjects?.length || 0,
          averageGrade: recentGrades.length > 0
            ? Math.round((recentGrades.reduce((s, g) => s + g.value, 0) / recentGrades.length) * 10) / 10
            : 0,
          attendanceRate: att.total > 0 ? Math.round((att.present / att.total) * 100) : 0,
          totalAbsences: att.absent,
          homeworkTotal: hw.total,
          homeworkPastDue: hw.pastDue,
          totalSubmissions: hw.totalSubmissions,
        },
        alerts: alerts.slice(0, 5),
        recentGrades,
        upcomingHomework: upcomingHomework.map((h) => ({
          _id: h._id,
          title: h.title,
          subject: h.subject,
          dueDate: h.dueDate,
          class: h.class,
          submissionCount: h.submissions.length,
        })),
      },
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─── MY STUDENTS (with progress) ───
router.get('/students', protect, teacherOnly, async (req, res) => {
  try {
    const teacher = await getTeacherProfile(req.user._id)
    if (!teacher) return res.json({ success: true, data: [] })

    const classIds = (teacher.classes || []).map((c) => c._id)
    const students = await Student.find({ class: { $in: classIds }, status: 'active' })
      .populate('class', 'name level')
      .sort({ lastName: 1 })

    // Enrich with grade averages
    const enriched = await Promise.all(
      students.map(async (s) => {
        const grades = await Grade.find({ student: s._id, teacher: teacher._id })
        const avg = grades.length > 0 ? Math.round((grades.reduce((sum, g) => sum + g.value, 0) / grades.length) * 10) / 10 : null
        const attDocs = await Attendance.find({ 'records.student': s._id, class: s.class })
        let present = 0, total = 0
        attDocs.forEach((a) => {
          const rec = a.records.find((r) => r.student.toString() === s._id.toString())
          if (rec) { total++; if (rec.status === 'present') present++ }
        })
        return {
          _id: s._id,
          firstName: s.firstName,
          lastName: s.lastName,
          fullName: `${s.lastName} ${s.firstName}`,
          photo: s.photo,
          matricule: s.matricule,
          class: s.class,
          cycle: s.cycle,
          gender: s.gender,
          averageGrade: avg,
          attendanceRate: total > 0 ? Math.round((present / total) * 100) : null,
          gradeCount: grades.length,
        }
      })
    )

    res.json({ success: true, data: enriched })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─── HOMEWORK CRUD ───
router.get('/homeworks', protect, teacherOnly, async (req, res) => {
  try {
    const teacher = await getTeacherProfile(req.user._id)
    if (!teacher) return res.json({ success: true, data: [] })

    const { classId, status } = req.query
    const query = { teacher: teacher._id }
    if (classId) query.class = classId
    const homeworks = await Homework.find(query).populate('class', 'name level').sort({ dueDate: -1 })

    const now = new Date()
    const enriched = await Promise.all(
      homeworks.map(async (h) => {
        const classStudents = await Student.countDocuments({ class: h.class._id, status: 'active' })
        const hw = h.toObject()
        hw.totalStudents = classStudents
        hw.submissionCount = h.submissions.length
        hw.notSubmitted = classStudents - h.submissions.length
        hw.isOverdue = h.dueDate < now
        hw.gradedCount = h.submissions.filter((s) => s.status === 'graded').length
        return hw
      })
    )

    const filtered = status === 'overdue'
      ? enriched.filter((h) => h.isOverdue && h.notSubmitted > 0)
      : status === 'graded'
        ? enriched.filter((h) => h.gradedCount === h.submissionCount && h.submissionCount > 0)
        : enriched

    res.json({ success: true, data: filtered })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/homeworks', protect, teacherOnly, async (req, res) => {
  try {
    const teacher = await getTeacherProfile(req.user._id)
    if (!teacher) return res.status(404).json({ message: 'Profil enseignant non trouvé' })

    const hw = await Homework.create({
      ...req.body,
      teacher: teacher._id,
      school: teacher.school,
    })
    const populated = await Homework.findById(hw._id).populate('class', 'name level')
    res.status(201).json({ success: true, data: populated })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.put('/homeworks/:id', protect, teacherOnly, async (req, res) => {
  try {
    const hw = await Homework.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('class', 'name level')
    if (!hw) return res.status(404).json({ message: 'Devoir non trouvé' })
    res.json({ success: true, data: hw })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.delete('/homeworks/:id', protect, teacherOnly, async (req, res) => {
  try {
    await Homework.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: 'Devoir supprimé' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// Grade a submission
router.put('/homeworks/:hwId/submissions/:subId/grade', protect, teacherOnly, async (req, res) => {
  try {
    const hw = await Homework.findById(req.params.hwId)
    if (!hw) return res.status(404).json({ message: 'Devoir non trouvé' })
    const sub = hw.submissions.id(req.params.subId)
    if (!sub) return res.status(404).json({ message: 'Soumission non trouvée' })
    sub.grade = req.body.grade
    sub.comment = req.body.comment || sub.comment
    sub.status = 'graded'
    await hw.save()
    res.json({ success: true, data: hw })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─── ANALYTICS ───
router.get('/analytics', protect, teacherOnly, async (req, res) => {
  try {
    const teacher = await getTeacherProfile(req.user._id)
    if (!teacher) return res.json({ success: true, data: {} })

    const classIds = (teacher.classes || []).map((c) => c._id)

    // Grade distribution
    const gradeDistribution = await Grade.aggregate([
      { $match: { teacher: teacher._id } },
      {
        $bucket: {
          groupBy: '$value',
          boundaries: [0, 5, 8, 10, 12, 14, 16, 20.01],
          default: 'other',
          output: { count: { $sum: 1 } },
        },
      },
    ])

    // Per-class average
    const classAverages = await Grade.aggregate([
      { $match: { teacher: teacher._id } },
      {
        $group: {
          _id: '$class',
          average: { $avg: '$value' },
          count: { $sum: 1 },
        },
      },
    ])
    // Populate class names
    const classMap = {}
    for (const cl of teacher.classes || []) { classMap[cl._id.toString()] = cl.name }
    const classAvgEnriched = classAverages.map((c) => ({
      class: classMap[c._id?.toString()] || 'Classe inconnue',
      average: Math.round(c.average * 10) / 10,
      count: c.count,
    }))

    // Per-subject average
    const subjectAverages = await Grade.aggregate([
      { $match: { teacher: teacher._id } },
      { $group: { _id: '$subject', average: { $avg: '$value' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])

    // Homework completion rate per class
    const hwCompletion = await Promise.all(
      (teacher.classes || []).map(async (cl) => {
        const hws = await Homework.find({ teacher: teacher._id, class: cl._id })
        const totalStudents = await Student.countDocuments({ class: cl._id, status: 'active' })
        let totalExpected = 0, totalSubmitted = 0
        hws.forEach((h) => {
          totalExpected += totalStudents
          totalSubmitted += h.submissions.length
        })
        return {
          class: cl.name,
          completionRate: totalExpected > 0 ? Math.round((totalSubmitted / totalExpected) * 100) : 0,
          homeworkCount: hws.length,
        }
      })
    )

    // Attendance trend (last 4 weeks)
    const fourWeeksAgo = new Date()
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)
    const attTrend = await Attendance.aggregate([
      { $match: { class: { $in: classIds }, date: { $gte: fourWeeksAgo } } },
      { $unwind: '$records' },
      {
        $group: {
          _id: { $week: '$date' },
          total: { $sum: 1 },
          present: { $sum: { $cond: [{ $eq: ['$records.status', 'present'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          week: '$_id',
          rate: { $multiply: [{ $divide: ['$present', '$total'] }, 100] },
        },
      },
    ])

    res.json({
      success: true,
      data: {
        gradeDistribution: gradeDistribution.map((b) => ({
          range: b._id === 'other' ? '20' : `${b._id}-${b._id + (b._id < 16 ? (b._id < 5 ? 5 : b._id < 8 ? 3 : 2) : 4)}`,
          count: b.count,
        })),
        classAverages: classAvgEnriched,
        subjectAverages: subjectAverages.map((s) => ({ subject: s._id, average: Math.round(s.average * 10) / 10, count: s.count })),
        hwCompletion,
        attendanceTrend: attTrend,
      },
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
