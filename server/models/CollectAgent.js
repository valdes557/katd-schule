// models/CollectAgent.js — Compte d'un Agent de Collecte Journalière.
const mongoose = require('mongoose')

const commissionWithdrawalSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true },
    destination: { type: String, enum: ['wallet', 'momo'], default: 'wallet' },
    phone: { type: String, default: '' },
    operator: { type: String, default: '' },
    accountName: { type: String, default: '' },
    withdrawnAt: { type: Date, default: Date.now },
    status: { type: String, default: 'completed' },
  },
  { _id: true }
)

const collectAgentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    agencyName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    city: { type: String, default: '', trim: true },
    neighborhood: { type: String, default: '', trim: true },
    termsAccepted: { type: Boolean, default: true },
    termsAcceptedAt: { type: Date, default: Date.now },
    subscriptionPaid: { type: Boolean, default: false },
    subscriptionPaidAt: { type: Date, default: null },
    subscriptionAmount: { type: Number, default: 4800 },
    subscriptionPaymentMethod: { type: String, default: '' },
    subscriptionReference: { type: String, default: '' },
    status: {
      type: String,
      enum: ['active', 'suspended', 'revoked'],
      default: 'active',
      index: true,
    },
    statusReason: { type: String, default: '' },
    suspendedAt: { type: Date, default: null },
    suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // ── Portefeuille commissions séparé (70% des frais mensuels) ──
    commissionBalance: { type: Number, default: 0 },
    commissionTotalEarned: { type: Number, default: 0 },
    commissionTotalWithdrawn: { type: Number, default: 0 },
    lastCommissionWithdrawal: { type: Date, default: null },
    commissionWithdrawals: [commissionWithdrawalSchema],

    meta: { type: Object, default: {} },
  },
  { timestamps: true }
)

module.exports = mongoose.model('CollectAgent', collectAgentSchema)
