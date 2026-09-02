// routes/boosts.js — Boost d'une publication (espace utilisateur /u).
// SÉCURITÉ : authentification obligatoire (protect), vérification propriétaire, prix résolus
// EXCLUSIVEMENT côté serveur (BoostPricing), limites anti-spam (BoostConfig), rate-limit ciblé,
// paiement confirmé serveur (wallet) ou par webhook (ikeepay), AuditLog des actions sensibles.
const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')
const { protect } = require('../middleware/auth')
const SchoolPost = require('../models/SchoolPost')
const BoostCampaign = require('../models/BoostCampaign')
const AuditLog = require('../models/AuditLog')
const boostPricing = require('../services/boostPricingService')
const boostPayment = require('../services/boostPaymentService')
const lifecycle = require('../services/boostLifecycleService')

// ───────────────────────── Rate-limit ciblé (création) ─────────────────────────
// Limiteur en mémoire (aucune dépendance) : N créations max par fenêtre glissante / utilisateur.
const RL_MAX = 5
const RL_WINDOW_MS = 60 * 1000
const rlHits = new Map() // userId -> [timestamps]
function rateLimited(userId) {
  const now = Date.now()
  const arr = (rlHits.get(String(userId)) || []).filter((t) => now - t < RL_WINDOW_MS)
  if (arr.length >= RL_MAX) { rlHits.set(String(userId), arr); return true }
  arr.push(now)
  rlHits.set(String(userId), arr)
  return false
}

// ───────────────────────── Helpers ─────────────────────────
function auditBoost(req, { action, label, entityId, statusCode = 200 }) {
  try {
    AuditLog.create({
      school: req.user?.school?._id || req.user?.school || null,
      actor: req.user?._id || null, actorName: req.user?.name || '', actorRole: req.user?.role || '',
      action, label, method: req.method, path: (req.originalUrl || '').split('?')[0],
      statusCode, entityType: 'BoostCampaign', entityId: String(entityId || ''), ip: req.ip || '',
    }).catch(() => {})
  } catch (_) { /* best-effort */ }
}

// Vérifie qu'un post est éligible au boost par cet utilisateur. Lève une erreur { status } sinon.
async function assertBoostablePost(postId, user) {
  if (!mongoose.isValidObjectId(postId)) { const e = new Error('Publication invalide'); e.status = 400; throw e }
  const post = await SchoolPost.findById(postId)
  if (!post) { const e = new Error('Publication introuvable ou supprimée'); e.status = 404; throw e }
  if (post.isPlatform) { const e = new Error('Cette publication ne peut pas être boostée'); e.status = 403; throw e }
  if (post.isPublic === false) { const e = new Error('Une publication non publique ne peut pas être boostée'); e.status = 403; throw e }
  if (post.isBlocked) { const e = new Error('Cette publication est bloquée par la modération'); e.status = 403; throw e }
  const authorId = String(post.author?._id || post.author || '')
  if (authorId !== String(user._id)) { const e = new Error("Vous ne pouvez booster que vos propres publications."); e.status = 403; throw e }
  return post
}

// Applique les garde-fous anti-spam configurables (BoostConfig). Lève { status:409 } si dépassé.
async function assertWithinLimits({ user, post, hours, price, cfg }) {
  const now = new Date()
  // 1) Une seule campagne active/en attente par publication à la fois
  const liveOnPost = await BoostCampaign.countDocuments({ post: post._id, status: { $in: ['active', 'pending_review', 'pending_payment'] } })
  if (liveOnPost > 0) { const e = new Error('Une campagne est déjà en cours pour cette publication.'); e.status = 409; e.code = 'ALREADY_ACTIVE'; throw e }
  // 2) Nombre max de boosts (payés) par publication
  const paidOnPost = await BoostCampaign.countDocuments({ post: post._id, status: { $in: ['active', 'pending_review', 'paused', 'completed'] } })
  if (paidOnPost >= cfg.maxBoostsPerPost) { const e = new Error('Nombre maximal de boosts atteint pour cette publication.'); e.status = 409; throw e }
  // 3) Nombre max de campagnes actives par utilisateur
  const activeForUser = await BoostCampaign.countDocuments({ user: user._id, status: { $in: ['active', 'pending_review', 'pending_payment'] } })
  if (activeForUser >= cfg.maxActiveCampaignsPerUser) { const e = new Error('Nombre maximal de campagnes actives atteint.'); e.status = 409; throw e }
  // 4) Durée max
  if (cfg.maxCampaignDurationHours && hours > cfg.maxCampaignDurationHours) { const e = new Error('Durée de campagne supérieure au maximum autorisé.'); e.status = 409; throw e }
  // 5) Budget min/max unitaire
  if (cfg.minBudget && price < cfg.minBudget) { const e = new Error('Budget inférieur au minimum autorisé.'); e.status = 409; throw e }
  if (cfg.maxBudget && price > cfg.maxBudget) { const e = new Error('Budget supérieur au maximum autorisé.'); e.status = 409; throw e }
  // 6) Délai minimum entre deux campagnes
  if (cfg.minDelayBetweenCampaignsHours > 0) {
    const last = await BoostCampaign.findOne({ user: user._id }).sort({ createdAt: -1 }).select('createdAt')
    if (last) {
      const diffH = (now - new Date(last.createdAt)) / 3600000
      if (diffH < cfg.minDelayBetweenCampaignsHours) { const e = new Error('Veuillez patienter avant de créer une nouvelle campagne.'); e.status = 409; throw e }
    }
  }
  // 7) Plafonds budgétaires jour / mois (somme des campagnes payées de la période + celle-ci)
  const paidStatuses = ['active', 'pending_review', 'paused', 'completed']
  const startDay = new Date(now); startDay.setHours(0, 0, 0, 0)
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const sumSince = async (since) => {
    const rows = await BoostCampaign.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(String(user._id)), status: { $in: paidStatuses }, createdAt: { $gte: since } } },
      { $group: { _id: null, total: { $sum: '$budget' } } },
    ])
    return rows[0]?.total || 0
  }
  if (cfg.maxDailyBudget && (await sumSince(startDay)) + price > cfg.maxDailyBudget) { const e = new Error('Plafond de budget quotidien atteint.'); e.status = 409; throw e }
  if (cfg.maxMonthlyBudget && (await sumSince(startMonth)) + price > cfg.maxMonthlyBudget) { const e = new Error('Plafond de budget mensuel atteint.'); e.status = 409; throw e }
}

// Sérialise une campagne pour le client (avec un aperçu minimal du post).
function serializeCampaign(c, post) {
  const p = post || c.post
  return {
    _id: c._id, objective: c.objective, audience: c.audience,
    durationKey: c.durationKey, durationHours: c.durationHours,
    budget: c.budget, currency: c.currency, paymentProvider: c.paymentProvider,
    status: c.status, stats: c.stats, startsAt: c.startsAt, endsAt: c.endsAt,
    activatedAt: c.activatedAt, createdAt: c.createdAt,
    post: p ? {
      _id: p._id, title: p.title, content: p.content, type: p.type,
      thumbnail: p.thumbnail, images: p.images, videoUrl: p.videoUrl, category: p.category,
      views: p.views, shares: p.shares,
      likes: Array.isArray(p.likes) ? p.likes.length : (p.likes || 0),
      comments: Array.isArray(p.comments) ? p.comments.length : (p.comments || 0),
    } : null,
  }
}

// ───────────────────────── GET /api/boosts/pricing ─────────────────────────
// Grille tarifaire officielle + config publique (objectifs, devise). Prix = source serveur.
router.get('/pricing', protect, async (req, res) => {
  try {
    const [pricing, cfg] = await Promise.all([boostPricing.getPricing({ activeOnly: true }), boostPricing.getConfig()])
    res.json({
      success: true,
      currency: cfg.currency,
      objectives: cfg.objectives,
      pricing: pricing.map((p) => ({ durationKey: p.durationKey, label: p.label, hours: p.hours, price: p.price, currency: p.currency })),
    })
  } catch (err) { res.status(err.status || 500).json({ message: err.message }) }
})

// ───────────────────────── POST /api/boosts/preview ─────────────────────────
// Valide l'éligibilité + résout le prix, SANS rien créer. Alimente le résumé avant paiement.
router.post('/preview', protect, async (req, res) => {
  try {
    const { postId, durationKey } = req.body
    const post = await assertBoostablePost(postId, req.user)
    const priced = await boostPricing.resolvePrice(durationKey)
    const endsPreview = new Date(Date.now() + priced.hours * 3600 * 1000)
    res.json({
      success: true,
      price: priced.price, currency: priced.currency, hours: priced.hours, durationLabel: priced.label,
      endsPreview,
      post: serializeCampaign({ objective: 'views', audience: {}, durationKey, durationHours: priced.hours, budget: priced.price, currency: priced.currency, stats: {} }, post).post,
    })
  } catch (err) { res.status(err.status || 500).json({ message: err.message }) }
})

// ───────────────────────── POST /api/boosts/create ─────────────────────────
// Crée la campagne (pending_payment) et déclenche le paiement. wallet → activée aussitôt ;
// ikeepay → renvoie une référence à interroger (aucun boost tant que non confirmé).
router.post('/create', protect, async (req, res) => {
  if (rateLimited(req.user._id)) return res.status(429).json({ message: 'Trop de tentatives. Réessayez dans un instant.' })
  let campaign = null
  try {
    const { postId, durationKey, objective, audience, provider, pin, phone, operator } = req.body
    const post = await assertBoostablePost(postId, req.user)
    const cfg = await boostPricing.getConfig()
    // PRIX OFFICIEL depuis la DB — on ignore totalement tout montant envoyé par le client.
    const priced = await boostPricing.resolvePrice(durationKey)
    await assertWithinLimits({ user: req.user, post, hours: priced.hours, price: priced.price, cfg })

    const obj = (cfg.objectives || []).includes(objective) ? objective : (cfg.objectives?.[0] || 'views')
    const aud = audience && typeof audience === 'object' ? {
      mode: audience.mode === 'custom' ? 'custom' : 'auto',
      country: String(audience.country || ''), region: String(audience.region || ''),
      ageRange: String(audience.ageRange || ''),
      interests: Array.isArray(audience.interests) ? audience.interests.map(String).slice(0, 20) : [],
    } : { mode: 'auto' }

    campaign = await BoostCampaign.create({
      user: req.user._id, post: post._id, objective: obj, audience: aud,
      durationKey: priced.durationKey, durationHours: priced.hours,
      budget: priced.price, currency: priced.currency,
      paymentProvider: provider === 'ikeepay' ? 'ikeepay' : 'wallet',
      status: 'pending_payment',
    })

    const result = await boostPayment.charge({ user: req.user, campaign, provider: campaign.paymentProvider, pin, phone, operator })
    auditBoost(req, { action: 'boost.create', label: 'Création campagne boost (' + campaign.paymentProvider + ')', entityId: campaign._id, statusCode: 201 })

    if (result.confirmed) {
      const fresh = await BoostCampaign.findById(campaign._id).populate('post')
      return res.status(201).json({ success: true, confirmed: true, status: fresh.status, campaign: serializeCampaign(fresh) })
    }
    return res.status(201).json({ success: true, confirmed: false, reference: result.reference, mode: result.mode,
      inline: result.inline || false, publicKey: result.publicKey || '', amount: campaign.budget, currency: campaign.currency,
      message: 'Demande de paiement envoyée.' })
  } catch (err) {
    // Paiement wallet échoué (solde/PIN) → on supprime la campagne pending pour ne pas polluer les limites.
    if (campaign && campaign.paymentProvider === 'wallet' && campaign.status === 'pending_payment') {
      await BoostCampaign.deleteOne({ _id: campaign._id, status: 'pending_payment' }).catch(() => {})
    }
    res.status(err.status || 500).json({ message: err.message })
  }
})

// ───────────────────────── GET /api/boosts/my-campaigns?status= ─────────────────────────
router.get('/my-campaigns', protect, async (req, res) => {
  try {
    const q = { user: req.user._id }
    const { status } = req.query
    if (status && BoostCampaign.STATUSES.includes(status)) q.status = status
    const rows = await BoostCampaign.find(q).sort({ createdAt: -1 }).limit(200).populate('post')
    res.json({ success: true, data: rows.map((c) => serializeCampaign(c)) })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ───────────────────────── GET /api/boosts/:id ─────────────────────────
router.get('/:id', protect, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Identifiant invalide' })
    const c = await BoostCampaign.findById(req.params.id).populate('post')
    if (!c) return res.status(404).json({ message: 'Campagne introuvable' })
    if (String(c.user) !== String(req.user._id) && req.user.role !== 'super_admin') return res.status(403).json({ message: 'Accès refusé' })
    res.json({ success: true, campaign: serializeCampaign(c) })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ───────────────────────── GET /api/boosts/:id/stats ─────────────────────────
router.get('/:id/stats', protect, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Identifiant invalide' })
    const c = await BoostCampaign.findById(req.params.id).populate('post')
    if (!c) return res.status(404).json({ message: 'Campagne introuvable' })
    if (String(c.user) !== String(req.user._id) && req.user.role !== 'super_admin') return res.status(403).json({ message: 'Accès refusé' })
    // Rafraîchit les stats vivantes (delta vs baseline) pour une campagne active.
    if (c.status === 'active' || c.status === 'pending_review') { try { await lifecycle.refreshStats(c) } catch (_) {} }
    const stats = lifecycle.computeStats(c, c.post)
    const now = Date.now()
    const timeRemainingMs = c.endsAt ? Math.max(0, new Date(c.endsAt).getTime() - now) : null
    const engagementRate = stats.impressions > 0
      ? Math.round(((stats.likes + stats.comments + stats.shares + stats.clicks) / stats.impressions) * 1000) / 10
      : 0
    res.json({
      success: true,
      stats: { ...stats, engagementRate }, cost: c.budget, currency: c.currency,
      status: c.status, startsAt: c.startsAt, endsAt: c.endsAt, timeRemainingMs,
      post: serializeCampaign(c).post,
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ───────────────────────── POST /api/boosts/:id/cancel ─────────────────────────
// Le propriétaire annule sa campagne (arrête la diffusion). Le remboursement éventuel
// relève de l'admin (POST /api/admin/boosts/:id/refund).
router.post('/:id/cancel', protect, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Identifiant invalide' })
    const c = await BoostCampaign.findById(req.params.id)
    if (!c) return res.status(404).json({ message: 'Campagne introuvable' })
    if (String(c.user) !== String(req.user._id)) return res.status(403).json({ message: 'Accès refusé' })
    if (!['pending_payment', 'pending_review', 'active', 'paused'].includes(c.status)) {
      return res.status(409).json({ message: 'Cette campagne ne peut plus être annulée.' })
    }
    c.status = 'cancelled'
    await c.save()
    auditBoost(req, { action: 'boost.cancel', label: 'Annulation campagne boost', entityId: c._id })
    res.json({ success: true, campaign: serializeCampaign(c) })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
