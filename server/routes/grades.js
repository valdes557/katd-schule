const express = require('express')
const router = express.Router()
const Grade = require('../models/Grade')
const Student = require('../models/Student')
const Attendance = require('../models/Attendance')
const School = require('../models/School')
const Class = require('../models/Class')
const Subject = require('../models/Subject')
const Teacher = require('../models/Teacher')
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
      const children = await Student.find({ parentUser: req.user._id }).select('_id')
      const childIds = children.map((s) => s._id)
      if (childIds.length === 0) return res.json({ success: true, total: 0, data: [] })
      if (student) {
        if (!childIds.some((id) => id.toString() === student.toString())) {
          return res.json({ success: true, total: 0, data: [] })
        }
      } else {
        query.student = { $in: childIds }
      }
    }
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

const { weightedAverage, appreciationFor, behaviorFor } = require('../utils/gradeHelpers')

// GET /api/grades/bulletin/:studentId — comprehensive report card data
router.get('/bulletin/:studentId', protect, async (req, res) => {
  try {
    const { term, academicYear } = req.query
    const studentId = req.params.studentId

    // 1. Student + class + school
    const student = await Student.findById(studentId)
      .populate('class', 'name level cycle')
      .populate('school', 'name logo city country')
      .lean()
    if (!student) return res.status(404).json({ message: 'Élève non trouvé' })

    // Permission: parent can only see own children; teacher/director must share school
    if (req.user.role === 'parent') {
      if (!student.parentUser || student.parentUser.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Accès refusé' })
      }
    } else if (['directeur', 'enseignant'].includes(req.user.role)) {
      const userSchool = (req.user.school?._id || req.user.school || '').toString()
      if (userSchool && student.school?._id?.toString() !== userSchool) {
        return res.status(403).json({ message: 'Accès refusé' })
      }
    }

    const classId = student.class?._id
    const year = academicYear || student.academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`

    // 2. All grades for this student (filtered by term)
    const gradeQuery = { student: studentId }
    if (term) gradeQuery.term = term
    if (academicYear) gradeQuery.academicYear = academicYear
    const grades = await Grade.find(gradeQuery).lean()

    // 3. All subjects + their coefficient (from Subject model when available)
    const subjectDocs = classId ? await Subject.find({ classes: classId }).lean() : []
    const coefMap = {}
    subjectDocs.forEach((s) => { coefMap[s.name] = s.coefficient || 1 })

    // 4. Group grades by subject -> compute devoirs avg, controles avg, exam, final avg
    const grouped = {}
    grades.forEach((g) => {
      if (!grouped[g.subject]) grouped[g.subject] = { devoirs: [], controles: [], exams: [], all: [], comments: [] }
      grouped[g.subject].all.push(g)
      if (g.comment) grouped[g.subject].comments.push(g.comment)
      const typeLower = (g.type || '').toLowerCase()
      if (typeLower === 'devoir' || typeLower === 'tp' || typeLower === 'oral') grouped[g.subject].devoirs.push(g.value)
      else if (typeLower === 'examen' || typeLower === 'controle') grouped[g.subject].controles.push(g.value)
      else if (typeLower === 'composition') grouped[g.subject].exams.push(g.value)
      else grouped[g.subject].devoirs.push(g.value)
    })

    const avg = (arr) => arr.length === 0 ? null : Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 100) / 100

    const subjects = Object.entries(grouped).map(([name, g]) => {
      const devoirsAvg = avg(g.devoirs)
      const controlesAvg = avg(g.controles)
      const examAvg = avg(g.exams)
      // Final subject average: weighted (devoirs 40% + controles 40% + exam 20%) if all exist, otherwise simple
      const components = []
      if (devoirsAvg != null) components.push({ value: devoirsAvg, w: 1 })
      if (controlesAvg != null) components.push({ value: controlesAvg, w: 1 })
      if (examAvg != null) components.push({ value: examAvg, w: 1 })
      const final = components.length === 0
        ? 0
        : components.reduce((s, c) => s + c.value * c.w, 0) / components.reduce((s, c) => s + c.w, 0)
      const coefficient = coefMap[name] || g.all[0]?.coefficient || 1
      return {
        name,
        coefficient,
        devoirsAvg,
        controlesAvg,
        examAvg,
        average: Math.round(final * 100) / 100,
        teacherComment: g.comments.find(Boolean) || appreciationFor(final),
      }
    })

    // 5. General average (weighted by coefficient)
    const generalAverage = subjects.length === 0
      ? 0
      : Math.round(
          (subjects.reduce((s, sub) => s + sub.average * sub.coefficient, 0) /
            subjects.reduce((s, sub) => s + sub.coefficient, 0)) * 100
        ) / 100

    // 6. Class stats: rank, class avg, top, bottom, class size
    let rank = null, classAverage = null, topAverage = null, bottomAverage = null, classSize = 0
    if (classId) {
      const classmates = await Student.find({ class: classId, status: 'active' }).select('_id').lean()
      classSize = classmates.length
      const ids = classmates.map((c) => c._id)
      const allClassGrades = await Grade.find({
        student: { $in: ids },
        ...(term ? { term } : {}),
        ...(academicYear ? { academicYear } : {}),
      }).lean()
      const byStudent = {}
      allClassGrades.forEach((g) => {
        const sid = g.student.toString()
        if (!byStudent[sid]) byStudent[sid] = {}
        if (!byStudent[sid][g.subject]) byStudent[sid][g.subject] = []
        byStudent[sid][g.subject].push(g)
      })
      const averages = Object.entries(byStudent).map(([sid, subjMap]) => {
        const subjAvgs = Object.entries(subjMap).map(([subj, list]) => {
          const a = list.reduce((s, g) => s + g.value, 0) / list.length
          const coef = coefMap[subj] || list[0].coefficient || 1
          return { value: a, coef }
        })
        const totalCoef = subjAvgs.reduce((s, x) => s + x.coef, 0)
        const sum = subjAvgs.reduce((s, x) => s + x.value * x.coef, 0)
        return { sid, avg: totalCoef > 0 ? sum / totalCoef : 0 }
      }).filter((x) => x.avg > 0)

      if (averages.length > 0) {
        const sorted = [...averages].sort((a, b) => b.avg - a.avg)
        const idx = sorted.findIndex((x) => x.sid === studentId.toString())
        rank = idx >= 0 ? idx + 1 : null
        classAverage = Math.round((sorted.reduce((s, x) => s + x.avg, 0) / sorted.length) * 100) / 100
        topAverage = Math.round(sorted[0].avg * 100) / 100
        bottomAverage = Math.round(sorted[sorted.length - 1].avg * 100) / 100
      }
    }

    // 7. Attendance summary (for the term/year if available, else all-time on student)
    const attRecords = await Attendance.find({ class: classId }).lean()
    let totalDays = 0, presentDays = 0, absentCount = 0, lateCount = 0
    attRecords.forEach((a) => {
      const rec = a.records?.find((r) => r.student?.toString() === studentId.toString())
      if (rec) {
        totalDays++
        if (rec.status === 'present') presentDays++
        else if (rec.status === 'absent') absentCount++
        else if (rec.status === 'late') lateCount++
      }
    })
    const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0

    res.json({
      success: true,
      data: {
        school: student.school ? { name: student.school.name, logo: student.school.logo, city: student.school.city, country: student.school.country } : null,
        student: {
          _id: student._id,
          firstName: student.firstName,
          lastName: student.lastName,
          matricule: student.matricule,
          dateOfBirth: student.dateOfBirth,
          gender: student.gender,
          photo: student.photo,
        },
        class: student.class ? { name: student.class.name, level: student.class.level, cycle: student.class.cycle } : null,
        academicYear: year,
        term: term || null,
        subjects,
        generalAverage,
        appreciation: appreciationFor(generalAverage),
        behavior: behaviorFor(attendanceRate),
        attendance: { totalDays, presentDays, absentCount, lateCount, rate: attendanceRate },
        classStats: { rank, classSize, classAverage, topAverage, bottomAverage },
        issuedAt: new Date(),
      },
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/grades (single or batch)
router.post('/', protect, authorize('directeur', 'enseignant', 'super_admin'), async (req, res) => {
  try {
    const schoolId = req.user.school._id || req.user.school

    // For teachers, validate that the target class belongs to them
    let teacherId = null
    if (req.user.role === 'enseignant') {
      const teacher = await Teacher.findOne({ user: req.user._id })
      if (!teacher) return res.status(403).json({ message: 'Profil enseignant non trouvé' })
      const teacherClassIds = (teacher.classes || []).map((c) => c.toString())
      const body = Array.isArray(req.body) ? req.body : [req.body]
      const bad = body.some((g) => !g.class || !teacherClassIds.includes(g.class.toString()))
      if (bad) return res.status(403).json({ message: "Vous ne pouvez créer des notes que pour vos classes assignées" })
      teacherId = teacher._id
    }

    if (Array.isArray(req.body)) {
      const grades = await Grade.insertMany(req.body.map((g) => ({ ...g, school: schoolId, ...(teacherId ? { teacher: teacherId } : {}) })))
      return res.status(201).json({ success: true, data: grades })
    }
    const grade = await Grade.create({ ...req.body, school: schoolId, ...(teacherId ? { teacher: teacherId } : {}) })
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
