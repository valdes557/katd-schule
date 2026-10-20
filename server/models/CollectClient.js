// models/CollectClient.js — Client enregistré par un Agent de Collecte.
// RÈGLE ABSOLUE : Les fonds du compte collecte appartiennent au client.
// Ni l'agent ni l'administrateur n'ont le droit de retirer les fonds de collecte d'un client.
const mongoose = require('mongoose')
const crypto = require('crypto')

const collectClientSchema = new mongoose.Schema(
  {
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'CollectAgent', required: true, index: true },
    agentUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    accountNumber: { type: String, unique: true, index: true },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, default: '', trim: true, lowercase: true, index: true }, // Email utilisateur lié
    momoMtn: { type: String, default: '', trim: true },                             // N° Mobile Money MTN
    momoOrange: { type: String, default: '', trim: true },                          // N° Orange Money
    neighborhood: { type: String, required: true, trim: true, index: true },        // Quartier / Zone
    city: { type: String, default: '', trim: true },
    cni: { type: String, default: '', trim: true },
    dailyTarget: { type: Number, default: 1000, min: 0 },       // Montant de la collecte journalière
    monthlyTarget: { type: Number, default: 0 },                 // Objectif mensuel de cagnotte (ex: 310 000 F)
    balance: { type: Number, default: 0 },                       // Solde d'épargne du compte collecte
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    lastMonthlyFeeMonth: { type: String, default: '' },         // ex: '2026-10' pour déduction mensuelle 1100 FCFA
    notes: { type: String, default: '' },
  },
  { timestamps: true }
)

// Génération automatique du numéro de compte client (ex: CL-849201)
collectClientSchema.pre('save', async function (next) {
  if (!this.accountNumber) {
    const rnd = crypto.randomInt(100000, 999999)
    this.accountNumber = `CL-${rnd}`
  }
  next()
})

module.exports = mongoose.model('CollectClient', collectClientSchema)
