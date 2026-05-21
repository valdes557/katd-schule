const mongoose = require('mongoose')

const paymentModalitySchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    className: { type: String, required: true, trim: true },
    totalAmount: { type: Number, required: true },
    installments: [
      {
        label: { type: String, required: true },
        amount: { type: Number, required: true },
        deadline: { type: String },
      },
    ],
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
)

paymentModalitySchema.index({ school: 1, order: 1 })

module.exports = mongoose.model('PaymentModality', paymentModalitySchema)
