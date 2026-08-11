// models/Sanction.js — Sanctions disciplinaires (cycle Secondaire, G1).
// Le Surveillant Général (ou le Principal / Vice-Principal) enregistre une sanction
// contre un élève : avertissement, blâme, exclusion, convocation, retenue. Chaque
// sanction est datée, motivée, attribuée à son auteur et conservée pour l'historique
// disciplinaire (consulté par la direction, l'élève et le parent).
const mongoose = require('mongoose')

const SANCTION_TYPES = [
  'avertissement',          // Avertissement écrit
  'blame',                  // Blâme
  'exclusion_temporaire',   // Exclusion temporaire (avec durée en jours)
  'exclusion_definitive',   // Exclusion définitive
  'convocation',            // Convocation des parents
  'retenue',                // Retenue / colle
]

const sanctionSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    type: { type: String, enum: SANCTION_TYPES, required: true },
    reason: { type: String, required: true, trim: true }, // motif de la sanction
    // Date à laquelle la sanction s'applique (par défaut : aujourd'hui)
    date: { type: Date, default: Date.now },
    // Durée en jours pour une exclusion temporaire / retenue (0 = sans objet)
    durationDays: { type: Number, default: 0, min: 0 },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // auteur (SG, directeur…)
    decidedByRole: { type: String, default: '' },
    note: { type: String, default: '' },
    // Annulation : une sanction n'est jamais supprimée, seulement annulée (traçabilité).
    canceled: { type: Boolean, default: false },
    canceledAt: { type: Date, default: null },
    canceledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
)

sanctionSchema.index({ school: 1, student: 1, date: -1 })

sanctionSchema.statics.TYPES = SANCTION_TYPES

module.exports = mongoose.model('Sanction', sanctionSchema)
