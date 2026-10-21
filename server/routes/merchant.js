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

// POST /api/merchant/initiate — paie les 6933 F via Mobile Money (collecte Ikeepay H2H)
router.post('/initiate', protect, async (req, res) => {
  try {
    const { phone, operator, country = 'CM', otp } = req.body
    const u = await User.findById(req.user._id).select('isMerchant email')
    if (u?.isMerchant) return res.status(400).json({ message: 'Vous êtes déjà marchand.' })
    const rawPhone = String(phone || '').replace(/[^0-9]/g, '')
    if (!rawPhone || !operator) {
      return res.status(400).json({ message: 'Numéro de téléphone et opérateur Mobile Money requis pour le débit direct.' })
    }

    const reference = genRef('mch')
    const { mode } = await ikeepay.resolveConfig()
    const normCountry = String(country || 'CM').trim().toUpperCase()
    const targetCurrency = ikeepay.getCountryCurrency ? ikeepay.getCountryCurrency(normCountry) : (normCountry === 'CM' ? 'XAF' : 'XOF')

    const intent = await PaymentIntent.create({
      reference, purpose: 'merchant', amount: MERCHANT_FEE, currency: targetCurrency,
      payerPhone: rawPhone, payerOperator: operator, initiatedBy: req.user._id,
      school: req.user.school?._id || null, mode,
    })
    const base = (process.env.SERVER_URL || '').replace(/\/$/, '')
    const result = await ikeepay.createCollection({
      amount: MERCHANT_FEE, phone: rawPhone, operator, reference,
      callbackUrl: base + '/api/payments/webhook', country: normCountry,
      currency: targetCurrency, customerEmail: u?.email || '', otp
    })
    if (result.transaction_id || result.id) { intent.providerTransactionId = result.transaction_id || result.id; await intent.save() }
    const paymentLink = result.payment_link || result.redirect_url || (result.data && (result.data.payment_link || result.data.redirect_url)) || null
    res.json({
      success: true, reference, amount: MERCHANT_FEE, mode, currency: targetCurrency,
      payment_link: paymentLink, message: 'Validez le paiement sur votre téléphone Mobile Money.'
    })
  } catch (err) { res.status(err.status || 500).json({ message: err.message }) }
})


const CollectClient = require('../models/CollectClient')
const DailyCollection = require('../models/DailyCollection')

// GET /api/merchant/collect-client-lookup?accountNumber=CL-XXXXXX
router.get('/collect-client-lookup', protect, async (req, res) => {
  try {
    const acc = String(req.query.accountNumber || '').trim().toUpperCase()
    if (!acc) return res.status(400).json({ message: 'Numéro de compte client requis' })
    const client = await CollectClient.findOne({ accountNumber: acc, status: 'active' }).populate('agent')
    if (!client) {
      return res.status(404).json({ message: 'Aucun compte client de collecte trouvé avec ce numéro.' })
    }
    res.json({
      success: true,
      client: {
        _id: client._id,
        accountNumber: client.accountNumber,
        fullName: client.fullName,
        neighborhood: client.neighborhood,
        phone: client.phone,
        agencyName: client.agent?.agencyName || '',
      },
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/merchant/transfer-to-collect-client — Transfert depuis le solde marchand vers le compte d'un client collecte
router.post('/transfer-to-collect-client', protect, async (req, res) => {
  try {
    const u = await User.findById(req.user._id).select('isMerchant name phone role')
    if (!u?.isMerchant && u?.role !== 'super_admin') {
      return res.status(403).json({ message: 'Action réservée aux comptes marchands actifs.' })
    }

    const { accountNumber, amount, notes } = req.body
    const amt = Number(amount)
    if (!amt || amt <= 0) {
      return res.status(400).json({ message: 'Montant de transfert invalide (doit être supérieur à 0).' })
    }

    const acc = String(accountNumber || '').trim().toUpperCase()
    if (!acc) {
      return res.status(400).json({ message: 'Numéro de compte client requis.' })
    }

    const client = await CollectClient.findOne({ accountNumber: acc, status: 'active' })
    if (!client) {
      return res.status(404).json({ message: 'Compte client de collecte introuvable ou inactif.' })
    }

    // Vérifie le solde du portefeuille marchand
    const w = await wallet.getOrCreateWallet(req.user._id, { role: req.user.role, school: req.user.school?._id })
    if (w.balance < amt) {
      return res.status(400).json({
        message: 'Solde insuffisant sur votre compte marchand (' + w.balance.toLocaleString('fr-FR') + ' FCFA disponibles).',
      })
    }

    // Débit du compte marchand
    await wallet.debit(req.user._id, {
      amount: amt,
      type: 'transfer_sent',
      description: 'Transfert marchand vers compte collecte : ' + client.fullName + ' (' + client.accountNumber + ')',
      meta: {
        reason: 'merchant_transfer_to_collect_client',
        clientId: String(client._id),
        clientAccountNumber: client.accountNumber,
        notes: notes || '',
      },
    })

    // Crédit du solde de collecte du client
    client.balance += amt
    await client.save()

    // Enregistrement dans DailyCollection
    const today = new Date().toISOString().slice(0, 10)
    await DailyCollection.create({
      agent: client.agent,
      agentUser: client.agentUser,
      client: client._id,
      clientName: client.fullName,
      clientPhone: client.phone,
      neighborhood: client.neighborhood,
      date: today,
      amount: amt,
      type: 'depot',
      status: 'paye',
      paymentMethod: 'wallet',
      notes: 'Transfert reçu du marchand ' + (u.name || 'Marchand') + (notes ? ' (' + notes + ')' : ''),
      datetime: new Date(),
    })

    res.json({
      success: true,
      message: 'Transfert de ' + amt.toLocaleString('fr-FR') + ' FCFA vers le compte de ' + client.fullName + ' (' + client.accountNumber + ') effectué avec succès !',
      client: {
        _id: client._id,
        accountNumber: client.accountNumber,
        fullName: client.fullName,
        newBalance: client.balance,
      },
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
