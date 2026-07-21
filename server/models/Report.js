// models/Report.js — Rapports internes (cycle Secondaire).
// Tous les membres → principal (directeur) ; professeurs → vice-principal.
const mongoose = require('mongoose')

const reportSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    fromRole: { type: String, default: '' },
    toRole: { type: String, enum: ['directeur', 'vice_principal'], required: true, index: true },
    subject: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    readAt: { type: Date, default: null },
    readBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
)

reportSchema.index({ school: 1, toRole: 1, createdAt: -1 })

module.exports = mongoose.model('Report', reportSchema)
