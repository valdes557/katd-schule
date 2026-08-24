// models/BoostCampaign.js — Campagne de boost d'une publication (SchoolPost).
// Le cycle de vie est piloté par le paiement (boostPaymentService) puis par le cron
// (boostLifecycleService). Le frontend ne fixe JAMAIS budget/statut/impressions/dates.
const mongoose = require('mongoose')

const STATUSES = [
  'pending_payment', // créée, en attente de confirmation de paiement
  'pending_review',  // payée mais en attente de validation manuelle (si BoostConfig.requireReview)
  'active',          // diffusée dans le feed
  'paused',          // suspendue (par l'admin)
  'completed',       // durée écoulée
  'rejected',        // rejetée (admin / modération)
  'cancelled',       // annulée (par le propriétaire)
  'refunded',        // remboursée
]

const boostCampaignSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolPost', required: true, index: true },

    objective: { type: String, enum: ['views', 'engagement', 'visibility'], default: 'views' },

    // Ciblage : best-effort. Le boost fonctionne même sans données de ciblage.
    audience: {
      mode: { type: String, enum: ['auto', 'custom'], default: 'auto' },
      country: { type: String, default: '' },
      region: { type: String, default: '' },
      ageRange: { type: String, default: '' },
      interests: { type: [String], default: [] },
    },

    durationKey: { type: String, enum: ['24h', '3d', '7d'], required: true },
    durationHours: { type: Number, required: true },

    // budget = prix officiel payé (résolu côté serveur depuis BoostPricing)
    budget: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'XOF' },

    paymentProvider: { type: String, enum: ['wallet', 'ikeepay'], required: true },
    paymentRef: { type: String, default: '' }, // ref PaymentIntent (ikeepay) ou id tx wallet
    paymentIntent: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentIntent', default: null },

    status: { type: String, enum: STATUSES, default: 'pending_payment', index: true },

    // Compteurs propres à la campagne
    stats: {
      impressions: { type: Number, default: 0 }, // fois où le post sponsorisé a été servi
      views: { type: Number, default: 0 },
      likes: { type: Number, default: 0 },
      comments: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      newFollowers: { type: Number, default: 0 },
    },
    // Snapshot des métriques du post à l'activation → stats métier = courant − baseline.
    baselineStats: {
      views: { type: Number, default: 0 },
      likes: { type: Number, default: 0 },
      comments: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      downloads: { type: Number, default: 0 },
    },

    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null, index: true },
    activatedAt: { type: Date, default: null },
    endingNotified: { type: Boolean, default: false }, // évite les notifs « fin proche » répétées

    rejectionReason: { type: String, default: '' },
    refundedAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
)

// Index composites pour les requêtes fréquentes (mes campagnes, diffusion, cron).
boostCampaignSchema.index({ user: 1, status: 1 })
boostCampaignSchema.index({ post: 1, status: 1 })
boostCampaignSchema.index({ status: 1, endsAt: 1 })
boostCampaignSchema.index({ status: 1, startsAt: 1 })

boostCampaignSchema.statics.STATUSES = STATUSES

module.exports = mongoose.model('BoostCampaign', boostCampaignSchema)
