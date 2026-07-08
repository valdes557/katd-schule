const mongoose = require('mongoose')

// Abonnement Web Push d'un utilisateur (un par navigateur/appareil).
// L'endpoint est unique : ré-abonner le même navigateur met à jour le doc existant.
const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userAgent: { type: String, default: '' },
  },
  { timestamps: true }
)

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema)
