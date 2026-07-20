// routes/shareholders.js — Programme actionnaires.
// Côté utilisateur : consultation des plans/termes + souscription payée via SEBPay.
// Côté super admin : modification des termes/avantages/responsabilités/droits et des
// plans (prix, libellés…), + liste des actionnaires.
const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const { protect } = require('../middleware/auth')
const ShareholderConfig = require('../models/ShareholderConfig')
const Shareholding = require('../models/Shareholding')
const ShareholderPost = require('../models/ShareholderPost')
const PaymentIntent = require('../models/PaymentIntent')
const WalletTransaction = require('../models/WalletTransaction')
const User = require('../models/User')
const School = require('../models/School')
const sebpay = require('../services/sebpayService')

function genRef(p) { return p + '_' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex') }
function superAdminOnly(req, res, next) {
  if (req.user?.role !== 'super_admin') return res.status(403).json({ message: 'Accès réservé au super administrateur' })
  next()
}

// ───────────────────────── UTILISATEUR ─────────────────────────

// GET /api/shareholders/config — plans actifs + textes (termes, avantages, droits…)
router.get('/config', protect, async (req, res) => {
  try {
    const cfg = await ShareholderConfig.getOrCreate()
    res.json({
      success: true,
      terms: cfg.terms, advantages: cfg.advantages,
      responsibilities: cfg.responsibilities, rights: cfg.rights,
      plans: (cfg.plans || []).filter((p) => p.isActive !== false),
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/shareholders/me — mes souscriptions d'actionnaire
router.get('/me', protect, async (req, res) => {
  try {
    const list = await Shareholding.find({ user: req.user._id }).sort({ createdAt: -1 })
    res.json({ success: true, shareholdings: list })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// Résout les utilisateurs de la zone d'attribution d'une part.
// - national / international : toute la plateforme (null = pas de filtre).
// - arrondissement / régional : utilisateurs rattachés aux écoles dont l'adresse
//   (ville / quartier / adresse) correspond à la zone saisie. Approximation assumée :
//   les comptes sans école n'ont pas de localisation en base.
async function zoneUserIds(sh) {
  if (sh.planKey === 'national' || sh.planKey === 'international') return null
  const z = String(sh.zone || '').trim()
  if (!z) return []
  const rx = new RegExp(z.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
  const schools = await School.find({
    $or: [{ 'address.city': rx }, { 'address.neighborhood': rx }, { 'address.address': rx }],
  }).select('_id')
  if (schools.length === 0) return []
  const users = await User.find({ school: { $in: schools.map((s) => s._id) } }).select('_id')
  return users.map((u) => u._id)
}

// GET /api/shareholders/dashboard — portefeuille de l'actionnaire connecté.
// CONFIDENTIALITÉ : ne renvoie QUE des agrégats (compteurs et totaux) — jamais les
// transferts individuels, ni les soldes, ni l'identité des autres utilisateurs.
router.get('/dashboard', protect, async (req, res) => {
  try {
    const holdings = await Shareholding.find({ user: req.user._id, status: 'active' }).sort({ createdAt: -1 })
    if (holdings.length === 0) return res.status(403).json({ message: "Vous n'êtes pas encore actionnaire" })
    const main = holdings[0] // part la plus récente = zone d'attribution affichée

    const ids = await zoneUserIds(main)
    const ownerMatch = ids === null ? {} : { owner: { $in: ids } }

    // 1. Nombre d'utilisateurs total de la zone d'attribution
    const userCount = ids === null ? await User.countDocuments({}) : ids.length

    // 2-4. Agrégats de transactions de la zone (compteur, transferts+retraits, frais)
    const TRANSFER_TYPES = ['transfer_sent', 'salary_transfer', 'pension_payment']
    const FEE_TYPES = ['transfer_fee', 'maintenance_fee']
    const rows = await WalletTransaction.aggregate([
      { $match: ownerMatch },
      {
        $group: {
          _id: null,
          txCount: { $sum: 1 },
          transfersTotal: { $sum: { $cond: [{ $in: ['$type', TRANSFER_TYPES] }, '$amount', 0] } },
          withdrawalsTotal: { $sum: { $cond: [{ $eq: ['$type', 'withdrawal'] }, '$amount', 0] } },
          feesTotal: { $sum: { $cond: [{ $in: ['$type', FEE_TYPES] }, '$amount', 0] } },
        },
      },
    ])
    const agg = rows[0] || { txCount: 0, transfersTotal: 0, withdrawalsTotal: 0, feesTotal: 0 }

    // 5. Gains accumulés de l'actionnaire (dividendes versés par l'admin)
    const gainRows = await WalletTransaction.aggregate([
      { $match: { owner: req.user._id, type: 'shareholder_gain' } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ])
    const gains = gainRows[0] || { total: 0, count: 0 }

    // 6. Publications du super admin (dépenses, sommes à payer, réunions…)
    const posts = await ShareholderPost.find({ isPublished: true }).sort({ createdAt: -1 }).limit(50)

    res.json({
      success: true,
      shareholdings: holdings,
      zone: { planKey: main.planKey, label: main.planLabel, zone: main.zone },
      stats: {
        userCount,
        txCount: agg.txCount,
        transfersTotal: agg.transfersTotal,
        withdrawalsTotal: agg.withdrawalsTotal,
        movementsTotal: agg.transfersTotal + agg.withdrawalsTotal,
        feesTotal: agg.feesTotal,
        gainsTotal: gains.total,
        gainsCount: gains.count,
      },
      posts,
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/shareholders/subscribe — souscrit à un plan (paiement Mobile Money SEBPay).
// Body: { planKey, zone, phone, operator }. Le PRIX est résolu côté serveur depuis la
// config (jamais depuis le client). L'actionnariat est créé au webhook approuvé.
router.post('/subscribe', protect, async (req, res) => {
  try {
    const { planKey, zone, phone, operator } = req.body
    if (!planKey) return res.status(400).json({ message: 'Plan requis' })
    if (!phone || !operator) return res.status(400).json({ message: 'Numéro et opérateur Mobile Money requis' })

    const cfg = await ShareholderConfig.getOrCreate()
    const plan = (cfg.plans || []).find((p) => p.key === planKey && p.isActive !== false)
    if (!plan) return res.status(404).json({ message: 'Plan introuvable ou désactivé' })

    // Un même plan ne peut être souscrit qu'une fois par utilisateur (tant qu'il est actif)
    const existing = await Shareholding.findOne({ user: req.user._id, planKey, status: 'active' })
    if (existing) return res.status(400).json({ message: 'Vous avez déjà souscrit à ce plan' })

    const reference = genRef('shr')
    const { mode } = await sebpay.resolveConfig()
    const intent = await PaymentIntent.create({
      reference, purpose: 'shareholder', amount: plan.price, currency: 'XOF',
      payerPhone: phone, payerOperator: operator, initiatedBy: req.user._id,
      school: req.user.school?._id || null, mode,
      meta: {
        planKey: plan.key, planLabel: plan.label, percent: plan.percent,
        durationYears: plan.durationYears, zone: String(zone || '').trim(),
      },
    })
    const base = (process.env.SERVER_URL || '').replace(/\/$/, '')
    const result = await sebpay.createCollection({ amount: plan.price, phone, operator, reference, callbackUrl: base + '/api/payments/webhook' })
    if (result.transaction_id) { intent.sebpayTransactionId = result.transaction_id; await intent.save() }
    res.json({ success: true, reference, amount: plan.price, mode, message: 'Validez le paiement sur votre téléphone Mobile Money.' })
  } catch (err) { res.status(err.status || 500).json({ message: err.message }) }
})

// ───────────────────────── SUPER ADMIN ─────────────────────────

// GET /api/shareholders/admin/config — config complète (y compris plans désactivés)
router.get('/admin/config', protect, superAdminOnly, async (req, res) => {
  try {
    const cfg = await ShareholderConfig.getOrCreate()
    res.json({ success: true, config: cfg })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/shareholders/admin/config — modifie termes/avantages/responsabilités/droits + plans
router.put('/admin/config', protect, superAdminOnly, async (req, res) => {
  try {
    const cfg = await ShareholderConfig.getOrCreate()
    const { terms, advantages, responsibilities, rights, plans } = req.body
    if (terms !== undefined) cfg.terms = String(terms)
    if (advantages !== undefined) cfg.advantages = String(advantages)
    if (responsibilities !== undefined) cfg.responsibilities = String(responsibilities)
    if (rights !== undefined) cfg.rights = String(rights)
    if (Array.isArray(plans)) {
      // Valide chaque plan : clé connue, prix > 0
      const KEYS = ['arrondissement', 'regional', 'national', 'international']
      for (const p of plans) {
        if (!KEYS.includes(p.key)) return res.status(400).json({ message: 'Clé de plan inconnue : ' + p.key })
        if (!(Number(p.price) > 0)) return res.status(400).json({ message: 'Prix invalide pour le plan ' + p.key })
      }
      cfg.plans = plans.map((p) => ({
        key: p.key, label: String(p.label || p.key), price: Number(p.price),
        percent: Number(p.percent) || 1, durationYears: Number(p.durationYears) || 35,
        description: String(p.description || ''), isActive: p.isActive !== false,
      }))
    }
    await cfg.save()
    res.json({ success: true, config: cfg })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/shareholders/admin/list — tous les actionnaires (avec identité)
router.get('/admin/list', protect, superAdminOnly, async (req, res) => {
  try {
    const filter = {}
    if (req.query.planKey) filter.planKey = req.query.planKey
    if (req.query.status) filter.status = req.query.status
    const list = await Shareholding.find(filter)
      .populate('user', 'name email phone walletAccountNo role')
      .sort({ createdAt: -1 }).limit(1000)
    const stats = {
      total: list.length,
      totalAmount: list.reduce((s, x) => s + (x.amount || 0), 0),
      byPlan: list.reduce((acc, x) => { acc[x.planKey] = (acc[x.planKey] || 0) + 1; return acc }, {}),
    }
    res.json({ success: true, shareholdings: list, stats })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/shareholders/admin/:id/revoke — révoque une souscription (gestion)
router.put('/admin/:id/revoke', protect, superAdminOnly, async (req, res) => {
  try {
    const s = await Shareholding.findByIdAndUpdate(req.params.id, { $set: { status: 'revoked' } }, { new: true })
    if (!s) return res.status(404).json({ message: 'Souscription introuvable' })
    res.json({ success: true, shareholding: s })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/shareholders/admin/:id — modifie/édite/active le plan d'un actionnaire.
// Body possible : { status, planKey, planLabel, percent, zone, durationYears, amount, startAt }
// (endAt recalculée si durée/startAt changent). status 'active' = réactivation.
router.put('/admin/:id', protect, superAdminOnly, async (req, res) => {
  try {
    const s = await Shareholding.findById(req.params.id)
    if (!s) return res.status(404).json({ message: 'Souscription introuvable' })
    const { status, planKey, planLabel, percent, zone, durationYears, amount, startAt } = req.body
    if (status !== undefined) {
      if (!['active', 'expired', 'revoked'].includes(status)) return res.status(400).json({ message: 'Statut invalide' })
      s.status = status
    }
    if (planKey !== undefined) {
      if (!['arrondissement', 'regional', 'national', 'international'].includes(planKey)) {
        return res.status(400).json({ message: 'Palier invalide' })
      }
      s.planKey = planKey
    }
    if (planLabel !== undefined) s.planLabel = String(planLabel)
    if (percent !== undefined) { if (!(Number(percent) > 0)) return res.status(400).json({ message: '% invalide' }); s.percent = Number(percent) }
    if (zone !== undefined) s.zone = String(zone).trim()
    if (amount !== undefined) { if (!(Number(amount) > 0)) return res.status(400).json({ message: 'Montant invalide' }); s.amount = Number(amount) }
    if (startAt !== undefined) { const d = new Date(startAt); if (!isNaN(d)) s.startAt = d }
    if (durationYears !== undefined) { if (!(Number(durationYears) > 0)) return res.status(400).json({ message: 'Durée invalide' }); s.durationYears = Number(durationYears) }
    // Recalcule l'échéance depuis startAt + durationYears
    const end = new Date(s.startAt)
    end.setFullYear(end.getFullYear() + (Number(s.durationYears) || 35))
    s.endAt = end
    await s.save()
    res.json({ success: true, shareholding: s })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// DELETE /api/shareholders/admin/:id — supprime définitivement la souscription
router.delete('/admin/:id', protect, superAdminOnly, async (req, res) => {
  try {
    const s = await Shareholding.findByIdAndDelete(req.params.id)
    if (!s) return res.status(404).json({ message: 'Souscription introuvable' })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/shareholders/admin/:id/pay-gain — verse un gain/dividende à l'actionnaire
// (crédité sur son portefeuille, type shareholder_gain — alimente « gains accumulés »).
router.put('/admin/:id/pay-gain', protect, superAdminOnly, async (req, res) => {
  try {
    const { amount, note } = req.body
    const amt = Number(amount)
    if (!amt || amt <= 0) return res.status(400).json({ message: 'Montant invalide' })
    const s = await Shareholding.findById(req.params.id).populate('user', 'name')
    if (!s) return res.status(404).json({ message: 'Souscription introuvable' })
    const wallet = require('../services/walletService')
    await wallet.credit(s.user._id, {
      amount: amt, type: 'shareholder_gain', counterparty: req.user._id,
      description: 'Gain actionnaire — ' + (s.planLabel || s.planKey) + (note ? ' : ' + note : ''),
      meta: { shareholding: String(s._id), planKey: s.planKey, zone: s.zone || '' },
    })
    res.json({ success: true, message: 'Gain de ' + amt.toLocaleString('fr-FR') + ' F versé à ' + (s.user?.name || 'l\'actionnaire') })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ── Publications du super admin pour les actionnaires (dépenses, paiements, réunions…) ──

// GET /api/shareholders/admin/posts — toutes les publications (y compris brouillons)
router.get('/admin/posts', protect, superAdminOnly, async (req, res) => {
  try {
    const posts = await ShareholderPost.find({}).sort({ createdAt: -1 }).limit(200)
    res.json({ success: true, posts })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/shareholders/admin/posts — crée une publication
router.post('/admin/posts', protect, superAdminOnly, async (req, res) => {
  try {
    const { title, body, category, amount, meetingAt, meetingLink, meetingPlace, isPublished } = req.body
    if (!title || !String(title).trim()) return res.status(400).json({ message: 'Titre requis' })
    const post = await ShareholderPost.create({
      title: String(title).trim(), body: String(body || ''),
      category: ['depense', 'paiement', 'reunion', 'info'].includes(category) ? category : 'info',
      amount: amount != null && amount !== '' ? Number(amount) : null,
      meetingAt: meetingAt ? new Date(meetingAt) : null,
      meetingLink: String(meetingLink || ''), meetingPlace: String(meetingPlace || ''),
      isPublished: isPublished !== false, createdBy: req.user._id,
    })
    res.json({ success: true, post })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/shareholders/admin/posts/:id — modifie une publication
router.put('/admin/posts/:id', protect, superAdminOnly, async (req, res) => {
  try {
    const patch = {}
    const { title, body, category, amount, meetingAt, meetingLink, meetingPlace, isPublished } = req.body
    if (title !== undefined) patch.title = String(title).trim()
    if (body !== undefined) patch.body = String(body)
    if (category !== undefined && ['depense', 'paiement', 'reunion', 'info'].includes(category)) patch.category = category
    if (amount !== undefined) patch.amount = amount != null && amount !== '' ? Number(amount) : null
    if (meetingAt !== undefined) patch.meetingAt = meetingAt ? new Date(meetingAt) : null
    if (meetingLink !== undefined) patch.meetingLink = String(meetingLink)
    if (meetingPlace !== undefined) patch.meetingPlace = String(meetingPlace)
    if (isPublished !== undefined) patch.isPublished = !!isPublished
    const post = await ShareholderPost.findByIdAndUpdate(req.params.id, { $set: patch }, { new: true })
    if (!post) return res.status(404).json({ message: 'Publication introuvable' })
    res.json({ success: true, post })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// DELETE /api/shareholders/admin/posts/:id — supprime une publication
router.delete('/admin/posts/:id', protect, superAdminOnly, async (req, res) => {
  try {
    const post = await ShareholderPost.findByIdAndDelete(req.params.id)
    if (!post) return res.status(404).json({ message: 'Publication introuvable' })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
