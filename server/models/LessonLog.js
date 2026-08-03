// models/LessonLog.js — Cahier de texte (cycle Secondaire).
// Le professeur remplit chaque séance : leçon dispensée, contenu, devoirs donnés.
// Consultable par le vice-principal, le directeur et les élèves de la classe.
const mongoose = require('mongoose')

const lessonLogSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true, index: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
    subject: { type: String, required: true, trim: true },
    // Date + créneau de la séance (ex. 08:00 - 09:00)
    date: { type: Date, required: true },
    startTime: { type: String, default: '' },
    endTime: { type: String, default: '' },
    // Contenu de la séance
    title: { type: String, required: true, trim: true }, // titre de la leçon
    content: { type: String, default: '' }, // description de ce qui a été fait
    homeworkGiven: { type: String, default: '' }, // devoirs donnés à l'oral / au tableau
    homework: { type: mongoose.Schema.Types.ObjectId, ref: 'Homework', default: null }, // lien devoir formel
    // Visa du vice-principal / directeur (suivi pédagogique)
    viewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    viewedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

lessonLogSchema.index({ school: 1, class: 1, date: -1 })
lessonLogSchema.index({ teacher: 1, date: -1 })

module.exports = mongoose.model('LessonLog', lessonLogSchema)
