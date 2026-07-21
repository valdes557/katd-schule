// models/EntryAttendance.js — Entrées/sorties scannées à la loge (cycle Secondaire).
// Le portier scanne le QR individuel d'un membre du personnel ou d'un élève :
// 1er scan du jour = entrée (retard si après attendanceConfig.lateAfter), 2e = sortie.
const mongoose = require('mongoose')

const entryAttendanceSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    day: { type: String, required: true, index: true }, // YYYY-MM-DD (fuseau APP_TZ)
    personKind: { type: String, enum: ['staff', 'student'], required: true },
    // staff → user (User de l'école : enseignant, VP, SG, caissière, secrétaire, portier, directeur)
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // student → fiche élève
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
    role: { type: String, default: '' }, // rôle du membre (ou 'eleve')
    className: { type: String, default: '' }, // classe de l'élève au moment du scan
    checkInAt: { type: Date },
    checkOutAt: { type: Date },
    status: { type: String, enum: ['present', 'late'], default: 'present' },
    lateMinutes: { type: Number, default: 0 },
    scannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

// Une seule fiche par personne et par jour
entryAttendanceSchema.index({ school: 1, day: 1, user: 1 }, { unique: true, partialFilterExpression: { user: { $type: 'objectId' } } })
entryAttendanceSchema.index({ school: 1, day: 1, student: 1 }, { unique: true, partialFilterExpression: { student: { $type: 'objectId' } } })

module.exports = mongoose.model('EntryAttendance', entryAttendanceSchema)
