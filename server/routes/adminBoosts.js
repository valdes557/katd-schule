// routes/adminBoosts.js — Gestion des boosts (Super Admin uniquement).
// Liste/filtre des campagnes, statistiques de revenus, suspension/rejet/réactivation,
// remboursement, configuration des prix et des limites. Toutes les routes : protect + super_admin.
const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')
const { protect, authorize } = require('../middleware/auth')
const BoostCampaign = require('../models/BoostCampaign')
const BoostPricing = require('../models/BoostPricing')
const AuditLog = require('../models/AuditLog')
const User = require('../models/User')
const walletService = require('../services/walletService')
const pushService = require('../services/pushService')
const boostPricing = require('../services/boostPricingService')

router.use(protect, authorize('super_admin'))

function audit(req, { action, label, entityId, statusCode = 200 }) {
  try {
    AuditLog.create({
      school: null, actor: req.user?._id || null, actorName: req.user?.name || '', actorRole: req.user?.role || '',
      action, label, method: req.method, path: (req.originalUrl || '').split('?')[0],
      statusCode, entityType: 'BoostCampaign', entityId: String(entityId || ''), ip: req.ip || '',
    }).catch(() => {})
  } catch (_) {}
}

const PAID = ['active', 'pending_review', 'paused', 'completed', 'refunded']

// ───────────────────────── GET /api/admin/boosts ─────────────────────────
// Filtres : status, userId, from, to (dates ISO), q (nom/email de l'acheteur). Pagination.
router.get('/', async (req, res) => {
  try {
    const { status, userId, from, to, q, page = 1, limit = 20 } = req.query
    const query = {}
    if (status && BoostCampaign.STATUSES.includes(status)) query.status = status
    if (userId && mongoose.isValidObjectId(userId)) query.user = userId
    if (from || to) {
      query.createdAt = {}
      if (from) query.createdAt.$gte = new Date(from)
      if (to) query.createdAt.$lte = new Date(to)
    }
    if (q && q.trim()) {
      const rx = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      const users = await User.find({ $or: [{ name: rx }, { email: rx }] }).select('_id').limit(50).lean()
      query.user = { $in: users.map((u) => u._id) }
    }
    const lim = Math.min(Number(limit) || 20, 100)
    const total = await BoostCampaign.countDocuments(query)
    const rows = await BoostCampaign.find(query)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * lim)
      .limit(lim)
      .populate('user', 'name email avatar role')
      .populate('post', 'title content type thumbnail images videoUrl category views shares')
    res.json({ success: true, total, page: Number(page), limit: lim, data: rows })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ───────────────────────── GET /api/admin/boosts/stats ─────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [agg] = await BoostCampaign.aggregate([
      { $match: { status: { $in: PAID } } },
      { $group: {
        _id: null,
        revenue: { $sum: '$budget' },
        refunded: { $sum: '$refundedAmount' },
        count: { $sum: 1 },
        avgBudget: { $avg: '$budget' },
        buyers: { $addToSet: '$user' },
      } },
    ])
    const [active, completed, totalAll] = await Promise.all([
      BoostCampaign.countDocuments({ status: 'active' }),
      BoostCampaign.countDocuments({ status: 'completed' }),
      BoostCampaign.countDocuments({}),
    ])
    // Revenus par jour sur 30 jours (série pour un mini-graphique).
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000)
    const byDay = await BoostCampaign.aggregate([
      { $match: { status: { $in: PAID }, createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$budget' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])
    res.json({
      success: true,
      revenue: agg?.revenue || 0,
      netRevenue: (agg?.revenue || 0) - (agg?.refunded || 0),
      refunded: agg?.refunded || 0,
      campaigns: totalAll,
      paidCampaigns: agg?.count || 0,
      activeCampaigns: active,
      completedCampaigns: completed,
      avgBudget: Math.round(agg?.avgBudget || 0),
      buyers: (agg?.buyers || []).length,
      revenueByDay: byDay,
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ───────────────────────── PATCH /api/admin/boosts/:id/status ─────────────────────────
// Actions admin : suspend (paused), reactivate (active), reject (rejected), complete (completed).
router.patch('/:id/status', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Identifiant invalide' })
    const { status, reason } = req.body
    const ALLOWED = ['paused', 'active', 'rejected', 'completed']
    if (!ALLOWED.includes(status)) return res.status(400).json({ message: 'Statut cible non autorisé' })
    const c = await BoostCampaign.findById(req.params.id)
    if (!c) return res.status(404).json({ message: 'Campagne introuvable' })
    // Réactivation : uniquement depuis paused, et si la durée n'est pas expirée.
    if (status === 'active' && c.status !== 'paused') return res.status(409).json({ message: 'Seule une campagne suspendue peut être réactivée.' })
    if (status === 'active' && c.endsAt && new Date(c.endsAt) <= new Date()) return res.status(409).json({ message: 'La durée de cette campagne est écoulée.' })
    c.status = status
    if (status === 'rejected') c.rejectionReason = String(reason || 'Rejetée par un administrateur')
    await c.save()
    audit(req, { action: 'boost.admin.status', label: 'Statut boost → ' + status + (reason ? ' (' + reason + ')' : ''), entityId: c._id })
    const labels = { paused: 'suspendu', active: 'réactivé', rejected: 'rejeté', completed: 'terminé' }
    pushService.sendToUser(c.user, { title: 'Boost ' + labels[status], body: 'Votre boost a été ' + labels[status] + (reason ? ' : ' + reason : '') + '.', url: '/u/mes-boosts', tag: 'boost_admin_' + c._id })
    res.json({ success: true, campaign: c })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ───────────────────────── POST /api/admin/boosts/:id/refund ─────────────────────────
// wallet : recrédite le propriétaire (boost_refund) + débit best-effort de l'admin.
// ikeepay : marque « refunded » (le payout Mobile Money est traité manuellement).
router.post('/:id/refund', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Identifiant invalide' })
    const c = await BoostCampaign.findById(req.params.id)
    if (!c) return res.status(404).json({ message: 'Campagne introuvable' })
    if (c.status === 'refunded') return res.status(409).json({ message: 'Déjà remboursée' })
    if (c.refundedAmount > 0) return res.status(409).json({ message: 'Déjà remboursée' })

    if (c.paymentProvider === 'wallet') {
      await walletService.credit(c.user, {
        amount: c.budget, type: 'boost_refund', role: 'utilisateur',
        description: 'Remboursement boost', meta: { boostCampaign: String(c._id) },
      })
      // Reprise best-effort du revenu côté admin (équilibre comptable).
      try {
        const admin = await walletService.getPlatformAdmin()
        if (admin) await walletService.debit(admin._id, { amount: c.budget, type: 'boost_refund', role: 'admin', counterparty: c.user, description: 'Reprise revenu boost (remboursement)', meta: { boostCampaign: String(c._id) } })
      } catch (e) { /* remboursement effectué même si la reprise admin échoue */ }
    }
    // ikeepay : pas de recrédit portefeuille (l'argent est chez l'opérateur) → payout manuel.
    c.refundedAmount = c.budget
    c.status = 'refunded'
    await c.save()
    audit(req, { action: 'boost.admin.refund', label: 'Remboursement boost (' + c.paymentProvider + ') ' + c.budget + ' ' + c.currency, entityId: c._id })
    pushService.sendToUser(c.user, { title: 'Boost remboursé', body: 'Votre boost de ' + c.budget + ' ' + c.currency + ' a été remboursé.', url: '/u/mes-boosts', tag: 'boost_refund_' + c._id })
    res.json({ success: true, campaign: c, note: c.paymentProvider === 'ikeepay' ? 'Remboursement marqué ; effectuez le payout Mobile Money manuellement.' : undefined })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ───────────────────────── CONFIG (limites) ─────────────────────────
router.get('/config', async (req, res) => {
  try { res.json({ success: true, config: await boostPricing.getConfig() }) }
  catch (err) { res.status(500).json({ message: err.message }) }
})

router.patch('/config', async (req, res) => {
  try {
    const cfg = await boostPricing.getConfig()
    const NUM = ['maxActiveCampaignsPerUser', 'maxBoostsPerPost', 'maxDailyBudget', 'maxMonthlyBudget',
      'minDelayBetweenCampaignsHours', 'maxCampaignDurationHours', 'minBudget', 'maxBudget',
      'feedInjectionRatio', 'maxSponsoredPerPage']
    for (const k of NUM) if (req.body[k] !== undefined) cfg[k] = Math.max(0, Number(req.body[k]) || 0)
    if (req.body.currency) cfg.currency = String(req.body.currency)
    if (req.body.requireReview !== undefined) cfg.requireReview = !!req.body.requireReview
    if (Array.isArray(req.body.objectives)) cfg.objectives = req.body.objectives.map(String).filter(Boolean)
    await cfg.save()
    audit(req, { action: 'boost.admin.config', label: 'Mise à jour configuration boost', entityId: cfg._id })
    res.json({ success: true, config: cfg })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ───────────────────────── PRICING (grille tarifaire) ─────────────────────────
router.get('/pricing', async (req, res) => {
  try { res.json({ success: true, data: await boostPricing.getPricing() }) }
  catch (err) { res.status(500).json({ message: err.message }) }
})

router.post('/pricing', async (req, res) => {
  try {
    const { durationKey, label, hours, price, currency, isActive, sortOrder } = req.body
    if (!['24h', '3d', '7d'].includes(durationKey)) return res.status(400).json({ message: 'durationKey invalide' })
    const row = await BoostPricing.create({
      durationKey, label: label || '', hours: Math.max(1, Number(hours) || 1), price: Math.max(0, Number(price) || 0),
      currency: currency || 'XOF', isActive: isActive !== false, sortOrder: Number(sortOrder) || 0,
    })
    audit(req, { action: 'boost.admin.pricing.create', label: 'Création tarif ' + durationKey, entityId: row._id, statusCode: 201 })
    res.status(201).json({ success: true, data: row })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

router.patch('/pricing/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Identifiant invalide' })
    const update = {}
    if (req.body.label !== undefined) update.label = String(req.body.label)
    if (req.body.hours !== undefined) update.hours = Math.max(1, Number(req.body.hours) || 1)
    if (req.body.price !== undefined) update.price = Math.max(0, Number(req.body.price) || 0)
    if (req.body.currency !== undefined) update.currency = String(req.body.currency)
    if (req.body.isActive !== undefined) update.isActive = !!req.body.isActive
    if (req.body.sortOrder !== undefined) update.sortOrder = Number(req.body.sortOrder) || 0
    const row = await BoostPricing.findByIdAndUpdate(req.params.id, update, { new: true })
    if (!row) return res.status(404).json({ message: 'Tarif introuvable' })
    // NB : les campagnes déjà payées conservent leur budget — aucun effet rétroactif.
    audit(req, { action: 'boost.admin.pricing.update', label: 'Mise à jour tarif ' + row.durationKey, entityId: row._id })
    res.json({ success: true, data: row })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

router.delete('/pricing/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Identifiant invalide' })
    await BoostPricing.findByIdAndDelete(req.params.id)
    audit(req, { action: 'boost.admin.pricing.delete', label: 'Suppression tarif', entityId: req.params.id })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
