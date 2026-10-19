// models/CollectAgent.js — Compte d'un Agent de Collecte Journalière.
const mongoose = require('mongoose')

const collectAgentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    agencyName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    city: { type: String, default: '', trim: true },
    neighborhood: { type: String, default: '', trim: true },
    termsAccepted: { type: Boolean, default: true },
    termsAcceptedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['active', 'suspended', 'revoked'],
      default: 'active',
      index: true,
    },
    statusReason: { type: String, default: '' },
    suspendedAt: { type: Date, default: null },
    suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
)

module.exports = mongoose.model('CollectAgent', collectAgentSchema)
