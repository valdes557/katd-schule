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
  extractPdfText, revealedText, answerQuestion, generateCourseContent,
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

const courseUpload = upload.fields([
  { name: 'pdf', maxCount: 1 },
  { name: 'nextPdf', maxCount: 1 },
  { name: 'images', maxCount: 5 },
])

// POST /api/ai-courses/generate-content — rédiger le cours automatiquement avec l'IA
router.post('/generate-content', protect, authorize('enseignant', 'directeur', 'super_admin'), rateLimit({ windowMs: 60000, max: 10 }), async (req, res) => {
  try {
    const sid = schoolId(req)
    if (!sid) return res.status(400).json({ message: 'Aucune école associée à votre compte' })
    const { title, subject, level, className, durationMinutes, language, images } = req.body
    if (!title || !subject) {
      return res.status(400).json({ message: 'Titre et matière requis pour la génération.' })
    }
    const sub = await getActiveSubscription(sid)
    if (!sub || sub.remainingQuestions <= 0) {
      return res.status(403).json({ message: sub ? QUOTA_EXHAUSTED_MSG : "Aucune souscription IA active pour votre établissement." })
    }
    const result = await generateCourseContent({
      title,
      subject,
      level: level || '',
      className: className || '',
      durationMinutes: parseInt(durationMinutes, 10) || 45,
      language: language || 'fr-FR',
      images: Array.isArray(images) ? images : [],
    })
    res.json({ success: true, data: result })
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message })
  }
})

// POST /api/ai-courses — programmer un cours (multipart : champs 'pdf', 'nextPdf' et 'images' optionnels)
router.post('/', protect, authorize('enseignant', 'directeur'), courseUpload, async (req, res) => {
  try {
    const sid = schoolId(req)
    if (!sid) return res.status(400).json({ message: 'Aucune école associée à votre compte' })

    const {
      classId, subject, subjectRef, title, sourceType, sourceText, scheduledAt, durationMinutes,
      language, voice, qaDurationMinutes, nextCourseTitle, nextCourseDate, nextCourseInstructions,
      nextCourseSourceType, nextCourseSourceText,
    } = req.body
    if (!classId || !subject || !title || !scheduledAt || !durationMinutes) {
      return res.status(400).json({ message: 'Classe, matière, titre, date/heure et durée requis' })
    }
    const duration = parseInt(durationMinutes, 10)
    if (!Number.isInteger(duration) || duration < 5 || duration > 240) {
      return res.status(400).json({ message: 'Durée invalide (entre 5 et 240 minutes)' })
    }
    const startNow = req.body.startNow === 'true' || req.body.startNow === true
    let when = new Date(scheduledAt)
    if (isNaN(when.getTime())) when = new Date()

    const isImmediate = startNow || when.getTime() <= Date.now() + 60 * 1000
    if (isImmediate) {
      when = new Date()
    } else if (when.getTime() < Date.now() - 5 * 60 * 1000) {
      return res.status(400).json({ message: "L'horaire prévu est déjà dépassé. Démarrez le cours en direct ou choisissez une heure future." })
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

    // Gestion des images téléversées ou fournies
    const courseImages = []
    if (req.files?.images && Array.isArray(req.files.images)) {
      for (const img of req.files.images) {
        courseImages.push({
          url: img.path,
          name: img.originalname || 'Illustration',
          caption: '',
        })
      }
    }
    if (req.body.existingImages) {
      try {
        const parsed = typeof req.body.existingImages === 'string' ? JSON.parse(req.body.existingImages) : req.body.existingImages
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && item.url) courseImages.push(item)
          }
        }
      } catch (_) {}
    }

    // Contenu source : texte saisi OU texte extrait du PDF OU auto-génération IA
    const finalSourceType = ['pdf', 'ai_generate'].includes(sourceType) ? sourceType : 'text'
    let text = String(sourceText || '').trim()
    let pdfUrl = ''
    let pdfName = ''
    const pdfFile = req.files?.pdf?.[0] || req.file
    if (finalSourceType === 'pdf') {
      if (!pdfFile) return res.status(400).json({ message: 'Fichier PDF requis' })
      try {
        text = await extractPdfText(pdfFile.buffer)
      } catch (e) {
        return res.status(400).json({ message: 'Impossible de lire ce PDF : ' + e.message })
      }
      if (text.length < 200) {
        return res.status(400).json({ message: 'Le PDF ne contient pas de texte exploitable (document scanné ?). Saisissez le cours en texte.' })
      }
      pdfUrl = pdfFile.path || ''
      pdfName = pdfFile.originalname || ''
    } else if (finalSourceType === 'ai_generate') {
      if (!text) {
        text = `Cours pédagogique approfondi sur le thème : ${title}. Matière : ${subject}. Niveau : ${klass.level || 'Général'}.`
      }
    } else if (text.length < 200) {
      return res.status(400).json({ message: 'Le contenu du cours est trop court (200 caractères minimum). Vous pouvez aussi choisir la génération automatique par l\'IA.' })
    }

    // Support du prochain cours (texte ou PDF)
    let nextPdfUrl = ''
    let nextPdfName = ''
    const nextPdfFile = req.files?.nextPdf?.[0]
    if (nextPdfFile) {
      nextPdfUrl = nextPdfFile.path || ''
      nextPdfName = nextPdfFile.originalname || ''
    }

    let initialStatus = 'planifie'
    let lessonScript = ''
    let generatedAt = null
    let usedFallback = false
    let generationError = ''

    if (isImmediate) {
      try {
        const { script, usage, model } = await generateLessonScript({
          title: String(title).trim(),
          subject: String(subject).trim(),
          durationMinutes: duration,
          language: language || 'fr-FR',
          sourceType: finalSourceType,
          sourceText: text,
          images: courseImages,
          level: klass.level || '',
        }, klass.name || '')
        lessonScript = script
        initialStatus = 'en_cours'
        generatedAt = new Date()
        AiUsageLog.create({
          user: req.user._id,
          school: sid,
          subscription: sub._id,
          model,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
        }).catch(() => {})
      } catch (err) {
        if (text.length >= 200) {
          lessonScript = text
          usedFallback = true
          initialStatus = 'en_cours'
          generationError = err.message
        } else {
          return res.status(502).json({
            message: `Erreur lors de la préparation IA du cours : ${err.message}`,
            generationError: err.message,
          })
        }
      }
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
      sourceType: finalSourceType,
      sourceText: text,
      pdfUrl,
      pdfName,
      images: courseImages,
      scheduledAt: when,
      startedAt: isImmediate ? when : null,
      durationMinutes: duration,
      language: language || 'fr-FR',
      voice: voice || 'female',
      qaDurationMinutes: qaDurationMinutes !== undefined ? Math.max(0, parseInt(qaDurationMinutes, 10)) : 10,
      nextCourseTitle: (nextCourseTitle || '').trim(),
      nextCourseDate: nextCourseDate ? new Date(nextCourseDate) : null,
      nextCourseInstructions: (nextCourseInstructions || '').trim(),
      nextCourseSourceType: ['none', 'text', 'pdf'].includes(nextCourseSourceType) ? nextCourseSourceType : (nextPdfUrl ? 'pdf' : (nextCourseSourceText ? 'text' : 'none')),
      nextCourseSourceText: (nextCourseSourceText || '').trim(),
      nextCoursePdfUrl: nextPdfUrl,
      nextCoursePdfName: nextPdfName,
      lessonScript,
      generatedAt,
      usedFallback,
      generationError,
      status: initialStatus,
    })
    res.status(201).json({ success: true, data: course })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/ai-courses/batch — programmer plusieurs cours d'une journée
router.post('/batch', protect, authorize('enseignant', 'directeur'), async (req, res) => {
  try {
    const sid = schoolId(req)
    if (!sid) return res.status(400).json({ message: 'Aucune école associée à votre compte' })

    const { courses } = req.body
    if (!Array.isArray(courses) || courses.length === 0) {
      return res.status(400).json({ message: 'Liste de cours invalide ou vide.' })
    }
    if (courses.length > 100) {
      return res.status(400).json({ message: 'Maximum 100 cours par programmation simultanée.' })
    }

    let teacherProfile = null
    let teacherClassIds = []
    if (req.user.role === 'enseignant') {
      const teacher = await Teacher.findOne({ user: req.user._id })
      if (!teacher) return res.status(403).json({ message: 'Profil enseignant non trouvé' })
      teacherClassIds = (teacher.classes || []).map((c) => c.toString())
      teacherProfile = teacher._id
    }

    const sub = await getActiveSubscription(sid)
    if (!sub || sub.remainingQuestions <= 0) {
      return res.status(403).json({ message: sub ? QUOTA_EXHAUSTED_MSG : "Aucune souscription IA active pour votre établissement." })
    }

    const createdList = []
    for (let i = 0; i < courses.length; i++) {
      const c = courses[i]
      const {
        classId, subject, subjectRef, title, sourceType, sourceText, scheduledAt, durationMinutes,
        language, voice, qaDurationMinutes, nextCourseTitle, nextCourseDate, nextCourseInstructions,
        nextCourseSourceType, nextCourseSourceText, images,
      } = c

      if (!classId || !subject || !title || !scheduledAt || !durationMinutes) {
        return res.status(400).json({ message: `Cours n°${i + 1} : Classe, matière, titre, date/heure et durée requis.` })
      }
      if (req.user.role === 'enseignant' && !teacherClassIds.includes(String(classId))) {
        return res.status(403).json({ message: `Cours n°${i + 1} : Vous ne pouvez programmer un cours que pour vos classes assignées.` })
      }
      const duration = parseInt(durationMinutes, 10)
      if (!Number.isInteger(duration) || duration < 5 || duration > 240) {
        return res.status(400).json({ message: `Cours n°${i + 1} : Durée invalide (entre 5 et 240 minutes).` })
      }
      const when = new Date(scheduledAt)
      if (isNaN(when.getTime())) {
        return res.status(400).json({ message: `Cours n°${i + 1} : Date/heure invalide.` })
      }
      const finalSourceType = ['text', 'ai_generate'].includes(sourceType) ? sourceType : 'text'
      let text = String(sourceText || '').trim()
      if (finalSourceType === 'ai_generate') {
        if (!text) {
          text = `Cours pédagogique approfondi sur le thème : ${title}. Matière : ${subject}.`
        }
      } else if (text.length < 200) {
        return res.status(400).json({ message: `Cours n°${i + 1} (« ${title} ») : Le contenu est trop court (200 caractères minimum) ou choisissez la génération IA.` })
      }

      const klass = await Class.findOne({ _id: classId, school: sid }).select('name level')
      if (!klass) return res.status(404).json({ message: `Cours n°${i + 1} : Classe introuvable dans votre école.` })

      const newCourse = await AiCourse.create({
        school: sid,
        class: classId,
        subject: String(subject).trim(),
        subjectRef: subjectRef || null,
        teacher: req.user._id,
        teacherProfile,
        teacherName: req.user.name || '',
        title: String(title).trim(),
        level: klass.level || '',
        sourceType: finalSourceType,
        sourceText: text,
        images: Array.isArray(images) ? images : [],
        scheduledAt: when,
        durationMinutes: duration,
        language: language || 'fr-FR',
        voice: voice || 'female',
        qaDurationMinutes: qaDurationMinutes !== undefined ? Math.max(0, parseInt(qaDurationMinutes, 10)) : 10,
        nextCourseTitle: (nextCourseTitle || '').trim(),
        nextCourseDate: nextCourseDate ? new Date(nextCourseDate) : null,
        nextCourseInstructions: (nextCourseInstructions || '').trim(),
        nextCourseSourceType: nextCourseSourceType || 'none',
        nextCourseSourceText: (nextCourseSourceText || '').trim(),
        status: 'planifie',
      })
      createdList.push(newCourse)
    }

    res.status(201).json({ success: true, count: createdList.length, data: createdList })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/ai-courses/:id — modification (autorisée même en compte à rebours ou préparation)
router.put('/:id', protect, authorize('enseignant', 'directeur'), courseUpload, async (req, res) => {
  try {
    const course = await AiCourse.findById(req.params.id)
    if (!course) return res.status(404).json({ message: 'Cours introuvable' })
    if (String(course.school) !== String(schoolId(req))) return res.status(403).json({ message: 'Accès refusé' })
    if (req.user.role === 'enseignant' && String(course.teacher) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Vous ne pouvez modifier que vos propres cours' })
    }
    if (['termine', 'annule'].includes(course.status)) {
      return res.status(400).json({ message: "Ce cours est déjà terminé ou annulé et ne peut plus être modifié." })
    }

    const {
      title, subject, subjectRef, sourceText, sourceType, scheduledAt, durationMinutes, classId,
      language, voice, qaDurationMinutes, nextCourseTitle, nextCourseDate, nextCourseInstructions,
      nextCourseSourceType, nextCourseSourceText,
    } = req.body

    let contentChanged = false

    if (title !== undefined) course.title = String(title).trim()
    if (subject !== undefined) course.subject = String(subject).trim()
    if (subjectRef !== undefined) course.subjectRef = subjectRef || null
    if (language !== undefined && course.language !== String(language).trim()) {
      course.language = String(language).trim() || 'fr-FR'
      contentChanged = true
    }
    if (voice !== undefined) course.voice = String(voice).trim() || 'female'
    if (qaDurationMinutes !== undefined) course.qaDurationMinutes = Math.max(0, parseInt(qaDurationMinutes, 10) || 10)
    if (nextCourseTitle !== undefined) course.nextCourseTitle = String(nextCourseTitle).trim()
    if (nextCourseDate !== undefined) course.nextCourseDate = nextCourseDate ? new Date(nextCourseDate) : null
    if (nextCourseInstructions !== undefined) course.nextCourseInstructions = String(nextCourseInstructions).trim()
    if (nextCourseSourceType !== undefined) course.nextCourseSourceType = nextCourseSourceType
    if (nextCourseSourceText !== undefined) course.nextCourseSourceText = String(nextCourseSourceText).trim()

    // Gestion du PDF du prochain cours si fourni
    if (req.files?.nextPdf?.[0]) {
      course.nextCoursePdfUrl = req.files.nextPdf[0].path || ''
      course.nextCoursePdfName = req.files.nextPdf[0].originalname || ''
      course.nextCourseSourceType = 'pdf'
    }

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
      if (when.getTime() < Date.now() - 5 * 60 * 1000 && course.status !== 'en_cours') {
        return res.status(400).json({ message: "L'horaire ne peut pas être fixé dans le passé." })
      }
      course.scheduledAt = when
    }

    // Gestion des images ajoutées ou existantes
    if (req.files?.images && Array.isArray(req.files.images)) {
      if (!Array.isArray(course.images)) course.images = []
      for (const img of req.files.images) {
        course.images.push({
          url: img.path,
          name: img.originalname || 'Illustration',
          caption: '',
        })
      }
      contentChanged = true
    }
    if (req.body.existingImages !== undefined) {
      try {
        const parsed = typeof req.body.existingImages === 'string' ? JSON.parse(req.body.existingImages) : req.body.existingImages
        if (Array.isArray(parsed)) {
          course.images = parsed.filter((item) => item && item.url)
          contentChanged = true
        }
      } catch (_) {}
    }

    if (sourceType !== undefined) {
      const st = ['pdf', 'ai_generate', 'text'].includes(sourceType) ? sourceType : 'text'
      if (course.sourceType !== st) {
        course.sourceType = st
        contentChanged = true
      }
    }

    // Gestion de la source principale du cours
    const pdfFile = req.files?.pdf?.[0]
    if (pdfFile) {
      try {
        const extracted = await extractPdfText(pdfFile.buffer)
        if (extracted.length < 200) {
          return res.status(400).json({ message: 'Le PDF ne contient pas de texte exploitable.' })
        }
        course.sourceText = extracted
        course.sourceType = 'pdf'
        course.pdfUrl = pdfFile.path || ''
        course.pdfName = pdfFile.originalname || ''
        contentChanged = true
      } catch (e) {
        return res.status(400).json({ message: 'Impossible de lire ce PDF : ' + e.message })
      }
    } else if (sourceText !== undefined) {
      const text = String(sourceText).trim()
      if (course.sourceType !== 'ai_generate' && course.sourceType !== 'pdf' && text.length < 200) {
        return res.status(400).json({ message: 'Le contenu du cours est trop court (200 caractères minimum).' })
      }
      if (text !== course.sourceText) {
        course.sourceText = text || (course.sourceType === 'ai_generate' ? `Cours sur : ${course.title}` : '')
        contentChanged = true
      }
    }

    // Si le contenu ou la langue a changé et que le cours n'a pas encore commencé :
    // Réinitialiser le script pour que l'IA le régénère à neuf avant diffusion !
    if (contentChanged && ['planifie', 'generation', 'pret'].includes(course.status)) {
      course.lessonScript = ''
      course.generationAttempts = 0
      course.generationError = ''
      course.status = 'planifie'
    }

    await course.save()
    res.json({ success: true, data: course })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/ai-courses/:id/start-now — Démarrer immédiatement la diffusion en direct
router.post('/:id/start-now', protect, authorize('enseignant', 'directeur', 'super_admin', 'vice_principal'), async (req, res) => {
  try {
    const course = await AiCourse.findById(req.params.id).populate('class', 'name level')
    if (!course) return res.status(404).json({ message: 'Cours introuvable' })
    if (req.user.role !== 'super_admin' && String(course.school) !== String(schoolId(req))) {
      return res.status(403).json({ message: 'Accès refusé' })
    }
    if (req.user.role === 'enseignant' && course.teacher && String(course.teacher) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Vous ne pouvez démarrer que vos propres cours' })
    }

    const sid = schoolId(req)
    const sub = await getActiveSubscription(sid)
    if (!sub || sub.remainingQuestions <= 0) {
      return res.status(403).json({ message: sub ? QUOTA_EXHAUSTED_MSG : "Souscription IA active requise pour votre établissement." })
    }

    // Si le cours n'a pas encore de script généré, on le prépare immédiatement
    if (!course.lessonScript || course.lessonScript.length < 100) {
      try {
        const { script, usage, model } = await generateLessonScript(course, course.class?.name || '')
        course.lessonScript = script
        course.generatedAt = new Date()
        course.generationError = ''
        course.usedFallback = false
        AiUsageLog.create({
          user: req.user._id,
          school: course.school,
          subscription: sub._id,
          model,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
        }).catch(() => {})
      } catch (err) {
        if ((course.sourceText || '').length >= 200) {
          course.lessonScript = course.sourceText
          course.usedFallback = true
          course.generationError = err.message
        } else {
          course.status = 'erreur'
          course.generationError = err.message
          await course.save()
          return res.status(502).json({
            message: `Erreur lors de la préparation du cours par l'IA : ${err.message}`,
            generationError: err.message,
          })
        }
      }
    }

    const now = new Date()
    course.status = 'en_cours'
    course.scheduledAt = now
    course.startedAt = now
    course.endedAt = null
    course.generationError = ''
    await course.save()

    res.json({
      success: true,
      message: 'La diffusion en direct du cours a démarré avec succès !',
      data: course,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
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

// DELETE /api/ai-courses/:id — suppression (cours planifié, terminé, annulé ou en erreur)
router.delete('/:id', protect, authorize('enseignant', 'directeur', 'super_admin', 'vice_principal'), async (req, res) => {
  try {
    const course = await AiCourse.findById(req.params.id)
    if (!course) return res.status(404).json({ message: 'Cours introuvable' })
    if (req.user.role !== 'super_admin' && String(course.school) !== String(schoolId(req))) return res.status(403).json({ message: 'Accès refusé' })
    if (req.user.role === 'enseignant' && course.teacher && String(course.teacher) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Vous ne pouvez supprimer que vos propres cours' })
    }
    if (!['planifie', 'termine', 'annule', 'erreur'].includes(course.status)) {
      return res.status(400).json({ message: 'Un cours en cours de préparation ou de diffusion ne peut pas être supprimé.' })
    }
    await course.deleteOne()
    res.json({ success: true })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/ai-courses/:id/send-to-director — Transmettre le cours au directeur de l'établissement
router.post('/:id/send-to-director', protect, authorize('enseignant', 'directeur', 'super_admin', 'vice_principal'), async (req, res) => {
  try {
    const course = await AiCourse.findById(req.params.id).populate('class', 'name level')
    if (!course) return res.status(404).json({ message: 'Cours introuvable' })
    if (req.user.role === 'enseignant' && course.teacher && String(course.teacher) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Vous ne pouvez transmettre que vos propres cours' })
    }

    course.sentToDirector = true
    course.sentToDirectorAt = new Date()
    await course.save()

    // Notification interne envoyée au directeur
    try {
      const Notification = require('../models/Notification')
      const director = await User.findOne({ school: course.school, role: 'directeur' })
      if (director) {
        await Notification.create({
          user: director._id,
          school: course.school,
          type: 'ai_course_report',
          title: `Rapport de cours IA : ${course.title}`,
          message: `L'enseignant ${course.teacherName || req.user.name} vous a transmis le cours « ${course.title} » (${course.subject}) de la classe ${course.class?.name || ''}.`,
          data: { courseId: course._id },
          link: `/dashboard/ia-cours/${course._id}/live`,
        })
      }
    } catch (_) {}

    res.json({
      success: true,
      message: 'Le cours a été transmis avec succès au directeur de votre établissement.',
      data: course,
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/ai-courses/:id/refine — Demande à l'IA d'ajouter ou modifier des éléments du cours (exercices, développement, précisions)
router.post('/:id/refine', protect, authorize('enseignant', 'directeur', 'super_admin', 'vice_principal'), async (req, res) => {
  try {
    const { instructions } = req.body || {}
    if (!instructions || !String(instructions).trim()) {
      return res.status(400).json({ message: 'Veuillez préciser la consigne de modification (ex: "ajoute des exercices", "développe la conclusion"...)' })
    }

    const course = await AiCourse.findById(req.params.id).populate('class', 'name level')
    if (!course) return res.status(404).json({ message: 'Cours introuvable' })
    if (req.user.role === 'enseignant' && course.teacher && String(course.teacher) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Accès refusé. Vous ne pouvez modifier que vos cours.' })
    }

    const sid = schoolId(req)
    const sub = await getActiveSubscription(sid)
    if (!sub || sub.remainingQuestions <= 0) {
      return res.status(403).json({ message: sub ? QUOTA_EXHAUSTED_MSG : "Souscription IA requise pour modifier le cours." })
    }

    const currentContent = course.lessonScript || course.sourceText || `Cours sur le thème : ${course.title}`
    const prompt = `Tu es un professeur assistant pédagogique d'élite pour la plateforme éducative KATD-SCHÜLE.
Niveau scolaire : ${course.level || course.class?.level || 'Secondaire'}
Classe : ${course.class?.name || 'Classe'}
Matière : ${course.subject}
Titre de la leçon : ${course.title}

Voici le contenu actuel de la leçon :
-------------------------------------
${currentContent.slice(0, 7000)}
-------------------------------------

CONSIGNE PRÉCISE DE L'ENSEIGNANT POUR AMÉLIORER / MODIFIER CE COURS :
"${String(instructions).trim()}"

DIRECTIVES OBLIGATOIRES :
1. Intègre scrupuleusement la demande de l'enseignant au sein du cours.
2. Si l'enseignant demande d'ajouter des exercices, formule 2 à 4 exercices adaptés au niveau avec leurs corrigés détaillés et méthodiques.
3. Si l'enseignant demande d'approfondir un passage, enrichis les explications avec des exemples concrets, analogies pédagogiques et formules clés.
4. Reste parfaitement fidèle au programme officiel et au niveau de la classe (${course.level || course.class?.level || 'Secondaire'}).
5. Formate la réponse en Markdown clair et soigné (#, ##, listes, formules, mise en gras des concepts clés).
6. Rédige le cours complet résultant prêt à être étudié et imprimé en PDF.`

    const refinedText = await generateText(prompt)
    if (!refinedText || refinedText.length < 100) {
      return res.status(502).json({ message: "L'IA n'a pas pu traiter cette modification. Veuillez réessayer." })
    }

    course.sourceText = refinedText
    course.lessonScript = refinedText
    course.status = ['planifie', 'erreur'].includes(course.status) ? 'pret' : course.status
    await course.save()

    res.json({
      success: true,
      message: 'Le cours a été enrichi et modifié avec succès par l\'IA selon votre demande.',
      data: course,
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ═════════════════════════════════════════════════════════════════════════════
// CONSULTATION
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/ai-courses?status=&classId=&scope=&page=&limit= — liste scopée par rôle avec pagination
router.get('/', protect, async (req, res) => {
  try {
    const sid = schoolId(req)
    if (!sid) return res.json({ success: true, data: [], pagination: { total: 0, page: 1, limit: 200, totalPages: 1 } })
    const query = { school: sid }
    if (req.query.classId) query.class = req.query.classId
    if (req.query.status) query.status = { $in: String(req.query.status).split(',') }

    const role = req.user.role
    if (role === 'enseignant') {
      const teacher = await Teacher.findOne({ user: req.user._id }).select('classes')
      if (!teacher) return res.json({ success: true, data: [], pagination: { total: 0, page: 1, limit: 200, totalPages: 1 } })
      if (req.query.scope === 'classes') query.class = { $in: teacher.classes || [] }
      else query.teacher = req.user._id
    } else if (role === 'eleve') {
      const cid = await studentClassId(req.user._id)
      if (!cid) return res.json({ success: true, data: [], pagination: { total: 0, page: 1, limit: 200, totalPages: 1 } })
      query.class = cid
      if (!query.status) query.status = { $in: ['pret', 'en_cours', 'termine'] }
    } else if (role === 'parent') {
      const children = await Student.find({ parentUser: req.user._id }).select('class')
      const ids = children.map((s) => s.class).filter(Boolean)
      if (!ids.length) return res.json({ success: true, data: [], pagination: { total: 0, page: 1, limit: 200, totalPages: 1 } })
      query.class = { $in: ids }
      if (!query.status) query.status = { $in: ['en_cours', 'termine'] }
    } else if (!['directeur', 'vice_principal', 'super_admin'].includes(role)) {
      return res.status(403).json({ message: 'Accès refusé' })
    }

    const total = await AiCourse.countDocuments(query)
    const page = req.query.page ? Math.max(1, parseInt(req.query.page, 10) || 1) : null
    const limit = req.query.limit ? Math.max(1, Math.min(200, parseInt(req.query.limit, 10) || 10)) : (page ? 10 : 200)

    let queryBuilder = AiCourse.find(query)
      .select('-lessonScript -sourceText')
      .populate('class', 'name level')
      .sort({ scheduledAt: -1 })

    if (page) {
      queryBuilder = queryBuilder.skip((page - 1) * limit).limit(limit)
    } else {
      queryBuilder = queryBuilder.limit(limit)
    }

    const courses = await queryBuilder.lean()
    const data = courses.map((c) => ({
      ...c,
      questionCount: (c.questions || []).length,
      questions: undefined,
    }))
    res.json({
      success: true,
      data,
      pagination: {
        total,
        page: page || 1,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    })
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
        language: course.language || 'fr-FR',
        voice: course.voice || 'female',
        qaDurationMinutes: course.qaDurationMinutes ?? 10,
        nextCourseTitle: course.nextCourseTitle || '',
        nextCourseDate: course.nextCourseDate || null,
        nextCourseInstructions: course.nextCourseInstructions || '',
        nextCourseSourceType: course.nextCourseSourceType || 'none',
        nextCourseSourceText: course.nextCourseSourceText || '',
        nextCoursePdfUrl: course.nextCoursePdfUrl || '',
        nextCoursePdfName: course.nextCoursePdfName || '',
        images: (course.images || []).map((img) => ({
          url: img.url,
          name: img.name || 'Illustration',
          caption: img.caption || '',
          analysis: img.analysis || '',
        })),
        text: reveal.text,
        units: reveal.units || [],
        progress: reveal.progress,
        remainingSeconds: reveal.remainingSeconds,
        totalUnits: reveal.totalUnits,
        shownUnits: reveal.shownUnits,
        canAskQuestions: course.status === 'termine' || (course.status === 'en_cours' && (course.qaDurationMinutes ?? 10) > 0),
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
// QUESTIONS DES ÉLÈVES & TEST DU PROFESSEUR — l'IA répond après chaque question
// ═════════════════════════════════════════════════════════════════════════════

// POST /api/ai-courses/:id/questions { question }
router.post('/:id/questions', protect, authorize('eleve', 'enseignant', 'directeur', 'super_admin'), rateLimit({ windowMs: 60000, max: 10 }), async (req, res) => {
  try {
    const question = String(req.body.question || '').trim()
    if (!question) return res.status(400).json({ message: 'Votre question est vide.' })
    if (question.length > 500) return res.status(400).json({ message: 'Question trop longue (500 caractères maximum).' })

    const course = await AiCourse.findById(req.params.id).populate('class', 'name')
    if (!course) return res.status(404).json({ message: 'Cours introuvable' })
    if (!['en_cours', 'termine'].includes(course.status)) {
      return res.status(400).json({ message: "Les questions ne sont pas encore ouvertes pour ce cours." })
    }

    // Vérification de la classe et des limites d'élèves (uniquement pour le rôle 'eleve')
    if (req.user.role === 'eleve') {
      const cid = await studentClassId(req.user._id)
      if (!cid || String(cid) !== String(course.class._id)) {
        return res.status(403).json({ message: 'Ce cours ne concerne pas votre classe.' })
      }
      const mine = (course.questions || []).filter((q) => String(q.student) === String(req.user._id))
      if (mine.length >= MAX_QUESTIONS_PER_STUDENT) {
        return res.status(429).json({ message: `Limite atteinte : ${MAX_QUESTIONS_PER_STUDENT} questions par élève et par cours.` })
      }
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

    // $push atomique : plusieurs élèves ou le professeur posent des questions
    const entry = {
      student: req.user._id,
      studentName: req.user.name || (req.user.role === 'enseignant' ? 'Professeur' : 'Élève'),
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
