// models/BoostConfig.js — Configuration globale des boosts (singleton), éditable par le
// Super Admin. Contient les garde-fous anti-spam/anti-fraude appliqués CÔTÉ SERVEUR à la
// création d'une campagne, et les paramètres de diffusion dans le feed.
const mongoose = require('mongoose')

const boostConfigSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: 'boost', unique: true, index: true },
    currency: { type: String, default: 'XOF' },

    // ── Garde-fous anti-spam (limites appliquées serveur, cf. boosts.js create) ──
    maxActiveCampaignsPerUser: { type: Number, default: 5 },
    maxBoostsPerPost: { type: Number, default: 10 },
    maxDailyBudget: { type: Number, default: 50000 },
    maxMonthlyBudget: { type: Number, default: 500000 },
    minDelayBetweenCampaignsHours: { type: Number, default: 0 },
    maxCampaignDurationHours: { type: Number, default: 168 }, // 7 jours
    minBudget: { type: Number, default: 0 },
    maxBudget: { type: Number, default: 1000000 },

    // Validation manuelle par l'admin avant activation ? (défaut : activation immédiate au paiement)
    requireReview: { type: Boolean, default: false },

    // Objectifs proposés (architecture extensible : ajouter une valeur suffit)
    objectives: { type: [String], default: ['views', 'engagement', 'visibility'] },

    // ── Diffusion ──
    // 1 publication sponsorisée injectée toutes les N publications organiques.
    feedInjectionRatio: { type: Number, default: 5 },
    // Nombre maximal de sponsorisés injectés par page de feed (diversité des contenus).
    maxSponsoredPerPage: { type: Number, default: 3 },
  },
  { timestamps: true }
)

module.exports = mongoose.model('BoostConfig', boostConfigSchema)
