const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/auth')
const Student = require('../models/Student')
const Grade = require('../models/Grade')
const Attendance = require('../models/Attendance')
const Homework = require('../models/Homework')
const Fee = require('../models/Fee')
const Appointment = require('../models/Appointment')
const ParentalControl = require('../models/ParentalControl')
const Timetable = require('../models/Timetable')
const Class = require('../models/Class')
const Message = require('../models/Message')
const Document = require('../models/Document')
const Teacher = require('../models/Teacher')

// Middleware: only parents
const parentOnly = (req, res, next) => {
  if (req.user.role !== 'parent') return res.status(403).json({ message: 'Accès réservé aux parents' })
  next()
}

// Helper: get all children of parent
async function getChildren(parentId) {
  return Student.find({ parentUser: parentId, status: 'active' })
    .populate('class', 'name level cycle')
    .populate('school', 'name')
}

// ─── DASHBOARD OVERVIEW ───
router.get('/dashboard', protect, parentOnly, async (req, res) => {
  try {
    const children = await getChildren(req.user._id)
    if (children.length === 0) return res.json({ success: true, data: { children: [], stats: {} } })

    const childIds = children.map((c) => c._id)
    const schoolId = children[0]?.school?._id

    // Aggregate stats across all children
    const [totalGrades, attendanceAgg, homeworkStats, feeStats, unreadMessages] = await Promise.all([
      Grade.aggregate([
        { $match: { student: { $in: childIds } } },
        { $group: { _id: null, avg: { $avg: '$value' }, count: { $sum: 1 } } },
      ]),
      Attendance.aggregate([
        { $unwind: '$records' },
        { $match: { 'records.student': { $in: childIds } } },
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
      Homework.aggregate([
        { $match: { class: { $in: children.map((c) => c.class?._id).filter(Boolean) } } },
        {
          $project: {
            total: { $literal: 1 },
            submitted: {
              $size: {
                $filter: {
                  input: '$submissions',
                  as: 's',
                  cond: { $in: ['$$s.student', childIds] },
                },
              },
            },
            isPastDue: { $lt: ['$dueDate', new Date()] },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            submitted: { $sum: { $cond: [{ $gt: ['$submitted', 0] }, 1, 0] } },
            overdue: { $sum: { $cond: [{ $and: [{ $eq: ['$submitted', 0] }, '$isPastDue'] }, 1, 0] } },
          },
        },
      ]),
      Fee.aggregate([
        { $match: { student: { $in: childIds } } },
        {
          $group: {
            _id: null,
            totalDue: { $sum: '$amount' },
            totalPaid: { $sum: '$paid' },
            pending: { $sum: { $cond: [{ $ne: ['$status', 'paid'] }, 1, 0] } },
          },
        },
      ]),
      Message.countDocuments({ recipient: req.user._id, read: false }),
    ])

    const att = attendanceAgg[0] || { total: 0, present: 0, absent: 0, late: 0 }
    const hw = homeworkStats[0] || { total: 0, submitted: 0, overdue: 0 }
    const fees = feeStats[0] || { totalDue: 0, totalPaid: 0, pending: 0 }

    // Today's attendance per child
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999)
    const [todayAttendances, installmentFees] = await Promise.all([
      Attendance.find({ 'records.student': { $in: childIds }, date: { $gte: todayStart, $lte: todayEnd } }),
      Fee.find({ student: { $in: childIds }, paymentMode: 'tranches' }),
    ])

    const childrenWithStatus = children.map((c) => {
      let todayStatus = 'unknown'
      for (const att of todayAttendances) {
        const rec = att.records.find((r) => r.student.toString() === c._id.toString())
        if (rec) { todayStatus = rec.status; break }
      }
      return { _id: c._id, firstName: c.firstName, lastName: c.lastName, fullName: `${c.lastName} ${c.firstName}`, photo: c.photo, matricule: c.matricule, class: c.class, school: c.school, cycle: c.cycle, gender: c.gender, todayStatus }
    })

    let pendingInstallments = 0; let nearestDeadline = null
    const now = new Date()
    installmentFees.forEach((fee) => {
      fee.installments.forEach((inst) => {
        if (!inst.paid) {
          pendingInstallments++
          if (!nearestDeadline || new Date(inst.dueDate) < nearestDeadline) nearestDeadline = inst.dueDate
        }
      })
    })

    res.json({
      success: true,
      data: {
        children: childrenWithStatus,
        stats: {
          averageGrade: totalGrades[0]?.avg ? Math.round(totalGrades[0].avg * 10) / 10 : 0,
          totalGrades: totalGrades[0]?.count || 0,
          attendanceRate: att.total > 0 ? Math.round((att.present / att.total) * 100) : 0,
          totalAbsences: att.absent,
          totalLate: att.late,
          homeworkTotal: hw.total,
          homeworkSubmitted: hw.submitted,
          homeworkOverdue: hw.overdue,
          feesTotalDue: fees.totalDue,
          feesTotalPaid: fees.totalPaid,
          feesPending: fees.pending,
          unreadMessages,
          pendingInstallments,
          nearestInstallmentDeadline: nearestDeadline,
        },
      },
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─── CHILD DETAIL: notes, attendance, homework ───
router.get('/children/:studentId', protect, parentOnly, async (req, res) => {
  try {
    const student = await Student.findOne({ _id: req.params.studentId, parentUser: req.user._id })
      .populate('class', 'name level cycle')
      .populate('school', 'name')
    if (!student) return res.status(404).json({ message: 'Enfant non trouvé' })

    const todayS = new Date(); todayS.setHours(0, 0, 0, 0)
    const todayE = new Date(); todayE.setHours(23, 59, 59, 999)

    const [grades, attendanceRecords, homeworks, timetable, todayAtt, childFees] = await Promise.all([
      Grade.find({ student: student._id }).sort({ date: -1 }).limit(100),
      Attendance.find({ 'records.student': student._id }).sort({ date: -1 }).limit(60)
        .then((docs) =>
          docs.map((d) => {
            const rec = d.records.find((r) => r.student.toString() === student._id.toString())
            return { date: d.date, status: rec?.status || 'absent' }
          })
        ),
      student.class
        ? Homework.find({ class: student.class._id || student.class }).sort({ dueDate: -1 }).limit(30)
            .then((hws) =>
              hws.map((h) => {
                const sub = h.submissions.find((s) => s.student.toString() === student._id.toString())
                const teacherMarkedDone = h.submissions.some((s) => s.student.toString() === student._id.toString())
                return {
                  _id: h._id,
                  title: h.title,
                  subject: h.subject,
                  type: h.type,
                  assignedDate: h.assignedDate,
                  dueDate: h.dueDate,
                  description: h.description,
                  teacherMarkedDone,
                  submitted: !!sub,
                  submittedAt: sub?.submittedAt,
                  grade: sub?.grade,
                  isLate: sub ? sub.submittedAt > h.dueDate : (!sub && new Date() > h.dueDate),
                  status: sub ? (sub.submittedAt > h.dueDate ? 'late' : 'submitted') : (new Date() > h.dueDate ? 'overdue' : 'pending'),
                }
              })
            )
        : [],
      student.class
        ? Timetable.findOne({ class: student.class._id || student.class })
        : null,
      Attendance.findOne({ 'records.student': student._id, date: { $gte: todayS, $lte: todayE } }),
      Fee.find({ student: student._id }).sort({ createdAt: -1 }),
    ])

    // Today's attendance status
    let todayAttendance = 'unknown'
    if (todayAtt) {
      const rec = todayAtt.records.find((r) => r.student.toString() === student._id.toString())
      if (rec) todayAttendance = rec.status
    }

    // Fee installments summary
    const feeSummary = childFees.map((f) => ({
      _id: f._id,
      label: f.label,
      amount: f.amount,
      paid: f.paid,
      remaining: f.amount - f.paid,
      status: f.status,
      dueDate: f.dueDate,
      paymentMode: f.paymentMode,
      installments: f.installments.map((i) => ({
        label: i.label,
        amount: i.amount,
        dueDate: i.dueDate,
        paid: i.paid,
        paidAt: i.paidAt,
      })),
      pendingInstallments: f.installments.filter((i) => !i.paid).length,
      totalInstallments: f.installments.length,
    }))

    // Grades by subject (include sequence)
    const gradesBySubject = {}
    grades.forEach((g) => {
      if (!gradesBySubject[g.subject]) gradesBySubject[g.subject] = []
      gradesBySubject[g.subject].push({ value: g.value, type: g.type, term: g.term, sequence: g.sequence, date: g.date, comment: g.comment, coefficient: g.coefficient })
    })

    // Activity & connection time from parental controls
    const ctrl = await ParentalControl.findOne({ student: student._id })
    const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    const weeklyAttendanceCount = attendanceRecords.filter(a => new Date(a.date) >= oneWeekAgo && a.status === 'present').length

    res.json({
      success: true,
      data: {
        student: {
          _id: student._id,
          firstName: student.firstName,
          lastName: student.lastName,
          fullName: `${student.lastName} ${student.firstName}`,
          photo: student.photo,
          matricule: student.matricule,
          class: student.class,
          school: student.school,
          cycle: student.cycle,
          gender: student.gender,
          dateOfBirth: student.dateOfBirth,
        },
        gradesBySubject,
        grades,
        attendance: attendanceRecords,
        homeworks,
        timetable: timetable?.slots || [],
        todayAttendance,
        fees: feeSummary,
        lastActivity: ctrl?.lastActivity || null,
        weeklyScreenTime: ctrl?.todayScreenMinutes || 0,
        activeDays: weeklyAttendanceCount,
      },
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─── HOMEWORK CLASS COMPLETION LIST ───
router.get('/homework/:hwId/completion', protect, parentOnly, async (req, res) => {
  try {
    const hw = await Homework.findById(req.params.hwId).populate('class', 'name')
    if (!hw) return res.status(404).json({ message: 'Devoir non trouvé' })

    const children = await getChildren(req.user._id)
    const childInClass = children.find((c) => c.class && c.class._id.toString() === hw.class._id.toString())
    if (!childInClass) return res.status(403).json({ message: 'Accès refusé — votre enfant n\'est pas dans cette classe' })

    const classStudents = await Student.find({ class: hw.class._id, status: 'active' }).sort({ lastName: 1 })
    const completion = classStudents.map((s) => ({
      _id: s._id,
      name: `${s.lastName} ${s.firstName}`,
      isMyChild: s._id.toString() === childInClass._id.toString(),
      done: hw.submissions.some((sub) => sub.student.toString() === s._id.toString()),
    }))

    const doneCount = completion.filter((c) => c.done).length
    res.json({
      success: true,
      data: {
        homework: { _id: hw._id, title: hw.title, subject: hw.subject, dueDate: hw.dueDate },
        completion,
        stats: { done: doneCount, notDone: completion.length - doneCount, total: completion.length },
      },
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ─── FEES ───
router.get('/fees', protect, parentOnly, async (req, res) => {
  try {
    const children = await getChildren(req.user._id)
    const childIds = children.map((c) => c._id)
    const fees = await Fee.find({ student: { $in: childIds } }).populate('student', 'firstName lastName matricule').sort({ createdAt: -1 })
    const totalDue = fees.reduce((s, f) => s + f.amount, 0)
    const totalPaid = fees.reduce((s, f) => s + f.paid, 0)
    res.json({ success: true, data: fees, summary: { totalDue, totalPaid, remaining: totalDue - totalPaid } })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// Pay a fee (partial or full)
router.post('/fees/:feeId/pay', protect, parentOnly, async (req, res) => {
  try {
    const fee = await Fee.findById(req.params.feeId)
    if (!fee) return res.status(404).json({ message: 'Frais non trouvé' })
    // Verify parent owns child
    const child = await Student.findOne({ _id: fee.student, parentUser: req.user._id })
    if (!child) return res.status(403).json({ message: 'Accès refusé' })

    const { amount, method = 'cash', reference = '', note = '' } = req.body
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Montant invalide' })

    fee.payments.push({ amount, method, reference, note })
    fee.paid += amount
    fee.status = fee.paid >= fee.amount ? 'paid' : 'partial'
    await fee.save()

    res.json({ success: true, data: fee })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─── APPOINTMENTS ───
router.get('/appointments', protect, parentOnly, async (req, res) => {
  try {
    const appointments = await Appointment.find({ parent: req.user._id })
      .populate('student', 'firstName lastName')
      .sort({ date: -1 })
    res.json({ success: true, data: appointments })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/appointments', protect, parentOnly, async (req, res) => {
  try {
    const { studentId, withRole, date, time, reason } = req.body
    const student = await Student.findOne({ _id: studentId, parentUser: req.user._id })
    if (!student) return res.status(404).json({ message: 'Enfant non trouvé' })

    const appt = await Appointment.create({
      parent: req.user._id,
      student: studentId,
      school: student.school,
      with: withRole,
      date,
      time,
      reason,
      status: 'pending',
    })
    res.status(201).json({ success: true, data: appt })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─── PARENTAL CONTROLS ───
router.get('/controls/:studentId', protect, parentOnly, async (req, res) => {
  try {
    let ctrl = await ParentalControl.findOne({ parent: req.user._id, student: req.params.studentId })
    if (!ctrl) {
      const student = await Student.findOne({ _id: req.params.studentId, parentUser: req.user._id })
      if (!student) return res.status(404).json({ message: 'Enfant non trouvé' })
      ctrl = await ParentalControl.create({ parent: req.user._id, student: student._id, school: student.school })
    }
    res.json({ success: true, data: ctrl })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.put('/controls/:studentId', protect, parentOnly, async (req, res) => {
  try {
    const ctrl = await ParentalControl.findOneAndUpdate(
      { parent: req.user._id, student: req.params.studentId },
      req.body,
      { new: true, upsert: true, runValidators: true }
    )
    res.json({ success: true, data: ctrl })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─── WEEKLY REPORT ───
router.get('/report/:studentId', protect, parentOnly, async (req, res) => {
  try {
    const student = await Student.findOne({ _id: req.params.studentId, parentUser: req.user._id })
    if (!student) return res.status(404).json({ message: 'Enfant non trouvé' })

    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const [recentGrades, recentAttendance, recentHomework] = await Promise.all([
      Grade.find({ student: student._id, date: { $gte: oneWeekAgo } }).sort({ date: -1 }),
      Attendance.find({ 'records.student': student._id, date: { $gte: oneWeekAgo } })
        .then((docs) =>
          docs.map((d) => {
            const rec = d.records.find((r) => r.student.toString() === student._id.toString())
            return { date: d.date, status: rec?.status }
          })
        ),
      student.class
        ? Homework.find({ class: student.class, dueDate: { $gte: oneWeekAgo } })
            .then((hws) =>
              hws.map((h) => {
                const sub = h.submissions.find((s) => s.student.toString() === student._id.toString())
                return { title: h.title, subject: h.subject, dueDate: h.dueDate, submitted: !!sub, late: sub ? sub.submittedAt > h.dueDate : false }
              })
            )
        : [],
    ])

    const avgGrade = recentGrades.length > 0 ? Math.round((recentGrades.reduce((s, g) => s + g.value, 0) / recentGrades.length) * 10) / 10 : null
    const daysPresent = recentAttendance.filter((a) => a.status === 'present').length
    const daysAbsent = recentAttendance.filter((a) => a.status === 'absent').length

    res.json({
      success: true,
      data: {
        student: { firstName: student.firstName, lastName: student.lastName },
        period: { from: oneWeekAgo, to: new Date() },
        grades: recentGrades,
        averageGrade: avgGrade,
        attendance: { total: recentAttendance.length, present: daysPresent, absent: daysAbsent },
        homework: recentHomework,
        homeworkDone: recentHomework.filter((h) => h.submitted).length,
        homeworkTotal: recentHomework.length,
      },
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─── DOCUMENTS ADMINISTRATIFS ───
router.get('/documents/:studentId', protect, parentOnly, async (req, res) => {
  try {
    const student = await Student.findOne({ _id: req.params.studentId, parentUser: req.user._id })
    if (!student) return res.status(404).json({ message: 'Enfant non trouvé' })

    const docs = await Document.find({ student: student._id, parent: req.user._id }).sort({ createdAt: -1 })
    res.json({ success: true, data: docs })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/documents/:studentId/generate', protect, parentOnly, async (req, res) => {
  try {
    const student = await Student.findOne({ _id: req.params.studentId, parentUser: req.user._id })
      .populate('class', 'name level cycle')
      .populate('school', 'name')
    if (!student) return res.status(404).json({ message: 'Enfant non trouvé' })

    const { type } = req.body
    if (!['certificat_scolarite', 'attestation_inscription', 'bulletin', 'attestation_reussite'].includes(type)) {
      return res.status(400).json({ message: 'Type de document invalide' })
    }

    const doc = await Document.create({
      student: student._id,
      school: student.school?._id || student.school,
      parent: req.user._id,
      type,
      status: 'ready',
      metadata: {
        studentName: `${student.lastName} ${student.firstName}`,
        matricule: student.matricule,
        className: student.class?.name,
        cycle: student.cycle,
        schoolName: student.school?.name,
        generatedAt: new Date(),
      },
    })

    res.status(201).json({ success: true, data: doc })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─── PRÉSENCE DE LA CLASSE COMPLÈTE ───
router.get('/children/:studentId/class-attendance', protect, parentOnly, async (req, res) => {
  try {
    const student = await Student.findOne({ _id: req.params.studentId, parentUser: req.user._id }).populate('class')
    if (!student || !student.class) return res.status(404).json({ message: 'Enfant ou classe non trouvée' })

    const { week } = req.query
    const startDate = week ? new Date(week) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000)

    const classStudents = await Student.find({ class: student.class._id, status: 'active' }).sort({ lastName: 1 })
    const attendances = await Attendance.find({
      class: student.class._id,
      date: { $gte: startDate, $lte: endDate },
    }).sort({ date: -1 })

    // Build per-student summary
    const summary = classStudents.map((s) => {
      const records = []
      attendances.forEach((att) => {
        const rec = att.records.find((r) => r.student.toString() === s._id.toString())
        if (rec) records.push({ date: att.date, status: rec.status })
      })
      return {
        _id: s._id,
        name: `${s.lastName} ${s.firstName}`,
        isMyChild: s._id.toString() === student._id.toString(),
        records,
        presentCount: records.filter((r) => r.status === 'present').length,
        absentCount: records.filter((r) => r.status === 'absent').length,
        lateCount: records.filter((r) => r.status === 'late').length,
      }
    })

    res.json({
      success: true,
      data: {
        class: student.class,
        attendanceDates: attendances.map((a) => a.date),
        students: summary,
      },
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ─── ENSEIGNANTS DE LA CLASSE DE L'ENFANT ───
router.get('/children/:studentId/teachers', protect, parentOnly, async (req, res) => {
  try {
    const student = await Student.findOne({ _id: req.params.studentId, parentUser: req.user._id }).populate('class')
    if (!student || !student.class) return res.status(404).json({ message: 'Enfant ou classe non trouvée' })

    const teachers = await Teacher.find({ classes: student.class._id })
      .populate('user', 'email lastLogin')
      .select('firstName lastName email phone subjects speciality photo')

    res.json({ success: true, data: teachers, className: student.class.name })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ─── GESTION DES TRANCHES DE PENSION (vue parent) ───
router.get('/fees/installments', protect, parentOnly, async (req, res) => {
  try {
    const children = await getChildren(req.user._id)
    const childIds = children.map((c) => c._id)
    const fees = await Fee.find({ student: { $in: childIds }, paymentMode: 'tranches' })
      .populate('student', 'firstName lastName class')
      .sort({ createdAt: -1 })

    const now = new Date()
    const overdueInstallments = []
    fees.forEach((fee) => {
      fee.installments.forEach((inst) => {
        if (!inst.paid && new Date(inst.dueDate) < now) {
          overdueInstallments.push({
            feeId: fee._id,
            studentName: `${fee.student?.lastName} ${fee.student?.firstName}`,
            label: inst.label,
            amount: inst.amount,
            dueDate: inst.dueDate,
          })
        }
      })
    })

    res.json({ success: true, data: fees, overdueInstallments })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
