// routes/wallet.js — Dashboard portefeuille : solde, dépôt, retrait, transfert salaire, code PIN
const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const { protect, authorize } = require('../middleware/auth')
const User = require('../models/User')
const Teacher = require('../models/Teacher')
const Wallet = require('../models/Wallet')
const WalletTransaction = require('../models/WalletTransaction')
const WithdrawalRequest = require('../models/WithdrawalRequest')
const PaymentIntent = require('../models/PaymentIntent')
const wallet = require('../services/walletService')
const sebpay = require('../services/sebpayService')
const { sendEmail } = require('../utils/emailService')

const SLA_HOURS = Number(process.env.WITHDRAWAL_SLA_HOURS || 24)
function genRef(p){ return p + '_' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex') }

// ───────────────────────── SOLDE & HISTORIQUE ─────────────────────────
// GET /api/wallet/me — solde + 50 dernières opérations
router.get('/me', protect, async (req, res) => {
  try {
    const w = await wallet.getOrCreateWallet(req.user._id, { role: req.user.role, school: req.user.school?._id })
    const txs = await WalletTransaction.find({ owner: req.user._id }).sort({ createdAt: -1 }).limit(50)
    const hasPin = !!(await User.findById(req.user._id).select('+walletPin').then(u => u && u.walletPin))
    res.json({ success: true, balance: w.balance, locked: w.locked, currency: w.currency,
      totalIn: w.totalIn, totalOut: w.totalOut, hasPin, transactions: txs })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ───────────────────────── DÉPÔT (directeur) ─────────────────────────
// POST /api/wallet/deposit/initiate — dépôt via Mobile Money (collecte SEBPay)
router.post('/deposit/initiate', protect, authorize('directeur'), async (req, res) => {
  try {
    const { amount, phone, operator } = req.body
    const amt = Number(amount)
    if (!amt || amt <= 0) return res.status(400).json({ message: 'Montant invalide' })
    if (!phone || !operator) return res.status(400).json({ message: 'Numéro et opérateur requis' })
    const reference = genRef('dep')
    const { mode } = await sebpay.resolveConfig()
    const intent = await PaymentIntent.create({
      reference, purpose: 'deposit', amount: amt, currency: 'XOF',
      payerPhone: phone, payerOperator: operator, initiatedBy: req.user._id,
      school: req.user.school?._id || null, mode,
    })
    const base = (process.env.SERVER_URL || '').replace(/\/$/, '')
    const result = await sebpay.createCollection({ amount: amt, phone, operator, reference, callbackUrl: base + '/api/payments/webhook' })
    if (result.transaction_id) { intent.sebpayTransactionId = result.transaction_id; await intent.save() }
    res.json({ success: true, reference, amount: amt, mode, message: 'Validez le dépôt sur votre téléphone Mobile Money.' })
  } catch (err) { res.status(err.status || 500).json({ message: err.message }) }
})

// ───────────────────────── CODE PIN ─────────────────────────
// POST /api/wallet/pin/set — créer/confirmer le code PIN (nouvelle création uniquement)
router.post('/pin/set', protect, async (req, res) => {
  try {
    const { pin, confirmPin } = req.body
    if (!pin || !/^[0-9]{4,6}$/.test(String(pin))) return res.status(400).json({ message: 'Le code PIN doit comporter 4 à 6 chiffres' })
    if (String(pin) !== String(confirmPin)) return res.status(400).json({ message: 'Les codes PIN ne correspondent pas' })
    const u = await User.findById(req.user._id).select('+walletPin')
    if (u.walletPin) return res.status(400).json({ message: 'Un code PIN existe déjà. Utilisez "PIN oublié" pour le modifier.' })
    u.walletPin = await bcrypt.hash(String(pin), 10)
    await u.save()
    res.json({ success: true, message: 'Code PIN créé avec succès' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/wallet/pin/forgot — envoie un code de réinitialisation par email
router.post('/pin/forgot', protect, async (req, res) => {
  try {
    const u = await User.findById(req.user._id).select('+pinResetCode +pinResetExpires')
    const code = ('' + Math.floor(100000 + Math.random() * 900000))
    u.pinResetCode = await bcrypt.hash(code, 10)
    u.pinResetExpires = new Date(Date.now() + 15 * 60 * 1000)
    await u.save()
    await sendEmail({ to: u.email, subject: 'Code de réinitialisation du PIN — KATD-SCHÜLE',
      html: '<div style="font-family:Arial;max-width:520px;margin:auto"><h2>Réinitialisation du code PIN</h2>' +
        '<p>Bonjour ' + (u.name || '') + ',</p><p>Voici votre code de réinitialisation (valable 15 minutes) :</p>' +
        '<div style="font-size:28px;font-weight:bold;letter-spacing:6px;background:#f3f4f6;padding:16px;text-align:center;border-radius:8px">' + code + '</div>' +
        '<p style="color:#6b7280;font-size:12px">Si vous n\'êtes pas à l\'origine de cette demande, ignorez cet email.</p></div>' })
    res.json({ success: true, message: 'Un code de réinitialisation a été envoyé à votre email.' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/wallet/pin/reset — valide le code email puis fixe le nouveau PIN
router.post('/pin/reset', protect, async (req, res) => {
  try {
    const { code, newPin, confirmPin } = req.body
    if (!newPin || !/^[0-9]{4,6}$/.test(String(newPin))) return res.status(400).json({ message: 'Le nouveau code PIN doit comporter 4 à 6 chiffres' })
    if (String(newPin) !== String(confirmPin)) return res.status(400).json({ message: 'Les codes PIN ne correspondent pas' })
    const u = await User.findById(req.user._id).select('+pinResetCode +pinResetExpires +walletPin')
    if (!u.pinResetCode || !u.pinResetExpires || u.pinResetExpires < new Date()) {
      return res.status(400).json({ message: 'Code expiré ou inexistant. Refaites une demande.' })
    }
    const ok = await bcrypt.compare(String(code || ''), u.pinResetCode)
    if (!ok) return res.status(400).json({ message: 'Code de réinitialisation invalide' })
    u.walletPin = await bcrypt.hash(String(newPin), 10)
    u.pinResetCode = null; u.pinResetExpires = null
    await u.save()
    res.json({ success: true, message: 'Code PIN modifié avec succès' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ───────────────────────── TRANSFERT SALAIRE (directeur → enseignant) ─────────────────────────
// GET /api/wallet/teachers — enseignants de l'école (pour le transfert)
router.get('/teachers', protect, authorize('directeur'), async (req, res) => {
  try {
    const teachers = await Teacher.find({ school: req.user.school?._id, status: 'active' }).populate('user', 'name email')
    const list = teachers.filter(t => t.user).map(t => ({
      id: t.user._id, name: (t.lastName + ' ' + t.firstName).trim(), email: t.email || (t.user && t.user.email) }))
    res.json({ success: true, teachers: list })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/wallet/transfer — transfert salaire (PIN requis)
router.post('/transfer', protect, authorize('directeur'), async (req, res) => {
  try {
    const { teacherUserId, amount, pin } = req.body
    const amt = Number(amount)
    if (!teacherUserId) return res.status(400).json({ message: 'Enseignant requis' })
    if (!amt || amt <= 0) return res.status(400).json({ message: 'Montant invalide' })
    if (!pin) return res.status(400).json({ message: 'Code PIN requis' })
    const u = await User.findById(req.user._id).select('+walletPin')
    if (!u.walletPin) return res.status(400).json({ message: "Veuillez d'abord créer votre code PIN" })
    const pinOk = await bcrypt.compare(String(pin), u.walletPin)
    if (!pinOk) return res.status(401).json({ message: 'Code PIN incorrect' })
    // L'enseignant doit appartenir à l'école du directeur
    const teacher = await Teacher.findOne({ user: teacherUserId, school: req.user.school?._id })
    if (!teacher) return res.status(404).json({ message: "Enseignant introuvable dans votre école" })
    const r = await wallet.transfer(req.user._id, teacherUserId, {
      amount: amt, description: 'Salaire — ' + (teacher.lastName + ' ' + teacher.firstName).trim(),
      meta: { schoolId: String(req.user.school?._id || '') } })
    // notifie l'enseignant
    try {
      const tUser = await User.findById(teacherUserId)
      if (tUser?.email) await sendEmail({ to: tUser.email, subject: 'Salaire reçu — KATD-SCHÜLE',
        html: '<p>Bonjour ' + (tUser.name||'') + ', vous avez reçu un salaire de <b>' + amt.toLocaleString('fr-FR') + ' FCFA</b> sur votre portefeuille KATD-SCHÜLE.</p>' })
    } catch (e) {}
    res.json({ success: true, message: 'Transfert effectué', balance: r.from.balance })
  } catch (err) { res.status(400).json({ message: err.message }) }
})

// ───────────────────────── RETRAIT (file 24h) ─────────────────────────
// POST /api/wallet/withdraw — demande de retrait (directeur: PIN requis)
router.post('/withdraw', protect, async (req, res) => {
  try {
    const { amount, momoNumber, momoOperator, pin } = req.body
    const amt = Number(amount)
    if (!amt || amt <= 0) return res.status(400).json({ message: 'Montant invalide' })
    if (!momoNumber) return res.status(400).json({ message: 'Numéro Mobile Money requis' })
    // Directeur: exige le PIN
    if (req.user.role === 'directeur') {
      const u = await User.findById(req.user._id).select('+walletPin')
      if (!u.walletPin) return res.status(400).json({ message: "Veuillez d'abord créer votre code PIN" })
      const pinOk = await bcrypt.compare(String(pin || ''), u.walletPin)
      if (!pinOk) return res.status(401).json({ message: 'Code PIN incorrect' })
    }
    const w = await wallet.getOrCreateWallet(req.user._id, { role: req.user.role, school: req.user.school?._id })
    if (w.balance < amt) return res.status(400).json({ message: 'Solde insuffisant' })
    // bloque le montant
    await wallet.lock(req.user._id, amt)
    const wr = await WithdrawalRequest.create({
      user: req.user._id, wallet: w._id, role: req.user.role, school: req.user.school?._id || null,
      amount: amt, momoNumber, momoOperator: momoOperator || '', accountName: req.user.name,
      status: 'pending', dueAt: new Date(Date.now() + SLA_HOURS * 3600 * 1000),
    })
    // ledger: débit (sortie effective côté solde déjà bloquée)
    await WalletTransaction.create({ wallet: w._id, owner: req.user._id, direction: 'debit',
      amount: amt, currency: w.currency, type: 'withdrawal', balanceAfter: w.balance,
      withdrawal: wr._id, description: 'Demande de retrait (traitement < ' + SLA_HOURS + 'h)' })
    try { await sendEmail({ to: req.user.email, subject: 'Demande de retrait reçue — KATD-SCHÜLE',
      html: '<p>Votre demande de retrait de <b>' + amt.toLocaleString('fr-FR') + ' FCFA</b> a été enregistrée. ' +
      'Vous recevrez le montant sur ' + momoNumber + ' sous ' + SLA_HOURS + ' heures.</p>' }) } catch(e){}
    res.json({ success: true, message: 'Demande de retrait enregistrée. Traitement sous ' + SLA_HOURS + 'h.', withdrawal: wr })
  } catch (err) { res.status(400).json({ message: err.message }) }
})

// GET /api/wallet/withdrawals — mes demandes de retrait
router.get('/withdrawals', protect, async (req, res) => {
  try {
    const list = await WithdrawalRequest.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50)
    res.json({ success: true, withdrawals: list })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
