// utils/crypto.js — Chiffrement AES-256-GCM pour secrets (clés API SEBPay, etc.)
const crypto = require('crypto')

const ALGO = 'aes-256-gcm'

function getKey() {
  const raw = process.env.ENCRYPTION_KEY || ''
  if (!raw || raw.length < 32) {
    throw new Error('ENCRYPTION_KEY manquante ou trop courte (64 hex attendus)')
  }
  // accepte hex (64 chars) ou texte (>=32) -> dérive 32 octets
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex')
  return crypto.createHash('sha256').update(raw).digest()
}

function encrypt(plain) {
  if (plain == null || plain === '') return ''
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv)
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // format: iv:tag:data (base64)
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':')
}

function decrypt(payload) {
  if (!payload) return ''
  const [ivB, tagB, dataB] = String(payload).split(':')
  if (!ivB || !tagB || !dataB) return ''
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivB, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB, 'base64'))
  const dec = Buffer.concat([decipher.update(Buffer.from(dataB, 'base64')), decipher.final()])
  return dec.toString('utf8')
}

// Masque une clé pour affichage : sk_live_••••••••3a7f
function mask(value) {
  if (!value) return ''
  const v = String(value)
  if (v.length <= 8) return v.slice(0, 2) + '••••'
  const head = v.slice(0, 7)
  const tail = v.slice(-4)
  return head + '••••••••' + tail
}

module.exports = { encrypt, decrypt, mask }
