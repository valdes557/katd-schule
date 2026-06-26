// models/PaymentIntent.js — Suivi des collectes SEBPay (argent entrant)
const mongoose = require('mongoose')

const paymentIntentSchema = new mongoose.Schema(
  {
    // Référence unique générée par nous, envoyée à SEBPay (external_reference)
    reference: { type: String, required: true, unique: true, index: true },
    purpose: {
      type: String,
      enum: ['subscription', 'enrollment', 'deposit'],
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'XOF' },
    // Coordonnées du payeur
    payerPhone: { type: String, default: '' },
    payerOperator: { type: String, default: '' },
    payerName: { type: String, default: '' },
    payerEmail: { type: String, default: '' },
    // Qui/quoi est concerné
    initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', default: null, index: true },
    // bénéficiaire du crédit portefeuille (ex: directeur pour enrollment)
    beneficiary: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Données métier libres (plan choisi, élève, etc.)
    meta: { type: Object, default: {} },
    // État SEBPay
    sebpayTransactionId: { type: String, default: null, index: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'expired'],
      default: 'pending',
      index: true,
    },
    mode: { type: String, enum: ['test', 'live'], default: 'test' },
    // Idempotence : true une fois le webhook approuvé traité (crédit fait)
    fulfilled: { type: Boolean, default: false },
    rawWebhook: { type: Object, default: {} },
  },
  { timestamps: true }
)

module.exports = mongoose.model('PaymentIntent', paymentIntentSchema)
