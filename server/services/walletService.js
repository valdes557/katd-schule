// services/walletService.js — Opérations atomiques sur les portefeuilles + grand livre
const Wallet = require('../models/Wallet')
const WalletTransaction = require('../models/WalletTransaction')

async function getOrCreateWallet(userId, { role = 'autre', school = null } = {}) {
  let wallet = await Wallet.findOne({ owner: userId })
  if (!wallet) {
    wallet = await Wallet.create({ owner: userId, role, school, currency: 'XOF' })
  }
  return wallet
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

module.exports = { getOrCreateWallet, credit, debit, lock, settleLocked, unlock, transfer }
