// models/WalletTransaction.js — Grand livre (ledger) de tous les mouvements
const mongoose = require('mongoose')

const txSchema = new mongoose.Schema(
  {
    wallet: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', required: true, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    direction: { type: String, enum: ['credit', 'debit'], required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'XOF' },
    // Nature de l'opération
    type: {
      type: String,
      enum: [
        'subscription',      // souscription directeur (collecte)
        'enrollment',        // frais d'inscription élève (collecte -> directeur)
        'deposit',           // dépôt directeur (collecte)
        'salary_transfer',   // transfert salaire directeur -> enseignant (interne)
        'salary_received',   // côté enseignant
        'withdrawal',        // retrait (débit -> file 24h)
        'withdrawal_refund', // remboursement si retrait rejeté
        'adjustment',        // ajustement admin
      ],
      required: true,
      index: true,
    },
    balanceAfter: { type: Number },          // solde après opération (audit)
    counterparty: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    paymentIntent: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentIntent', default: null },
    withdrawal: { type: mongoose.Schema.Types.ObjectId, ref: 'WithdrawalRequest', default: null },
    sebpayTransactionId: { type: String, default: null, index: true },
    description: { type: String, default: '' },
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
)

module.exports = mongoose.model('WalletTransaction', txSchema)
