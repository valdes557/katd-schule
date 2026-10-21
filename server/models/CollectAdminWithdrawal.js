// models/CollectAdminWithdrawal.js — Enregistrement des retraits ordonnés par l'administrateur depuis le compte d'un client.
const mongoose = require('mongoose')

const collectAdminWithdrawalSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    adminName: { type: String, required: true },
    adminEmail: { type: String, default: '' },
    adminRole: { type: String, default: 'super_admin' },

    client: { type: mongoose.Schema.Types.ObjectId, ref: 'CollectClient', required: true, index: true },
    clientName: { type: String, required: true },
    clientAccountNumber: { type: String, default: '' },
    clientPhone: { type: String, default: '' },
    neighborhood: { type: String, default: '' },

    amount: { type: Number, required: true },
    payoutMethod: {
      type: String,
      enum: ['momo', 'cash', 'bank', 'wallet'],
      default: 'momo',
    },
    momoOperator: { type: String, default: '' }, // 'mtn' | 'orange'
    momoNumber: { type: String, default: '' },
    notes: { type: String, default: '' },
    executedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

collectAdminWithdrawalSchema.index({ client: 1, executedAt: -1 })
collectAdminWithdrawalSchema.index({ admin: 1, executedAt: -1 })

module.exports = mongoose.model('CollectAdminWithdrawal', collectAdminWithdrawalSchema)
