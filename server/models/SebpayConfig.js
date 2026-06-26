// models/SebpayConfig.js — Clés API SEBPay chiffrées (gérées via dashboard admin)
const mongoose = require('mongoose')

const sebpayConfigSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: 'sebpay', unique: true },
    mode: { type: String, enum: ['test', 'live'], default: 'test' },
    // Valeurs chiffrées (AES-256-GCM via utils/crypto)
    publicKeyTest: { type: String, default: '' },
    secretKeyTest: { type: String, default: '' },
    publicKeyLive: { type: String, default: '' },
    secretKeyLive: { type: String, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
)

module.exports = mongoose.model('SebpayConfig', sebpayConfigSchema)
