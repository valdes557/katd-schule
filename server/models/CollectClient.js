// models/CollectClient.js — Client enregistré par un Agent de Collecte.
// RÈGLE ABSOLUE : Les fonds du compte collecte appartiennent au client.
// Ni l'agent ni l'administrateur n'ont le droit de retirer les fonds de collecte d'un client.
const mongoose = require('mongoose')
const crypto = require('crypto')

const collectClientSchema = new mongoose.Schema(
  {
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'CollectAgent', default: null, index: true },
    agentUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    accountNumber: { type: String, unique: true, index: true },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, default: '', trim: true, lowercase: true, index: true }, // Email utilisateur lié
    momoMtn: { type: String, default: '', trim: true },                             // N° Mobile Money MTN
    momoOrange: { type: String, default: '', trim: true },                          // N° Orange Money
    neighborhood: { type: String, required: true, trim: true, index: true },        // Quartier / Zone
    city: { type: String, default: '', trim: true },
    cni: { type: String, default: '', trim: true },
    dailyTarget: { type: Number, default: 1000, min: 0 },       // Montant de la collecte journalière
    monthlyTarget: { type: Number, default: 0 },                 // Objectif mensuel de cagnotte (ex: 310 000 F)
    balance: { type: Number, default: 0 },                       // Solde d'épargne du compte collecte
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    lastMonthlyFeeMonth: { type: String, default: '' },         // ex: '2026-10' pour déduction mensuelle 1100 FCFA
    notes: { type: String, default: '' },

    // Souscription Client (4 995 FCFA / an ou mois)
    isSelfSubscribed: { type: Boolean, default: false },
    subscriptionPaid: { type: Boolean, default: false },
    subscriptionPaidAt: { type: Date, default: null },
    subscriptionExpiresAt: { type: Date, default: null },
    subscriptionAmount: { type: Number, default: 0 },
    subscriptionInterval: { type: String, enum: ['annual', 'monthly'], default: 'annual' },
    subscriptionPaymentMethod: { type: String, default: '' },
    subscriptionReference: { type: String, default: '' },

    // Signature numérique & Termes et Conditions signés par l'agent et le client
    termsAccepted: { type: Boolean, default: false },
    termsSignedAt: { type: Date, default: null },
    agentSignature: { type: String, default: '' },              // Image Base64 de la signature de l'agent
    clientSignature: { type: String, default: '' },             // Image Base64 de la signature du client
    termsContent: { type: String, default: '' },                // Contenu des termes et conditions au moment de la signature
    contractNumber: { type: String, default: '' },              // N° de contrat officiel (ex: CTR-2026-8910)
  },
  { timestamps: true }
)

// Génération automatique du numéro de compte client (ex: CL-849201) et du contrat
collectClientSchema.pre('save', async function (next) {
  if (!this.accountNumber) {
    const rnd = crypto.randomInt(100000, 999999)
    this.accountNumber = `CL-${rnd}`
  }
  if (!this.contractNumber) {
    const year = new Date().getFullYear()
    const rnd = crypto.randomInt(1000, 9999)
    this.contractNumber = `CTR-${year}-${rnd}`
  }
  next()
})

module.exports = mongoose.model('CollectClient', collectClientSchema)
