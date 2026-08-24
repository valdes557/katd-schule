// models/BoostPricing.js — Grille tarifaire des boosts (éditable par le Super Admin).
// SÉCURITÉ : le prix officiel d'un boost est TOUJOURS résolu ici côté serveur ; le
// frontend n'envoie qu'une `durationKey`, jamais un montant. Voir boostPricingService.
const mongoose = require('mongoose')

const boostPricingSchema = new mongoose.Schema(
  {
    // Clé de durée normalisée (sert de référence stable côté front/back).
    durationKey: { type: String, enum: ['24h', '3d', '7d'], required: true, unique: true, index: true },
    label: { type: String, default: '' }, // ex. « 24 heures »
    hours: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'XOF' },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
)

module.exports = mongoose.model('BoostPricing', boostPricingSchema)
