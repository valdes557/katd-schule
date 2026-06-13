const mongoose = require('mongoose')

// Annonce officielle publiée par le directeur (distincte des publications "social"/SchoolPost)
const announcementSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    title: { type: String, trim: true },
    content: { type: String, required: true, trim: true },
    // Cible de l'annonce : tout le monde, les parents uniquement, ou les enseignants uniquement
    audience: { type: String, enum: ['all', 'parents', 'teachers'], default: 'all' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

announcementSchema.index({ school: 1, createdAt: -1 })

module.exports = mongoose.model('Announcement', announcementSchema)
