// routes/aiCourses.js — Cours de l'IA enseignante autonome (F2 Secondaire).
// Le professeur programme un cours (texte ou PDF, heure + durée) pour une de
// SES classes ; l'IA le déroule en direct (révélation progressive) puis répond
// aux questions des élèves. Quota : 1 unité par cours généré + 1 par question.
const express = require('express')
const router = express.Router()
const AiCourse = require('../models/AiCourse')
const AiConfig = require('../models/AiConfig')
const AiUsageLog = require('../models/AiUsageLog')
const Teacher = require('../models/Teacher')
const Student = require('../models/Student')
const Class = require('../models/Class')
const { protect, authorize } = require('../middleware/auth')
const { upload } = require('../config/cloudinary')
const {
  extractPdfText, revealedText, answerQuestion,
} = require('../services/aiCourseService')
const {
  getActiveSubscription, consumeQuota, QUOTA_EXHAUSTED_MSG,
} = require('../services/aiQuotaService')

function schoolId(req) { return req.user.school?._id || req.user.school }

const MIN_LEAD_MS = 10 * 60 * 1000 // programmation au moins 10 min à l'avance
const MAX_QUESTIONS_PER_STUDENT = 3

// Rate limiting maison (mémoire) — même pattern que routes/ai.js
const rateBuckets = new Map()
function rateLimit({ windowMs = 60000, max = 5 } = {}) {
  return (req, res, next) => {
    const id = req.user._id.toString()
    const now = Date.now()
    const hits = (rateBuckets.get(id) || []).filter((t) => now - t < windowMs)
    if (hits.length >= max) {
      return res.status(429).json({ message: 'Trop de requêtes. Patientez quelques instants.' })
    }
    hits.push(now)
    rateBuckets.set(id, hits)
    next()
  }
}

// Classe de l'élève connecté (ou null)
async function studentClassId(userId) {
  const me = await Student.findOne({ user: userId }).select('class')
  return me?.class || null
}

// L'utilisateur peut-il voir ce cours ? (renvoie true/false)
async function canViewCourse(user, course) {
  if (user.role === 'super_admin') return true
  const sid = String(user.school?._id || user.school || '')
  if (String(course.school) !== sid) return false
  if (['directeur', 'vice_principal'].includes(user.role)) return true
  if (user.role === 'enseignant') {
    if (String(course.teacher) === String(user._id)) return true
    const teacher = await Teacher.findOne({ user: user._id }).select('classes')
    return (teacher?.classes || []).some((c) => String(c) === String(course.class))
  }
  if (user.role === 'eleve') {
    if (!['pret', 'en_cours', 'termine'].includes(course.status)) return false
    const cid = await studentClassId(user._id)
    return cid && String(cid) === String(course.class)
  }
  if (user.role === 'parent') {
    if (!['en_cours', 'termine'].includes(course.status)) return false
    const children = await Student.find({ parentUser: user._id }).select('class')
    return children.some((s) => s.class && String(s.class) === String(course.class))
  }
  return false
}

// ═════════════════════════════════════════════════════════════════════════════
// CRÉATION / MODIFICATION (professeur, directeur)
// ═════════════════════════════════════════════════════════════════════════════

// POST /api/ai-courses — programmer un cours (multipart : champ 'pdf' optionnel)
router.post('/', protect, authorize('enseignant', 'directeur'), upload.single('pdf'), async (req, res) => {
  try {
    const sid = schoolId(req)
    if (!sid) return res.status(400).json({ message: 'Aucune école associée à votre compte' })

    const { classId, subject, subjectRef, title, sourceType, sourceText, scheduledAt, durationMinutes } = req.body
    if (!classId || !subject || !title || !scheduledAt || !durationMinutes) {
      return res.status(400).json({ message: 'Classe, matière, titre, date/heure et durée requis' })
    }
    const duration = parseInt(durationMinutes, 10)
    if (!Number.isInteger(duration) || duration < 5 || duration > 240) {
      return res.status(400).json({ message: 'Durée invalide (entre 5 et 240 minutes)' })
    }
    const when = new Date(scheduledAt)
    if (isNaN(when.getTime())) return res.status(400).json({ message: 'Date/heure invalide' })
    if (when.getTime() < Date.now() + MIN_LEAD_MS) {
      return res.status(400).json({ message: "Programmez le cours au moins 10 minutes à l'avance (l'IA prépare la leçon 5 minutes avant l'heure)." })
    }

    // Autorisation : le prof ne programme que pour SES classes assignées
    let teacherProfile = null
    if (req.user.role === 'enseignant') {
      const teacher = await Teacher.findOne({ user: req.user._id })
      if (!teacher) return res.status(403).json({ message: 'Profil enseignant non trouvé' })
      const teacherClassIds = (teacher.classes || []).map((c) => c.toString())
      if (!teacherClassIds.includes(String(classId))) {
        return res.status(403).json({ message: 'Vous ne pouvez programmer un cours que pour vos classes assignées' })
      }
      teacherProfile = teacher._id
    }
    const klass = await Class.findOne({ _id: classId, school: sid }).select('name level')
    if (!klass) return res.status(404).json({ message: 'Classe introuvable dans votre école' })

    // Souscription IA active requise dès la création (inutile de planifier sinon)
    const sub = await getActiveSubscription(sid)
    if (!sub || sub.remainingQuestions <= 0) {
      return res.status(403).json({ message: sub ? QUOTA_EXHAUSTED_MSG : "Aucune souscription IA active pour votre établissement." })
    }

    // Contenu source : texte saisi OU texte extrait du PDF
    let text = String(sourceText || '').trim()
    let pdfUrl = ''
    let pdfName = ''
    if (sourceType === 'pdf') {
      if (!req.file) return res.status(400).json({ message: 'Fichier PDF requis' })
      try {
        text = await extractPdfText(req.file.buffer)
      } catch (e) {
        return res.status(400).json({ message: 'Impossible de lire ce PDF : ' + e.message })
      }
      if (text.length < 200) {
        return res.status(400).json({ message: 'Le PDF ne contient pas de texte exploitable (document scanné ?). Saisissez le cours en texte.' })
      }
      pdfUrl = req.file.path || ''
      pdfName = req.file.originalname || ''
    } else if (text.length < 200) {
      return res.status(400).json({ message: 'Le contenu du cours est trop court (200 caractères minimum).' })
    }

    const course = await AiCourse.create({
      school: sid,
      class: classId,
      subject: String(subject).trim(),
      subjectRef: subjectRef || null,
      teacher: req.user._id,
      teacherProfile,
      teacherName: req.user.name || '',
      title: String(title).trim(),
      level: klass.level || '',
      sourceType: sourceType === 'pdf' ? 'pdf' : 'text',
      sourceText: text,
      pdfUrl,
      pdfName,
      scheduledAt: when,
      durationMinutes: duration,
      status: 'planifie',
    })
    res.status(201).json({ success: true, data: course })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/ai-courses/:id — modification tant que le cours est 'planifie'
router.put('/:id', protect, authorize('enseignant', 'directeur'), async (req, res) => {
  try {
    const course = await AiCourse.findById(req.params.id)
    if (!course) return res.status(404).json({ message: 'Cours introuvable' })
    if (String(course.school) !== String(schoolId(req))) return res.status(403).json({ message: 'Accès refusé' })
    if (req.user.role === 'enseignant' && String(course.teacher) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Vous ne pouvez modifier que vos propres cours' })
    }
    if (course.status !== 'planifie') {
      return res.status(400).json({ message: "Ce cours n'est plus modifiable (préparation ou diffusion déjà lancée)." })
    }

    const { title, subject, subjectRef, sourceText, scheduledAt, durationMinutes, classId } = req.body
    if (title !== undefined) course.title = String(title).trim()
    if (subject !== undefined) course.subject = String(subject).trim()
    if (subjectRef !== undefined) course.subjectRef = subjectRef || null
    if (classId !== undefined && String(classId) !== String(course.class)) {
      if (req.user.role === 'enseignant') {
        const teacher = await Teacher.findOne({ user: req.user._id }).select('classes')
        const ids = (teacher?.classes || []).map((c) => c.toString())
        if (!ids.includes(String(classId))) {
          return res.status(403).json({ message: 'Vous ne pouvez programmer un cours que pour vos classes assignées' })
        }
      }
      const klass = await Class.findOne({ _id: classId, school: course.school }).select('name level')
      if (!klass) return res.status(404).json({ message: 'Classe introuvable dans votre école' })
      course.class = classId
      course.level = klass.level || ''
    }
    if (durationMinutes !== undefined) {
      const d = parseInt(durationMinutes, 10)
      if (!Number.isInteger(d) || d < 5 || d > 240) return res.status(400).json({ message: 'Durée invalide (entre 5 et 240 minutes)' })
      course.durationMinutes = d
    }
    if (scheduledAt !== undefined) {
      const when = new Date(scheduledAt)
      if (isNaN(when.getTime())) return res.status(400).json({ message: 'Date/heure invalide' })
      if (when.getTime() < Date.now() + MIN_LEAD_MS) {
        return res.status(400).json({ message: "Programmez le cours au moins 10 minutes à l'avance." })
      }
      course.scheduledAt = when
    }
    if (sourceText !== undefined && course.sourceType === 'text') {
      const text = String(sourceText).trim()
      if (text.length < 200) return res.status(400).json({ message: 'Le contenu du cours est trop court (200 caractères minimum).' })
      course.sourceText = text
    }
    // Toute modification invalide un éventuel script pré-généré
    course.lessonScript = ''
    course.generationAttempts = 0
    course.generationError = ''
    await course.save()
    res.json({ success: true, data: course })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/ai-courses/:id/cancel — annulation avant diffusion
router.post('/:id/cancel', protect, authorize('enseignant', 'directeur'), async (req, res) => {
  try {
    const course = await AiCourse.findById(req.params.id)
    if (!course) return res.status(404).json({ message: 'Cours introuvable' })
    if (String(course.school) !== String(schoolId(req))) return res.status(403).json({ message: 'Accès refusé' })
    if (req.user.role === 'enseignant' && String(course.teacher) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Vous ne pouvez annuler que vos propres cours' })
    }
    if (!['planifie', 'generation', 'pret'].includes(course.status)) {
      return res.status(400).json({ message: 'Ce cours ne peut plus être annulé.' })
    }
    course.status = 'annule'
    await course.save()
    res.json({ success: true, data: course })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// DELETE /api/ai-courses/:id — suppression (cours non diffusé uniquement)
router.delete('/:id', protect, authorize('enseignant', 'directeur'), async (req, res) => {
  try {
    const course = await AiCourse.findById(req.params.id)
    if (!course) return res.status(404).json({ message: 'Cours introuvable' })
    if (String(course.school) !== String(schoolId(req))) return res.status(403).json({ message: 'Accès refusé' })
    if (req.user.role === 'enseignant' && String(course.teacher) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Vous ne pouvez supprimer que vos propres cours' })
    }
    if (!['planifie', 'annule', 'erreur'].includes(course.status)) {
      return res.status(400).json({ message: 'Un cours diffusé ou en préparation ne peut pas être supprimé.' })
    }
    await course.deleteOne()
    res.json({ success: true })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ═════════════════════════════════════════════════════════════════════════════
// CONSULTATION
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/ai-courses?status=&classId=&scope= — liste scopée par rôle
router.get('/', protect, async (req, res) => {
  try {
    const sid = schoolId(req)
    if (!sid) return res.json({ success: true, data: [] })
    const query = { school: sid }
    if (req.query.classId) query.class = req.query.classId
    if (req.query.status) query.status = { $in: String(req.query.status).split(',') }

    const role = req.user.role
    if (role === 'enseignant') {
      const teacher = await Teacher.findOne({ user: req.user._id }).select('classes')
      if (!teacher) return res.json({ success: true, data: [] })
      if (req.query.scope === 'classes') query.class = { $in: teacher.classes || [] }
      else query.teacher = req.user._id
    } else if (role === 'eleve') {
      const cid = await studentClassId(req.user._id)
      if (!cid) return res.json({ success: true, data: [] })
      query.class = cid
      if (!query.status) query.status = { $in: ['pret', 'en_cours', 'termine'] }
    } else if (role === 'parent') {
      const children = await Student.find({ parentUser: req.user._id }).select('class')
      const ids = children.map((s) => s.class).filter(Boolean)
      if (!ids.length) return res.json({ success: true, data: [] })
      query.class = { $in: ids }
      if (!query.status) query.status = { $in: ['en_cours', 'termine'] }
    } else if (!['directeur', 'vice_principal', 'super_admin'].includes(role)) {
      return res.status(403).json({ message: 'Accès refusé' })
    }

    const courses = await AiCourse.find(query)
      .select('-lessonScript -sourceText')
      .populate('class', 'name level')
      .sort({ scheduledAt: -1 })
      .limit(200)
      .lean()
    const data = courses.map((c) => ({
      ...c,
      questionCount: (c.questions || []).length,
      questions: undefined,
    }))
    res.json({ success: true, data })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/ai-courses/:id — détail (sans le script pour les élèves/parents)
router.get('/:id', protect, async (req, res) => {
  try {
    const course = await AiCourse.findById(req.params.id).populate('class', 'name level')
    if (!course) return res.status(404).json({ message: 'Cours introuvable' })
    if (!(await canViewCourse(req.user, course))) return res.status(403).json({ message: 'Accès refusé' })
    const obj = course.toObject()
    if (['eleve', 'parent'].includes(req.user.role)) {
      delete obj.lessonScript
      delete obj.sourceText
    }
    res.json({ success: true, data: obj })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/ai-courses/:id/live — état en direct : portion visible + questions
router.get('/:id/live', protect, async (req, res) => {
  try {
    const course = await AiCourse.findById(req.params.id).populate('class', 'name level')
    if (!course) return res.status(404).json({ message: 'Cours introuvable' })
    if (!(await canViewCourse(req.user, course))) return res.status(403).json({ message: 'Accès refusé' })

    const now = new Date()
    const isLiveOrDone = ['en_cours', 'termine'].includes(course.status)
    const reveal = isLiveOrDone
      ? revealedText(course, now)
      : { text: '', totalUnits: 0, shownUnits: 0, progress: 0, remainingSeconds: null }

    res.json({
      success: true,
      data: {
        _id: course._id,
        title: course.title,
        subject: course.subject,
        teacherName: course.teacherName,
        className: course.class?.name || '',
        status: course.status,
        scheduledAt: course.scheduledAt,
        durationMinutes: course.durationMinutes,
        startedAt: course.startedAt,
        endedAt: course.endedAt,
        serverTime: now, // le client cale son chrono dessus (horloges locales décalées)
        secondsToStart: Math.max(0, Math.round((new Date(course.scheduledAt).getTime() - now.getTime()) / 1000)),
        text: reveal.text,
        progress: reveal.progress,
        remainingSeconds: reveal.remainingSeconds,
        totalUnits: reveal.totalUnits,
        shownUnits: reveal.shownUnits,
        canAskQuestions: course.status === 'termine',
        usedFallback: course.usedFallback,
        generationError: course.status === 'erreur' ? course.generationError : '',
        questions: (course.questions || []).map((q) => ({
          _id: q._id,
          studentName: q.studentName,
          question: q.question,
          answer: q.answer,
          status: q.status,
          askedAt: q.askedAt,
          answeredAt: q.answeredAt,
        })),
      },
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ═════════════════════════════════════════════════════════════════════════════
// QUESTIONS DES ÉLÈVES (fin de cours) — l'IA répond après chaque question
// ═════════════════════════════════════════════════════════════════════════════

// POST /api/ai-courses/:id/questions { question }
router.post('/:id/questions', protect, authorize('eleve'), rateLimit({ windowMs: 60000, max: 5 }), async (req, res) => {
  try {
    const question = String(req.body.question || '').trim()
    if (!question) return res.status(400).json({ message: 'Votre question est vide.' })
    if (question.length > 500) return res.status(400).json({ message: 'Question trop longue (500 caractères maximum).' })

    const course = await AiCourse.findById(req.params.id).populate('class', 'name')
    if (!course) return res.status(404).json({ message: 'Cours introuvable' })
    if (course.status !== 'termine') {
      return res.status(400).json({ message: "Les questions s'ouvrent à la fin du cours." })
    }
    const cid = await studentClassId(req.user._id)
    if (!cid || String(cid) !== String(course.class._id)) {
      return res.status(403).json({ message: 'Ce cours ne concerne pas votre classe.' })
    }
    const mine = (course.questions || []).filter((q) => String(q.student) === String(req.user._id))
    if (mine.length >= MAX_QUESTIONS_PER_STUDENT) {
      return res.status(429).json({ message: `Limite atteinte : ${MAX_QUESTIONS_PER_STUDENT} questions par élève et par cours.` })
    }

    const cfg = await AiConfig.getConfig()
    if (!cfg.enabled) {
      return res.status(403).json({ message: "L'assistant IA est temporairement désactivé par l'administrateur." })
    }
    const sub = await getActiveSubscription(course.school)
    if (!sub) return res.status(403).json({ message: "Aucune souscription IA active pour votre établissement." })
    if (sub.remainingQuestions <= 0) return res.status(403).json({ message: QUOTA_EXHAUSTED_MSG })

    // Réponse IA d'abord — on ne facture pas un échec OpenAI
    let result
    try {
      result = await answerQuestion({ course, className: course.class?.name || '', question })
    } catch (err) {
      return res.status(err.status || 500).json({ message: err.message })
    }

    const updated = await consumeQuota(sub)
    if (!updated) return res.status(403).json({ message: QUOTA_EXHAUSTED_MSG })

    // $push atomique : plusieurs élèves posent des questions en parallèle
    const entry = {
      student: req.user._id,
      studentName: req.user.name || '',
      question,
      answer: result.answer,
      status: 'repondu',
      askedAt: new Date(),
      answeredAt: new Date(),
    }
    await AiCourse.updateOne({ _id: course._id }, { $push: { questions: entry } })

    // Journalise l'utilisation (stats + anti-abus)
    AiUsageLog.create({
      user: req.user._id,
      school: course.school,
      subscription: sub._id,
      model: result.model,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      totalTokens: result.usage.totalTokens,
    }).catch((e) => console.error('AiUsageLog:', e.message))

    res.json({
      success: true,
      data: { question: entry, remainingQuestions: updated.remainingQuestions },
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
