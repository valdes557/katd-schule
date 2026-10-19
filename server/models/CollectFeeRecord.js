// models/CollectFeeRecord.js — Enregistrement des frais mensuels (1 100 FCFA) déduits par client.
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
    deductedAt: { type: Date, default: Date.now },
    walletTransaction: { type: mongoose.Schema.Types.ObjectId, ref: 'WalletTransaction', default: null },
  },
  { timestamps: true }
)

collectFeeRecordSchema.index({ client: 1, month: 1 }, { unique: true })
collectFeeRecordSchema.index({ agent: 1, month: 1 })

module.exports = mongoose.model('CollectFeeRecord', collectFeeRecordSchema)
