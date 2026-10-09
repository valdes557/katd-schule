const mongoose = require('mongoose')

// Souscription / Recharge de forfait IA par un utilisateur public (role: 'utilisateur').
// Enregistre chaque paiement (via portefeuille ou Mobile Money / Ikeepay),
// avec le forfait acheté, le nombre de requêtes accordées et la référence.
const userAiSubscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    package: { type: mongoose.Schema.Types.ObjectId, ref: 'AiPackage' },
    packageName: { type: String, required: true },
    totalQuestions: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'F CFA', trim: true },
    paymentMethod: {
      type: String,
      enum: ['wallet', 'mobile_money', 'admin_grant'],
      default: 'wallet',
    },
    paymentReference: { type: String, default: null, index: true },
    paymentIntent: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentIntent', default: null },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'failed'],
      default: 'pending',
      index: true,
    },
    approvedAt: { type: Date },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
)

userAiSubscriptionSchema.index({ user: 1, createdAt: -1 })

module.exports = mongoose.model('UserAiSubscription', userAiSubscriptionSchema)
