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
const PaymentIntent = require('../models/PaymentIntent')
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

module.exports = router
