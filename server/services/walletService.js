// services/walletService.js — Opérations atomiques sur les portefeuilles + grand livre
const crypto = require('crypto')
const Wallet = require('../models/Wallet')
const WalletTransaction = require('../models/WalletTransaction')
const User = require('../models/User')

// Frais de transfert entre utilisateurs : 0,25% du montant, payés EN PLUS par l'envoyeur.
const TRANSFER_FEE_RATE = 0.0025
// Frais de retrait vers un opérateur externe : 2% du montant, DÉDUITS du montant reçu.
const WITHDRAWAL_FEE_RATE = 0.02
// Commission marchand : 0,20% du montant, bonus virtuel crédité au marchand (envoyeur) sur ses transferts.
const MERCHANT_COMMISSION_RATE = 0.002
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'valdeslando15@gmail.com').toLowerCase()

// Types de crédit « argent reçu d'un particulier » : la TOUTE PREMIÈRE somme reçue
// (transfert, salaire, pension, inscription) règle l'arriéré de frais de maintenance
// du bénéficiaire, exactement comme un dépôt qu'il fait lui-même sur son compte.
const MAINTENANCE_ON_CREDIT_TYPES = new Set(['transfer_received', 'salary_received', 'pension_received', 'enrollment'])

async function getOrCreateWallet(userId, { role = 'autre', school = null } = {}) {
  let wallet = await Wallet.findOne({ owner: userId })
  if (!wallet) {
    wallet = await Wallet.create({ owner: userId, role, school, currency: 'XOF' })
  }
  return wallet
}

// Génère (une fois) le numéro de compte KS###### (KS + 6 chiffres) d'un utilisateur,
// avec garantie d'unicité. Ex. KS930021.
async function ensureAccountNo(userId) {
  const u = await User.findById(userId).select('walletAccountNo name email role')
  if (!u) throw new Error('Utilisateur introuvable')
  if (u.walletAccountNo) return u.walletAccountNo
  for (let i = 0; i < 12; i++) {
    const n = crypto.randomInt(0, 1000000) // 0..999999
    const candidate = 'KS' + String(n).padStart(6, '0') // KS + 6 chiffres
    const exists = await User.exists({ walletAccountNo: candidate })
    if (!exists) {
      u.walletAccountNo = candidate
      await u.save()
      return candidate
    }
  }
  throw new Error("Impossible de générer un numéro de compte, réessayez")
}

// Génère (une fois) le code de parrainage court d'un utilisateur (ex. KATD7F3K9), unique.
// Exposé dans l'espace /u pour partager le lien ...?ref=CODE.
async function ensureReferralCode(userId) {
  const u = await User.findById(userId).select('referralCode name')
  if (!u) throw new Error('Utilisateur introuvable')
  if (u.referralCode) return u.referralCode
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sans I,O,0,1 ambigus
  for (let i = 0; i < 12; i++) {
    let suffix = ''
    for (let k = 0; k < 5; k++) suffix += ALPHABET[crypto.randomInt(0, ALPHABET.length)]
    const candidate = 'KATD' + suffix
    const exists = await User.exists({ referralCode: candidate })
    if (!exists) {
      u.referralCode = candidate
      await u.save()
      return candidate
    }
  }
  throw new Error('Impossible de générer un code de parrainage, réessayez')
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
  // Frais de maintenance : la première somme reçue d'un particulier (transfert, salaire,
  // pension, inscription) règle l'arriéré, exactement comme un dépôt fait par soi-même.
  // Best-effort + require paresseux (scheduler dépend déjà de ce service).
  if (MAINTENANCE_ON_CREDIT_TYPES.has(type)) {
    try {
      const { applyMaintenanceOnDeposit } = require('../jobs/scheduler')
      await applyMaintenanceOnDeposit(userId)
    } catch (e) { console.error('[maintenance:onCredit] ' + userId + ' :', e.message) }
  }
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

// Calcule les frais de retrait (2%, arrondi à l'entier) — DÉDUITS du montant reçu.
function computeWithdrawalFee(amount) {
  const amt = Number(amount)
  if (!amt || amt <= 0) return 0
  return Math.round(amt * WITHDRAWAL_FEE_RATE)
}

// Calcule la commission marchand (0,20%, arrondi à l'entier) — bonus virtuel au marchand.
function computeMerchantCommission(amount) {
  const amt = Number(amount)
  if (!amt || amt <= 0) return 0
  return Math.round(amt * MERCHANT_COMMISSION_RATE)
}

// Crédite l'admin plateforme des frais encaissés (best-effort : ne bloque pas l'opération
// si l'admin est introuvable ou si le crédit échoue). meta.feeType = 'transfer' | 'withdrawal'.
async function collectFee({ fee, fromUserId, description, meta = {} }) {
  const f = Number(fee)
  if (!f || f <= 0) return
  try {
    const admin = await getPlatformAdmin()
    if (admin) {
      await credit(admin._id, { amount: f, type: 'fee_collected', counterparty: fromUserId,
        role: 'admin', description, meta })
    }
  } catch (e) { /* frais tracés côté payeur même si le crédit admin échoue */ }
}

// Crédite une commission marchand de 0,20% (bonus virtuel) à CHAQUE compte marchand actif,
// sur n'importe quel transfert de la plateforme (y compris ceux du super admin).
// Best-effort : n'interrompt jamais le transfert. Retourne la commission unitaire versée.
async function creditMerchantsCommission(amt, { fromUserId, toUserId, fromLabel, toLabel }) {
  const commission = computeMerchantCommission(amt)
  if (commission <= 0) return 0
  try {
    const merchants = await User.find({ isMerchant: true, isActive: { $ne: false } }).select('_id name role school')
    for (const m of merchants) {
      try {
        // Le libellé précise s'il s'agit de son propre transfert ou d'un transfert tiers.
        const own = String(m._id) === String(fromUserId)
        await credit(m._id, {
          amount: commission, type: 'merchant_commission',
          counterparty: own ? toUserId : fromUserId, role: m.role, school: m.school || null,
          description: own
            ? 'Commission marchand (0,20%) — transfert vers ' + toLabel
            : 'Commission marchand (0,20%) — transfert ' + fromLabel + ' → ' + toLabel,
          meta: { rate: MERCHANT_COMMISSION_RATE, baseAmount: amt, from: String(fromUserId), to: String(toUserId), own },
        })
      } catch (e) { /* commission best-effort par marchand */ }
    }
  } catch (e) { /* pas de marchand / erreur : transfert déjà effectué */ }
  return commission
}

// Transfert entre deux utilisateurs quelconques.
// - Utilisateur normal : frais 0,25% payés EN PLUS par l'envoyeur, encaissés par l'admin.
// - Marchand (envoyeur) : EXONÉRÉ des 0,25%.
// - TOUS les comptes marchands actifs reçoivent 0,20% de commission (bonus virtuel) sur CE transfert,
//   qu'ils en soient l'auteur ou non (commission sur toutes les transactions de la plateforme).
// Dans tous les cas le destinataire reçoit le montant plein.
async function transferBetweenUsers(fromUserId, toUserId, { amount, description = '' }) {
  const amt = Number(amount)
  if (!amt || amt <= 0) throw new Error('Montant de transfert invalide')
  if (String(fromUserId) === String(toUserId)) throw new Error('Impossible de transférer vers votre propre compte')

  // Noms/comptes + statut marchand pour libellés + tarification (chantiers 4 & marchands).
  const [fromU, toU] = await Promise.all([
    User.findById(fromUserId).select('name walletAccountNo isMerchant'),
    User.findById(toUserId).select('name walletAccountNo'),
  ])
  const fromLabel = (fromU?.name || 'Utilisateur') + (fromU?.walletAccountNo ? ' (' + fromU.walletAccountNo + ')' : '')
  const toLabel = (toU?.name || 'Utilisateur') + (toU?.walletAccountNo ? ' (' + toU.walletAccountNo + ')' : '')

  const isMerchant = !!fromU?.isMerchant
  const fee = isMerchant ? 0 : computeTransferFee(amt) // marchand exonéré des 0,25%
  const total = amt + fee

  // Vérifie le solde de l'envoyeur AVANT toute écriture (débit couvre montant + frais).
  const fromWallet = await getOrCreateWallet(fromUserId)
  if (fromWallet.balance < total) throw new Error(isMerchant ? 'Solde insuffisant' : 'Solde insuffisant (frais de 0,25% inclus)')

  // Débit envoyeur : montant transféré (libellé nominatif : vers qui)
  const d = await debit(fromUserId, { amount: amt, type: 'transfer_sent',
    counterparty: toUserId, description: 'Envoyé à ' + toLabel })
  // Débit envoyeur : frais 0,25% (utilisateur normal uniquement)
  if (fee > 0) {
    await debit(fromUserId, { amount: fee, type: 'transfer_fee', counterparty: toUserId,
      description: 'Frais de transfert (0,25%)', meta: { rate: TRANSFER_FEE_RATE, baseAmount: amt } })
  }
  // Crédit destinataire : montant transféré (libellé nominatif : de qui)
  const c = await credit(toUserId, { amount: amt, type: 'transfer_received',
    counterparty: fromUserId, description: 'Reçu de ' + fromLabel })
  // Crédit admin : frais encaissés (best-effort, ne bloque pas le transfert si admin absent)
  await collectFee({ fee, fromUserId,
    description: 'Frais de transfert encaissés (0,25%) — ' + fromLabel,
    meta: { feeType: 'transfer', rate: TRANSFER_FEE_RATE, baseAmount: amt, from: String(fromUserId), to: String(toUserId) } })
  // Commission marchand : 0,20% (bonus virtuel) versé à CHAQUE marchand actif de la plateforme.
  const commission = await creditMerchantsCommission(amt, { fromUserId, toUserId, fromLabel, toLabel })
  const fromWalletAfter = await getOrCreateWallet(fromUserId)
  return { from: fromWalletAfter, to: c.wallet, amount: amt, fee, commission, total, debitTx: d.tx, creditTx: c.tx }
}

module.exports = {
  getOrCreateWallet, credit, debit, lock, settleLocked, unlock, transfer,
  ensureAccountNo, ensureReferralCode, getPlatformAdmin, computeTransferFee, transferBetweenUsers,
  computeWithdrawalFee, collectFee, computeMerchantCommission,
  TRANSFER_FEE_RATE, WITHDRAWAL_FEE_RATE, MERCHANT_COMMISSION_RATE,
}
