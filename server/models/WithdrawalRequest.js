// models/WithdrawalRequest.js — File des demandes de retrait (traitement manuel < 24h)
const mongoose = require('mongoose')

const withdrawalSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    wallet: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', required: true },
    role: { type: String, enum: ['directeur', 'enseignant', 'utilisateur', 'admin'], required: true },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', default: null },
    amount: { type: Number, required: true, min: 1 },
    // Frais de retrait (2%) déduits du montant + montant net réellement versé à l'opérateur
    fee: { type: Number, default: 0 },
    netAmount: { type: Number, default: 0 },
    currency: { type: String, default: 'XOF' },
    // Coordonnées Mobile Money de réception
    momoNumber: { type: String, required: true },
    momoOperator: { type: String, default: '' }, // mtn / moov ...
    accountName: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'processing', 'paid', 'rejected'],
      default: 'pending',
      index: true,
    },
    // Payout Ikeepay : notre référence externe (préfixe wd_) + id de payout du prestataire
    providerRef: { type: String, default: null, index: true },
    providerPayoutId: { type: String, default: null },
    // SLA : date limite de traitement (now + WITHDRAWAL_SLA_HOURS)
    dueAt: { type: Date },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    processedAt: { type: Date, default: null },
    adminNote: { type: String, default: '' },
    rejectionReason: { type: String, default: '' },
  },
  { timestamps: true }
)

module.exports = mongoose.model('WithdrawalRequest', withdrawalSchema)
