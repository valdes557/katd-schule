const mongoose = require('mongoose')

// Pointage (présence) du personnel enseignant via QR code.
// Une entrée par enseignant et par jour (clé unique teacher + day).
const teacherAttendanceSchema = new mongoose.Schema(
  {
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    // Jour au format YYYY-MM-DD (fuseau serveur) pour garantir l'unicité quotidienne
    day: { type: String, required: true },
    checkInAt: { type: Date },
    checkOutAt: { type: Date },
    // Statut d'arrivée
    status: { type: String, enum: ['present', 'late'], default: 'present' },
    // Minutes de retard par rapport à l'heure limite (0 si à l'heure)
    lateMinutes: { type: Number, default: 0 },
    // Départ anticipé (avant l'heure de sortie minimale)
    earlyDeparture: { type: Boolean, default: false },
    earlyMinutes: { type: Number, default: 0 },
  },
  { timestamps: true }
)

teacherAttendanceSchema.index({ teacher: 1, day: 1 }, { unique: true })
teacherAttendanceSchema.index({ school: 1, day: 1 })

module.exports = mongoose.model('TeacherAttendance', teacherAttendanceSchema)
