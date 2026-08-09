// services/aiCourseService.js — Logique métier de l'IA enseignante autonome.
// Extraction du texte des PDF, génération du déroulé de cours via OpenAI,
// révélation progressive calée sur le temps (fonction pure → tous les
// spectateurs voient exactement la même chose), réponses aux questions.
const AiConfig = require('../models/AiConfig')
const { generateChatResponse } = require('./openaiService')

const MAX_SOURCE_CHARS = 20000 // taille max du contenu source (texte ou PDF extrait)
const MAX_CONTEXT_CHARS = 6000 // contexte max envoyé à l'IA pour les questions

// ─────────────────────────────────────────────────────────────────────────────
// Extraction du texte d'un PDF (buffer multer). require paresseux : le boot
// du serveur ne dépend pas de pdf-parse.
// ─────────────────────────────────────────────────────────────────────────────
async function extractPdfText(buffer) {
  const pdfParse = require('pdf-parse')
  const data = await pdfParse(buffer)
  return String(data.text || '')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_SOURCE_CHARS)
}

// ─────────────────────────────────────────────────────────────────────────────
// Génération du déroulé complet du cours
// ─────────────────────────────────────────────────────────────────────────────

function lessonSystemPrompt(course, className) {
  const dur = course.durationMinutes
  const parts = Math.min(6, Math.max(3, Math.ceil(dur / 12)))
  const targetWords = Math.min(dur * 130, 6000)
  return [
    `Tu es un professeur de ${course.subject} qui donne un cours en direct à la classe ${className}${course.level ? ` (niveau ${course.level})` : ''}.`,
    `Le cours dure ${dur} minutes et sera affiché progressivement aux élèves, comme si tu l'écrivais au tableau au fur et à mesure.`,
    '',
    'Rédige le DÉROULÉ COMPLET du cours en français, prêt à être lu, structuré ainsi :',
    "1. Accroche et objectifs de la séance",
    `2. Développement en ${parts} parties numérotées (définitions, explications, exemples concrets)`,
    "3. Exercices d'application avec correction expliquée",
    '4. Résumé et points à retenir',
    '',
    'Contraintes :',
    `- Environ ${targetWords} mots (le rythme doit remplir ${dur} minutes).`,
    `- Phrases courtes et claires, adaptées au niveau des élèves.`,
    '- Pas de Markdown lourd : titres en texte simple, listes avec des tirets.',
    "- Tu parles à des élèves, jamais à « l'utilisateur ». Ne mentionne jamais que tu es une IA.",
  ].join('\n')
}

// Planifie 1 à 3 appels OpenAI selon la durée (maxTokens plafonné à 4000).
function planChunks(durationMinutes) {
  if (durationMinutes <= 25) return 1
  if (durationMinutes <= 60) return 2
  return 3
}

/**
 * Génère le déroulé complet du cours (1 à 3 appels selon la durée).
 * @returns {Promise<{script:string, usage:Object, model:string, calls:number}>}
 */
async function generateLessonScript(course, className) {
  const cfg = await AiConfig.getConfig()
  const genConfig = {
    model: cfg.model,
    systemPrompt: lessonSystemPrompt(course, className),
    temperature: 0.6,
    maxTokens: 4000,
  }
  const calls = planChunks(course.durationMinutes)
  const source = String(course.sourceText || '').slice(0, MAX_SOURCE_CHARS)
  const parts = []
  const usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }

  for (let i = 0; i < calls; i++) {
    let instruction
    if (calls === 1) {
      instruction = `Contenu de référence fourni par le professeur (à respecter et développer) :\n"""\n${source}\n"""\n\nRédige le déroulé complet du cours.`
    } else if (i === 0) {
      instruction = `Contenu de référence fourni par le professeur (à respecter et développer) :\n"""\n${source}\n"""\n\nRédige la partie ${i + 1} sur ${calls} du déroulé (début du cours : accroche, objectifs, premières parties). Ne conclus pas.`
    } else {
      const tail = parts[i - 1].slice(-1500)
      instruction = `Contenu de référence fourni par le professeur :\n"""\n${source}\n"""\n\nVoici la fin de ce qui a déjà été dit :\n"""\n${tail}\n"""\n\nPoursuis le cours (partie ${i + 1} sur ${calls}) sans répéter ce qui précède.${i === calls - 1 ? ' Termine par les exercices corrigés puis le résumé.' : ' Ne conclus pas encore.'}`
    }
    const r = await generateChatResponse({
      messages: [{ role: 'user', content: instruction }],
      config: genConfig,
    })
    parts.push(r.content)
    usage.promptTokens += r.usage.promptTokens
    usage.completionTokens += r.usage.completionTokens
    usage.totalTokens += r.usage.totalTokens
  }
  return { script: parts.join('\n\n'), usage, model: genConfig.model, calls }
}

// ─────────────────────────────────────────────────────────────────────────────
// Révélation progressive — fonction pure du temps
// ─────────────────────────────────────────────────────────────────────────────

// Découpe le script en unités de révélation (phrases ; les très longues sont
// re-coupées par groupes de 12 mots pour garder un rythme d'écriture fluide).
function splitScript(script) {
  const raw = String(script || '')
    .split(/(?<=[.!?…:])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const out = []
  for (const u of raw) {
    if (u.length <= 220) { out.push(u); continue }
    const w = u.split(/\s+/)
    for (let i = 0; i < w.length; i += 12) out.push(w.slice(i, i + 12).join(' '))
  }
  return out
}

// Rejoint les unités en préservant la structure (retour à la ligne avant les
// tirets et numéros de liste).
function joinUnits(units) {
  let text = ''
  for (const u of units) {
    if (!text) { text = u; continue }
    text += (/^[-•]|^\d+[.)]/.test(u) ? '\n' : ' ') + u
  }
  return text
}

/**
 * Portion du cours visible à l'instant `now` : l'IA « écrit » au rythme calé
 * sur la durée programmée. Identique pour tous les spectateurs, résiste aux
 * rechargements et redémarrages (aucun état de progression persisté).
 */
function revealedText(course, now = new Date()) {
  const units = splitScript(course.lessonScript)
  const total = units.length
  const start = course.startedAt || course.scheduledAt
  const durMs = course.durationMinutes * 60 * 1000
  const elapsed = Math.max(0, now.getTime() - new Date(start).getTime())
  const progress = durMs > 0 ? Math.min(1, elapsed / durMs) : 1
  // Un cours terminé révèle TOUT (jamais de texte tronqué à la fin)
  const shown = course.status === 'termine' ? total : Math.min(total, Math.floor(progress * total))
  return {
    text: joinUnits(units.slice(0, shown)),
    totalUnits: total,
    shownUnits: shown,
    progress,
    remainingSeconds: Math.max(0, Math.round((durMs - elapsed) / 1000)),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Questions des élèves en fin de cours
// ─────────────────────────────────────────────────────────────────────────────

// Tronque le script pour le contexte : début (intro) + fin (conclusion/résumé).
function truncateContext(script) {
  const s = String(script || '')
  if (s.length <= MAX_CONTEXT_CHARS) return s
  return s.slice(0, 1500) + '\n[...]\n' + s.slice(-(MAX_CONTEXT_CHARS - 1500))
}

/**
 * Répond à la question d'un élève avec le cours comme contexte.
 * @returns {Promise<{answer:string, usage:Object, model:string}>}
 */
async function answerQuestion({ course, className, question }) {
  const cfg = await AiConfig.getConfig()
  const systemPrompt = [
    `Tu es le professeur qui vient de donner ce cours de ${course.subject} à la classe ${className}.`,
    "Un élève te pose une question sur le cours. Réponds en français, brièvement (5 à 12 phrases), avec un exemple si utile.",
    "Reste dans le cadre du cours et du programme scolaire ; si la question sort du sujet, ramène poliment l'élève au cours.",
    'Ne mentionne jamais que tu es une IA.',
    '',
    'Voici le cours qui vient d\'être donné :',
    '"""',
    truncateContext(course.lessonScript || course.sourceText),
    '"""',
  ].join('\n')

  const result = await generateChatResponse({
    messages: [{ role: 'user', content: String(question).trim() }],
    config: { model: cfg.model, systemPrompt, temperature: 0.4, maxTokens: 700 },
  })
  return { answer: result.content, usage: result.usage, model: result.model }
}

module.exports = {
  extractPdfText,
  generateLessonScript,
  splitScript,
  revealedText,
  answerQuestion,
  MAX_SOURCE_CHARS,
  MAX_CONTEXT_CHARS,
}
