// models/AdminCoAccount.js — Comptes spéciaux d'administration (60% / 40%)
// Gère la répartition des revenus plateforme entre Compte 1 (tankoujohnson@gmail.com)
// et Compte 2 (valdeslando15@gmail.com), les vérifications OTP par email, et les retraits.
const mongoose = require('mongoose')

const adminWithdrawalSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true },
    method: { type: String, enum: ['momo', 'wallet'], default: 'momo' },
    phone: { type: String, default: '' },
    operator: { type: String, default: '' }, // mtn | orange
    accountName: { type: String, default: '' },
    notes: { type: String, default: '' },
    status: { type: String, enum: ['completed', 'pending', 'rejected'], default: 'completed' },
    providerPayoutId: { type: String, default: '' },
    providerRef: { type: String, default: '' },
    targetWalletAccountNo: { type: String, default: '' },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    targetUserName: { type: String, default: '' },
    withdrawnAt: { type: Date, default: Date.now },
    performedBy: { type: String, default: '' },
  },
  { _id: true, timestamps: true }
)

const adminRevenueLedgerSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: [
        'withdrawal_fee',          // 1. Frais de retrait
        'transfer_fee',            // 2. Frais de transfert
        'maintenance_fee',         // 3. Frais de maintenance
        'subscription',            // 4. Frais de souscription d'école
        'ai_subscription',         // 5. Frais de souscription IA
        'collect_fee',             // 6. Frais de fonctionnement mensuel (collecte journalière)
        'merchant_signup',         // 7. Frais d'ouverture compte Marchand
        'agent_signup',            // 8. Frais d'ouverture compte agent de collecte
        'client_signup',           // 9. Frais de souscription client collecte journalière
        'shareholder_subscription',// 10. Frais de souscription des associés (actions)
      ],
      required: true,
      index: true,
    },
    totalPlatformAmount: { type: Number, required: true },
    sharePercent: { type: Number, required: true }, // 60 ou 40
    accountShareAmount: { type: Number, required: true },
    description: { type: String, default: '' },
    reference: { type: String, default: '' },
    date: { type: Date, default: Date.now },
  },
  { _id: true, timestamps: true }
)

const adminCoAccountSchema = new mongoose.Schema(
  {
    accountKey: { type: String, enum: ['account_1', 'account_2'], unique: true, required: true },
    name: { type: String, default: '' },
    email: { type: String, required: true, trim: true, lowercase: true },
    baseSharePercent: { type: Number, required: true }, // 60 ou 40
    balance: { type: Number, default: 0 },
    totalEarned: { type: Number, default: 0 },
    totalWithdrawn: { type: Number, default: 0 },
    withdrawals: [adminWithdrawalSchema],
    ledger: [adminRevenueLedgerSchema],
    // Sécurité OTP par email à chaque accès
    currentOtp: { type: String, default: null },
    otpExpiresAt: { type: Date, default: null },
    // Code de secours d'urgence (fixé à 19970 pour le Compte 2, supprimable par l'utilisateur)
    emergencyPin: { type: String, default: null },
    emergencyPinActive: { type: Boolean, default: true },
    emergencyPinDeletedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

// Récupère ou initialise les 2 comptes administrateurs officiels
adminCoAccountSchema.statics.ensureAccounts = async function () {
  let acc1 = await this.findOne({ accountKey: 'account_1' })
  if (!acc1) {
    acc1 = await this.create({
      accountKey: 'account_1',
      name: 'Compte Administrateur 1',
      email: 'tankoujohnson@gmail.com',
      baseSharePercent: 60,
      balance: 0,
      totalEarned: 0,
      totalWithdrawn: 0,
    })
  } else if (acc1.email !== 'tankoujohnson@gmail.com' || acc1.baseSharePercent !== 60) {
    acc1.email = 'tankoujohnson@gmail.com'
    acc1.baseSharePercent = 60
    await acc1.save()
  }

  let acc2 = await this.findOne({ accountKey: 'account_2' })
  if (!acc2) {
    acc2 = await this.create({
      accountKey: 'account_2',
      name: 'Compte Administrateur 2',
      email: 'valdeslando15@gmail.com',
      baseSharePercent: 40,
      balance: 0,
      totalEarned: 0,
      totalWithdrawn: 0,
      emergencyPin: '19970',
      emergencyPinActive: true,
      emergencyPinDeletedAt: null,
    })
  } else {
    let dirty = false
    if (acc2.email !== 'valdeslando15@gmail.com' || acc2.baseSharePercent !== 40) {
      acc2.email = 'valdeslando15@gmail.com'
      acc2.baseSharePercent = 40
      dirty = true
    }
    // Si le code de secours n'a pas encore été supprimé par l'utilisateur, l'activer avec 19970
    if (!acc2.emergencyPinDeletedAt && (!acc2.emergencyPin || !acc2.emergencyPinActive)) {
      acc2.emergencyPin = '19970'
      acc2.emergencyPinActive = true
      dirty = true
    }
    if (dirty) await acc2.save()
  }

  return { acc1, acc2 }
}

module.exports = mongoose.model('AdminCoAccount', adminCoAccountSchema)
