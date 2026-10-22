// models/CollectFeeRecord.js — Enregistrement des frais mensuels (1 000 FCFA) déduits par client.
// Répartition : 70% pour l'agent (700 FCFA) dans son portefeuille de commissions séparé,
// 30% pour l'administrateur / plateforme (300 FCFA). Déduction uniquement si solde >= 2 000 FCFA.
const mongoose = require('mongoose')

const collectFeeRecordSchema = new mongoose.Schema(
  {
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'CollectAgent', required: true, index: true },
    agentUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    agencyName: { type: String, required: true },
    agentName: { type: String, required: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'CollectClient', required: true, index: true },
    clientName: { type: String, required: true },
    month: { type: String, required: true, index: true }, // Format 'YYYY-MM'
    amount: { type: Number, default: 1000 },
    maintenanceFee: { type: Number, default: 0 },
    commissionBase: { type: Number, default: 1000 },
    agentShare: { type: Number, default: 700 },       // 70% de 1 000 = 700 FCFA (portefeuille commission agent)
    platformShare: { type: Number, default: 300 },    // 30% de 1 000 = 300 FCFA (gestion des collectes admin)
    deductedAt: { type: Date, default: Date.now },
    walletTransaction: { type: mongoose.Schema.Types.ObjectId, ref: 'WalletTransaction', default: null },
  },
  { timestamps: true }
)

collectFeeRecordSchema.index({ client: 1, month: 1 }, { unique: true })
collectFeeRecordSchema.index({ agent: 1, month: 1 })

module.exports = mongoose.model('CollectFeeRecord', collectFeeRecordSchema)
