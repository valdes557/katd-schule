// routes/walletAdmin.js — Admin: traitement des retraits + clés API SEBPay sécurisées
const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const { protect } = require('../middleware/auth')
const User = require('../models/User')
const WithdrawalRequest = require('../models/WithdrawalRequest')
const PaymentIntent = require('../models/PaymentIntent')
const WalletTransaction = require('../models/WalletTransaction')
const SebpayConfig = require('../models/SebpayConfig')
const wallet = require('../services/walletService')
const { encrypt, decrypt, mask } = require('../utils/crypto')
const { sendEmail } = require('../utils/emailService')

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'valdeslando15@gmail.com').toLowerCase()

// Garde : super-admin global OU email admin configuré
function isAdmin(u){ return u && (u.role === 'super_admin' || u.role === 'admin' || (u.email||'').toLowerCase() === ADMIN_EMAIL) }
function adminOnly(req, res, next){ if(!isAdmin(req.user)) return res.status(403).json({ message: 'Accès réservé à l\'administrateur' }); next() }
// Garde stricte : rôle super_admin (clés API). L'email ADMIN_EMAIL ne sert PAS à se connecter,
// il reçoit uniquement le code de déverrouillage (voir route /sebpay/request-code).
function superAdminOnly(req, res, next){ if(req.user.role !== 'super_admin') return res.status(403).json({ message: 'Action réservée au super-administrateur' }); next() }

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

// ───────────────────── PAIEMENTS SEBPAY (collectes) ─────────────────────
// GET /api/admin/payments?purpose=subscription&status=approved — argent entrant SEBPay
// Consultation seule : le statut est mis à jour automatiquement par le webhook SEBPay.
router.get('/payments', protect, adminOnly, async (req, res) => {
  try {
    const filter = {}
    const { purpose, status, q } = req.query
    if (purpose && ['subscription', 'enrollment', 'deposit'].includes(purpose)) filter.purpose = purpose
    if (status && ['pending', 'approved', 'rejected', 'expired'].includes(status)) filter.status = status
    if (q && String(q).trim()) {
      const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      filter.$or = [{ reference: rx }, { payerName: rx }, { payerEmail: rx }, { payerPhone: rx }, { sebpayTransactionId: rx }]
    }
    const list = await PaymentIntent.find(filter)
      .sort({ createdAt: -1 })
      .populate('school', 'name')
      .populate('initiatedBy', 'name email')
      .populate('beneficiary', 'name email')
      .limit(300)
      .lean()
    res.json({ success: true, payments: list })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/admin/payments/stats — synthèse (encaissé / en attente / rejeté) par finalité
router.get('/payments/stats', protect, adminOnly, async (req, res) => {
  try {
    const rows = await PaymentIntent.aggregate([
      { $group: {
        _id: { purpose: '$purpose', status: '$status' },
        count: { $sum: 1 },
        total: { $sum: '$amount' },
      } },
    ])
    // Agrège en { approved: {count,total}, pending:{...}, rejected:{...}, byPurpose:{...} }
    const stats = { approved: { count: 0, total: 0 }, pending: { count: 0, total: 0 }, rejected: { count: 0, total: 0 }, byPurpose: {} }
    for (const r of rows) {
      const st = r._id.status, pu = r._id.purpose || 'autre'
      if (stats[st]) { stats[st].count += r.count; stats[st].total += r.total }
      if (!stats.byPurpose[pu]) stats.byPurpose[pu] = { count: 0, total: 0, approvedTotal: 0 }
      stats.byPurpose[pu].count += r.count
      stats.byPurpose[pu].total += r.total
      if (st === 'approved') stats.byPurpose[pu].approvedTotal += r.total
    }
    res.json({ success: true, stats })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ───────────────────── TRANSACTIONS (grand livre unifié) ─────────────────────
// Groupes de rôles : personnel de la plateforme vs utilisateurs/parents/élèves
const STAFF_ROLES = ['super_admin', 'admin', 'directeur', 'enseignant']
const USER_ROLES = ['utilisateur', 'parent', 'eleve']
function roleGroup(role) { return USER_ROLES.includes(role) ? 'users' : 'staff' }

// Libellés lisibles des natures d'opération (WalletTransaction.type + PaymentIntent.purpose)
const CATEGORY_LABELS = {
  subscription: 'Souscription', enrollment: 'Inscription élève', deposit: 'Dépôt portefeuille',
  salary_transfer: 'Transfert salaire', salary_received: 'Salaire reçu',
  withdrawal: 'Retrait', withdrawal_refund: 'Remboursement retrait', adjustment: 'Ajustement',
  transfer_sent: 'Transfert envoyé', transfer_received: 'Transfert reçu',
  transfer_fee: 'Frais de transfert', fee_collected: 'Frais encaissés',
  pension_payment: 'Paiement pension', pension_received: 'Pension reçue',
}

// Construit un filtre de dates { createdAt: { $gte, $lte } } à partir de from/to (YYYY-MM-DD)
function buildDateFilter(from, to) {
  const f = {}
  if (from) { const d = new Date(from); if (!isNaN(d)) f.$gte = d }
  if (to) { const d = new Date(to); if (!isNaN(d)) { d.setHours(23, 59, 59, 999); f.$lte = d } }
  return Object.keys(f).length ? { createdAt: f } : {}
}

function normalizeWalletTx(tx) {
  const o = tx.owner || {}
  const cp = tx.counterparty || null
  return {
    _id: 'w_' + tx._id, source: 'wallet', date: tx.createdAt,
    category: tx.type, categoryLabel: CATEGORY_LABELS[tx.type] || tx.type,
    direction: tx.direction, amount: tx.amount, currency: tx.currency || 'XOF',
    status: 'completed',
    actor: {
      id: o._id, name: o.name || '—', role: o.role || '', email: o.email || '',
      phone: o.phone || '', matricule: o.matricule || '', accountNo: o.walletAccountNo || '',
      group: roleGroup(o.role),
    },
    counterparty: cp ? { name: cp.name, role: cp.role } : null,
    description: tx.description || '',
  }
}

function normalizeIntent(pi) {
  const by = pi.initiatedBy || {}
  const role = by.role || 'directeur'
  return {
    _id: 'p_' + pi._id, source: 'sebpay', date: pi.createdAt,
    category: pi.purpose, categoryLabel: CATEGORY_LABELS[pi.purpose] || pi.purpose,
    direction: 'credit', amount: pi.amount, currency: pi.currency || 'XOF',
    status: pi.status,
    actor: {
      id: by._id, name: pi.payerName || by.name || (pi.meta && pi.meta.directorName) || '—',
      role, email: pi.payerEmail || by.email || '',
      phone: pi.payerPhone || '', matricule: by.matricule || '', accountNo: by.walletAccountNo || '',
      group: roleGroup(role),
    },
    counterparty: pi.school ? { name: pi.school.name, role: 'school' } : null,
    description: (pi.meta && (pi.meta.planName || pi.meta.schoolName)) || pi.reference || '',
  }
}

// GET /api/admin/transactions — toutes les souscriptions + paiements (personnel & utilisateurs)
// Union : grand livre portefeuille (WalletTransaction) + collectes SEBPay non converties en écriture
// (souscriptions + tentatives non abouties). Filtres : type, statut, groupe (staff/users/rôle), dates, q.
// Renvoie la liste paginée ET les statistiques sur l'ensemble filtré.
router.get('/transactions', protect, adminOnly, async (req, res) => {
  try {
    const { category, status, group, from, to, q } = req.query
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50))
    const dateFilter = buildDateFilter(from, to)

    // Grand livre : tous les mouvements de portefeuille
    const walletDocs = await WalletTransaction.find(dateFilter)
      .sort({ createdAt: -1 })
      .populate('owner', 'name role email phone matricule walletAccountNo')
      .populate('counterparty', 'name role')
      .limit(8000).lean()

    // Collectes SEBPay : souscriptions (jamais écrites au grand livre) + tentatives non abouties
    // (les dépôts/inscriptions approuvés sont déjà représentés par leur écriture de portefeuille).
    const intentDocs = await PaymentIntent.find({
      ...dateFilter,
      $or: [{ purpose: 'subscription' }, { status: { $ne: 'approved' } }],
    }).sort({ createdAt: -1 })
      .populate('initiatedBy', 'name role email matricule walletAccountNo')
      .populate('school', 'name')
      .limit(3000).lean()

    let items = [...walletDocs.map(normalizeWalletTx), ...intentDocs.map(normalizeIntent)]

    // Filtres en mémoire (sur l'union normalisée)
    if (category) items = items.filter((i) => i.category === category)
    if (status) items = items.filter((i) => i.status === status)
    if (group) {
      if (group === 'staff' || group === 'users') items = items.filter((i) => i.actor.group === group)
      else items = items.filter((i) => i.actor.role === group) // rôle précis
    }
    if (q && String(q).trim()) {
      const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      items = items.filter((i) => rx.test(i.actor.name) || rx.test(i.actor.phone) ||
        rx.test(i.actor.matricule) || rx.test(i.actor.accountNo) || rx.test(i.actor.email) || rx.test(i.description))
    }

    items.sort((a, b) => new Date(b.date) - new Date(a.date))

    // Statistiques sur l'ensemble filtré (avant pagination)
    const stats = {
      totalCount: items.length, totalIn: 0, totalOut: 0,
      byCategory: {}, byStatus: {}, byGroup: { staff: { count: 0, total: 0 }, users: { count: 0, total: 0 } },
    }
    for (const i of items) {
      if (i.direction === 'debit') stats.totalOut += i.amount
      else stats.totalIn += i.amount
      const c = (stats.byCategory[i.category] ||= { label: i.categoryLabel, count: 0, total: 0 })
      c.count++; c.total += i.amount
      const s = (stats.byStatus[i.status] ||= { count: 0, total: 0 })
      s.count++; s.total += i.amount
      const g = stats.byGroup[i.actor.group]; if (g) { g.count++; g.total += i.amount }
    }
    stats.net = stats.totalIn - stats.totalOut

    const total = items.length
    const pages = Math.max(1, Math.ceil(total / limit))
    const paged = items.slice((page - 1) * limit, (page - 1) * limit + limit)

    res.json({ success: true, transactions: paged, total, page, pages, stats })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ───────────────────── FRAIS DE TRANSACTION (versés à l'admin) ─────────────────────
// GET /api/admin/transaction-fees — frais encaissés par l'administrateur (type 'fee_collected').
// Détaille le payeur (identifiants, nom, téléphone, date), le type et le montant du frais.
// Filtres : dates, groupe (staff/users), q. Stats : total, moyenne, par groupe, par période (jour/mois).
router.get('/transaction-fees', protect, adminOnly, async (req, res) => {
  try {
    const { group, from, to, q, feeType } = req.query
    const period = req.query.period === 'day' ? 'day' : 'month'
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50))
    const dateFilter = buildDateFilter(from, to)

    const docs = await WalletTransaction.find({ type: 'fee_collected', ...dateFilter })
      .sort({ createdAt: -1 })
      .populate('counterparty', 'name role email phone matricule walletAccountNo')
      .limit(10000).lean()

    let fees = docs.map((tx) => {
      const p = tx.counterparty || {}
      // Distingue frais de transfert (0,25%) et frais de retrait (2%) via meta.feeType.
      const kind = (tx.meta && tx.meta.feeType) === 'withdrawal' ? 'withdrawal' : 'transfer'
      return {
        _id: String(tx._id), date: tx.createdAt,
        feeType: kind,
        feeLabel: kind === 'withdrawal' ? 'Frais de retrait (2%)' : 'Frais de transfert (0,25%)',
        amount: tx.amount, currency: tx.currency || 'XOF',
        baseAmount: (tx.meta && tx.meta.baseAmount) || null,
        rate: (tx.meta && tx.meta.rate) || (kind === 'withdrawal' ? 0.02 : 0.0025),
        payer: {
          id: p._id, name: p.name || '—', role: p.role || '', email: p.email || '',
          phone: p.phone || '', matricule: p.matricule || '', accountNo: p.walletAccountNo || '',
          group: roleGroup(p.role),
        },
      }
    })

    if (feeType === 'transfer' || feeType === 'withdrawal') fees = fees.filter((f) => f.feeType === feeType)
    if (group) {
      if (group === 'staff' || group === 'users') fees = fees.filter((f) => f.payer.group === group)
      else fees = fees.filter((f) => f.payer.role === group)
    }
    if (q && String(q).trim()) {
      const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      fees = fees.filter((f) => rx.test(f.payer.name) || rx.test(f.payer.phone) ||
        rx.test(f.payer.matricule) || rx.test(f.payer.accountNo) || rx.test(f.payer.email))
    }

    // Statistiques
    const stats = {
      totalCount: fees.length, totalAmount: 0, avg: 0,
      byGroup: { staff: { count: 0, total: 0 }, users: { count: 0, total: 0 } },
      byType: { transfer: { count: 0, total: 0 }, withdrawal: { count: 0, total: 0 } },
      byPeriod: [], period,
    }
    const periodMap = {}
    for (const f of fees) {
      stats.totalAmount += f.amount
      const g = stats.byGroup[f.payer.group]; if (g) { g.count++; g.total += f.amount }
      const ty = stats.byType[f.feeType]; if (ty) { ty.count++; ty.total += f.amount }
      const d = new Date(f.date)
      const key = period === 'day'
        ? d.toISOString().slice(0, 10)
        : d.toISOString().slice(0, 7)
      const pm = (periodMap[key] ||= { period: key, count: 0, total: 0 })
      pm.count++; pm.total += f.amount
    }
    stats.avg = fees.length ? Math.round(stats.totalAmount / fees.length) : 0
    stats.byPeriod = Object.values(periodMap).sort((a, b) => (a.period < b.period ? 1 : -1))

    const total = fees.length
    const pages = Math.max(1, Math.ceil(total / limit))
    const paged = fees.slice((page - 1) * limit, (page - 1) * limit + limit)

    res.json({ success: true, fees: paged, total, page, pages, stats })
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
