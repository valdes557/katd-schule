const mongoose = require('mongoose')

const feeSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    label: { type: String, required: true, trim: true },
    type: { type: String, enum: ['scolarite', 'pension', 'inscription', 'cantine', 'transport', 'uniforme', 'autre'], default: 'scolarite' },
    amount: { type: Number, required: true },
    paid: { type: Number, default: 0 },
    dueDate: { type: Date },
    status: { type: String, enum: ['pending', 'partial', 'paid', 'overdue'], default: 'pending' },
    academicYear: { type: String },
    term: { type: String },
    payments: [
      {
        amount: { type: Number, required: true },
        method: { type: String, enum: ['cash', 'mobile_money', 'bank', 'online', 'wallet'], default: 'cash' },
        reference: { type: String },
        date: { type: Date, default: Date.now },
        note: { type: String },
      },
    ],
    // Remise / réduction accordée par le directeur sur ce frais
    discount: {
      type: { type: String, enum: ['fixed', 'percentage'] },
      value: { type: Number }, // valeur saisie (F CFA ou %)
      amount: { type: Number, default: 0 }, // montant calculé en F CFA (source de vérité)
      reason: { type: String, trim: true }, // motif de la réduction
      date: { type: Date },
      grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    paymentMode: { type: String, enum: ['complet', 'tranches'], default: 'complet' },
    installments: [
      {
        label: { type: String, required: true },
        amount: { type: Number, required: true },
        dueDate: { type: Date, required: true },
        paid: { type: Boolean, default: false },
        paidAt: { type: Date },
        paidAmount: { type: Number, default: 0 },
        method: { type: String, enum: ['cash', 'mobile_money', 'bank', 'online', 'wallet'], default: 'cash' },
        reference: { type: String },
        notified: { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true }
)

feeSchema.index({ student: 1, school: 1, academicYear: 1 })

// Montant net à payer après remise
feeSchema.methods.netAmount = function () {
  return Math.max(0, (this.amount || 0) - (this.discount?.amount || 0))
}
feeSchema.virtual('net').get(function () {
  return this.netAmount()
})
feeSchema.set('toJSON', { virtuals: true })
feeSchema.set('toObject', { virtuals: true })

// Recalcule le statut à chaque save (paiement, changement de montant ou de remise)
feeSchema.pre('save', function (next) {
  if (this.isModified('paid') || this.isModified('amount') || this.isModified('discount')) {
    const net = this.netAmount()
    this.status = this.paid >= net ? 'paid' : this.paid > 0 ? 'partial' : 'pending'
  }
  next()
})

module.exports = mongoose.model('Fee', feeSchema)
