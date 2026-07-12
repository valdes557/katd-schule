// routes/adminMerchants.js — Admin : gestion des marchands
// (liste + soldes + commissions gagnées + identité + transactions, octroi/retrait du statut,
//  approvisionnement virtuel illimité).
const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/auth')
const User = require('../models/User')
const Wallet = require('../models/Wallet')
const WalletTransaction = require('../models/WalletTransaction')
const wallet = require('../services/walletService')

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
