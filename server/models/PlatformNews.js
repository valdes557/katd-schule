const mongoose = require('mongoose')

// Contenu « News / Démo » publié par l'administrateur (super_admin) : vidéos de
// démonstration de l'application, PDF, images ou liens. Apparaît dans le feed News
// de tous les dashboards, de l'espace utilisateur et de la page d'accueil.
const platformNewsSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    type: { type: String, enum: ['video', 'pdf', 'image', 'link'], default: 'video' },
    mediaUrl: { type: String }, // URL Cloudinary (vidéo/pdf/image)
    link: { type: String, trim: true }, // lien externe optionnel
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

platformNewsSchema.index({ createdAt: -1 })

module.exports = mongoose.model('PlatformNews', platformNewsSchema)
