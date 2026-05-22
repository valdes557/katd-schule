const mongoose = require('mongoose')

const platformPaymentMethodSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['mobile_money', 'bank', 'cash', 'other'], default: 'mobile_money' },
    accountNumber: { type: String, default: '' },
    accountName: { type: String, default: '' },
    instructions: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
)

module.exports = mongoose.model('PlatformPaymentMethod', platformPaymentMethodSchema)
