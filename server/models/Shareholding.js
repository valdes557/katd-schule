// models/Shareholding.js — Souscription d'actionnaire (1% par palier géographique).
// Les actionnaires sont délimités en arrondissement, ville, région et pays :
// le champ `zone` précise la délimitation choisie (nom de l'arrondissement, de la
// région, du pays…) selon le plan souscrit.
const mongoose = require('mongoose')

const shareholdingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Plan souscrit (copie figée au moment de la souscription)
    planKey: { type: String, enum: ['arrondissement', 'regional', 'national', 'international'], required: true, index: true },
    planLabel: { type: String, default: '' },
    percent: { type: Number, default: 1 },
    amount: { type: Number, required: true, min: 1 },   // somme versée (non remboursable)
    durationYears: { type: Number, default: 35 },
    // Délimitation géographique (arrondissement/ville/région/pays selon le plan)
    zone: { type: String, default: '' },
    startAt: { type: Date, default: Date.now },
    endAt: { type: Date },                              // startAt + durationYears
    status: { type: String, enum: ['active', 'expired', 'revoked'], default: 'active', index: true },
    paymentIntent: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentIntent', default: null },
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
)

shareholdingSchema.index({ user: 1, planKey: 1 })

module.exports = mongoose.model('Shareholding', shareholdingSchema)
