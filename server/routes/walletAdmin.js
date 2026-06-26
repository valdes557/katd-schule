// routes/walletAdmin.js — Admin: traitement des retraits + clés API SEBPay sécurisées
const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const { protect } = require('../middleware/auth')
const User = require('../models/User')
const WithdrawalRequest = require('../models/WithdrawalRequest')
const SebpayConfig = require('../models/SebpayConfig')
const wallet = require('../services/walletService')
const { encrypt, decrypt, mask } = require('../utils/crypto')
const { sendEmail } = require('../utils/emailService')

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'valdeslando15@gmail.com').toLowerCase()

// Garde : super-admin global OU email admin configuré
function isAdmin(u){ return u && (u.role === 'super_admin' || u.role === 'admin' || (u.email||'').toLowerCase() === ADMIN_EMAIL) }
function adminOnly(req, res, next){ if(!isAdmin(req.user)) return res.status(403).json({ message: 'Accès réservé à l\'administrateur' }); next() }
// Garde stricte : uniquement l'email super-admin (clés API)
function superAdminOnly(req, res, next){ if((req.user.email||'').toLowerCase() !== ADMIN_EMAIL) return res.status(403).json({ message: 'Action réservée au super-administrateur' }); next() }

// ───────────────────── RETRAITS (file 24h) ─────────────────────
// GET /api/admin/withdrawals?status=pending
router.get('/withdrawals', protect, adminOnly, async (req, res) => {
  try {
    const filter = {}
    if (req.query.status) filter.status = req.query.status
    const list = await WithdrawalRequest.find(filter).sort({ createdAt: 1 }).populate('user', 'name email role').limit(200)
    res.json({ success: true, withdrawals: list })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/admin/withdrawals/:id/pay — marquer comme payé (settle locked)
router.put('/withdrawals/:id/pay', protect, adminOnly, async (req, res) => {
  try {
    const wr = await WithdrawalRequest.findById(req.params.id)
    if (!wr) return res.status(404).json({ message: 'Demande introuvable' })
    if (wr.status === 'paid') return res.json({ success: true, message: 'Déjà payé' })
    if (wr.status === 'rejected') return res.status(400).json({ message: 'Demande déjà rejetée' })
    await wallet.settleLocked(wr.user, wr.amount)
    wr.status = 'paid'; wr.processedBy = req.user._id; wr.processedAt = new Date()
    wr.adminNote = req.body.note || ''
    await wr.save()
    try { const u = await User.findById(wr.user); if(u?.email) await sendEmail({ to: u.email,
      subject: 'Retrait effectué — KATD-SCHÜLE',
      html: '<p>Votre retrait de <b>' + wr.amount.toLocaleString('fr-FR') + ' FCFA</b> a été envoyé sur ' + wr.momoNumber + '.</p>' }) } catch(e){}
    res.json({ success: true, message: 'Retrait marqué comme payé' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/admin/withdrawals/:id/reject — rejeter (rembourse le portefeuille)
router.put('/withdrawals/:id/reject', protect, adminOnly, async (req, res) => {
  try {
    const wr = await WithdrawalRequest.findById(req.params.id)
    if (!wr) return res.status(404).json({ message: 'Demande introuvable' })
    if (wr.status === 'paid') return res.status(400).json({ message: 'Demande déjà payée' })
    if (wr.status === 'rejected') return res.json({ success: true, message: 'Déjà rejeté' })
    await wallet.unlock(wr.user, wr.amount)
    const WalletTransaction = require('../models/WalletTransaction')
    const w = await wallet.getOrCreateWallet(wr.user)
    await WalletTransaction.create({ wallet: w._id, owner: wr.user, direction: 'credit',
      amount: wr.amount, currency: wr.currency, type: 'withdrawal_refund', balanceAfter: w.balance,
      withdrawal: wr._id, description: 'Remboursement retrait rejeté' })
    wr.status = 'rejected'; wr.processedBy = req.user._id; wr.processedAt = new Date()
    wr.rejectionReason = req.body.reason || ''
    await wr.save()
    try { const u = await User.findById(wr.user); if(u?.email) await sendEmail({ to: u.email,
      subject: 'Retrait rejeté — KATD-SCHÜLE',
      html: '<p>Votre demande de retrait de <b>' + wr.amount.toLocaleString('fr-FR') + ' FCFA</b> a été rejetée et le montant recrédité sur votre portefeuille.' + (wr.rejectionReason ? ' Motif : ' + wr.rejectionReason : '') + '</p>' }) } catch(e){}
    res.json({ success: true, message: 'Demande rejetée et montant remboursé' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ───────────────────── CLÉS API SEBPAY (sécurisées) ─────────────────────
// GET /api/admin/sebpay — état (clés masquées, jamais en clair)
router.get('/sebpay', protect, superAdminOnly, async (req, res) => {
  try {
    const cfg = await SebpayConfig.findOne({ singleton: 'sebpay' })
    if (!cfg) return res.json({ success: true, mode: process.env.SEBPAY_MODE || 'test', configured: false,
      keys: { publicKeyTest: '', secretKeyTest: '', publicKeyLive: '', secretKeyLive: '' } })
    res.json({ success: true, mode: cfg.mode, configured: true, keys: {
      publicKeyTest: mask(decrypt(cfg.publicKeyTest)), secretKeyTest: mask(decrypt(cfg.secretKeyTest)),
      publicKeyLive: mask(decrypt(cfg.publicKeyLive)), secretKeyLive: mask(decrypt(cfg.secretKeyLive)) } })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/admin/sebpay/request-code — envoie un PIN à l'email admin pour déverrouiller
router.post('/sebpay/request-code', protect, superAdminOnly, async (req, res) => {
  try {
    const u = await User.findById(req.user._id).select('+pinResetCode +pinResetExpires')
    const code = ('' + Math.floor(100000 + Math.random() * 900000))
    u.pinResetCode = await bcrypt.hash('sebpay:' + code, 10)
    u.pinResetExpires = new Date(Date.now() + 10 * 60 * 1000)
    await u.save()
    await sendEmail({ to: ADMIN_EMAIL, subject: 'Code de déverrouillage des clés API — KATD-SCHÜLE',
      html: '<div style="font-family:Arial;max-width:520px;margin:auto"><h2>Déverrouillage des clés API SEBPay</h2>' +
        '<p>Code valable 10 minutes :</p><div style="font-size:28px;font-weight:bold;letter-spacing:6px;background:#f3f4f6;padding:16px;text-align:center;border-radius:8px">' + code + '</div></div>' })
    res.json({ success: true, message: 'Code envoyé à l\'email administrateur' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// Vérifie le code de déverrouillage (sans le consommer si reveal)
async function verifyUnlock(userId, code){
  const u = await User.findById(userId).select('+pinResetCode +pinResetExpires')
  if (!u.pinResetCode || !u.pinResetExpires || u.pinResetExpires < new Date()) return false
  return await bcrypt.compare('sebpay:' + String(code||''), u.pinResetCode)
}

// POST /api/admin/sebpay/reveal — révèle les clés en clair (exige le code email)
router.post('/sebpay/reveal', protect, superAdminOnly, async (req, res) => {
  try {
    if (!(await verifyUnlock(req.user._id, req.body.code))) return res.status(401).json({ message: 'Code invalide ou expiré' })
    const cfg = await SebpayConfig.findOne({ singleton: 'sebpay' })
    if (!cfg) return res.json({ success: true, keys: {} })
    res.json({ success: true, keys: {
      publicKeyTest: decrypt(cfg.publicKeyTest), secretKeyTest: decrypt(cfg.secretKeyTest),
      publicKeyLive: decrypt(cfg.publicKeyLive), secretKeyLive: decrypt(cfg.secretKeyLive) } })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/admin/sebpay — modifie les clés (exige le code email)
router.put('/sebpay', protect, superAdminOnly, async (req, res) => {
  try {
    if (!(await verifyUnlock(req.user._id, req.body.code))) return res.status(401).json({ message: 'Code invalide ou expiré' })
    const { mode, publicKeyTest, secretKeyTest, publicKeyLive, secretKeyLive } = req.body
    let cfg = await SebpayConfig.findOne({ singleton: 'sebpay' })
    if (!cfg) cfg = new SebpayConfig({ singleton: 'sebpay' })
    if (mode) cfg.mode = mode
    if (publicKeyTest !== undefined && publicKeyTest !== '') cfg.publicKeyTest = encrypt(publicKeyTest)
    if (secretKeyTest !== undefined && secretKeyTest !== '') cfg.secretKeyTest = encrypt(secretKeyTest)
    if (publicKeyLive !== undefined && publicKeyLive !== '') cfg.publicKeyLive = encrypt(publicKeyLive)
    if (secretKeyLive !== undefined && secretKeyLive !== '') cfg.secretKeyLive = encrypt(secretKeyLive)
    cfg.updatedBy = req.user._id
    await cfg.save()
    // consomme le code après modification
    const u = await User.findById(req.user._id).select('+pinResetCode +pinResetExpires')
    u.pinResetCode = null; u.pinResetExpires = null; await u.save()
    res.json({ success: true, message: 'Clés API mises à jour' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
