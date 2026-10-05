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
  const parts = Math.min(5, Math.max(3, Math.ceil(dur / 15)))
  const targetWords = Math.min(dur * 80, 2800)
  const lang = course.language === 'en-US' ? 'anglais' : 'français'
  return [
    `Tu es un éminent professeur de ${course.subject} qui enseigne en direct à la classe ${className}${course.level ? ` (niveau ${course.level})` : ''}.`,
    `Titre de la leçon : « ${course.title} ». Durée prévue : ${dur} minutes.`,
    `Ton enseignement doit être d'une grande intelligence pédagogique, rigoureux, vivant et captivant, parfaitement calibré pour le niveau scolaire de cette classe.`,
    '',
    `Tu dois structurer le DÉROULÉ COMPLET du cours en ${lang} selon cette progression méthodique :`,
    "1. Introduction immersive : accroche captivante, utilité concrète dans la vie réelle, objectifs pédagogiques clairs de la séance.",
    `2. Développement approfondi en ${parts} grandes parties logiques : définitions précises, explications étape par étape, concepts clés, théorèmes/règles et exemples concrets de la vie courante.`,
    "3. Démonstrations et explications visuelles : si des images ou schémas sont mentionnés ou fournis, commente-les et décris-les oralement avec précision (« Regardez attentivement cette figure... », « Sur ce schéma, observez comment... »).",
    "4. Exercices d'application progressifs avec résolution détaillée et correction méthodique pas à pas.",
    "5. Résumé de synthèse et points capitaux à retenir pour les évaluations.",
    '',
    'Consignes pédagogiques et d\'expression :',
    `- Réfléchis et raisonne avec clarté et bienveillance comme un véritable professeur passionné. Ne dis jamais que tu es une IA.`,
    `- Volume ciblé : environ ${targetWords} mots riches et didactiques pour remplir les ${dur} minutes.`,
    `- Ton oral naturel, fluide et percutant : le texte sera affiché progressivement et lu à voix haute aux élèves par synthèse vocale.`,
    `- Termine TOUJOURS complètement tes phrases et tes sections jusqu'au point final sans jamais couper la parole.`,
    `- Si tu fais référence à une image ou figure, utilise la syntaxe ![Titre explicatif](url) ou réfère-toi aux figures fournies.`,
  ].join('\n')
}

// Génération directe en 1 appel optimisé : évite les délais d'attente prolongés (divise le temps par 3 à 5)
function planChunks(_durationMinutes) {
  return 1
}

/**
 * Génère le déroulé complet du cours à haute vitesse d'exécution.
 * Supporte la rédaction autonome à partir du titre et les images démonstratives.
 * @returns {Promise<{script:string, usage:Object, model:string, calls:number}>}
 */
async function generateLessonScript(course, className) {
  const cfg = await AiConfig.getConfig()
  const cfgObj = cfg && typeof cfg.toObject === 'function' ? cfg.toObject() : cfg
  const genConfig = {
    ...cfgObj,
    model: cfg.model,
    systemPrompt: lessonSystemPrompt(course, className),
    temperature: 0.5,
    maxTokens: 3500,
  }
  const calls = planChunks(course.durationMinutes)
  const source = String(course.sourceText || '').slice(0, MAX_SOURCE_CHARS)
  const parts = []
  const usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }

  let imagesNote = ''
  if (Array.isArray(course.images) && course.images.length > 0) {
    imagesNote = '\n\nFIGURES ET IMAGES DU COURS FOURNIES PAR LE PROFESSEUR (À INTÉGRER ET EXPLIQUER DÉTAILLÉMENT À L\'ORAL) :\n' +
      course.images.map((img, idx) => `Figure ${idx + 1} : ![${img.caption || img.name || 'Illustration pédagogique'}](${img.url})`).join('\n') +
      '\nConsigne : intègre ces balises ![...](url) aux moments opportuns du cours et décris précisément aux élèves ce qui est visible sur chaque image et ce que cela démontre.'
  }

  const isAuto = course.sourceType === 'ai_generate' || !source

  let instruction
  if (isAuto) {
    instruction = `Recherche et rédige le cours complet sur la leçon « ${course.title} » en ${course.subject} pour la classe ${className} (niveau ${course.level || 'secondaire'}). Développe méthodiquement l'accroche, les notions clés, les démonstrations explicatives, les exercices d'application corrigés et le résumé essentiel.${imagesNote}`
  } else {
    instruction = `Contenu de référence fourni par le professeur pour « ${course.title} » :\n"""\n${source}\n"""\n\nRédige le déroulé complet et vivant du cours en respectant et développant ces éléments avec clarté, pédagogie et exercices corrigés pas à pas.${imagesNote}`
  }

  const r = await generateChatResponse({
    messages: [{ role: 'user', content: instruction }],
    config: genConfig,
  })
  parts.push(r.content)
  usage.promptTokens += r.usage.promptTokens
  usage.completionTokens += r.usage.completionTokens
  usage.totalTokens += r.usage.totalTokens

  return { script: parts.join('\n\n'), usage, model: genConfig.model, calls }
}

/**
 * Rédige le contenu d'un cours à la demande (recherches fiables, niveau de classe, schémas démonstratifs).
 */
async function generateCourseContent({ title, subject, level = '', className = '', durationMinutes = 45, language = 'fr-FR', images = [] }) {
  const cfg = await AiConfig.getConfig()
  const cfgObj = cfg && typeof cfg.toObject === 'function' ? cfg.toObject() : cfg
  const lang = language === 'en-US' ? 'anglais' : 'français'

  let imagesPrompt = ''
  if (Array.isArray(images) && images.length > 0) {
    imagesPrompt = '\nImages et figures fournies à expliquer :\n' + images.map((img, i) => `Figure ${i + 1} : ![${img.caption || img.name || 'Illustration'}](${img.url})`).join('\n')
  }

  const prompt = [
    `Tu es un éminent professeur de ${subject}. Rédige un cours complet, moderne, rigoureux et captivant en ${lang} pour la classe ${className || level} (niveau ${level || 'secondaire'}).`,
    `Titre exact de la leçon : « ${title} ». Durée du cours : ${durationMinutes} minutes.`,
    '',
    'Structure requise :',
    '1. Introduction : accroche motivante, mise en contexte dans la vie courante et objectifs du cours.',
    '2. Notions fondamentales : définitions claires, théorèmes/principes, explications pas à pas et exemples concrets.',
    '3. Analyse visuelle et démonstrations : intègre des illustrations explicatives (syntaxe Markdown ![Légende](url) ou schémas textuels / ASCII / diagrammes) et décris oralement ce qui y figure.',
    '4. Exercices d\'application avec corrigés méthodiques et astuces.',
    '5. Bilan / Synthèse des points à retenir.',
    '',
    'Rédige le contenu de façon complète, détaillée et soignée sans laisser de phrase inachevée.',
    imagesPrompt,
  ].filter(Boolean).join('\n')

  const result = await generateChatResponse({
    messages: [{ role: 'user', content: prompt }],
    config: {
      ...cfgObj,
      model: cfg.model,
      temperature: 0.5,
      maxTokens: 4000,
    },
  })

  return {
    content: result.content,
    model: result.model,
    usage: result.usage,
  }
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
  const shownUnits = units.slice(0, shown)
  return {
    text: joinUnits(shownUnits),
    units: shownUnits,
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
 * Répond à la question d'un élève avec le cours comme contexte (adapté lecture vocale).
 * @returns {Promise<{answer:string, usage:Object, model:string}>}
 */
async function answerQuestion({ course, className, question }) {
  const cfg = await AiConfig.getConfig()
  const cfgObj = cfg && typeof cfg.toObject === 'function' ? cfg.toObject() : cfg
  const lang = course.language === 'en-US' ? 'anglais' : 'français'
  const systemPrompt = [
    `Tu es le professeur qui vient d'enseigner ce cours de ${course.subject} à la classe ${className}.`,
    `Un élève te pose une question (posée vocalement ou par écrit). Réponds oralement et chaleureusement en ${lang}, de manière concise (3 à 7 phrases claires), avec un exemple concret si pertinent.`,
    "Reste dans le cadre du cours et du programme scolaire ; si la question sort du sujet, ramène poliment l'élève au cours.",
    "Ta réponse sera énoncée à voix haute à l'élève : utilise un ton oral naturel, fluide et bienveillant sans puces Markdown complexes.",
    'Ne mentionne jamais que tu es une IA.',
    '',
    'Voici le cours qui vient d\'être donné :',
    '"""',
    truncateContext(course.lessonScript || course.sourceText),
    '"""',
  ].join('\n')

  const result = await generateChatResponse({
    messages: [{ role: 'user', content: String(question).trim() }],
    config: {
      ...cfgObj,
      model: cfg.model,
      systemPrompt,
      temperature: 0.4,
      maxTokens: 3500, // Réponse complète et soignée sans coupure
    },
  })
  return { answer: result.content, usage: result.usage, model: result.model }
}

module.exports = {
  extractPdfText,
  generateLessonScript,
  generateCourseContent,
  splitScript,
  revealedText,
  answerQuestion,
  MAX_SOURCE_CHARS,
  MAX_CONTEXT_CHARS,
}
