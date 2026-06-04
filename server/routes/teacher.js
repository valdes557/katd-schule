const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')
const multer = require('multer')
const path = require('path')
const { protect } = require('../middleware/auth')
const Teacher = require('../models/Teacher')
const Student = require('../models/Student')
const User = require('../models/User')
const Grade = require('../models/Grade')
const Attendance = require('../models/Attendance')
const Homework = require('../models/Homework')
const Class = require('../models/Class')
const Subject = require('../models/Subject')
const Activity = require('../models/Activity')
const Resource = require('../models/Resource')
const DailyReport = require('../models/DailyReport')
const SchoolPost = require('../models/SchoolPost')
const { sendEmail } = require('../utils/emailService')

const teacherOnly = (req, res, next) => {
  if (req.user.role !== 'enseignant') return res.status(403).json({ message: 'Accès réservé aux enseignants' })
  next()
}

// Helper: get teacher profile from User
async function getTeacherProfile(userId) {
  return Teacher.findOne({ user: userId }).populate('classes', 'name level cycle room stats')
}

// Multer config for daily report attachments (PDF only)
const reportStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, `report-${unique}${path.extname(file.originalname)}`)
  },
})

function reportFileFilter(req, file, cb) {
  if (!file.mimetype || !file.mimetype.includes('pdf')) {
    return cb(new Error('Seuls les fichiers PDF sont autorisés pour les rapports'))
  }
  cb(null, true)
}

const uploadReport = multer({
  storage: reportStorage,
  fileFilter: reportFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
})

// ─── DASHBOARD ───
router.get('/dashboard', protect, teacherOnly, async (req, res) => {
  try {
    const teacher = await getTeacherProfile(req.user._id)
    if (!teacher) return res.status(404).json({ message: 'Profil enseignant non trouvé' })

    const classIds = (teacher.classes || []).map((c) => c._id)
    const schoolId = teacher.school

    const [studentCount, recentGrades, attendanceAgg, homeworkAgg, upcomingHomework, announcements] = await Promise.all([
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
      // Recent school announcements
      SchoolPost.find({ school: schoolId, isPublic: true })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('title content createdAt'),
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
          cycle: teacher.cycle,
          speciality: teacher.speciality,
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
        announcements,
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

    // Notify parents of all students in this class (async, non-blocking)
    Student.find({ class: hw.class, status: 'active' }).populate('parentUser', 'email name').then((students) => {
      students.filter((s) => s.parentUser?.email).forEach((s) => {
        sendEmail({
          to: s.parentUser.email,
          subject: `📚 Nouveau devoir — ${hw.subject} | ${populated.class?.name || ''}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:#2563EB;padding:20px;border-radius:8px 8px 0 0"><h2 style="color:white;margin:0">Nouveau devoir assigné</h2></div><div style="background:#F9FAFB;padding:20px;border:1px solid #E5E7EB;border-top:0;border-radius:0 0 8px 8px"><p>Bonjour <strong>${s.parentUser.name}</strong>,</p><p>Un nouveau devoir a été assigné à votre enfant <strong>${s.lastName} ${s.firstName}</strong> :</p><table style="width:100%;border-collapse:collapse;font-size:14px"><tr><td style="padding:8px;border-bottom:1px solid #E5E7EB;color:#6B7280">Matière</td><td style="padding:8px;border-bottom:1px solid #E5E7EB;font-weight:700">${hw.subject}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #E5E7EB;color:#6B7280">Titre</td><td style="padding:8px;border-bottom:1px solid #E5E7EB">${hw.title}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #E5E7EB;color:#6B7280">Type</td><td style="padding:8px;border-bottom:1px solid #E5E7EB">${hw.type}</td></tr><tr><td style="padding:8px;color:#6B7280">À remettre le</td><td style="padding:8px;font-weight:700;color:#DC2626">${new Date(hw.dueDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</td></tr></table>${hw.description ? `<p style="margin-top:12px;font-size:13px;color:#4B5563"><em>${hw.description}</em></p>` : ''}<div style="text-align:center;margin-top:20px"><a href="${process.env.CLIENT_URL || 'https://katd-schule.vercel.app'}/login" style="background:#2563EB;color:white;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px">Voir sur mon espace</a></div></div></div>`,
        }).catch(() => {})
      })
    }).catch(() => {})
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

// ─── LISTE DES PARENTS DE LA CLASSE ───
router.get('/class/:classId/parents', protect, teacherOnly, async (req, res) => {
  try {
    const teacher = await getTeacherProfile(req.user._id)
    if (!teacher) return res.status(404).json({ message: 'Profil enseignant non trouvé' })

    // Verify teacher has this class
    const hasClass = teacher.classes.some((c) => c._id.toString() === req.params.classId)
    if (!hasClass) return res.status(403).json({ message: 'Cette classe ne vous est pas assignée' })

    const students = await Student.find({ class: req.params.classId, status: 'active' })
      .populate('parentUser', 'email lastLogin phone')
      .sort({ lastName: 1 })

    const result = students.map((s) => ({
      studentId: s._id,
      studentName: `${s.lastName} ${s.firstName}`,
      matricule: s.matricule,
      parent: {
        name: s.parent?.name,
        phone: s.parent?.phone || s.parentUser?.phone,
        email: s.parent?.email || s.parentUser?.email,
        relation: s.parent?.relation,
        hasAccount: !!s.parentUser,
        lastLogin: s.parentUser?.lastLogin,
      },
    }))

    res.json({ success: true, data: result })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ─── MARQUER LE STATUT DEVOIR PAR ÉLÈVE (fait / non fait) ───
router.put('/homework/:hwId/completion', protect, teacherOnly, async (req, res) => {
  try {
    const teacher = await getTeacherProfile(req.user._id)
    if (!teacher) return res.status(404).json({ message: 'Profil enseignant non trouvé' })

    const homework = await Homework.findOne({ _id: req.params.hwId, teacher: teacher._id })
    if (!homework) return res.status(404).json({ message: 'Devoir non trouvé' })

    const { completions } = req.body // [{ studentId, done: true/false }]
    if (!Array.isArray(completions)) return res.status(400).json({ message: 'completions doit être un tableau' })

    // Sync submissions: add done entries, remove not-done
    completions.forEach(({ studentId, done }) => {
      const idx = homework.submissions.findIndex((s) => s.student.toString() === studentId)
      if (done && idx === -1) {
        homework.submissions.push({ student: studentId, status: 'submitted', submittedAt: new Date() })
      } else if (!done && idx !== -1) {
        homework.submissions.splice(idx, 1)
      }
    })
    await homework.save()

    // Notify parents of absent students via email (async, non-blocking)
    const notDoneStudentIds = completions.filter((c) => !c.done).map((c) => c.studentId)
    if (notDoneStudentIds.length > 0) {
      Student.find({ _id: { $in: notDoneStudentIds } })
        .populate('parentUser', 'email name')
        .then((students) => {
          students.forEach((s) => {
            if (s.parentUser?.email) {
              sendEmail({
                to: s.parentUser.email,
                subject: `📚 Devoir non remis — ${homework.subject}`,
                html: `<p>Bonjour,</p><p>Votre enfant <strong>${s.lastName} ${s.firstName}</strong> n'a pas remis le devoir de <strong>${homework.subject}</strong> : "${homework.title}" (date limite : ${new Date(homework.dueDate).toLocaleDateString('fr-FR')}).</p><p>Connectez-vous à votre espace parent pour plus de détails.</p>`,
              }).catch(() => {})
            }
          })
        }).catch(() => {})
    }

    res.json({ success: true, message: 'Statut des devoirs mis à jour', data: homework })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ─── SOUMETTRE LA PRÉSENCE + NOTIFIER LES PARENTS ───
// Override the existing attendance submission to also notify parents (new route suffix)
router.post('/attendance/:classId/notify', protect, teacherOnly, async (req, res) => {
  try {
    // Find absent/late students and email their parents
    const { attendanceId } = req.body
    const attendance = await Attendance.findById(attendanceId)
    if (!attendance) return res.status(404).json({ message: 'Présence non trouvée' })

    const absentIds = attendance.records.filter((r) => r.status === 'absent' || r.status === 'late').map((r) => r.student)
    const students = await Student.find({ _id: { $in: absentIds } }).populate('parentUser', 'email name')

    let sent = 0
    for (const s of students) {
      if (s.parentUser?.email) {
        const status = attendance.records.find((r) => r.student.toString() === s._id.toString())?.status
        await sendEmail({
          to: s.parentUser.email,
          subject: `📋 Présence — ${s.lastName} ${s.firstName}`,
          html: `<p>Bonjour,</p><p>Votre enfant <strong>${s.lastName} ${s.firstName}</strong> a été marqué(e) <strong>${status === 'absent' ? 'absent(e)' : 'en retard'}</strong> le ${new Date(attendance.date).toLocaleDateString('fr-FR')}.</p><p>Connectez-vous à votre espace parent pour voir le détail.</p>`,
        }).catch(() => {})
        sent++
      }
    }

    res.json({ success: true, message: `${sent} parent(s) notifié(s)` })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ─── ACTIVITIES ───
router.get('/activities', protect, teacherOnly, async (req, res) => {
  try {
    const teacher = await getTeacherProfile(req.user._id)
    if (!teacher) return res.json({ success: true, data: [] })
    const items = await Activity.find({ teacher: teacher._id })
      .populate('class', 'name level')
      .sort({ date: -1 })
    res.json({ success: true, data: items })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

router.post('/activities', protect, teacherOnly, async (req, res) => {
  try {
    const teacher = await getTeacherProfile(req.user._id)
    if (!teacher) return res.status(404).json({ message: 'Profil enseignant non trouvé' })
    const teacherClassIds = (teacher.classes || []).map((c) => c._id.toString())
    if (!req.body.class || !teacherClassIds.includes(req.body.class.toString())) {
      return res.status(403).json({ message: "Activité possible uniquement pour vos classes" })
    }
    const act = await Activity.create({
      ...req.body,
      teacher: teacher._id,
      school: teacher.school,
    })
    const populated = await Activity.findById(act._id).populate('class', 'name level')
    res.status(201).json({ success: true, data: populated })

    // Notify parents of class
    Student.find({ class: act.class, status: 'active' }).populate('parentUser', 'email name').then((students) => {
      students.filter((s) => s.parentUser?.email).forEach((s) => {
        sendEmail({
          to: s.parentUser.email,
          subject: `🎯 Nouvelle activité — ${act.title}`,
          html: `<p>Bonjour <strong>${s.parentUser.name}</strong>,</p>
            <p>Une activité a été planifiée pour la classe de <strong>${s.lastName} ${s.firstName}</strong> :</p>
            <ul>
              <li><strong>${act.title}</strong> (${act.type})</li>
              <li>Date : <strong>${new Date(act.date).toLocaleDateString('fr-FR')}</strong></li>
              ${act.location ? `<li>Lieu : ${act.location}</li>` : ''}
              ${act.cost ? `<li>Coût : ${act.cost} FCFA</li>` : ''}
            </ul>
            ${act.description ? `<p><em>${act.description}</em></p>` : ''}
            <p style="color:#6B7280;font-size:12px">— KATD-SCHÜLE</p>`,
        }).catch(() => {})
      })
    }).catch(() => {})
  } catch (err) { res.status(500).json({ message: err.message }) }
})

router.put('/activities/:id', protect, teacherOnly, async (req, res) => {
  try {
    const teacher = await getTeacherProfile(req.user._id)
    if (!teacher) return res.status(404).json({ message: 'Profil enseignant non trouvé' })
    const act = await Activity.findOneAndUpdate(
      { _id: req.params.id, teacher: teacher._id },
      req.body,
      { new: true, runValidators: true }
    ).populate('class', 'name level')
    if (!act) return res.status(404).json({ message: 'Activité non trouvée' })
    res.json({ success: true, data: act })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

router.delete('/activities/:id', protect, teacherOnly, async (req, res) => {
  try {
    const teacher = await getTeacherProfile(req.user._id)
    if (!teacher) return res.status(404).json({ message: 'Profil enseignant non trouvé' })
    const r = await Activity.findOneAndDelete({ _id: req.params.id, teacher: teacher._id })
    if (!r) return res.status(404).json({ message: 'Activité non trouvée' })
    res.json({ success: true, message: 'Activité supprimée' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ─── RESOURCES ───
router.get('/resources', protect, teacherOnly, async (req, res) => {
  try {
    const teacher = await getTeacherProfile(req.user._id)
    if (!teacher) return res.json({ success: true, data: [] })
    const items = await Resource.find({ teacher: teacher._id })
      .populate('classes', 'name level')
      .sort({ createdAt: -1 })
    res.json({ success: true, data: items })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

router.post('/resources', protect, teacherOnly, async (req, res) => {
  try {
    const teacher = await getTeacherProfile(req.user._id)
    if (!teacher) return res.status(404).json({ message: 'Profil enseignant non trouvé' })
    const teacherClassIds = (teacher.classes || []).map((c) => c._id.toString())
    const targetClasses = (req.body.classes || []).filter((c) => teacherClassIds.includes(c.toString()))
    if (targetClasses.length === 0) {
      return res.status(403).json({ message: "Sélectionnez au moins une de vos classes" })
    }
    const r = await Resource.create({
      ...req.body,
      classes: targetClasses,
      teacher: teacher._id,
      school: teacher.school,
      author: req.user._id,
    })
    res.status(201).json({ success: true, data: r })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

router.put('/resources/:id', protect, teacherOnly, async (req, res) => {
  try {
    const teacher = await getTeacherProfile(req.user._id)
    if (!teacher) return res.status(404).json({ message: 'Profil enseignant non trouvé' })
    const r = await Resource.findOneAndUpdate(
      { _id: req.params.id, teacher: teacher._id },
      req.body,
      { new: true, runValidators: true }
    )
    if (!r) return res.status(404).json({ message: 'Ressource non trouvée' })
    res.json({ success: true, data: r })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

router.delete('/resources/:id', protect, teacherOnly, async (req, res) => {
  try {
    const teacher = await getTeacherProfile(req.user._id)
    if (!teacher) return res.status(404).json({ message: 'Profil enseignant non trouvé' })
    const r = await Resource.findOneAndDelete({ _id: req.params.id, teacher: teacher._id })
    if (!r) return res.status(404).json({ message: 'Ressource non trouvée' })
    res.json({ success: true, message: 'Ressource supprimée' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ─── DAILY REPORTS ───
router.get('/reports', protect, teacherOnly, async (req, res) => {
  try {
    const teacher = await getTeacherProfile(req.user._id)
    if (!teacher) return res.status(404).json({ message: 'Profil enseignant non trouvé' })
    const items = await DailyReport.find({ teacher: teacher._id })
      .populate('classes', 'name level')
      .sort({ date: -1, createdAt: -1 })
      .limit(100)
    res.json({ success: true, data: items })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

router.post('/reports', protect, teacherOnly, uploadReport.single('attachment'), async (req, res) => {
  try {
    const teacher = await getTeacherProfile(req.user._id)
    if (!teacher) return res.status(404).json({ message: 'Profil enseignant non trouvé' })
    const teacherClassIds = (teacher.classes || []).map((c) => c._id.toString())
    const targetClasses = (req.body.classes || []).filter((c) => teacherClassIds.includes(c.toString()))
    if (targetClasses.length === 0) {
      return res.status(403).json({ message: 'Sélectionnez au moins une de vos classes' })
    }
    const payload = {
      title: req.body.title || `Rapport du ${new Date().toLocaleDateString('fr-FR')}`,
      content: req.body.content,
      classes: targetClasses,
      teacher: teacher._id,
      school: teacher.school,
      date: req.body.date || new Date(),
    }
    if (!payload.content || String(payload.content).trim().length === 0) {
      return res.status(400).json({ message: 'Le contenu du rapport est requis' })
    }
    if (req.file) {
      payload.attachmentUrl = `/uploads/${req.file.filename}`
      payload.attachmentName = req.file.originalname
    }

    const r = await DailyReport.create(payload)
    const populated = await DailyReport.findById(r._id).populate('classes', 'name level')
    res.status(201).json({ success: true, data: populated })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// Update a teacher's own report (title/content only for now)
router.put('/reports/:id', protect, teacherOnly, async (req, res) => {
  try {
    const teacher = await getTeacherProfile(req.user._id)
    if (!teacher) return res.status(404).json({ message: 'Profil enseignant non trouvé' })

    const update = {}
    if (typeof req.body.title !== 'undefined') {
      update.title = req.body.title
    }
    if (typeof req.body.content !== 'undefined') {
      if (!String(req.body.content).trim().length) {
        return res.status(400).json({ message: 'Le contenu du rapport est requis' })
      }
      update.content = req.body.content
    }

    const r = await DailyReport.findOneAndUpdate(
      { _id: req.params.id, teacher: teacher._id },
      update,
      { new: true }
    ).populate('classes', 'name level')

    if (!r) return res.status(404).json({ message: 'Rapport non trouvé' })
    res.json({ success: true, data: r })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// Delete a teacher's own report
router.delete('/reports/:id', protect, teacherOnly, async (req, res) => {
  try {
    const teacher = await getTeacherProfile(req.user._id)
    if (!teacher) return res.status(404).json({ message: 'Profil enseignant non trouvé' })

    const r = await DailyReport.findOneAndDelete({ _id: req.params.id, teacher: teacher._id })
    if (!r) return res.status(404).json({ message: 'Rapport non trouvé' })

    res.json({ success: true, message: 'Rapport supprimé' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
