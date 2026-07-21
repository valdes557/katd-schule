// models/PermissionRequest.js — Demandes de permission (sortie, absence, retard).
// Demandées par un parent/élève/professeur, validées par le Surveillant Général
// (ou le principal), consultées par le portier pour autoriser les sorties.
const mongoose = require('mongoose')

const permissionRequestSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    requesterRole: { type: String, default: '' },
    // Si la demande concerne un élève (demande d'un parent ou de l'élève lui-même)
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
    kind: { type: String, enum: ['sortie', 'absence', 'retard'], default: 'sortie' },
    reason: { type: String, required: true, trim: true },
    fromDate: { type: Date, required: true },
    toDate: { type: Date, default: null },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },
    decisionNote: { type: String, default: '' },
  },
  { timestamps: true }
)

permissionRequestSchema.index({ school: 1, status: 1, createdAt: -1 })

module.exports = mongoose.model('PermissionRequest', permissionRequestSchema)
