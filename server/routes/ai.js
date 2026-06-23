const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')
const { protect, authorize } = require('../middleware/auth')
const { upload } = require('../config/cloudinary')
const User = require('../models/User')
const AiConfig = require('../models/AiConfig')
const AiPackage = require('../models/AiPackage')
const AiSubscription = require('../models/AiSubscription')
const AiConversation = require('../models/AiConversation')
const AiUsageLog = require('../models/AiUsageLog')
const { generateChatResponse, OpenAiError } = require('../services/openaiService')
const {
  sendAiSubscriptionRequestEmail,
  sendAiSubscriptionApprovedEmail,
  sendAiSubscriptionRejectedEmail,
} = require('../utils/emailService')

function schoolId(req) { return req.user.school?._id || req.user.school }

const QUOTA_EXHAUSTED_MSG = 'Votre quota de questions IA est épuisé. Veuillez renouveler votre abonnement.'

const adminOnly = [protect, authorize('super_admin')]
const directorOnly = [protect, authorize('directeur')]

// ─────────────────────────────────────────────────────────────────────────────
// Rate limiting maison (mémoire) — protection anti-abus sur le chat IA
// ─────────────────────────────────────────────────────────────────────────────
const rateBuckets = new Map() // userId -> [timestamps]
function rateLimit({ windowMs = 60000, max = 20 } = {}) {
  return (req, res, next) => {
    const id = req.user._id.toString()
    const now = Date.now()
    const hits = (rateBuckets.get(id) || []).filter((t) => now - t < windowMs)
    if (hits.length >= max) {
      return res.status(429).json({ message: 'Trop de requêtes. Patientez quelques instants.' })
    }
    hits.push(now)
    rateBuckets.set(id, hits)
    next()
  }
}

// Renvoie la souscription IA active (approuvée) d'une école, ou null.
async function getActiveSubscription(sid) {
  if (!sid) return null
  return AiSubscription.findOne({ school: sid, status: 'approved' }).sort({ approvedAt: -1 })
}

// L'utilisateur peut-il utiliser le chat ? Directeur = d'office, sinon aiAccess requis.
function canUseChat(user) {
  if (user.role === 'directeur') return true
  if (['enseignant', 'parent'].includes(user.role)) return user.aiAccess === true
  return false
}

// ═════════════════════════════════════════════════════════════════════════════
// CONFIGURATION GLOBALE (administrateur)
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/ai/config
router.get('/config', ...adminOnly, async (req, res) => {
  try {
    const cfg = await AiConfig.getConfig()
    res.json({ success: true, data: cfg })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/ai/config
router.put('/config', ...adminOnly, async (req, res) => {
  try {
    const cfg = await AiConfig.getConfig()
    const fields = ['enabled', 'model', 'systemPrompt', 'temperature', 'maxTokens']
    for (const f of fields) if (req.body[f] !== undefined) cfg[f] = req.body[f]
    await cfg.save()
    res.json({ success: true, data: cfg })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ═════════════════════════════════════════════════════════════════════════════
// OFFRES IA (administrateur : CRUD ; directeur : liste des offres actives)
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/ai/packages — admin: toutes ; directeur: seulement actives
router.get('/packages', protect, async (req, res) => {
  try {
    const filter = req.user.role === 'super_admin' ? {} : { isActive: true }
    const packages = await AiPackage.find(filter).sort({ sortOrder: 1, price: 1 })
    res.json({ success: true, data: packages })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/ai/packages
router.post('/packages', ...adminOnly, async (req, res) => {
  try {
    const { name, totalQuestions, price } = req.body
    if (!name || !totalQuestions || price === undefined) {
      return res.status(400).json({ message: 'Nom, nombre de questions et prix requis' })
    }
    const pkg = await AiPackage.create(req.body)
    res.status(201).json({ success: true, data: pkg })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/ai/packages/:id
router.put('/packages/:id', ...adminOnly, async (req, res) => {
  try {
    const pkg = await AiPackage.findByIdAndUpdate(req.params.id, req.body, { new: true })
    if (!pkg) return res.status(404).json({ message: 'Offre introuvable' })
    res.json({ success: true, data: pkg })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// DELETE /api/ai/packages/:id
router.delete('/packages/:id', ...adminOnly, async (req, res) => {
  try {
    const pkg = await AiPackage.findByIdAndDelete(req.params.id)
    if (!pkg) return res.status(404).json({ message: 'Offre introuvable' })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ═════════════════════════════════════════════════════════════════════════════
// SOUSCRIPTIONS
// ═════════════════════════════════════════════════════════════════════════════

// POST /api/ai/subscription/request — directeur soumet une demande + capture paiement
router.post('/subscription/request', ...directorOnly, upload.single('paymentScreenshot'), async (req, res) => {
  try {
    const sid = schoolId(req)
    if (!sid) return res.status(400).json({ message: 'Aucune école associée à votre compte' })

    // Bloque les demandes en double (déjà en attente ou déjà approuvée active)
    const existing = await AiSubscription.findOne({ school: sid, status: { $in: ['pending', 'approved'] } })
    if (existing) {
      return res.status(400).json({
        message: existing.status === 'pending'
          ? 'Une demande est déjà en attente de validation.'
          : 'Votre établissement dispose déjà d\'une souscription IA active.',
      })
    }

    const pkg = await AiPackage.findById(req.body.packageId)
    if (!pkg || !pkg.isActive) return res.status(400).json({ message: 'Offre invalide ou indisponible' })

    const sub = await AiSubscription.create({
      director: req.user._id,
      school: sid,
      package: pkg._id,
      packageName: pkg.name,
      totalQuestions: pkg.totalQuestions,
      usedQuestions: 0,
      remainingQuestions: pkg.totalQuestions,
      price: pkg.price,
      currency: pkg.currency,
      paymentScreenshot: req.file?.path || null,
      status: 'pending',
    })

    // Notifie l'administrateur principal par email (best-effort)
    try {
      const admin = await User.findOne({ role: 'super_admin' })
      if (admin?.email) {
        await sendAiSubscriptionRequestEmail({
          to: admin.email,
          schoolName: req.user.school?.name || 'École',
          directorName: req.user.name,
          packageName: pkg.name,
          totalQuestions: pkg.totalQuestions,
          price: pkg.price,
          currency: pkg.currency,
        })
      }
    } catch (e) { console.error('Email demande IA:', e.message) }

    res.status(201).json({ success: true, data: sub })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/ai/subscription/status — directeur: statut + quota de son école
router.get('/subscription/status', protect, async (req, res) => {
  try {
    const sid = schoolId(req)
    if (!sid) return res.json({ success: true, data: null })
    const sub = await AiSubscription.findOne({ school: sid })
      .sort({ createdAt: -1 })
      .populate('package', 'name totalQuestions price')
    res.json({ success: true, data: sub })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/ai/subscriptions — admin: historique de toutes les demandes (filtre ?status=)
router.get('/subscriptions', ...adminOnly, async (req, res) => {
  try {
    const filter = {}
    if (req.query.status) filter.status = req.query.status
    const subs = await AiSubscription.find(filter)
      .populate('director', 'name email')
      .populate('school', 'name')
      .sort({ createdAt: -1 })
      .limit(500)
    res.json({ success: true, data: subs })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/ai/subscription/approve { id }
router.post('/subscription/approve', ...adminOnly, async (req, res) => {
  try {
    const sub = await AiSubscription.findById(req.body.id).populate('director', 'name email')
    if (!sub) return res.status(404).json({ message: 'Demande introuvable' })
    if (sub.status === 'approved') return res.status(400).json({ message: 'Demande déjà approuvée' })

    sub.status = 'approved'
    sub.approvedBy = req.user._id
    sub.approvedAt = new Date()
    await sub.save()

    // Le directeur obtient l'accès au chat d'office
    await User.updateOne({ _id: sub.director._id }, { $set: { aiAccess: true, aiAccessGrantedAt: new Date() } })

    try {
      if (sub.director?.email) {
        await sendAiSubscriptionApprovedEmail({
          to: sub.director.email,
          directorName: sub.director.name,
          packageName: sub.packageName,
          totalQuestions: sub.totalQuestions,
        })
      }
    } catch (e) { console.error('Email approbation IA:', e.message) }

    res.json({ success: true, data: sub })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/ai/subscription/reject { id, reason }
router.post('/subscription/reject', ...adminOnly, async (req, res) => {
  try {
    const sub = await AiSubscription.findById(req.body.id).populate('director', 'name email')
    if (!sub) return res.status(404).json({ message: 'Demande introuvable' })

    sub.status = 'rejected'
    sub.rejectedReason = req.body.reason || ''
    sub.approvedBy = req.user._id
    await sub.save()

    try {
      if (sub.director?.email) {
        await sendAiSubscriptionRejectedEmail({
          to: sub.director.email,
          directorName: sub.director.name,
          packageName: sub.packageName,
          reason: req.body.reason,
        })
      }
    } catch (e) { console.error('Email rejet IA:', e.message) }

    res.json({ success: true, data: sub })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/ai/subscription/:id/suspend — admin suspend l'accès IA d'une école
router.put('/subscription/:id/suspend', ...adminOnly, async (req, res) => {
  try {
    const sub = await AiSubscription.findById(req.params.id)
    if (!sub) return res.status(404).json({ message: 'Souscription introuvable' })
    sub.status = 'suspended'
    await sub.save()
    res.json({ success: true, data: sub })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/ai/subscription/:id/reactivate — admin réactive une souscription suspendue
router.put('/subscription/:id/reactivate', ...adminOnly, async (req, res) => {
  try {
    const sub = await AiSubscription.findById(req.params.id)
    if (!sub) return res.status(404).json({ message: 'Souscription introuvable' })
    // Réactive seulement s'il reste du quota, sinon marque comme expirée
    sub.status = sub.remainingQuestions > 0 ? 'approved' : 'expired'
    await sub.save()
    res.json({ success: true, data: sub })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ═════════════════════════════════════════════════════════════════════════════
// GESTION DES ACCÈS (directeur → enseignants & parents de son école)
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/ai/access — liste des enseignants/parents de l'école avec leur état d'accès
router.get('/access', ...directorOnly, async (req, res) => {
  try {
    const sid = schoolId(req)
    if (!sid) return res.json({ success: true, data: [] })
    const users = await User.find({ school: sid, role: { $in: ['enseignant', 'parent'] } })
      .select('name email role aiAccess aiAccessGrantedAt avatar')
      .sort({ role: 1, name: 1 })
    res.json({ success: true, data: users })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/ai/access/grant { userId }
router.post('/access/grant', ...directorOnly, async (req, res) => {
  try {
    const sid = schoolId(req)
    const target = await User.findOne({ _id: req.body.userId, school: sid, role: { $in: ['enseignant', 'parent'] } })
    if (!target) return res.status(404).json({ message: 'Utilisateur introuvable dans votre école' })
    target.aiAccess = true
    target.aiAccessGrantedAt = new Date()
    await target.save()
    res.json({ success: true, data: { _id: target._id, aiAccess: true } })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/ai/access/revoke { userId }
router.post('/access/revoke', ...directorOnly, async (req, res) => {
  try {
    const sid = schoolId(req)
    const target = await User.findOne({ _id: req.body.userId, school: sid, role: { $in: ['enseignant', 'parent'] } })
    if (!target) return res.status(404).json({ message: 'Utilisateur introuvable dans votre école' })
    target.aiAccess = false
    await target.save()
    res.json({ success: true, data: { _id: target._id, aiAccess: false } })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ═════════════════════════════════════════════════════════════════════════════
// CHAT IA
// ═════════════════════════════════════════════════════════════════════════════

// POST /api/ai/chat { message, conversationId? }
router.post('/chat', protect, rateLimit({ windowMs: 60000, max: 20 }), async (req, res) => {
  try {
    const { message, conversationId } = req.body
    if (!message || !String(message).trim()) {
      return res.status(400).json({ message: 'Votre question est vide.' })
    }
    if (!canUseChat(req.user)) {
      return res.status(403).json({ message: "Vous n'avez pas accès à l'assistant IA. Demandez l'accès à votre directeur." })
    }

    const cfg = await AiConfig.getConfig()
    if (!cfg.enabled) {
      return res.status(403).json({ message: "L'assistant IA est temporairement désactivé par l'administrateur." })
    }

    const sid = schoolId(req)
    const sub = await getActiveSubscription(sid)
    if (!sub) {
      return res.status(403).json({ message: "Aucune souscription IA active pour votre établissement." })
    }
    if (sub.remainingQuestions <= 0) {
      return res.status(403).json({ message: QUOTA_EXHAUSTED_MSG })
    }

    // Charge / crée la conversation
    let conversation
    if (conversationId) {
      conversation = await AiConversation.findOne({ _id: conversationId, user: req.user._id })
    }
    if (!conversation) {
      conversation = new AiConversation({
        user: req.user._id,
        school: sid,
        title: String(message).trim().slice(0, 60),
        messages: [],
      })
    }

    // Construit le contexte (10 derniers échanges) + nouvelle question
    const history = conversation.messages.slice(-10).map((m) => ({ role: m.role, content: m.content }))
    const userMessage = { role: 'user', content: String(message).trim() }

    let result
    try {
      result = await generateChatResponse({ messages: [...history, userMessage], config: cfg })
    } catch (err) {
      const status = err instanceof OpenAiError ? err.status : 500
      return res.status(status).json({ message: err.message })
    }

    // Décrément ATOMIQUE du quota (garde anti-course : ne descend pas sous 0)
    const updated = await AiSubscription.findOneAndUpdate(
      { _id: sub._id, remainingQuestions: { $gt: 0 } },
      { $inc: { usedQuestions: 1, remainingQuestions: -1 } },
      { new: true }
    )
    if (!updated) {
      return res.status(403).json({ message: QUOTA_EXHAUSTED_MSG })
    }
    // Si c'était la dernière question, marque la souscription comme expirée
    if (updated.remainingQuestions === 0) {
      await AiSubscription.updateOne({ _id: updated._id }, { $set: { status: 'expired' } })
    }

    // Persiste l'échange
    conversation.messages.push(userMessage)
    conversation.messages.push({ role: 'assistant', content: result.content })
    await conversation.save()

    // Journalise l'utilisation (stats + anti-abus)
    AiUsageLog.create({
      user: req.user._id,
      school: sid,
      subscription: sub._id,
      model: result.model,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      totalTokens: result.usage.totalTokens,
    }).catch((e) => console.error('AiUsageLog:', e.message))

    res.json({
      success: true,
      data: {
        conversationId: conversation._id,
        answer: result.content,
        remainingQuestions: updated.remainingQuestions,
        usedQuestions: updated.usedQuestions,
        totalQuestions: updated.totalQuestions,
      },
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/ai/history — liste des conversations de l'utilisateur courant
router.get('/history', protect, async (req, res) => {
  try {
    const conversations = await AiConversation.find({ user: req.user._id })
      .select('title updatedAt messages')
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean()
    // Allège la charge : ne renvoie pas tout le contenu dans la liste
    const data = conversations.map((c) => ({
      _id: c._id,
      title: c.title,
      updatedAt: c.updatedAt,
      messageCount: c.messages?.length || 0,
    }))
    res.json({ success: true, data })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/ai/conversations/:id — détail d'une conversation
router.get('/conversations/:id', protect, async (req, res) => {
  try {
    const conversation = await AiConversation.findOne({ _id: req.params.id, user: req.user._id })
    if (!conversation) return res.status(404).json({ message: 'Conversation introuvable' })
    res.json({ success: true, data: conversation })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// DELETE /api/ai/conversations/:id
router.delete('/conversations/:id', protect, async (req, res) => {
  try {
    const conv = await AiConversation.findOneAndDelete({ _id: req.params.id, user: req.user._id })
    if (!conv) return res.status(404).json({ message: 'Conversation introuvable' })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ═════════════════════════════════════════════════════════════════════════════
// STATISTIQUES
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/ai/stats — admin: stats globales ; directeur: stats de son école (par utilisateur)
router.get('/stats', protect, async (req, res) => {
  try {
    if (req.user.role === 'super_admin') {
      const [subAgg, totalQuestions, schoolsWithAi, pendingCount, perSchool] = await Promise.all([
        AiSubscription.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 }, totalQ: { $sum: '$totalQuestions' }, usedQ: { $sum: '$usedQuestions' } } },
        ]),
        AiUsageLog.countDocuments({}),
        AiSubscription.distinct('school', { status: 'approved' }),
        AiSubscription.countDocuments({ status: 'pending' }),
        AiSubscription.aggregate([
          { $match: { status: { $in: ['approved', 'expired', 'suspended'] } } },
          { $group: { _id: '$school', used: { $sum: '$usedQuestions' }, total: { $sum: '$totalQuestions' } } },
          { $lookup: { from: 'schools', localField: '_id', foreignField: '_id', as: 'school' } },
          { $unwind: { path: '$school', preserveNullAndEmptyArrays: true } },
          { $project: { schoolName: '$school.name', used: 1, total: 1 } },
          { $sort: { used: -1 } },
          { $limit: 50 },
        ]),
      ])
      const byStatus = subAgg.reduce((o, s) => ({ ...o, [s._id]: s.count }), {})
      const totalUsed = subAgg.reduce((sum, s) => sum + (s.usedQ || 0), 0)
      const totalAllowed = subAgg.reduce((sum, s) => sum + (s.totalQ || 0), 0)
      return res.json({
        success: true,
        data: {
          scope: 'admin',
          byStatus,
          activeSchools: schoolsWithAi.length,
          pendingRequests: pendingCount,
          totalQuestionsAsked: totalQuestions,
          totalUsedQuota: totalUsed,
          totalAllowedQuota: totalAllowed,
          perSchool,
        },
      })
    }

    // Directeur : consommation par utilisateur de son école
    if (req.user.role === 'directeur') {
      const sid = schoolId(req)
      if (!sid) return res.json({ success: true, data: { scope: 'school', users: [], subscription: null } })
      const sub = await getActiveSubscription(sid)
      const perUser = await AiUsageLog.aggregate([
        { $match: { school: new mongoose.Types.ObjectId(sid.toString()) } },
        { $group: { _id: '$user', questions: { $sum: 1 }, tokens: { $sum: '$totalTokens' } } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        { $project: { name: '$user.name', role: '$user.role', questions: 1, tokens: 1 } },
        { $sort: { questions: -1 } },
      ])
      return res.json({
        success: true,
        data: {
          scope: 'school',
          subscription: sub ? {
            packageName: sub.packageName,
            totalQuestions: sub.totalQuestions,
            usedQuestions: sub.usedQuestions,
            remainingQuestions: sub.remainingQuestions,
          } : null,
          users: perUser,
        },
      })
    }

    return res.status(403).json({ message: 'Accès refusé' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
