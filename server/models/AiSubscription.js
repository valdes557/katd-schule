const mongoose = require('mongoose')

// Souscription IA d'un établissement. Une demande est soumise par le directeur
// (avec capture de paiement), puis approuvée/rejetée par l'administrateur.
// Le quota (remainingQuestions) est partagé par tous les utilisateurs autorisés
// de l'école et décrémenté à chaque question envoyée à l'agent IA.
const aiSubscriptionSchema = new mongoose.Schema(
  {
    director: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    package: { type: mongoose.Schema.Types.ObjectId, ref: 'AiPackage' },
    packageName: { type: String, required: true },
    totalQuestions: { type: Number, required: true, min: 0 },
    usedQuestions: { type: Number, default: 0, min: 0 },
    remainingQuestions: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'F CFA' },
    paymentScreenshot: { type: String }, // URL Cloudinary de la capture de paiement
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'expired', 'suspended'],
      default: 'pending',
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    rejectedReason: { type: String },
  },
  { timestamps: true }
)

aiSubscriptionSchema.index({ school: 1, status: 1 })

module.exports = mongoose.model('AiSubscription', aiSubscriptionSchema)
