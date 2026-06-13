const mongoose = require('mongoose')

// Salaire d'un enseignant pour un mois donné (état des salaires géré par le directeur)
const salarySchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
    month: { type: String, required: true }, // format "YYYY-MM" (ex: "2026-06")
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
    paidAt: { type: Date },
    method: { type: String, enum: ['cash', 'mobile_money', 'bank', 'online'], default: 'cash' },
    reference: { type: String, trim: true },
    note: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

// Un seul enregistrement de salaire par enseignant et par mois
salarySchema.index({ school: 1, teacher: 1, month: 1 }, { unique: true })
salarySchema.index({ school: 1, month: -1 })

module.exports = mongoose.model('Salary', salarySchema)
