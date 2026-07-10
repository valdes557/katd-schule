// services/sebpayService.js — Intégration passerelle SEBPay (collectes uniquement)
// Doc: https://new.sebpay.bj/fr/docs  | Base: /api/v1
const crypto = require('crypto')
const SebpayConfig = require('../models/SebpayConfig')
const { decrypt } = require('../utils/crypto')

const BASE_URL = process.env.SEBPAY_BASE_URL || 'https://newapi.sebpay.bj/api/v1'
// Pays / devise par défaut du marché (Cameroun / Afrique centrale). Surchargeables par .env.
const DEFAULT_COUNTRY = process.env.SEBPAY_COUNTRY || 'CM'
const DEFAULT_CURRENCY = process.env.SEBPAY_CURRENCY || 'XAF'

// Résout les clés actives : la config DB (dashboard) prend le dessus sur le .env
async function resolveConfig() {
  let mode = process.env.SEBPAY_MODE || 'test'
  let pk = '', sk = ''
  try {
    const cfg = await SebpayConfig.findOne({ singleton: 'sebpay' })
    if (cfg) {
      mode = cfg.mode || mode
      if (mode === 'live') {
        pk = decrypt(cfg.publicKeyLive) || ''
        sk = decrypt(cfg.secretKeyLive) || ''
      } else {
        pk = decrypt(cfg.publicKeyTest) || ''
        sk = decrypt(cfg.secretKeyTest) || ''
      }
    }
  } catch (e) { /* DB indisponible -> fallback env */ }
  // Fallback variables d'environnement
  if (!pk || !sk) {
    if (mode === 'live') {
      pk = pk || process.env.SEBPAY_PUBLIC_KEY_LIVE || ''
      sk = sk || process.env.SEBPAY_SECRET_KEY_LIVE || ''
    } else {
      pk = pk || process.env.SEBPAY_PUBLIC_KEY_TEST || ''
      sk = sk || process.env.SEBPAY_SECRET_KEY_TEST || ''
    }
  }
  return { mode, publicKey: pk, secretKey: sk }
}

// Indicatifs téléphoniques par code pays ISO (marchés SEBPay courants)
const DIAL_CODES = {
  CM: '237', BJ: '229', CI: '225', SN: '221', TG: '228', BF: '226',
  ML: '223', NE: '227', GN: '224', CG: '242', GA: '241', TD: '235', CF: '236',
}

// Normalise un numéro au format NATIONAL attendu par SEBPay (le pays est envoyé à part).
// Retire l'indicatif pays s'il est présent (ex: 237680404921 -> 680404921).
function normalizePhone(phone, country) {
  let digits = String(phone || '').replace(/[^0-9]/g, '')
  const dial = DIAL_CODES[String(country || '').toUpperCase()]
  if (dial && digits.startsWith(dial) && digits.length > dial.length) {
    digits = digits.slice(dial.length)
  }
  return digits
}

// SEBPay /collections attend le CODE opérateur sans suffixe pays :
// "mtn-cm" -> "mtn", "orange-cm" -> "orange" (le pays est déjà envoyé à part).
function normalizeOperator(operator) {
  return String(operator || '').trim().toLowerCase().replace(/[-_][a-z]{2}$/, '')
}

function authHeaders(cfg) {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Public-Key': cfg.publicKey,
    'X-Secret-Key': cfg.secretKey,
  }
}

// Initie une collecte Mobile Money (argent entrant)
async function createCollection({ amount, phone, operator, reference, callbackUrl, country = DEFAULT_COUNTRY, currency = DEFAULT_CURRENCY, otpCode }) {
  const cfg = await resolveConfig()
  if (!cfg.publicKey || !cfg.secretKey) {
    throw new Error('Clés API SEBPay non configurées (mode ' + cfg.mode + ')')
  }
  const body = {
    amount,
    currency,
    phone: normalizePhone(phone, country),
    operator: normalizeOperator(operator),
    country,
    external_reference: reference,
  }
  // callback_url est optionnel : on ne l'envoie que s'il est absolu (http/https),
  // sinon SEBPay rejette la requête (erreur de validation). Le suivi se fait par polling.
  if (callbackUrl && /^https?:\/\//i.test(callbackUrl)) body.callback_url = callbackUrl
  if (otpCode) body.otp_code = otpCode
  const res = await fetch(BASE_URL + '/collections', {
    method: 'POST',
    headers: authHeaders(cfg),
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    let msg = (data && (data.message || data.error)) || ('Erreur SEBPay ' + res.status)
    // Détail champ par champ (format Laravel { errors: { champ: [messages] } })
    if (data && data.errors && typeof data.errors === 'object') {
      const details = Object.entries(data.errors)
        .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
        .join(' | ')
      if (details) msg += ' — ' + details
    }
    const err = new Error(msg)
    err.status = res.status
    err.data = data
    throw err
  }
  return { mode: cfg.mode, ...data }
}

// Liste les opérateurs Mobile Money supportés (filtrés par pays) — pour peupler le formulaire
async function listOperators(country = DEFAULT_COUNTRY) {
  const cfg = await resolveConfig()
  if (!cfg.publicKey || !cfg.secretKey) {
    throw new Error('Clés API SEBPay non configurées (mode ' + cfg.mode + ')')
  }
  const res = await fetch(BASE_URL + '/operators?country=' + encodeURIComponent(country), {
    method: 'GET',
    headers: authHeaders(cfg),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error((data && data.message) || ('Erreur SEBPay ' + res.status))
    err.status = res.status
    err.data = data
    throw err
  }
  // Normalise : SEBPay renvoie soit un tableau, soit { data: [...] }
  const list = Array.isArray(data) ? data : (data.data || data.operators || [])
  return list
}

// Vérifie le statut d'une collecte (par transaction_id ou external_reference)
async function getCollectionStatus(idOrRef) {
  const cfg = await resolveConfig()
  const res = await fetch(BASE_URL + '/collections/' + encodeURIComponent(idOrRef), {
    method: 'GET',
    headers: authHeaders(cfg),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error((data && data.message) || ('Erreur SEBPay ' + res.status))
    err.status = res.status
    throw err
  }
  return data
}

// Vérifie la signature HMAC-SHA256 d'un webhook (en-tête X-SebPay-Signature)
async function verifyWebhookSignature(rawBody, signature) {
  const cfg = await resolveConfig()
  if (!cfg.secretKey || !signature) return false
  const expected = crypto.createHmac('sha256', cfg.secretKey).update(rawBody).digest('hex')
  try {
    const a = Buffer.from(expected)
    const b = Buffer.from(String(signature))
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  } catch (e) {
    return false
  }
}

module.exports = { resolveConfig, createCollection, listOperators, getCollectionStatus, verifyWebhookSignature, BASE_URL, DEFAULT_COUNTRY, DEFAULT_CURRENCY }
