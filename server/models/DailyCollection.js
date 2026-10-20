// models/DailyCollection.js — Enregistrement d'une collecte journalière par client.
const mongoose = require('mongoose')

const dailyCollectionSchema = new mongoose.Schema(
  {
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'CollectAgent', required: true, index: true },
    agentUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'CollectClient', required: true, index: true },
    clientName: { type: String, required: true },
    clientPhone: { type: String, default: '' },
    neighborhood: { type: String, required: true }, // Quartier
    date: { type: String, required: true, index: true }, // Format 'YYYY-MM-DD'
    datetime: { type: Date, default: Date.now },
    amount: { type: Number, default: 0 },
    type: {
      type: String,
      enum: ['depot', 'retrait'],
      default: 'depot',
    },
    status: {
      type: String,
      enum: ['paye', 'non_paye', 'retrait'],
      default: 'paye',
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['especes', 'momo', 'wallet'],
      default: 'especes',
    },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
)

dailyCollectionSchema.index({ client: 1, date: 1 })
dailyCollectionSchema.index({ agent: 1, date: 1 })

module.exports = mongoose.model('DailyCollection', dailyCollectionSchema)
