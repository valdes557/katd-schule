const mongoose = require('mongoose')

const subscriptionPlanSchema = new mongoose.Schema(
  {
    cycle: { type: String, enum: ['Maternelle', 'Primaire', 'Secondaire'], required: true },
    name: { type: String, required: true, trim: true },
    quarterlyPrice: { type: Number, required: true },
    annualPrice: { type: Number, required: true },
    features: [{ type: String }],
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
)

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema)
