// services/boostPricingService.js — Source de vérité des prix et de la config boost.
// SÉCURITÉ : resolvePrice() est le SEUL point qui fixe un montant. Le frontend n'envoie
// jamais de prix — uniquement une durationKey.
const BoostPricing = require('../models/BoostPricing')
const BoostConfig = require('../models/BoostConfig')

const DEFAULT_CURRENCY = process.env.BOOST_DEFAULT_CURRENCY || 'XOF'

// Grille par défaut (semée si la collection est vide) — cf. spec : 24h=500, 3j=1000, 7j=2500.
const DEFAULT_PRICING = [
  { durationKey: '24h', label: '24 heures', hours: 24, price: 500, sortOrder: 1 },
  { durationKey: '3d', label: '3 jours', hours: 72, price: 1000, sortOrder: 2 },
  { durationKey: '7d', label: '7 jours', hours: 168, price: 2500, sortOrder: 3 },
]

// Retourne la grille tarifaire (sème les défauts au 1er appel si la collection est vide).
async function getPricing({ activeOnly = false } = {}) {
  let rows = await BoostPricing.find().sort({ sortOrder: 1 })
  if (!rows.length) {
    await BoostPricing.insertMany(DEFAULT_PRICING.map((r) => ({ ...r, currency: DEFAULT_CURRENCY, isActive: true })))
    rows = await BoostPricing.find().sort({ sortOrder: 1 })
  }
  return activeOnly ? rows.filter((r) => r.isActive) : rows
}

// Résout le prix OFFICIEL d'une durée depuis la DB. Lève une erreur (400) si la durée est
// inconnue ou inactive. Le montant n'est JAMAIS pris du frontend.
async function resolvePrice(durationKey) {
  await getPricing() // garantit le seed
  const row = await BoostPricing.findOne({ durationKey, isActive: true })
  if (!row) {
    const err = new Error("Cette formule de boost n'est pas disponible.")
    err.status = 400
    throw err
  }
  return { price: row.price, hours: row.hours, currency: row.currency, durationKey: row.durationKey, label: row.label }
}

// Retourne la config singleton (créée avec les défauts si absente).
async function getConfig() {
  let cfg = await BoostConfig.findOne({ singleton: 'boost' })
  if (!cfg) cfg = await BoostConfig.create({ singleton: 'boost', currency: DEFAULT_CURRENCY })
  return cfg
}

module.exports = { getPricing, resolvePrice, getConfig, DEFAULT_CURRENCY }
