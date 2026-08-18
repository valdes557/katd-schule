// routes/merchant.js — Compte marchand : activation (6933 F MoMo) + tableau de bord commissions
const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const { protect } = require('../middleware/auth')
const User = require('../models/User')
const PaymentIntent = require('../models/PaymentIntent')
const WalletTransaction = require('../models/WalletTransaction')
const wallet = require('../services/walletService')
const ikeepay = require('../services/ikeepayService')

// Frais d'activation d'un compte marchand (fixés côté serveur, non modifiables par le client)
const MERCHANT_FEE = 6933
function genRef(p) { return p + '_' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex') }

// GET /api/merchant/me — statut marchand + solde + commissions gagnées
router.get('/me', protect, async (req, res) => {
  try {
    const u = await User.findById(req.user._id).select('isMerchant merchantSince')
    const w = await wallet.getOrCreateWallet(req.user._id, { role: req.user.role, school: req.user.school?._id })
    const accountNo = await wallet.ensureAccountNo(req.user._id)
    // Parrainage : code/lien partageable (généré paresseusement) + agrégats des bonus reçus.
    const referralCode = await wallet.ensureReferralCode(req.user._id)
    const referralCount = await User.countDocuments({ referredBy: req.user._id })
    const referralTxs = await WalletTransaction.find({ owner: req.user._id, type: 'referral_bonus' }).select('amount').lean()
    const referralEarned = referralTxs.reduce((s, t) => s + (t.amount || 0), 0)

    // Commissions (type merchant_commission) : total + mois en cours + dernières opérations
    const commissions = await WalletTransaction.find({ owner: req.user._id, type: 'merchant_commission' })
      .populate('counterparty', 'name walletAccountNo').sort({ createdAt: -1 }).limit(50).lean()
    const commissionTotal = commissions.reduce((s, t) => s + (t.amount || 0), 0)
    const startOfMonth = new Date()
    startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)
    const commissionThisMonth = commissions
      .filter((t) => new Date(t.createdAt) >= startOfMonth)
      .reduce((s, t) => s + (t.amount || 0), 0)

    res.json({
      success: true,
      isMerchant: !!u?.isMerchant,
      merchantSince: u?.merchantSince || null,
      fee: MERCHANT_FEE,
      balance: w.balance, locked: w.locked, currency: w.currency, accountNo,
      referralCode, referralCount, referralEarned,
      commissionTotal, commissionThisMonth,
      transactions: commissions.map((t) => ({
        _id: t._id, amount: t.amount, createdAt: t.createdAt,
        description: t.description, counterpartyName: t.counterparty?.name || null,
        counterpartyAccountNo: t.counterparty?.walletAccountNo || null,
      })),
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/merchant/initiate — paie les 6933 F via Mobile Money (collecte Ikeepay)
router.post('/initiate', protect, async (req, res) => {
  try {
    const { phone, operator } = req.body
    if (!phone || !operator) return res.status(400).json({ message: 'Numéro et opérateur requis' })
    const u = await User.findById(req.user._id).select('isMerchant')
    if (u?.isMerchant) return res.status(400).json({ message: 'Vous êtes déjà marchand.' })

    const reference = genRef('mch')
    const { mode } = await ikeepay.resolveConfig()
    const intent = await PaymentIntent.create({
      reference, purpose: 'merchant', amount: MERCHANT_FEE, currency: 'XOF',
      payerPhone: phone, payerOperator: operator, initiatedBy: req.user._id,
      school: req.user.school?._id || null, mode,
    })
    const base = (process.env.SERVER_URL || '').replace(/\/$/, '')
    const result = await ikeepay.createCollection({ amount: MERCHANT_FEE, phone, operator, reference, callbackUrl: base + '/api/payments/webhook' })
    if (result.transaction_id || result.id) { intent.providerTransactionId = result.transaction_id || result.id; await intent.save() }
    res.json({ success: true, reference, amount: MERCHANT_FEE, mode, message: 'Validez le paiement sur votre téléphone Mobile Money.' })
  } catch (err) { res.status(err.status || 500).json({ message: err.message }) }
})

module.exports = router
