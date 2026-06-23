const mongoose = require('mongoose')

// Salaire d'un enseignant pour un mois donné (état des salaires géré par le directeur)
const salarySchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
    month: { type: String, required: true }, // format "YYYY-MM" (ex: "2026-06")
    // Détail du salaire : brut, déductions (avec motif), net effectivement reçu.
    grossAmount: { type: Number, min: 0, default: 0 }, // salaire brut / normal
    deductions: { type: Number, min: 0, default: 0 }, // total des retenues
    deductionReason: { type: String, trim: true }, // motif(s) des retenues (retard, absence, tontine…)
    netAmount: { type: Number, min: 0, default: 0 }, // net reçu = brut - déductions
    amount: { type: Number, required: true, min: 0 }, // = net (conservé pour compatibilité)
    status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
    paidAt: { type: Date },
    method: {
      type: String,
      enum: ['cash', 'mtn_momo', 'royalkatd', 'futurra', 'orange_money', 'bank_transfer', 'mobile_money', 'bank', 'online'],
      default: 'cash',
    },
    // Coordonnées bancaires / de virement (si mode = virement)
    bankDetails: {
      accountNumber: { type: String, trim: true },
      accountName: { type: String, trim: true },
      reference: { type: String, trim: true },
    },
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
