// services/ikeepayService.js — Intégration passerelle Ikeepay (collectes + payouts)
// Doc: https://www.ikeepay.com/developer
//
// Ikeepay expose une API unifiée Mobile Money multi-pays (Afrique de l'Ouest/Centrale).
// Authentification : clé API unique par environnement, envoyée en Bearer.
//   POST {BASE}/payments        → collecte (argent entrant)
//   POST {BASE}{PAYOUT_PATH}    → payout / disbursement (argent sortant, retraits)
//   GET  {BASE}{STATUS_PATH}/:id→ statut d'une transaction
//   Webhook (callback_url)      → notification signée (HMAC) du résultat
//
// ⚠️ Les chemins payout/statut et le schéma de signature exacts ne sont pas publics :
// ils sont surchargeables par variables d'environnement, avec un repli de réconciliation
// (vérification active du statut) pour ne JAMAIS créditer sur un webhook non vérifié.
const crypto = require('crypto')
const IkeepayConfig = require('../models/IkeepayConfig')
const { decrypt } = require('../utils/crypto')

const BASE_URL = (process.env.IKEEPAY_BASE_URL || 'https://api.ikeepay.com').replace(/\/$/, '')
// Chemins surchargeables (à confirmer/ajuster côté Ikeepay sans toucher au code).
const COLLECT_PATH = process.env.IKEEPAY_COLLECT_PATH || '/payments'
const PAYOUT_PATH = process.env.IKEEPAY_PAYOUT_PATH || '/payouts'
const STATUS_PATH = process.env.IKEEPAY_STATUS_PATH || '/payments'
// En-tête portant la signature HMAC du webhook (à confirmer avec Ikeepay).
const SIGNATURE_HEADER = (process.env.IKEEPAY_SIGNATURE_HEADER || 'x-ikeepay-signature').toLowerCase()
// Marché par défaut : multi-pays, devise XOF, pays par défaut Côte d'Ivoire.
const DEFAULT_COUNTRY = process.env.IKEEPAY_COUNTRY || 'CI'
const DEFAULT_CURRENCY = process.env.IKEEPAY_CURRENCY || 'XOF'

// Résout la clé API active : la config DB (dashboard) prend le dessus sur le .env.
async function resolveConfig() {
  let mode = process.env.IKEEPAY_MODE || 'test'
  let apiKey = '', webhookSecret = '', publicKey = ''
  try {
    const cfg = await IkeepayConfig.findOne({ singleton: 'ikeepay' })
    if (cfg) {
      mode = cfg.mode || mode
      if (mode === 'live') {
        apiKey = decrypt(cfg.apiKeyLive) || ''
        webhookSecret = decrypt(cfg.webhookSecretLive) || ''
        publicKey = cfg.publicKeyLive || ''
      } else {
        apiKey = decrypt(cfg.apiKeyTest) || ''
        webhookSecret = decrypt(cfg.webhookSecretTest) || ''
        publicKey = cfg.publicKeyTest || ''
      }
    }
  } catch (e) { /* DB indisponible -> fallback env */ }
  // Fallback variables d'environnement
  if (!apiKey) {
    apiKey = (mode === 'live' ? process.env.IKEEPAY_API_KEY_LIVE : process.env.IKEEPAY_API_KEY_TEST) || ''
  }
  if (!webhookSecret) {
    webhookSecret = (mode === 'live' ? process.env.IKEEPAY_WEBHOOK_SECRET_LIVE : process.env.IKEEPAY_WEBHOOK_SECRET_TEST) || ''
  }
  if (!publicKey) {
    publicKey = (mode === 'live' ? process.env.IKEEPAY_PUBLIC_KEY_LIVE : process.env.IKEEPAY_PUBLIC_KEY_TEST) || ''
  }
  return { mode, apiKey, webhookSecret, publicKey }
}

// Indicatifs téléphoniques par code pays ISO (marchés Ikeepay courants)
const DIAL_CODES = {
  CI: '225', SN: '221', CM: '237', BJ: '229', TG: '228', BF: '226',
  ML: '223', NE: '227', GN: '224', CG: '242', GA: '241', TD: '235', CF: '236',
  CD: '243', // RDC
}

// Normalise un numéro au format INTERNATIONAL (MSISDN sans +), attendu par la plupart
// des agrégateurs Mobile Money. Préfixe l'indicatif pays s'il est absent.
function normalizePhone(phone, country) {
  let digits = String(phone || '').replace(/[^0-9]/g, '')
  const dial = DIAL_CODES[String(country || '').toUpperCase()]
  if (dial) {
    if (digits.startsWith(dial)) return digits
    // supprime un éventuel 0 national initial avant de préfixer l'indicatif
    digits = digits.replace(/^0+/, '')
    return dial + digits
  }
  return digits
}

// Convertit un code opérateur interne (ex: "mtn-ci", "orange", "wave") vers le nom
// de fournisseur attendu par Ikeepay (ex: "MTN", "ORANGE", "WAVE"). Le suffixe pays
// (-ci, -sn, …) est retiré.
const PROVIDER_MAP = {
  mtn: 'MTN', orange: 'ORANGE', wave: 'WAVE', moov: 'MOOV', airtel: 'AIRTEL',
  free: 'FREE', freemoney: 'FREE', emoney: 'EMONEY', mpesa: 'MPESA',
}
function mapProvider(operator) {
  const base = String(operator || '').trim().toLowerCase()
    .replace(/[-_][a-z]{2}$/, '') // retire suffixe pays éventuel
    .replace(/[^a-z]/g, '')       // "free-money" -> "freemoney"
  return PROVIDER_MAP[base] || base.toUpperCase()
}

function authHeaders(cfg) {
  // Doc Ikeepay : authentification par clé secrète dans l'en-tête x-api-key.
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'x-api-key': cfg.apiKey,
  }
}

// Extrait un message d'erreur lisible d'une réponse Ikeepay (formats variables).
function buildError(res, data) {
  let msg = (data && (data.message || data.error)) || ('Erreur Ikeepay ' + res.status)
  if (data && data.errors && typeof data.errors === 'object') {
    const details = Object.entries(data.errors)
      .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
      .join(' | ')
    if (details) msg += ' — ' + details
  }
  const err = new Error(msg)
  err.status = res.status
  err.data = data
  return err
}

// Corps commun d'une opération Mobile Money (collecte ou payout).
function buildMomoBody({ amount, phone, operator, reference, callbackUrl, country, currency, accountName, customerEmail, otp }) {
  const natPhone = normalizePhone(phone, country)
  if (!/^[0-9]{8,15}$/.test(natPhone)) {
    const err = new Error('Numéro Mobile Money invalide : « ' + (phone || '') + " ». Vérifiez qu'il est complet.")
    err.status = 400
    throw err
  }
  // Format attendu par Ikeepay (doc) : phoneNumber + operator (nom du fournisseur), external_reference.
  const body = {
    amount,
    currency,
    country,
    phoneNumber: natPhone,
    operator: mapProvider(operator),
    external_reference: reference,
  }
  if (customerEmail) body.customer_email = customerEmail
  if (otp) body.otp = otp
  if (accountName) body.account_name = accountName
  // callback_url optionnel : uniquement s'il est absolu (http/https).
  if (callbackUrl && /^https?:\/\//i.test(callbackUrl)) body.callback_url = callbackUrl
  return body
}

// Initie une collecte Mobile Money (argent entrant)
async function createCollection({ amount, phone, operator, reference, callbackUrl, customerEmail, otp, country = DEFAULT_COUNTRY, currency = DEFAULT_CURRENCY }) {
  const cfg = await resolveConfig()
  if (!cfg.apiKey) throw new Error('Clé API Ikeepay non configurée (mode ' + cfg.mode + ')')
  const body = buildMomoBody({ amount, phone, operator, reference, callbackUrl, country, currency, customerEmail, otp })
  const res = await fetch(BASE_URL + COLLECT_PATH, {
    method: 'POST', headers: authHeaders(cfg), body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw buildError(res, data)
  return { mode: cfg.mode, ...data }
}

// Initie un payout / disbursement Mobile Money (argent sortant → retraits utilisateurs)
async function createPayout({ amount, phone, operator, reference, callbackUrl, accountName, country = DEFAULT_COUNTRY, currency = DEFAULT_CURRENCY }) {
  const cfg = await resolveConfig()
  if (!cfg.apiKey) throw new Error('Clé API Ikeepay non configurée (mode ' + cfg.mode + ')')
  const body = buildMomoBody({ amount, phone, operator, reference, callbackUrl, country, currency, accountName })
  const res = await fetch(BASE_URL + PAYOUT_PATH, {
    method: 'POST', headers: authHeaders(cfg), body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw buildError(res, data)
  return { mode: cfg.mode, ...data }
}

// Liste les opérateurs Mobile Money supportés (best-effort). Repli : liste statique
// multi-pays (Afrique de l'Ouest, XOF) si l'API ne fournit pas l'endpoint.
const FALLBACK_OPERATORS = [
  { code: 'orange', name: 'Orange Money' },
  { code: 'mtn', name: 'MTN MoMo' },
  { code: 'wave', name: 'Wave' },
  { code: 'moov', name: 'Moov Money' },
  { code: 'free', name: 'Free Money' },
  { code: 'emoney', name: 'E-Money' },
  { code: 'airtel', name: 'Airtel Money' },
]
async function listOperators(country = DEFAULT_COUNTRY) {
  try {
    const cfg = await resolveConfig()
    if (!cfg.apiKey) return FALLBACK_OPERATORS
    const res = await fetch(BASE_URL + '/operators?country=' + encodeURIComponent(country), {
      method: 'GET', headers: authHeaders(cfg),
    })
    if (!res.ok) return FALLBACK_OPERATORS
    const data = await res.json().catch(() => ({}))
    const list = Array.isArray(data) ? data : (data.data || data.operators || [])
    return list.length ? list : FALLBACK_OPERATORS
  } catch (e) {
    return FALLBACK_OPERATORS
  }
}

// Vérifie le statut d'une transaction (par id fournisseur ou external_reference)
async function getTransactionStatus(idOrRef) {
  const cfg = await resolveConfig()
  const res = await fetch(BASE_URL + STATUS_PATH + '/' + encodeURIComponent(idOrRef), {
    method: 'GET', headers: authHeaders(cfg),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw buildError(res, data)
  return data
}

// Vérifie la signature HMAC-SHA256 d'un webhook. Retourne false si aucun secret n'est
// configuré ou si la signature ne correspond pas → l'appelant réconcilie alors le statut
// via getTransactionStatus avant tout crédit.
async function verifyWebhookSignature(rawBody, signature) {
  const cfg = await resolveConfig()
  if (!cfg.webhookSecret || !signature) return false
  const expected = crypto.createHmac('sha256', cfg.webhookSecret).update(rawBody).digest('hex')
  try {
    const a = Buffer.from(expected)
    const b = Buffer.from(String(signature))
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  } catch (e) {
    return false
  }
}

// Réponse standard d'un paiement « inline » (iframe pk_…). Lève une erreur 400 si la clé publique
// n'est pas configurée. `reference` = external_reference (order_id), `amount` en unités (XOF).
async function inlineResponse(reference, amount, currency = DEFAULT_CURRENCY) {
  const { mode, publicKey } = await resolveConfig()
  if (!publicKey) {
    const e = new Error('Clé publique Ikeepay non configurée (mode ' + mode + ') — renseignez-la dans Gestion Plateforme → Clés API.')
    e.status = 400
    throw e
  }
  return { success: true, reference, amount, mode, currency, inline: true, publicKey }
}

module.exports = {
  resolveConfig, createCollection, createPayout, listOperators, getTransactionStatus,
  verifyWebhookSignature, mapProvider, normalizePhone, inlineResponse,
  BASE_URL, PAYOUT_PATH, STATUS_PATH, SIGNATURE_HEADER, DEFAULT_COUNTRY, DEFAULT_CURRENCY,
}
