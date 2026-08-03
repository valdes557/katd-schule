// routes/lessonLogs.js — Cahier de texte (cycle Secondaire).
// Le professeur remplit chaque séance (leçon + devoirs donnés) ; le vice-principal
// et le directeur contrôlent ; les élèves consultent le cahier de leur classe.
const express = require('express')
const router = express.Router()
const LessonLog = require('../models/LessonLog')
const Teacher = require('../models/Teacher')
const Student = require('../models/Student')
const { protect, authorize } = require('../middleware/auth')

function schoolId(req) { return req.user.school?._id || req.user.school }

// GET /api/lesson-logs?classId=&subject=&from=&to= — liste scoppée par rôle
router.get('/', protect, async (req, res) => {
  try {
    const sid = schoolId(req)
    const { classId, subject, from, to, page = 1, limit = 50 } = req.query
    const query = { school: sid }
    if (classId) query.class = classId
    if (subject) query.subject = subject
    if (from || to) {
      query.date = {}
      if (from) query.date.$gte = new Date(from)
      if (to) query.date.$lte = new Date(to)
    }

    // Scope par rôle
    if (req.user.role === 'enseignant') {
      // Le professeur ne voit que SON cahier de texte
      const teacher = await Teacher.findOne({ user: req.user._id })
      if (!teacher) return res.json({ success: true, total: 0, data: [] })
      query.teacher = teacher._id
    } else if (req.user.role === 'eleve') {
      // L'élève consulte le cahier de SA classe uniquement
      const me = await Student.findOne({ user: req.user._id }).select('class')
      if (!me?.class) return res.json({ success: true, total: 0, data: [] })
      query.class = me.class
    } else if (req.user.role === 'parent') {
      // Le parent consulte le cahier des classes de ses enfants
      const children = await Student.find({ parentUser: req.user._id }).select('class')
      const ids = children.map((s) => s.class).filter(Boolean)
      if (ids.length === 0) return res.json({ success: true, total: 0, data: [] })
      if (!classId) query.class = { $in: ids }
      else if (!ids.some((id) => String(id) === String(classId))) return res.json({ success: true, total: 0, data: [] })
    } else if (!['directeur', 'vice_principal', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Accès refusé' })
    }

    const total = await LessonLog.countDocuments(query)
    const logs = await LessonLog.find(query)
      .populate('class', 'name level')
      .populate('teacher', 'firstName lastName')
      .populate('homework', 'title dueDate')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ date: -1, createdAt: -1 })
    res.json({ success: true, total, data: logs })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/lesson-logs — le professeur remplit une séance
router.post('/', protect, authorize('enseignant', 'directeur', 'super_admin'), async (req, res) => {
  try {
    const sid = schoolId(req)
    const { classId, subject, date, startTime, endTime, title, content, homeworkGiven, homework } = req.body
    if (!classId || !subject || !date || !title) {
      return res.status(400).json({ message: 'Classe, matière, date et titre de la leçon requis' })
    }

    // Le professeur ne remplit que pour SES classes assignées
    let teacherId = null
    if (req.user.role === 'enseignant') {
      const teacher = await Teacher.findOne({ user: req.user._id })
      if (!teacher) return res.status(403).json({ message: 'Profil enseignant non trouvé' })
      const teacherClassIds = (teacher.classes || []).map((c) => c.toString())
      if (!teacherClassIds.includes(classId.toString())) {
        return res.status(403).json({ message: 'Vous ne pouvez remplir le cahier de texte que pour vos classes assignées' })
      }
      teacherId = teacher._id
    } else {
      // Directeur : impute au professeur indiqué (ou refuse si absent)
      if (!req.body.teacher) return res.status(400).json({ message: 'Professeur requis' })
      teacherId = req.body.teacher
    }

    const log = await LessonLog.create({
      school: sid, class: classId, teacher: teacherId, subject,
      date: new Date(date), startTime: startTime || '', endTime: endTime || '',
      title, content: content || '', homeworkGiven: homeworkGiven || '', homework: homework || null,
    })
    res.status(201).json({ success: true, data: log })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/lesson-logs/:id — modification par l'auteur (ou directeur)
router.put('/:id', protect, authorize('enseignant', 'directeur', 'super_admin'), async (req, res) => {
  try {
    const log = await LessonLog.findById(req.params.id)
    if (!log) return res.status(404).json({ message: 'Séance non trouvée' })
    if (String(log.school) !== String(schoolId(req))) return res.status(403).json({ message: 'Accès refusé' })
    if (req.user.role === 'enseignant') {
      const teacher = await Teacher.findOne({ user: req.user._id })
      if (!teacher || String(log.teacher) !== String(teacher._id)) {
        return res.status(403).json({ message: 'Vous ne pouvez modifier que vos propres séances' })
      }
    }
    const allowed = ['subject', 'date', 'startTime', 'endTime', 'title', 'content', 'homeworkGiven', 'homework']
    for (const k of allowed) if (req.body[k] !== undefined) log[k] = req.body[k]
    await log.save()
    res.json({ success: true, data: log })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/lesson-logs/:id/visa — visa du vice-principal / directeur (contrôle pédagogique)
router.put('/:id/visa', protect, authorize('vice_principal', 'directeur', 'super_admin'), async (req, res) => {
  try {
    const log = await LessonLog.findById(req.params.id)
    if (!log) return res.status(404).json({ message: 'Séance non trouvée' })
    if (String(log.school) !== String(schoolId(req))) return res.status(403).json({ message: 'Accès refusé' })
    log.viewedBy = req.user._id
    log.viewedAt = new Date()
    await log.save()
    res.json({ success: true, data: log })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// DELETE /api/lesson-logs/:id — auteur ou directeur
router.delete('/:id', protect, authorize('enseignant', 'directeur', 'super_admin'), async (req, res) => {
  try {
    const log = await LessonLog.findById(req.params.id)
    if (!log) return res.status(404).json({ message: 'Séance non trouvée' })
    if (String(log.school) !== String(schoolId(req))) return res.status(403).json({ message: 'Accès refusé' })
    if (req.user.role === 'enseignant') {
      const teacher = await Teacher.findOne({ user: req.user._id })
      if (!teacher || String(log.teacher) !== String(teacher._id)) {
        return res.status(403).json({ message: 'Vous ne pouvez supprimer que vos propres séances' })
      }
    }
    await log.deleteOne()
    res.json({ success: true, message: 'Séance supprimée' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
