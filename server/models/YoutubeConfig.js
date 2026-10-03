// models/YoutubeConfig.js — Clé API YouTube Data v3 (chiffrée) + réglages, gérés via le
// dashboard Super Admin. Mirroir de IkeepayConfig : la clé est chiffrée (AES-256-GCM,
// utils/crypto) et résolue côté serveur uniquement (youtubeService), jamais exposée au client.
const mongoose = require('mongoose')

const youtubeConfigSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: 'youtube', unique: true },
    apiKey: { type: String, default: '' }, // valeur CHIFFRÉE (utils/crypto.encrypt)
    cacheTtl: { type: Number, default: 300 }, // durée de cache des réponses (secondes)
    maxSearchLen: { type: Number, default: 120 }, // longueur max d'un terme de recherche
    enabled: { type: Boolean, default: true },
    // Téléchargement des vidéos + publicité AdSense / AdMob (monétisation).
    // Aucune donnée secrète ici : les identifiants d'annonces figurent dans le client.
    downloadEnabled: { type: Boolean, default: true }, // autorise le téléchargement des vidéos
    adsenseClient: { type: String, default: '' },       // ex. "ca-pub-1234567890123456"
    adSlot: { type: String, default: '' },              // ID du bloc d'annonce AdSense
    adCountdown: { type: Number, default: 5 },          // secondes de pub avant le téléchargement
    // Configuration Google AdMob pour la version mobile native
    admobEnabled: { type: Boolean, default: true },
    admobAppId: { type: String, default: '' },          // ex. "ca-app-pub-xxxxxxxx~yyyyyyyy"
    admobBannerSlot: { type: String, default: '' },     // ex. "ca-app-pub-xxxxxxxx/banner1"
    admobInterstitialSlot: { type: String, default: '' },// ex. "ca-app-pub-xxxxxxxx/interstitial1"
    admobRewardedSlot: { type: String, default: '' },   // ex. "ca-app-pub-xxxxxxxx/rewarded1"
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
)

module.exports = mongoose.model('YoutubeConfig', youtubeConfigSchema)
