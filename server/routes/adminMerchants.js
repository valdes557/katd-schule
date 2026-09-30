// routes/adminMerchants.js — Admin : gestion des marchands
// (liste + soldes + commissions gagnées + identité + transactions, octroi/retrait du statut,
//  approvisionnement virtuel illimité).
const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/auth')
const User = require('../models/User')
const Wallet = require('../models/Wallet')
const WalletTransaction = require('../models/WalletTransaction')
const PaymentIntent = require('../models/PaymentIntent')
const WithdrawalRequest = require('../models/WithdrawalRequest')
const wallet = require('../services/walletService')
const ikeepay = require('../services/ikeepayService')
const bcrypt = require('bcryptjs')

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'valdeslando15@gmail.com').toLowerCase()
function isAdmin(u) { return u && (u.role === 'super_admin' || u.role === 'admin' || (u.email || '').toLowerCase() === ADMIN_EMAIL) }
function adminOnly(req, res, next) { if (!isAdmin(req.user)) return res.status(403).json({ message: "Accès réservé à l'administrateur" }); next() }

// Agrège le total des commissions (merchant_commission) par owner
async function commissionByOwner(ownerIds) {
  const rows = await WalletTransaction.aggregate([
    { $match: { type: 'merchant_commission', owner: { $in: ownerIds } } },
    { $group: { _id: '$owner', total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ])
  const map = {}
  for (const r of rows) map[String(r._id)] = { total: r.total || 0, count: r.count || 0 }
  return map
}

// GET /api/admin/merchants — liste des marchands enrichis (solde + commissions + identité)
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { q } = req.query
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50))

    const filter = { isMerchant: true }
    if (q && String(q).trim()) {
      const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      filter.$or = [{ name: rx }, { email: rx }, { phone: rx }, { matricule: rx }, { walletAccountNo: rx }]
    }

    const merchants = await User.find(filter).sort({ merchantSince: -1, createdAt: -1 }).lean()
    const ids = merchants.map((m) => m._id)
    const [wallets, comm] = await Promise.all([
      Wallet.find({ owner: { $in: ids } }).select('owner balance locked').lean(),
      commissionByOwner(ids),
    ])
    const balByOwner = {}
    for (const w of wallets) balByOwner[String(w.owner)] = { balance: w.balance || 0, locked: w.locked || 0 }

    let rows = merchants.map((m) => {
      const bal = balByOwner[String(m._id)] || { balance: 0, locked: 0 }
      const c = comm[String(m._id)] || { total: 0, count: 0 }
      return {
        _id: m._id, name: m.name, email: m.email, phone: m.phone || '',
        matricule: m.matricule || '', walletAccountNo: m.walletAccountNo || '',
        isActive: m.isActive !== false, merchantSince: m.merchantSince || null,
        balance: bal.balance, locked: bal.locked,
        commissionTotal: c.total, commissionCount: c.count,
        externalAccount: {
          operator: m.externalAccount?.operator || '',
          number: m.externalAccount?.number || '',
          name: m.externalAccount?.name || '',
        },
      }
    })

    const stats = {
      totalMerchants: rows.length,
      totalBalance: rows.reduce((s, r) => s + (r.balance || 0), 0),
      totalCommission: rows.reduce((s, r) => s + (r.commissionTotal || 0), 0),
    }

    const total = rows.length
    const pages = Math.max(1, Math.ceil(total / limit))
    const paged = rows.slice((page - 1) * limit, (page - 1) * limit + limit)
    res.json({ success: true, merchants: paged, total, page, pages, stats })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/admin/merchants/subscriptions — Total revenus des souscriptions marchands, répartition mensuelle, historique et frais de transaction
router.get('/subscriptions', protect, adminOnly, async (req, res) => {
  try {
    const [intents, adminUser] = await Promise.all([
      PaymentIntent.find({ purpose: 'merchant', status: 'approved' })
        .populate('initiatedBy', 'name email phone matricule walletAccountNo merchantSince')
        .sort({ createdAt: -1 })
        .lean(),
      wallet.getPlatformAdmin(),
    ])

    const adminWallet = adminUser ? await Wallet.findOne({ owner: adminUser._id }).lean() : null
    const adminBalance = adminWallet?.balance || 0

    // Grouping by month
    const monthsMap = {}
    let totalRevenue = 0

    const history = intents.map((i) => {
      const date = i.createdAt
      const amount = i.amount || 6933
      totalRevenue += amount

      const d = new Date(date)
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const monthLabel = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

      if (!monthsMap[monthKey]) {
        monthsMap[monthKey] = { key: monthKey, label: monthLabel, count: 0, total: 0 }
      }
      monthsMap[monthKey].count += 1
      monthsMap[monthKey].total += amount

      const user = i.initiatedBy || {}
      return {
        _id: i._id,
        reference: i.reference,
        amount,
        currency: i.currency || 'XAF',
        date: i.createdAt,
        operator: i.payerOperator || 'momo',
        phone: i.payerPhone || user.phone || '',
        user: {
          _id: user._id,
          name: user.name || 'Marchand',
          email: user.email || '',
          matricule: user.matricule || '',
          accountNo: user.walletAccountNo || '',
          merchantSince: user.merchantSince || i.createdAt,
        },
      }
    })

    const byMonth = Object.values(monthsMap).sort((a, b) => b.key.localeCompare(a.key))

    // Track monthly & cumulative transaction fees and operations for all active merchants
    const allMerchants = await User.find({ isMerchant: true })
      .select('name email phone matricule walletAccountNo merchantSince')
      .lean()

    const merchantIds = allMerchants.map((m) => m._id)

    // Aggrégation des transactions des marchands
    const merchantTxs = await WalletTransaction.aggregate([
      { $match: { owner: { $in: merchantIds } } },
      {
        $group: {
          _id: '$owner',
          commissionTotal: {
            $sum: { $cond: [{ $eq: ['$type', 'merchant_commission'] }, '$amount', 0] },
          },
          commissionCount: {
            $sum: { $cond: [{ $eq: ['$type', 'merchant_commission'] }, 1, 0] },
          },
          volumeDeposit: {
            $sum: { $cond: [{ $eq: ['$type', 'deposit'] }, '$amount', 0] },
          },
          volumeWithdrawal: {
            $sum: { $cond: [{ $eq: ['$type', 'withdrawal'] }, '$amount', 0] },
          },
          volumeTransfer: {
            $sum: { $cond: [{ $eq: ['$type', 'transfer'] }, '$amount', 0] },
          },
          totalOperations: { $sum: 1 },
        },
      },
    ])

    const txMap = {}
    for (const r of merchantTxs) {
      txMap[String(r._id)] = r
    }

    const merchantFees = allMerchants.map((m) => {
      const stats = txMap[String(m._id)] || {}
      return {
        _id: m._id,
        name: m.name,
        email: m.email,
        phone: m.phone || '',
        matricule: m.matricule || '',
        walletAccountNo: m.walletAccountNo || '',
        merchantSince: m.merchantSince,
        commissionTotal: stats.commissionTotal || 0,
        commissionCount: stats.commissionCount || 0,
        volumeDeposit: stats.volumeDeposit || 0,
        volumeWithdrawal: stats.volumeWithdrawal || 0,
        volumeTransfer: stats.volumeTransfer || 0,
        totalOperations: stats.totalOperations || 0,
      }
    })

    res.json({
      success: true,
      totalRevenue,
      totalCount: history.length,
      adminBalance,
      byMonth,
      history,
      merchantFees,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/admin/merchants/subscriptions/withdraw — Retrait Mobile Money depuis les fonds de souscriptions marchands
router.post('/subscriptions/withdraw', protect, adminOnly, async (req, res) => {
  try {
    const { amount, momoNumber, momoOperator, accountName, country = 'CM', pin, password } = req.body
    const amt = Number(amount)
    if (!amt || amt <= 0) return res.status(400).json({ message: 'Montant de retrait invalide' })
    if (!momoNumber || !String(momoNumber).trim()) {
      return res.status(400).json({ message: 'Le numéro de téléphone Mobile Money est obligatoire' })
    }
    if (!momoOperator) {
      return res.status(400).json({ message: "L'opérateur Mobile Money est requis (mtn, orange, moov, celtiis)" })
    }

    // Authentification de sécurité : vérification du PIN ou du mot de passe
    const u = await User.findById(req.user._id).select('+walletPin +password')
    let authValid = false
    if (pin && u?.walletPin) {
      authValid = await bcrypt.compare(String(pin), u.walletPin)
    }
    if (!authValid && password && u?.password) {
      authValid = await bcrypt.compare(String(password), u.password)
    }
    if (!authValid) {
      return res.status(401).json({ message: 'Code PIN ou mot de passe incorrect' })
    }

    // Portefeuille admin
    let w = await Wallet.findOne({ owner: req.user._id })
    if (!w) {
      const superAdmin = await wallet.getPlatformAdmin()
      if (superAdmin && String(superAdmin._id) !== String(req.user._id)) {
        w = await Wallet.findOne({ owner: superAdmin._id })
      }
    }
    if (!w) {
      w = await wallet.getOrCreateWallet(req.user._id, { role: 'admin' })
    }

    if (w.balance < amt) {
      return res.status(400).json({
        message: `Solde insuffisant pour ce retrait. Solde disponible : ${w.balance.toLocaleString('fr-FR')} FCFA`,
      })
    }

    const normCountry = String(country || 'CM').trim().toUpperCase()
    const targetCurrency = ikeepay.getCountryCurrency ? ikeepay.getCountryCurrency(normCountry) : (normCountry === 'CM' ? 'XAF' : 'XOF')
    const providerRef = 'wd_mch_' + Date.now()
    const base = (process.env.SERVER_URL || '').replace(/\/$/, '')
    const holderName = String(accountName || req.user.name || 'Admin KATD').trim()

    // 1. Déclenche le payout direct via Ikeepay vers le Mobile Money de l'administrateur
    let payout
    try {
      payout = await ikeepay.createPayout({
        amount: amt,
        phone: String(momoNumber).trim(),
        operator: momoOperator,
        accountName: holderName,
        country: normCountry,
        currency: targetCurrency,
        reference: providerRef,
        callbackUrl: base + '/api/payments/webhook',
      })
    } catch (ikeepayErr) {
      console.error('[Admin Merchant Subscriptions Payout Error]:', ikeepayErr.message, ikeepayErr.data || '')
      return res.status(400).json({
        message: `Ikeepay a retourné une erreur : ${ikeepayErr.message}`,
      })
    }

    const payoutId = payout?.transaction_id || payout?.id || providerRef

    // 2. Débit atomique du portefeuille admin
    const debitRes = await wallet.debit(w.owner, {
      amount: amt,
      type: 'withdrawal',
      description: `Retrait souscriptions marchands vers ${momoOperator.toUpperCase()} ${momoNumber} (${holderName})`,
      meta: {
        momoNumber,
        momoOperator,
        accountName: holderName,
        payoutId,
        providerRef,
        source: 'merchant_subscriptions',
      },
    })

    // 3. Enregistrement de la demande de retrait pour la traçabilité
    await WithdrawalRequest.create({
      user: w.owner,
      amount: amt,
      netAmount: amt,
      fee: 0,
      currency: targetCurrency,
      momoNumber: String(momoNumber).trim(),
      momoOperator,
      accountName: holderName,
      status: 'paid',
      processedAt: new Date(),
      providerPayoutId: payoutId,
      providerRef,
      mode: payout?.mode || 'live',
      role: 'admin',
      school: null,
      note: 'Retrait automatique des souscriptions marchands (Payout Ikeepay)',
    })

    res.json({
      success: true,
      message: `Retrait de ${amt.toLocaleString('fr-FR')} FCFA envoyé avec succès vers ${momoOperator.toUpperCase()} (${momoNumber}) !`,
      balance: debitRes.wallet.balance,
      payoutId,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/admin/merchants/:id — détail marchand + dernières transactions (toutes catégories)
router.get('/:id', protect, adminOnly, async (req, res) => {
  try {
    const m = await User.findById(req.params.id).select('name email phone matricule walletAccountNo isMerchant merchantSince isActive externalAccount')
    if (!m || !m.isMerchant) return res.status(404).json({ message: 'Marchand introuvable' })
    const w = await wallet.getOrCreateWallet(m._id)
    const txs = await WalletTransaction.find({ owner: m._id })
      .populate('counterparty', 'name walletAccountNo').sort({ createdAt: -1 }).limit(100).lean()
    const commissionTotal = txs.filter((t) => t.type === 'merchant_commission').reduce((s, t) => s + (t.amount || 0), 0)
    res.json({
      success: true,
      merchant: {
        _id: m._id, name: m.name, email: m.email, phone: m.phone || '',
        matricule: m.matricule || '', walletAccountNo: m.walletAccountNo || '',
        merchantSince: m.merchantSince, isActive: m.isActive !== false,
        externalAccount: m.externalAccount || {},
        balance: w.balance, locked: w.locked, commissionTotal,
      },
      transactions: txs.map((t) => ({
        _id: t._id, type: t.type, direction: t.direction, amount: t.amount,
        description: t.description, createdAt: t.createdAt,
        counterpartyName: t.counterparty?.name || null,
      })),
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/admin/merchants/:id/grant — accorde/retire le statut marchand. body { isMerchant }
router.put('/:id/grant', protect, adminOnly, async (req, res) => {
  try {
    const grant = req.body.isMerchant === true || req.body.isMerchant === 'true'
    const target = await User.findById(req.params.id).select('role isMerchant merchantSince')
    if (!target) return res.status(404).json({ message: 'Utilisateur introuvable' })
    if (target.role === 'super_admin') return res.status(400).json({ message: 'Action impossible sur un super-administrateur' })
    target.isMerchant = grant
    if (grant && !target.merchantSince) target.merchantSince = new Date()
    await target.save()
    if (grant) await wallet.getOrCreateWallet(target._id)
    res.json({ success: true, message: grant ? 'Statut marchand accordé' : 'Statut marchand retiré', isMerchant: grant })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/admin/merchants/:id/fund — approvisionnement virtuel illimité. body { amount, reason }
router.put('/:id/fund', protect, adminOnly, async (req, res) => {
  try {
    const amount = Number(req.body.amount)
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Montant invalide' })
    const target = await User.findById(req.params.id).select('isMerchant role school')
    if (!target || !target.isMerchant) return res.status(404).json({ message: 'Marchand introuvable' })
    const { wallet: w } = await wallet.credit(target._id, {
      amount, type: 'merchant_funding', role: target.role, school: target.school || null,
      counterparty: req.user._id,
      description: (req.body.reason && String(req.body.reason).trim()) || 'Approvisionnement marchand (virtuel)',
      meta: { adminId: String(req.user._id), reason: req.body.reason || '' },
    })
    res.json({ success: true, message: 'Compte marchand approvisionné', balance: w.balance })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
