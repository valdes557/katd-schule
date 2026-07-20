// models/ShareholderConfig.js — Configuration du programme actionnaires (document unique).
// Le SUPER ADMIN peut modifier : termes & conditions de souscription, avantages,
// responsabilités, droits et obligations, ainsi que les plans (prix, durée, libellés).
const mongoose = require('mongoose')

// Plans par défaut : 1% d'action, non remboursable, durée 35 ans.
const DEFAULT_PLANS = [
  {
    key: 'arrondissement', label: "1% à l'arrondissement", price: 100000,
    percent: 1, durationYears: 35,
    description: "1% d'action dans un arrondissement. Somme non remboursable, valable 35 ans.",
  },
  {
    key: 'regional', label: '1% régional', price: 496000,
    percent: 1, durationYears: 35,
    description: "1% d'action au niveau régional. Somme non remboursable, valable 35 ans.",
  },
  {
    key: 'national', label: '1% national', price: 1263980,
    percent: 1, durationYears: 35,
    description: "1% d'action sur le territoire national. Somme non remboursable, valable 35 ans.",
  },
  {
    key: 'international', label: '1% international', price: 5000000,
    percent: 1, durationYears: 35,
    description: "1% d'action au niveau international. Somme non remboursable, valable 35 ans.",
  },
]

const planSchema = new mongoose.Schema({
  key: { type: String, required: true },          // arrondissement | regional | national | international
  label: { type: String, required: true },
  price: { type: Number, required: true, min: 1 },
  percent: { type: Number, default: 1 },
  durationYears: { type: Number, default: 35 },
  description: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
}, { _id: false })

const shareholderConfigSchema = new mongoose.Schema(
  {
    // Clé fixe : garantit un document unique (singleton)
    key: { type: String, default: 'main', unique: true },
    // Textes libres modifiables par le super admin (affichés à l'utilisateur avant souscription)
    terms: { type: String, default: "Termes et conditions d'utilisation et de souscription d'actionnaires. La somme versée est non remboursable." },
    advantages: { type: String, default: "Avantages de l'actionnaire." },
    responsibilities: { type: String, default: "Responsabilités de l'actionnaire." },
    rights: { type: String, default: "Droits et obligations de l'actionnaire." },
    plans: { type: [planSchema], default: DEFAULT_PLANS },
  },
  { timestamps: true }
)

// Renvoie le document de configuration (créé avec les valeurs par défaut au premier appel)
shareholderConfigSchema.statics.getOrCreate = async function () {
  let cfg = await this.findOne({ key: 'main' })
  if (!cfg) cfg = await this.create({ key: 'main' })
  return cfg
}

module.exports = mongoose.model('ShareholderConfig', shareholderConfigSchema)
module.exports.DEFAULT_PLANS = DEFAULT_PLANS
