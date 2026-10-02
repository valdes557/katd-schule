// models/AiCourse.js — Cours donné par l'IA enseignante autonome (F2 Secondaire).
// Le professeur programme un cours (texte ou PDF) ; l'IA pré-génère le déroulé
// 5 min avant l'heure, l'écrit progressivement pendant la durée prévue, puis
// répond aux questions des élèves à la fin. Cycle de vie :
// planifie → generation → pret → en_cours → termine  (ou annule / erreur)
const mongoose = require('mongoose')

const questionSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    studentName: { type: String, default: '' },
    question: { type: String, required: true },
    answer: { type: String, default: '' },
    status: { type: String, enum: ['en_attente', 'repondu', 'erreur'], default: 'repondu' },
    askedAt: { type: Date, default: Date.now },
    answeredAt: { type: Date, default: null },
  },
  { _id: true }
)

const aiCourseSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true, index: true },
    subject: { type: String, required: true, trim: true }, // nom lisible (cohérent LessonLog)
    subjectRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', default: null },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // compte User du prof
    teacherProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },
    teacherName: { type: String, default: '' }, // dénormalisé pour le bandeau live
    title: { type: String, required: true, trim: true },
    level: { type: String, default: '' }, // Class.level — adapte le ton du prompt

    // Contenu source fourni par le professeur ou généré par l'IA
    sourceType: { type: String, enum: ['text', 'pdf', 'ai_generate'], default: 'ai_generate' },
    sourceText: { type: String, default: '' }, // texte saisi OU extrait du PDF OU généré par l'IA
    pdfUrl: { type: String, default: '' },
    pdfName: { type: String, default: '' },
    images: [
      {
        url: { type: String, default: '' },
        name: { type: String, default: '' },
        caption: { type: String, default: '' },
        analysis: { type: String, default: '' },
      },
    ],

    // Voix et Langue de diffusion vocale
    language: { type: String, default: 'fr-FR', trim: true },
    voice: { type: String, default: 'female', trim: true }, // 'female', 'male', 'auto'

    // Programmation
    scheduledAt: { type: Date, required: true, index: true },
    durationMinutes: { type: Number, required: true, min: 5, max: 240 },
    qaDurationMinutes: { type: Number, default: 10, min: 0, max: 60 }, // Temps réservé aux questions

    // Informations sur le prochain cours (devoirs, date, thème, texte ou PDF)
    nextCourseTitle: { type: String, default: '', trim: true },
    nextCourseDate: { type: Date, default: null },
    nextCourseInstructions: { type: String, default: '', trim: true },
    nextCourseSourceType: { type: String, enum: ['none', 'text', 'pdf'], default: 'none' },
    nextCourseSourceText: { type: String, default: '' },
    nextCoursePdfUrl: { type: String, default: '' },
    nextCoursePdfName: { type: String, default: '' },

    status: {
      type: String,
      enum: ['planifie', 'generation', 'pret', 'en_cours', 'termine', 'annule', 'erreur'],
      default: 'planifie',
      index: true,
    },

    // Déroulé complet pré-généré par l'IA (révélé progressivement pendant le cours)
    lessonScript: { type: String, default: '' },
    generatedAt: { type: Date, default: null },
    generationError: { type: String, default: '' },
    generationAttempts: { type: Number, default: 0 },
    usedFallback: { type: Boolean, default: false }, // true = sourceText brut déroulé (IA en échec)

    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },

    // Questions des élèves en fin de cours (réponse IA après chaque question)
    questions: [questionSchema],

    // Transmission du rapport de cours au directeur d'établissement
    sentToDirector: { type: Boolean, default: false },
    sentToDirectorAt: { type: Date, default: null },
  },
  { timestamps: true }
)

aiCourseSchema.index({ status: 1, scheduledAt: 1 }) // scans du runner
aiCourseSchema.index({ class: 1, scheduledAt: -1 }) // liste élève
aiCourseSchema.index({ teacher: 1, scheduledAt: -1 }) // liste prof

module.exports = mongoose.model('AiCourse', aiCourseSchema)
