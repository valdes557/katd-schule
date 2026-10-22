// models/CollectFeeRecord.js — Enregistrement des frais mensuels (1 100 FCFA) déduits par client.
// Répartition : 100 FCFA de maintenance (plateforme) + 1 000 FCFA de commission (700 F pour l'agent, 300 F pour la plateforme).
// Total : 700 FCFA pour l'agent, 400 FCFA pour l'admin plateforme. Déduction uniquement si solde >= 2 000 FCFA.
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
    amount: { type: Number, default: 1100 },
    maintenanceFee: { type: Number, default: 100 },   // 100 F frais de maintenance plateforme
    commissionBase: { type: Number, default: 1000 },  // 1 000 F base commissions
    agentShare: { type: Number, default: 700 },       // 70% de 1 000 = 700 FCFA (portefeuille commission agent)
    platformShare: { type: Number, default: 400 },    // 100 F maintenance + 300 F (30% de 1 000) = 400 FCFA
    deductedAt: { type: Date, default: Date.now },
    walletTransaction: { type: mongoose.Schema.Types.ObjectId, ref: 'WalletTransaction', default: null },
  },
  { timestamps: true }
)

collectFeeRecordSchema.index({ client: 1, month: 1 }, { unique: true })
collectFeeRecordSchema.index({ agent: 1, month: 1 })

module.exports = mongoose.model('CollectFeeRecord', collectFeeRecordSchema)
