const mongoose = require('mongoose')

// Annonce de cours de répétition publiée par un enseignant. Visible publiquement
// dans le feed « News » de toute la plateforme (dashboards + espace utilisateur + accueil).
const tutoringPostSchema = new mongoose.Schema(
  {
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    teacherName: { type: String, trim: true },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    subjects: { type: String, trim: true }, // matières concernées (texte libre)
    price: { type: String, trim: true }, // prix / tarif (texte libre pour souplesse)
    photo: { type: String }, // URL Cloudinary de la photo de l'annonce
    contactWhatsapp: { type: String, trim: true },
    contactEmail: { type: String, trim: true, lowercase: true },
    location: { type: String, trim: true },
    schedule: { type: String, trim: true }, // horaires / jours
    status: { type: String, enum: ['published', 'closed'], default: 'published' },
  },
  { timestamps: true }
)

tutoringPostSchema.index({ status: 1, createdAt: -1 })

module.exports = mongoose.model('TutoringPost', tutoringPostSchema)
