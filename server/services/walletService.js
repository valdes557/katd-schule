// services/walletService.js — Opérations atomiques sur les portefeuilles + grand livre
const crypto = require('crypto')
const Wallet = require('../models/Wallet')
const WalletTransaction = require('../models/WalletTransaction')
const User = require('../models/User')

// Frais de transfert entre utilisateurs : 0,25% du montant, payés EN PLUS par l'envoyeur.
const TRANSFER_FEE_RATE = 0.0025
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'valdeslando15@gmail.com').toLowerCase()

async function getOrCreateWallet(userId, { role = 'autre', school = null } = {}) {
  let wallet = await Wallet.findOne({ owner: userId })
  if (!wallet) {
    wallet = await Wallet.create({ owner: userId, role, school, currency: 'XOF' })
  }
  return wallet
}

// Génère (une fois) le numéro de compte KS-XXXXXX d'un utilisateur, avec garantie d'unicité.
async function ensureAccountNo(userId) {
  const u = await User.findById(userId).select('walletAccountNo name email role')
  if (!u) throw new Error('Utilisateur introuvable')
  if (u.walletAccountNo) return u.walletAccountNo
  for (let i = 0; i < 8; i++) {
    const candidate = 'KS-' + crypto.randomBytes(3).toString('hex').toUpperCase() // KS- + 6 hex
    const exists = await User.exists({ walletAccountNo: candidate })
    if (!exists) {
      u.walletAccountNo = candidate
      await u.save()
      return candidate
    }
  }
  throw new Error("Impossible de générer un numéro de compte, réessayez")
}

// Retourne l'utilisateur admin plateforme (destinataire des frais). null si introuvable.
async function getPlatformAdmin() {
  return (
    (await User.findOne({ role: 'super_admin' }).select('_id role')) ||
    (await User.findOne({ email: ADMIN_EMAIL }).select('_id role'))
  )
}

// Crédite un portefeuille (argent reçu) + écrit au grand livre
async function credit(userId, { amount, type, description = '', counterparty = null,
                                paymentIntent = null, sebpayTransactionId = null,
                                role, school, meta = {} }) {
  const amt = Number(amount)
  if (!amt || amt <= 0) throw new Error('Montant de crédit invalide')
  const wallet = await getOrCreateWallet(userId, { role, school })
  wallet.balance += amt
  wallet.totalIn += amt
  await wallet.save()
  const tx = await WalletTransaction.create({
    wallet: wallet._id, owner: userId, direction: 'credit', amount: amt,
    currency: wallet.currency, type, balanceAfter: wallet.balance,
    counterparty, paymentIntent, sebpayTransactionId, description, meta,
  })
  return { wallet, tx }
}

// Débite le solde disponible (transfert, ajustement)
async function debit(userId, { amount, type, description = '', counterparty = null,
                               withdrawal = null, role, school, meta = {} }) {
  const amt = Number(amount)
  if (!amt || amt <= 0) throw new Error('Montant de débit invalide')
  const wallet = await getOrCreateWallet(userId, { role, school })
  if (wallet.balance < amt) throw new Error('Solde insuffisant')
  wallet.balance -= amt
  wallet.totalOut += amt
  await wallet.save()
  const tx = await WalletTransaction.create({
    wallet: wallet._id, owner: userId, direction: 'debit', amount: amt,
    currency: wallet.currency, type, balanceAfter: wallet.balance,
    counterparty, withdrawal, description, meta,
  })
  return { wallet, tx }
}

// Bloque un montant (retrait demandé) : sort du solde dispo -> locked
async function lock(userId, amount) {
  const amt = Number(amount)
  const wallet = await getOrCreateWallet(userId)
  if (wallet.balance < amt) throw new Error('Solde insuffisant')
  wallet.balance -= amt
  wallet.locked += amt
  await wallet.save()
  return wallet
}

// Confirme le retrait (sort du locked définitivement)
async function settleLocked(userId, amount) {
  const amt = Number(amount)
  const wallet = await getOrCreateWallet(userId)
  wallet.locked = Math.max(0, wallet.locked - amt)
  wallet.totalOut += amt
  await wallet.save()
  return wallet
}

// Annule un blocage (retrait rejeté) : locked -> balance
async function unlock(userId, amount) {
  const amt = Number(amount)
  const wallet = await getOrCreateWallet(userId)
  wallet.locked = Math.max(0, wallet.locked - amt)
  wallet.balance += amt
  await wallet.save()
  return wallet
}

// Transfert interne instantané (directeur -> enseignant)
async function transfer(fromUserId, toUserId, { amount, description = '', meta = {} }) {
  const amt = Number(amount)
  if (!amt || amt <= 0) throw new Error('Montant de transfert invalide')
  const d = await debit(fromUserId, { amount: amt, type: 'salary_transfer',
    counterparty: toUserId, description: description || 'Transfert de salaire', meta })
  const c = await credit(toUserId, { amount: amt, type: 'salary_received',
    counterparty: fromUserId, description: description || 'Salaire reçu', meta })
  return { from: d.wallet, to: c.wallet, debitTx: d.tx, creditTx: c.tx }
}

// Calcule les frais de transfert (0,25%, arrondi à l'entier) — payés EN PLUS par l'envoyeur.
function computeTransferFee(amount) {
  const amt = Number(amount)
  if (!amt || amt <= 0) return 0
  return Math.round(amt * TRANSFER_FEE_RATE)
}

// Transfert entre deux utilisateurs quelconques (frais 0,25% ajoutés, encaissés par l'admin).
// L'envoyeur est débité (amount + fee) ; le destinataire reçoit amount ; l'admin reçoit fee.
async function transferBetweenUsers(fromUserId, toUserId, { amount, description = '' }) {
  const amt = Number(amount)
  if (!amt || amt <= 0) throw new Error('Montant de transfert invalide')
  if (String(fromUserId) === String(toUserId)) throw new Error('Impossible de transférer vers votre propre compte')
  const fee = computeTransferFee(amt)
  const total = amt + fee

  // Vérifie le solde de l'envoyeur AVANT toute écriture (débit couvre montant + frais).
  const fromWallet = await getOrCreateWallet(fromUserId)
  if (fromWallet.balance < total) throw new Error('Solde insuffisant (frais de 0,25% inclus)')

  // Débit envoyeur : montant transféré
  const d = await debit(fromUserId, { amount: amt, type: 'transfer_sent',
    counterparty: toUserId, description: description || 'Transfert envoyé' })
  // Débit envoyeur : frais 0,25%
  if (fee > 0) {
    await debit(fromUserId, { amount: fee, type: 'transfer_fee', counterparty: toUserId,
      description: 'Frais de transfert (0,25%)', meta: { rate: TRANSFER_FEE_RATE, baseAmount: amt } })
  }
  // Crédit destinataire : montant transféré
  const c = await credit(toUserId, { amount: amt, type: 'transfer_received',
    counterparty: fromUserId, description: description || 'Transfert reçu' })
  // Crédit admin : frais encaissés (best-effort, ne bloque pas le transfert si admin absent)
  if (fee > 0) {
    try {
      const admin = await getPlatformAdmin()
      if (admin) {
        await credit(admin._id, { amount: fee, type: 'fee_collected', counterparty: fromUserId,
          role: 'admin', description: 'Frais de transfert encaissés (0,25%)',
          meta: { from: String(fromUserId), to: String(toUserId), baseAmount: amt } })
      }
    } catch (e) { /* frais tracés côté envoyeur même si le crédit admin échoue */ }
  }
  return { from: d.wallet, to: c.wallet, amount: amt, fee, total, debitTx: d.tx, creditTx: c.tx }
}

module.exports = {
  getOrCreateWallet, credit, debit, lock, settleLocked, unlock, transfer,
  ensureAccountNo, getPlatformAdmin, computeTransferFee, transferBetweenUsers,
  TRANSFER_FEE_RATE,
}
