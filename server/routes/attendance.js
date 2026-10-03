const express = require('express')
const router = express.Router()
const Attendance = require('../models/Attendance')
const Student = require('../models/Student')
const Class = require('../models/Class')
const Teacher = require('../models/Teacher')
const mongoose = require('mongoose')
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
    if (classId) {
      try {
        match.class = new mongoose.Types.ObjectId(classId)
      } catch (e) {
        return res.status(400).json({ message: 'Classe invalide' })
      }
    }

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

// POST /api/attendance/resolve-qr — appel par QR : résout le QR d'un élève {qrId, classId}
// Le professeur scanne les QR individuels de SA classe pour faire l'appel de séance.
router.post('/resolve-qr', protect, authorize('directeur', 'enseignant', 'super_admin'), async (req, res) => {
  try {
    const schoolId = req.user.school._id || req.user.school
    const qrId = (req.body.qrId || '').trim()
    const { classId } = req.body
    if (!qrId) return res.status(400).json({ message: 'QR invalide' })
    if (!classId) return res.status(400).json({ message: 'Classe requise' })

    // Le professeur ne peut faire l'appel que dans ses classes assignées
    if (req.user.role === 'enseignant') {
      const teacher = await Teacher.findOne({ user: req.user._id })
      if (!teacher) return res.status(403).json({ message: 'Profil enseignant non trouvé' })
      const teacherClassIds = (teacher.classes || []).map((c) => c.toString())
      if (!teacherClassIds.includes(classId.toString())) {
        return res.status(403).json({ message: "Vous ne pouvez faire l'appel que pour vos classes assignées" })
      }
    }

    const student = await Student.findOne({ attendanceQrId: qrId }).populate('class', 'name')
    if (!student) return res.status(404).json({ message: 'QR inconnu' })
    if (String(student.school) !== String(schoolId)) return res.status(403).json({ message: "QR d'un autre établissement" })
    if (String(student.class?._id || student.class) !== String(classId)) {
      return res.status(400).json({
        message: `${student.lastName} ${student.firstName} n'est pas dans cette classe${student.class?.name ? ` (classe : ${student.class.name})` : ''}`,
      })
    }

    res.json({
      success: true,
      data: { id: student._id, name: `${student.lastName} ${student.firstName}`, matricule: student.matricule || '', className: student.class?.name || '' },
    })
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

    // Notify parents of attendance status for each student (async, non-blocking)
    const notifiable = records.filter((r) => ['present', 'absent', 'late', 'excused'].includes(r.status))
    if (notifiable.length > 0) {
      const ids = notifiable.map((r) => r.student)
      Student.find({ _id: { $in: ids } })
        .populate('parentUser', 'email name')
        .populate('class', 'name')
        .then((students) => {
          const push = require('../services/pushService')
          students.forEach((s) => {
            const rec = notifiable.find((r) => r.student.toString() === s._id.toString())
            const status = rec?.status
            if (!status || !s.parentUser) return

            let label = 'Présent'
            let adjective = 'présent(e)'
            let color = '#16A34A'

            if (status === 'absent') {
              label = 'Absent'
              adjective = 'absent(e)'
              color = '#DC2626'
            } else if (status === 'late') {
              label = 'En retard'
              adjective = 'en retard'
              color = '#D97706'
            } else if (status === 'excused') {
              label = 'Justifié'
              adjective = 'justifié(e)'
              color = '#4F46E5'
            }

            // Push temps réel (absence/retard uniquement : signal utile, pas de spam "présent")
            if (['absent', 'late'].includes(status)) {
              push.sendToUser(s.parentUser._id, {
                title: status === 'absent' ? '🚨 Absence signalée' : '⏰ Retard signalé',
                body: `${s.lastName} ${s.firstName} (${s.class?.name || ''}) a été marqué(e) ${adjective} le ${new Date(date).toLocaleDateString('fr-FR')}`,
                url: '/dashboard/parent/presence',
              }).catch(() => {})
            }

            if (!s.parentUser.email) return
            sendEmail({
              to: s.parentUser.email,
              subject: `📋 Présence — ${s.lastName} ${s.firstName} (${label})`,
              html: `<p>Bonjour,</p>
                <p>Votre enfant <strong>${s.lastName} ${s.firstName}</strong> (${s.class?.name || ''}) a été marqué(e) <strong style="color:${color}">${adjective}</strong> le <strong>${new Date(date).toLocaleDateString('fr-FR')}</strong>.</p>
                <p>Connectez-vous à votre espace parent pour voir les détails de sa scolarité.</p>
                <p style="color:#6B7280;font-size:12px;margin-top:24px">— KATD-SCHÜLE</p>`,
            }).catch(() => {})
          })
        }).catch(() => {})
    }
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/attendance/weekly-sheet — Fiche d'appel hebdomadaire intégrée à l'agenda de la classe
router.get('/weekly-sheet', protect, async (req, res) => {
  try {
    const Timetable = require('../models/Timetable')
    const { classId, weekDate } = req.query
    if (!classId) return res.status(400).json({ message: 'classId requis' })

    const schoolId = req.user.school?._id || req.user.school
    const cls = await Class.findById(classId).lean()
    if (!cls) return res.status(404).json({ message: 'Classe non trouvée' })

    const students = await Student.find({ class: classId, school: schoolId, status: 'active' })
      .select('firstName lastName matricule photo gender parent')
      .sort({ lastName: 1 })
      .lean()

    const timetable = await Timetable.findOne({ class: classId, school: schoolId }).lean()
    const slots = timetable?.slots || []

    // Calcul des dates du lundi au samedi de la semaine cible
    const ref = weekDate ? new Date(weekDate) : new Date()
    const dayOfWeek = ref.getDay() // 0 = Dimanche, 1 = Lundi, ...
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(ref)
    monday.setDate(ref.getDate() + diffToMonday)
    monday.setHours(0, 0, 0, 0)

    const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
    const weekDays = DAYS.map((dayName, idx) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + idx)
      return {
        name: dayName,
        dateStr: d.toISOString().slice(0, 10),
        slots: slots.filter((s) => s.day === dayName),
      }
    })

    const saturday = new Date(monday)
    saturday.setDate(monday.getDate() + 5)
    saturday.setHours(23, 59, 59, 999)

    // Charger les pointages d'assiduité de cette semaine
    const attendances = await Attendance.find({
      class: classId,
      date: { $gte: monday, $lte: saturday },
    }).lean()

    // Structurer les absences par élève et par créneau
    const studentAbsences = {}
    students.forEach((st) => {
      studentAbsences[st._id] = {}
    })

    attendances.forEach((att) => {
      const attDateStr = new Date(att.date).toISOString().slice(0, 10)
      att.records?.forEach((rec) => {
        const sId = String(rec.student)
        if (!studentAbsences[sId]) studentAbsences[sId] = {}
        if (!studentAbsences[sId][attDateStr]) studentAbsences[sId][attDateStr] = { status: rec.status, slotAbsences: {} }

        rec.courseAbsences?.forEach((ca) => {
          if (ca.slotId) {
            studentAbsences[sId][attDateStr].slotAbsences[ca.slotId] = ca.isAbsent !== false
          }
        })
      })
    })

    const isTransmitted = attendances.some((a) => a.transmittedToDirector === true)

    res.json({
      success: true,
      class: cls,
      weekStart: monday.toISOString().slice(0, 10),
      weekEnd: saturday.toISOString().slice(0, 10),
      isTransmitted,
      students,
      weekDays,
      timetableSlots: slots,
      studentAbsences,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/attendance/weekly-course-absence — Marquer ou décocher l'absence d'un élève à un cours précis
router.post('/weekly-course-absence', protect, authorize('directeur', 'enseignant', 'super_admin'), async (req, res) => {
  try {
    const { classId, studentId, date, slotId, day, startTime, endTime, subject, isAbsent } = req.body
    if (!classId || !studentId || !date || !slotId) {
      return res.status(400).json({ message: 'classId, studentId, date et slotId requis' })
    }

    const schoolId = req.user.school?._id || req.user.school
    const targetDate = new Date(date)
    targetDate.setHours(12, 0, 0, 0)

    let attendance = await Attendance.findOne({ class: classId, date: targetDate })
    if (!attendance) {
      attendance = new Attendance({
        class: classId,
        school: schoolId,
        date: targetDate,
        teacher: req.user.role === 'enseignant' ? (await Teacher.findOne({ user: req.user._id }))?._id : undefined,
        records: [],
        summary: { total: 0, present: 0, absent: 0, late: 0, excused: 0 },
      })
    }

    let rec = attendance.records.find((r) => String(r.student) === String(studentId))
    if (!rec) {
      rec = {
        student: studentId,
        status: isAbsent ? 'absent' : 'present',
        courseAbsences: [],
      }
      attendance.records.push(rec)
      rec = attendance.records[attendance.records.length - 1]
    }

    if (!Array.isArray(rec.courseAbsences)) rec.courseAbsences = []

    const cIdx = rec.courseAbsences.findIndex((ca) => ca.slotId === slotId)
    if (cIdx >= 0) {
      rec.courseAbsences[cIdx].isAbsent = !!isAbsent
    } else {
      rec.courseAbsences.push({
        slotId,
        day: day || '',
        startTime: startTime || '',
        endTime: endTime || '',
        subject: subject || '',
        isAbsent: !!isAbsent,
        date,
      })
    }

    // Si au moins un cours est manqué, le statut global est marqué absent
    const hasAnyMissed = rec.courseAbsences.some((ca) => ca.isAbsent)
    rec.status = hasAnyMissed ? 'absent' : 'present'

    // Recalcul du summary
    const counts = { total: attendance.records.length, present: 0, absent: 0, late: 0, excused: 0 }
    attendance.records.forEach((r) => {
      counts[r.status] = (counts[r.status] || 0) + 1
    })
    attendance.summary = counts

    await attendance.save()

    res.json({
      success: true,
      message: isAbsent ? 'Absence enregistrée pour ce cours' : 'Présence rétablie pour ce cours',
      record: rec,
      summary: attendance.summary,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/attendance/transmit-weekly-sheet — Transmettre la fiche hebdomadaire à la direction
router.post('/transmit-weekly-sheet', protect, authorize('directeur', 'enseignant', 'super_admin'), async (req, res) => {
  try {
    const { classId, weekStartDate } = req.body
    if (!classId) return res.status(400).json({ message: 'classId requis' })

    const monday = new Date(weekStartDate || new Date())
    monday.setHours(0, 0, 0, 0)
    const saturday = new Date(monday)
    saturday.setDate(monday.getDate() + 6)
    saturday.setHours(23, 59, 59, 999)

    const updated = await Attendance.updateMany(
      { class: classId, date: { $gte: monday, $lte: saturday } },
      {
        $set: {
          transmittedToDirector: true,
          transmittedAt: new Date(),
          transmittedBy: req.user._id,
        },
      }
    )

    res.json({
      success: true,
      message: 'Fiche d\'appel hebdomadaire transmise avec succès à la direction',
      data: { count: updated.modifiedCount },
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/attendance/student-stats/:studentId — Bilan d'assiduité (hebdo, mensuel, annuel, cours manqués)
router.get('/student-stats/:studentId', protect, async (req, res) => {
  try {
    const Timetable = require('../models/Timetable')
    const student = await Student.findById(req.params.studentId).populate('class').lean()
    if (!student) return res.status(404).json({ message: 'Élève non trouvé' })

    const schoolId = student.school
    const currentYear = new Date().getFullYear()

    // Emploi du temps pour estimer le nombre total de cours par semaine
    const tt = await Timetable.findOne({ class: student.class?._id, school: schoolId }).lean()
    const weeklySlotsCount = tt?.slots?.length || 25

    const allAttendances = await Attendance.find({
      class: student.class?._id,
      'records.student': student._id,
    }).lean()

    let totalSessions = allAttendances.length
    let totalPresentDays = 0
    let totalAbsentDays = 0
    let missedCourseSlotsCount = 0

    const monthlyStats = {}

    allAttendances.forEach((att) => {
      const d = new Date(att.date)
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!monthlyStats[mKey]) monthlyStats[mKey] = { total: 0, absent: 0, missedCourses: 0 }

      const rec = att.records?.find((r) => String(r.student) === String(student._id))
      if (rec) {
        monthlyStats[mKey].total += 1
        if (rec.status === 'present') totalPresentDays += 1
        if (rec.status === 'absent') {
          totalAbsentDays += 1
          monthlyStats[mKey].absent += 1
        }
        const missedSlots = rec.courseAbsences?.filter((ca) => ca.isAbsent).length || 0
        missedCourseSlotsCount += missedSlots
        monthlyStats[mKey].missedCourses += missedSlots
      }
    })

    // Estimation cours suivis
    const estimatedTotalCourses = Math.max(totalSessions * 5, missedCourseSlotsCount + 10)
    const followedCourses = Math.max(0, estimatedTotalCourses - missedCourseSlotsCount)
    const assiduiteRate = estimatedTotalCourses > 0
      ? Math.round((followedCourses / estimatedTotalCourses) * 100)
      : (student.attendanceRate || 100)

    res.json({
      success: true,
      student: {
        _id: student._id,
        name: `${student.lastName} ${student.firstName}`,
        matricule: student.matricule,
        className: student.class?.name || '—',
      },
      summary: {
        totalSessions,
        totalPresentDays,
        totalAbsentDays,
        estimatedTotalCourses,
        followedCourses,
        missedCourseSlotsCount,
        assiduiteRate,
      },
      monthlyStats,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
