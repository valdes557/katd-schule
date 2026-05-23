const mongoose = require('mongoose')

const feeSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    label: { type: String, required: true, trim: true },
    type: { type: String, enum: ['scolarite', 'inscription', 'cantine', 'transport', 'uniforme', 'autre'], default: 'scolarite' },
    amount: { type: Number, required: true },
    paid: { type: Number, default: 0 },
    dueDate: { type: Date },
    status: { type: String, enum: ['pending', 'partial', 'paid', 'overdue'], default: 'pending' },
    academicYear: { type: String },
    term: { type: String },
    payments: [
      {
        amount: { type: Number, required: true },
        method: { type: String, enum: ['cash', 'mobile_money', 'bank', 'online'], default: 'cash' },
        reference: { type: String },
        date: { type: Date, default: Date.now },
        note: { type: String },
      },
    ],
  },
  { timestamps: true }
)

feeSchema.index({ student: 1, school: 1, academicYear: 1 })

module.exports = mongoose.model('Fee', feeSchema)
