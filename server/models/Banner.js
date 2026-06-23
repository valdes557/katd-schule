const mongoose = require('mongoose')

// Bannière promotionnelle gérée par l'administrateur principal et affichée
// sur la page d'accueil de la plateforme (carrousel).
const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, default: '' },
    subtitle: { type: String, trim: true, default: '' },
    image: { type: String, required: true }, // URL Cloudinary
    link: { type: String, trim: true, default: '' }, // lien cible au clic (optionnel)
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

bannerSchema.index({ isActive: 1, sortOrder: 1 })

module.exports = mongoose.model('Banner', bannerSchema)
