// models/Wallet.js — Portefeuille interne par utilisateur
const mongoose = require('mongoose')

const walletSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    role: { type: String, enum: ['admin', 'directeur', 'enseignant', 'utilisateur', 'autre'], default: 'autre' },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', default: null, index: true },
    currency: { type: String, default: 'XOF' },
    // Solde disponible (retirable / transférable)
    balance: { type: Number, default: 0, min: 0 },
    // Montant bloqué (retraits en attente de traitement)
    locked: { type: Number, default: 0, min: 0 },
    // Cumuls informatifs
    totalIn: { type: Number, default: 0 },
    totalOut: { type: Number, default: 0 },
  },
  { timestamps: true }
)

walletSchema.virtual('total').get(function () {
  return (this.balance || 0) + (this.locked || 0)
})

module.exports = mongoose.model('Wallet', walletSchema)
