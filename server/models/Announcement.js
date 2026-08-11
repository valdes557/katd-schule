const mongoose = require('mongoose')

// Annonce officielle publiée par le directeur (distincte des publications "social"/SchoolPost)
const announcementSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    title: { type: String, trim: true },
    content: { type: String, required: true, trim: true },
    // Cible de l'annonce : tout le monde, les parents uniquement, ou les enseignants uniquement
    audience: { type: String, enum: ['all', 'parents', 'teachers'], default: 'all' },
    // Publiée par la secrétaire au nom de la Direction ("La Direction" affiché aux lecteurs)
    onBehalfOf: { type: String, default: '' },
    // Programmation (G2) : 'publiee' visible immédiatement ; 'programmee' publiée
    // automatiquement par le scheduler à `scheduledAt`, puis passe à 'publiee'.
    status: { type: String, enum: ['publiee', 'programmee'], default: 'publiee' },
    scheduledAt: { type: Date, default: null },
    publishedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

announcementSchema.index({ school: 1, createdAt: -1 })
// Recherche efficace des annonces programmées arrivées à échéance (scheduler).
announcementSchema.index({ status: 1, scheduledAt: 1 })

module.exports = mongoose.model('Announcement', announcementSchema)
