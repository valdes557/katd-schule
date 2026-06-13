const mongoose = require('mongoose')

// Dépense / facture enregistrée par le directeur (ce que l'école a dépensé)
const expenseSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    label: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['salaires', 'loyer', 'fournitures', 'equipement', 'services', 'transport', 'maintenance', 'alimentation', 'autre'],
      default: 'autre',
    },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now },
    supplier: { type: String, trim: true },
    method: { type: String, enum: ['cash', 'mobile_money', 'bank', 'online'], default: 'cash' },
    reference: { type: String, trim: true },
    note: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

expenseSchema.index({ school: 1, date: -1 })

module.exports = mongoose.model('Expense', expenseSchema)
