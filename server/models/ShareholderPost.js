// models/ShareholderPost.js — Publications du SUPER ADMIN à destination des actionnaires :
// dépenses à faire ou faites, sommes exigées à payer, réunions physiques/en ligne, infos…
// Visibles uniquement dans le portefeuille des actionnaires actifs.
const mongoose = require('mongoose')

const shareholderPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    body: { type: String, default: '' },
    category: { type: String, enum: ['depense', 'paiement', 'reunion', 'info'], default: 'info', index: true },
    // Montant concerné (dépense engagée ou somme exigée à payer), optionnel
    amount: { type: Number, default: null },
    // Réunion : date/heure + lien (visio) ou lieu (physique)
    meetingAt: { type: Date, default: null },
    meetingLink: { type: String, default: '' },
    meetingPlace: { type: String, default: '' },
    isPublished: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
)

module.exports = mongoose.model('ShareholderPost', shareholderPostSchema)
