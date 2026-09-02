// models/YouTubeHistory.js — Historique des vidéos YouTube consultées par un utilisateur.
// Métadonnées + identifiant uniquement. Borné (~100 entrées/utilisateur, purge best-effort côté route).
const mongoose = require('mongoose')

const historySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    youtubeVideoId: { type: String, required: true },
    title: { type: String, default: '' },
    thumbnail: { type: String, default: '' },
    channelTitle: { type: String, default: '' },
    watchedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
)

historySchema.index({ user: 1, watchedAt: -1 })

module.exports = mongoose.model('YouTubeHistory', historySchema)
