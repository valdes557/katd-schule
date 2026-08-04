// models/TeacherFile.js — Dossier administratif d'un enseignant (cycle Secondaire).
// La secrétaire reçoit les pièces, vérifie le dossier (checklist), le transmet au
// Principal (directeur) qui le valide ou le rejette.
const mongoose = require('mongoose')

const attachmentSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true }, // ex : Diplôme, CNI, CV…
    fileUrl: { type: String, required: true },
    fileName: { type: String, default: '' },
    fileType: { type: String, default: '' },
    checked: { type: Boolean, default: false }, // pièce vérifiée par la secrétaire
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
)

const teacherFileSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    // Enseignant concerné : compte User (rôle enseignant) — le nom est copié pour la liste
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    teacherName: { type: String, required: true, trim: true },
    subjectTaught: { type: String, default: '' }, // matière enseignée
    note: { type: String, default: '' },
    attachments: [attachmentSchema],
    // Workflow : recu → verifie → transmis → valide | rejete
    status: { type: String, enum: ['recu', 'verifie', 'transmis', 'valide', 'rejete'], default: 'recu', index: true },
    statusHistory: [
      {
        status: String,
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        at: { type: Date, default: Date.now },
        note: { type: String, default: '' },
      },
    ],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    decisionNote: { type: String, default: '' }, // motif de validation/rejet du principal
  },
  { timestamps: true }
)

teacherFileSchema.index({ school: 1, status: 1, createdAt: -1 })

module.exports = mongoose.model('TeacherFile', teacherFileSchema)
