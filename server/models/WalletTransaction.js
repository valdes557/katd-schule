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
        'transfer_sent',     // transfert utilisateur -> utilisateur (côté envoyeur)
        'transfer_received', // transfert utilisateur -> utilisateur (côté destinataire)
        'transfer_fee',      // frais 0,25% prélevés à l'envoyeur (débit)
        'fee_collected',     // frais 0,25% encaissés par l'admin (crédit)
        'pension_payment',   // paiement de pension/frais depuis le solde (côté parent, débit)
        'pension_received',  // pension reçue par le directeur (crédit)
        'merchant_signup',   // frais d'activation marchand (6933) encaissés par l'admin (crédit)
        'merchant_funding',  // approvisionnement virtuel admin -> marchand (crédit)
        'merchant_commission', // commission 0,20% gagnée par le marchand sur un transfert (crédit)
        'referral_bonus',    // bonus de parrainage 70 F au 1er dépôt du filleul (crédit parrain)
        'interest',          // intérêt quotidien directeur 0,01%/jour (crédit)
        'maintenance_fee',   // frais de maintenance mensuels (débit utilisateur)
        'shareholder_subscription', // souscription actionnaire encaissée par l'admin (crédit)
        'shareholder_gain',  // gain/dividende versé à un actionnaire (crédit)
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
