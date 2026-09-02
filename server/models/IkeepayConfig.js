// models/IkeepayConfig.js — Clés API Ikeepay chiffrées (gérées via dashboard admin)
// Ikeepay authentifie par une clé API unique (Bearer) par environnement. Un secret de
// webhook (optionnel) permet de vérifier la signature des notifications entrantes.
const mongoose = require('mongoose')

const ikeepayConfigSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: 'ikeepay', unique: true },
    mode: { type: String, enum: ['test', 'live'], default: 'test' },
    // Clé PUBLIQUE (pk_live_… / pk_test_…) — NON secrète (exposée à l'iframe inline). Stockée en clair.
    publicKeyTest: { type: String, default: '' },
    publicKeyLive: { type: String, default: '' },
    // Clé API SECRÈTE (en-tête x-api-key) — valeurs chiffrées (AES-256-GCM via utils/crypto)
    apiKeyTest: { type: String, default: '' },
    apiKeyLive: { type: String, default: '' },
    // Secret de vérification des webhooks (HMAC), optionnel selon la config Ikeepay
    webhookSecretTest: { type: String, default: '' },
    webhookSecretLive: { type: String, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
)

module.exports = mongoose.model('IkeepayConfig', ikeepayConfigSchema)
