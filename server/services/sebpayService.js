// services/sebpayService.js — Intégration passerelle SEBPay (collectes uniquement)
// Doc: https://new.sebpay.bj/fr/docs  | Base: /api/v1
const crypto = require('crypto')
const SebpayConfig = require('../models/SebpayConfig')
const { decrypt } = require('../utils/crypto')

const BASE_URL = process.env.SEBPAY_BASE_URL || 'https://newapi.sebpay.bj/api/v1'

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

function authHeaders(cfg) {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Public-Key': cfg.publicKey,
    'X-Secret-Key': cfg.secretKey,
  }
}

// Initie une collecte Mobile Money (argent entrant)
async function createCollection({ amount, phone, operator, reference, callbackUrl, country = 'BJ', currency = 'XOF', otpCode }) {
  const cfg = await resolveConfig()
  if (!cfg.publicKey || !cfg.secretKey) {
    throw new Error('Clés API SEBPay non configurées (mode ' + cfg.mode + ')')
  }
  const body = {
    amount,
    currency,
    phone: String(phone).replace(/[^0-9]/g, ''),
    operator,
    country,
    external_reference: reference,
    callback_url: callbackUrl,
  }
  if (otpCode) body.otp_code = otpCode
  const res = await fetch(BASE_URL + '/collections', {
    method: 'POST',
    headers: authHeaders(cfg),
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || ('Erreur SEBPay ' + res.status)
    const err = new Error(msg)
    err.status = res.status
    err.data = data
    throw err
  }
  return { mode: cfg.mode, ...data }
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

module.exports = { resolveConfig, createCollection, getCollectionStatus, verifyWebhookSignature, BASE_URL }
