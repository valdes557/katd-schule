// jobs/aiCourseRunner.js — Diffusion ponctuelle des cours de l'IA enseignante.
// Tick toutes les 45 s :
//  1. pregenerate : à T-5 min, génère le déroulé complet du cours (OpenAI) →
//     la révélation commence pile à l'heure programmée (ponctualité déterministe).
//  2. startDue    : à scheduledAt, passe en 'en_cours' (startedAt = scheduledAt,
//     PAS now : le retard du tick ne décale jamais le cours) + push aux élèves.
//  3. finishDue   : à scheduledAt + durée, passe en 'termine' + push « posez vos
//     questions ». Idempotence : transitions atomiques conditionnées sur status.
const AiCourse = require('../models/AiCourse')
const AiUsageLog = require('../models/AiUsageLog')
const Student = require('../models/Student')
const { generateLessonScript } = require('../services/aiCourseService')
const { getActiveSubscription, consumeQuota, refundQuota } = require('../services/aiQuotaService')
const { sendToUser, sendToUsers } = require('../services/pushService')

const TICK_MS = 45 * 1000
const PREGEN_LEAD_MS = 5 * 60 * 1000
const MAX_ATTEMPTS = 3

// Push best-effort aux élèves actifs de la classe + au professeur.
async function notifyClass(course, payload) {
  try {
    const students = await Student.find({ class: course.class, status: 'active' }).select('user')
    const ids = students.map((s) => s.user).filter(Boolean)
    if (ids.length) await sendToUsers(ids, payload)
    await sendToUser(course.teacher, payload)
  } catch (e) { console.error('[aiCourse:notify]', e.message) }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Pré-génération à T-5 min
// ─────────────────────────────────────────────────────────────────────────────
async function pregenerate(now) {
  const due = await AiCourse.find({
    status: 'planifie',
    scheduledAt: { $lte: new Date(now.getTime() + PREGEN_LEAD_MS) },
  }).populate('class', 'name').limit(5)

  for (const c of due) {
    // Verrou atomique : protège du double tick / redémarrage en pleine génération
    const locked = await AiCourse.findOneAndUpdate(
      { _id: c._id, status: 'planifie' },
      { $set: { status: 'generation' }, $inc: { generationAttempts: 1 } },
      { new: true }
    ).populate('class', 'name')
    if (!locked) continue

    // Cours périmé (serveur éteint à l'heure prévue) : jamais de diffusion périmée
    const endAt = new Date(locked.scheduledAt).getTime() + locked.durationMinutes * 60000
    if (now.getTime() > endAt) {
      locked.status = 'erreur'
      locked.generationError = "Cours non diffusé (serveur indisponible à l'heure prévue)"
      await locked.save()
      sendToUser(locked.teacher, {
        title: 'Cours IA non diffusé',
        body: `« ${locked.title} » n'a pas pu être diffusé à l'heure prévue.`,
        url: '/dashboard/ia-cours',
        tag: `ai-course-err-${locked._id}`,
      }).catch(() => {})
      continue
    }

    // Souscription IA de l'école
    const sub = await getActiveSubscription(locked.school)
    if (!sub || sub.remainingQuestions <= 0) {
      locked.status = 'erreur'
      locked.generationError = 'Souscription IA absente ou quota épuisé'
      await locked.save()
      sendToUser(locked.teacher, {
        title: 'Cours IA annulé',
        body: `« ${locked.title} » : quota IA de l'établissement épuisé.`,
        url: '/dashboard/ia-cours',
        tag: `ai-course-err-${locked._id}`,
      }).catch(() => {})
      continue
    }

    // 1 unité de quota par cours (remboursée si échec)
    const consumed = await consumeQuota(sub)
    if (!consumed) {
      locked.status = 'erreur'
      locked.generationError = 'Quota IA épuisé'
      await locked.save()
      continue
    }

    try {
      const { script, usage, model } = await generateLessonScript(locked, locked.class?.name || '')
      locked.status = 'pret'
      locked.lessonScript = script
      locked.generatedAt = new Date()
      locked.generationError = ''
      locked.usedFallback = false
      await locked.save()
      AiUsageLog.create({
        user: locked.teacher,
        school: locked.school,
        subscription: sub._id,
        model,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
      }).catch((e) => console.error('AiUsageLog:', e.message))
      console.log(`[aiCourse] script prêt : « ${locked.title} » (${locked.durationMinutes} min)`)
    } catch (err) {
      console.error('[aiCourse:pregen]', locked._id.toString(), err.message)
      await refundQuota(sub._id)
      const canRetry = locked.generationAttempts < MAX_ATTEMPTS &&
        new Date(locked.scheduledAt).getTime() > Date.now()
      if (canRetry) {
        // Retour à 'planifie' : nouvelle tentative au tick suivant
        locked.status = 'planifie'
        locked.generationError = err.message
        await locked.save()
      } else if ((locked.sourceText || '').length >= 200) {
        // Fallback ponctualité : le contenu du prof est déroulé tel quel —
        // le cours démarre quand même à l'heure.
        locked.status = 'pret'
        locked.lessonScript = locked.sourceText
        locked.usedFallback = true
        locked.generationError = err.message
        await locked.save()
      } else {
        locked.status = 'erreur'
        locked.generationError = err.message
        await locked.save()
        sendToUser(locked.teacher, {
          title: 'Cours IA en échec',
          body: `« ${locked.title} » : la préparation par l'IA a échoué.`,
          url: '/dashboard/ia-cours',
          tag: `ai-course-err-${locked._id}`,
        }).catch(() => {})
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Démarrage ponctuel à scheduledAt
// ─────────────────────────────────────────────────────────────────────────────
async function startDue(now) {
  const due = await AiCourse.find({ status: 'pret', scheduledAt: { $lte: now } }).limit(20)
  for (const c of due) {
    const started = await AiCourse.findOneAndUpdate(
      { _id: c._id, status: 'pret' },
      // startedAt = scheduledAt : la révélation est exactement à la position
      // attendue même si le tick arrive jusqu'à 45 s en retard.
      { $set: { status: 'en_cours', startedAt: c.scheduledAt } },
      { new: true }
    )
    if (!started) continue
    await notifyClass(started, {
      title: `${started.subject} — le cours commence`,
      body: started.title,
      url: `/dashboard/ia-cours/${started._id}/live`,
      tag: `ai-course-${started._id}`,
    })
    console.log(`[aiCourse] en direct : « ${started.title} »`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Fin à l'heure + ouverture des questions
// ─────────────────────────────────────────────────────────────────────────────
async function finishDue(now) {
  const live = await AiCourse.find({ status: 'en_cours' }).limit(50)
  for (const c of live) {
    const start = c.startedAt || c.scheduledAt
    const endAt = new Date(new Date(start).getTime() + c.durationMinutes * 60000)
    if (endAt > now) continue
    const done = await AiCourse.findOneAndUpdate(
      { _id: c._id, status: 'en_cours' },
      { $set: { status: 'termine', endedAt: endAt } },
      { new: true }
    )
    if (!done) continue
    await notifyClass(done, {
      title: `${done.subject} — cours terminé`,
      body: "Posez vos questions à l'IA enseignante.",
      url: `/dashboard/ia-cours/${done._id}/live`,
      tag: `ai-course-end-${done._id}`,
    })
    console.log(`[aiCourse] terminé : « ${done.title} »`)
  }
}

async function tick() {
  const now = new Date()
  try { await pregenerate(now) } catch (e) { console.error('[aiCourse:pregen]', e.message) }
  try { await startDue(now) } catch (e) { console.error('[aiCourse:start]', e.message) }
  try { await finishDue(now) } catch (e) { console.error('[aiCourse:finish]', e.message) }
}

let timer = null
function start() {
  if (timer) return
  // Premier passage peu après le démarrage (laisse la connexion Mongo s'établir)
  setTimeout(tick, 20 * 1000)
  timer = setInterval(tick, TICK_MS)
  console.log('🤖 Runner cours IA démarré (tick 45 s : pré-génération T-5, départ/fin ponctuels)')
}

module.exports = { start, tick }
