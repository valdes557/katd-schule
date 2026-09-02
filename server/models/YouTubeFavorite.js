// models/YouTubeFavorite.js — Vidéos YouTube mises en favori par un utilisateur.
// On ne stocke QUE des métadonnées + l'identifiant YouTube (jamais le fichier vidéo).
const mongoose = require('mongoose')

const favoriteSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    youtubeVideoId: { type: String, required: true },
    title: { type: String, default: '' },
    thumbnail: { type: String, default: '' },
    channelTitle: { type: String, default: '' },
  },
  { timestamps: true }
)

// Un même utilisateur ne peut favoriser une vidéo qu'une fois.
favoriteSchema.index({ user: 1, youtubeVideoId: 1 }, { unique: true })

module.exports = mongoose.model('YouTubeFavorite', favoriteSchema)
