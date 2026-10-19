// models/CollectReport.js — Rapport journalier envoyé par l'agent de collecte à l'administrateur.
const mongoose = require('mongoose')

const collectReportSchema = new mongoose.Schema(
  {
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'CollectAgent', required: true, index: true },
    agentUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    agencyName: { type: String, required: true },
    agentName: { type: String, required: true },
    date: { type: String, required: true, index: true }, // 'YYYY-MM-DD'
    totalClients: { type: Number, default: 0 },
    paidClientsCount: { type: Number, default: 0 },
    unpaidClientsCount: { type: Number, default: 0 },
    totalCollected: { type: Number, default: 0 },
    sentToAdmin: { type: Boolean, default: true },
    sentAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['sent', 'reviewed'], default: 'sent' },
    notes: { type: String, default: '' },
    adminFeedback: { type: String, default: '' },
  },
  { timestamps: true }
)

collectReportSchema.index({ agent: 1, date: 1 }, { unique: true })

module.exports = mongoose.model('CollectReport', collectReportSchema)
