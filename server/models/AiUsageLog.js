const mongoose = require('mongoose')

// Journal d'utilisation de l'IA : une entrée par question traitée. Sert aux
// statistiques (admin global / directeur par école / par utilisateur) et à la
// protection contre les abus.
const aiUsageLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
    subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'AiSubscription' },
    model: { type: String },
    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
  },
  { timestamps: true }
)

aiUsageLogSchema.index({ school: 1, createdAt: -1 })
aiUsageLogSchema.index({ user: 1, createdAt: -1 })

module.exports = mongoose.model('AiUsageLog', aiUsageLogSchema)
