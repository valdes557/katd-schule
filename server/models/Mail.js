// models/Mail.js — Registre du courrier (cycle Secondaire).
// La secrétaire enregistre le courrier entrant/sortant : expéditeur/destinataire,
// objet, catégorie, pièce scannée (Cloudinary), puis le classe et l'archive.
const mongoose = require('mongoose')

const mailSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    direction: { type: String, enum: ['entrant', 'sortant'], required: true, index: true },
    reference: { type: String, default: '', trim: true }, // n° d'enregistrement interne
    subject: { type: String, required: true, trim: true }, // objet du courrier
    correspondent: { type: String, required: true, trim: true }, // expéditeur (entrant) ou destinataire (sortant)
    category: { type: String, default: 'Général', trim: true }, // ex : Administratif, MINESEC, Parents…
    mailDate: { type: Date, required: true }, // date portée sur le courrier
    scanUrl: { type: String, default: '' }, // pièce scannée
    scanName: { type: String, default: '' },
    note: { type: String, default: '' },
    archived: { type: Boolean, default: false, index: true },
    registeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

mailSchema.index({ school: 1, archived: 1, mailDate: -1 })

module.exports = mongoose.model('Mail', mailSchema)
