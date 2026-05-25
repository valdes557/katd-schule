const mongoose = require('mongoose')

const gradeSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    subject: { type: String, required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    type: { type: String, enum: ['devoir', 'examen', 'composition', 'oral', 'tp'], default: 'devoir' },
    value: { type: Number, required: true, min: 0, max: 20 },
    coefficient: { type: Number, default: 1 },
    sequence: { type: String, enum: ['Séquence 1', 'Séquence 2', 'Séquence 3', 'Séquence 4', 'Séquence 5', 'Séquence 6'] },
    term: { type: String, enum: ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'], required: true },
    academicYear: { type: String },
    date: { type: Date, default: Date.now },
    comment: { type: String },
  },
  { timestamps: true }
)

gradeSchema.index({ student: 1, subject: 1, term: 1, type: 1 })

module.exports = mongoose.model('Grade', gradeSchema)
