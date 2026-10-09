const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const mongoose = require('mongoose')
const { protect, authorize } = require('../middleware/auth')
const { upload } = require('../config/cloudinary')
const User = require('../models/User')
const AiConfig = require('../models/AiConfig')
const AiPackage = require('../models/AiPackage')
const AiSubscription = require('../models/AiSubscription')
const AiConversation = require('../models/AiConversation')
const AiUsageLog = require('../models/AiUsageLog')
const UserAiSubscription = require('../models/UserAiSubscription')
const PaymentIntent = require('../models/PaymentIntent')
const wallet = require('../services/walletService')
const ikeepay = require('../services/ikeepayService')
const {
  getUserQuotaInfo,
  consumeUserQuota,
  refundUserQuota,
  USER_QUOTA_EXHAUSTED_MSG,
} = require('../services/aiQuotaService')
const { performWebSearch, buildSearchContext } = require('../services/webSearchService')
const { generateChatResponse, OpenAiError } = require('../services/openaiService')
const {
  sendAiSubscriptionRequestEmail,
  sendAiSubscriptionApprovedEmail,
  sendAiSubscriptionRejectedEmail,
} = require('../utils/emailService')

function schoolId(req) { return req.user.school?._id || req.user.school }

function genRef(prefix) {
  return prefix + '_' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex')
}
function callbackUrl() {
  const base = process.env.SERVER_URL || ''
  return base.replace(/\/$/, '') + '/api/payments/webhook'
}

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
  // Cherche en priorité une souscription approuvée avec du quota restant
  const withQuota = await AiSubscription.findOne({
    school: sid,
    status: 'approved',
    remainingQuestions: { $gt: 0 },
  }).sort({ approvedAt: -1 })
  if (withQuota) return withQuota

  // Repli : souscription approuvée la plus récente (pour renvoyer le quota épuisé si applicable)
  return AiSubscription.findOne({ school: sid, status: 'approved' }).sort({ approvedAt: -1 })
}

// L'utilisateur peut-il utiliser le chat ? Directeur & admin = d'office, utilisateur & enseignant/parent/élève autorisés.
function canUseChat(user) {
  if (['directeur', 'super_admin', 'admin', 'vice_principal'].includes(user.role)) return true
  if (['enseignant', 'parent', 'utilisateur', 'eleve'].includes(user.role)) return true
  return false
}

// ═════════════════════════════════════════════════════════════════════════════
// CONFIGURATION GLOBALE (administrateur)
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/ai/config
router.get('/config', ...adminOnly, async (req, res) => {
  try {
    const cfg = await AiConfig.getConfig()

    // Migration automatique si un ancien modèle Gemini déprécié était resté stocké
    if (cfg.provider === 'gemini' && (!cfg.model || cfg.model.includes('gemini-1.5') || cfg.model.includes('gemini-2.0'))) {
      cfg.model = 'gemini-3.5-flash'
      await cfg.save()
    }

    const json = cfg.toObject()
    const mask = (k) => (k && k.length > 8 ? `${k.slice(0, 4)}••••••••${k.slice(-4)}` : k ? '••••••••' : '')
    res.json({
      success: true,
      data: {
        ...json,
        geminiApiKeyMasked: mask(cfg.geminiApiKey || process.env.GEMINI_API_KEY),
        openaiApiKeyMasked: mask(cfg.openaiApiKey || process.env.OPENAI_API_KEY),
        anthropicApiKeyMasked: mask(cfg.anthropicApiKey || process.env.ANTHROPIC_API_KEY),
        groqApiKeyMasked: mask(cfg.groqApiKey || process.env.GROQ_API_KEY),
        hasGeminiKey: !!(cfg.geminiApiKey || process.env.GEMINI_API_KEY),
        hasOpenaiKey: !!(cfg.openaiApiKey || process.env.OPENAI_API_KEY),
        hasAnthropicKey: !!(cfg.anthropicApiKey || process.env.ANTHROPIC_API_KEY),
        hasGroqKey: !!(cfg.groqApiKey || process.env.GROQ_API_KEY),
      },
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/ai/config
router.put('/config', ...adminOnly, async (req, res) => {
  try {
    const cfg = await AiConfig.getConfig()
    const fields = ['enabled', 'provider', 'model', 'systemPrompt', 'temperature', 'maxTokens']
    for (const f of fields) if (req.body[f] !== undefined) cfg[f] = req.body[f]

    const keyFields = ['geminiApiKey', 'openaiApiKey', 'anthropicApiKey', 'groqApiKey']
    for (const k of keyFields) {
      if (req.body[k] !== undefined && typeof req.body[k] === 'string') {
        const val = req.body[k].trim()
        if (val && !val.includes('••••')) {
          cfg[k] = val
        }
      }
    }

    await cfg.save()

    const mask = (k) => (k && k.length > 8 ? `${k.slice(0, 4)}••••••••${k.slice(-4)}` : k ? '••••••••' : '')
    res.json({
      success: true,
      data: {
        ...cfg.toObject(),
        geminiApiKeyMasked: mask(cfg.geminiApiKey || process.env.GEMINI_API_KEY),
        openaiApiKeyMasked: mask(cfg.openaiApiKey || process.env.OPENAI_API_KEY),
        anthropicApiKeyMasked: mask(cfg.anthropicApiKey || process.env.ANTHROPIC_API_KEY),
        groqApiKeyMasked: mask(cfg.groqApiKey || process.env.GROQ_API_KEY),
        hasGeminiKey: !!(cfg.geminiApiKey || process.env.GEMINI_API_KEY),
        hasOpenaiKey: !!(cfg.openaiApiKey || process.env.OPENAI_API_KEY),
        hasAnthropicKey: !!(cfg.anthropicApiKey || process.env.ANTHROPIC_API_KEY),
        hasGroqKey: !!(cfg.groqApiKey || process.env.GROQ_API_KEY),
      },
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/ai/test-key — Teste en direct une clé API et un modèle IA
router.post('/test-key', ...adminOnly, async (req, res) => {
  try {
    const { provider = 'gemini', apiKey, model } = req.body
    const cfg = await AiConfig.getConfig()

    let resolvedKey = (apiKey || '').trim()
    if (!resolvedKey || resolvedKey.includes('••••')) {
      if (provider === 'gemini') resolvedKey = cfg.geminiApiKey || process.env.GEMINI_API_KEY
      else if (provider === 'openai') resolvedKey = cfg.openaiApiKey || process.env.OPENAI_API_KEY
      else if (provider === 'anthropic') resolvedKey = cfg.anthropicApiKey || process.env.ANTHROPIC_API_KEY
      else if (provider === 'groq') resolvedKey = cfg.groqApiKey || process.env.GROQ_API_KEY
    }

    if (!resolvedKey) {
      return res.status(400).json({
        message: `Veuillez renseigner une clé API valide pour le fournisseur sélectionné (${provider.toUpperCase()}).`,
      })
    }

    let resolvedModel = (model || '').trim()
    if (provider === 'gemini') {
      if (!resolvedModel || resolvedModel.includes('gemini-2.0') || resolvedModel.includes('gemini-1.5')) {
        resolvedModel = 'gemini-3.5-flash'
      }
    } else if (provider === 'openai') {
      resolvedModel = resolvedModel || 'gpt-4o-mini'
    } else if (provider === 'groq') {
      resolvedModel = resolvedModel || 'llama-3.3-70b-versatile'
    } else if (provider === 'anthropic') {
      resolvedModel = resolvedModel || 'claude-opus-5-5'
    }

    const testConfig = {
      provider,
      model: resolvedModel,
      geminiApiKey: provider === 'gemini' ? resolvedKey : '',
      openaiApiKey: provider === 'openai' ? resolvedKey : '',
      anthropicApiKey: provider === 'anthropic' ? resolvedKey : '',
      groqApiKey: provider === 'groq' ? resolvedKey : '',
      temperature: 0.2,
      maxTokens: 50,
      systemPrompt: "Tu es un testeur de connexion. Réponds brièvement.",
    }

    const result = await generateChatResponse({
      messages: [{ role: 'user', content: 'Dis en français : "Connexion réussie avec l\'IA !"' }],
      config: testConfig,
    })

    res.json({
      success: true,
      message: 'Connexion établie avec succès !',
      answer: result.content,
      model: result.model,
    })
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message || 'Échec du test de connexion avec le modèle IA.',
    })
  }
})

// GET /api/ai/health — Vérifie l'état de l'assistant IA et la présence de la clé API pour les utilisateurs
router.get('/health', protect, async (req, res) => {
  try {
    const cfg = await AiConfig.getConfig()
    if (!cfg.enabled) {
      return res.json({
        ok: false,
        status: 'disabled',
        message: "L'assistant IA est temporairement désactivé par l'administrateur.",
        provider: cfg.provider,
        model: cfg.model,
      })
    }

    const provider = cfg.provider || 'gemini'
    let hasKey = false
    if (provider === 'gemini') {
      hasKey = !!(cfg.geminiApiKey || process.env.GEMINI_API_KEY)
    } else if (provider === 'openai') {
      hasKey = !!(cfg.openaiApiKey || process.env.OPENAI_API_KEY)
    } else if (provider === 'anthropic') {
      hasKey = !!(cfg.anthropicApiKey || process.env.ANTHROPIC_API_KEY)
    } else if (provider === 'groq') {
      hasKey = !!(cfg.groqApiKey || process.env.GROQ_API_KEY)
    }

    if (!hasKey) {
      return res.json({
        ok: false,
        status: 'missing_key',
        provider,
        model: cfg.model,
        message: `Clé API ${provider.toUpperCase()} manquante. Veuillez configurer la clé API dans le panneau d'administration.`,
      })
    }

    res.json({
      ok: true,
      status: 'configured',
      provider,
      model: cfg.model,
    })
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message })
  }
})

// ═════════════════════════════════════════════════════════════════════════════
// OFFRES IA (administrateur : CRUD ; directeur : liste des offres actives)
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/ai/packages — admin: toutes ; autres: actives selon target
router.get('/packages', protect, async (req, res) => {
  try {
    const filter = req.user.role === 'super_admin' ? {} : { isActive: true }
    if (req.query.target) {
      filter.target = { $in: [req.query.target, 'all'] }
    }
    const packages = await AiPackage.find(filter).sort({ sortOrder: 1, price: 1 })
    res.json({ success: true, data: packages })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/ai/user-packages — packages visibles pour les utilisateurs (role: 'utilisateur')
router.get('/user-packages', protect, async (req, res) => {
  try {
    let packages = await AiPackage.find({
      isActive: true,
      target: { $in: ['user', 'all'] },
    }).sort({ sortOrder: 1, price: 1 })

    // Auto-création de l'offre par défaut si aucune offre n'existe encore pour les utilisateurs (100 requêtes = 1 000 F CFA)
    if (packages.length === 0) {
      try {
        const defaultPkg = await AiPackage.create({
          name: 'Pack Découverte 100 Requêtes',
          description: 'Idéal pour le chat IA et les cours interactifs',
          totalQuestions: 100,
          price: 1000,
          currency: 'F CFA',
          target: 'user',
          isActive: true,
          sortOrder: 1,
        })
        packages = [defaultPkg]
      } catch (_) {}
    }

    res.json({ success: true, data: packages })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/ai/user-quota — consulte le quota de l'utilisateur connecté
router.get('/user-quota', protect, async (req, res) => {
  try {
    const info = await getUserQuotaInfo(req.user._id)
    res.json({ success: true, data: info })
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

// POST /api/ai/subscription/request — directeur soumet une demande + capture paiement (manuel / virement)
router.post('/subscription/request', ...directorOnly, upload.single('paymentScreenshot'), async (req, res) => {
  try {
    const sid = schoolId(req)
    if (!sid) return res.status(400).json({ message: 'Aucune école associée à votre compte' })

    // Bloque les demandes en double (déjà en attente ou déjà approuvée active avec quota)
    const existing = await AiSubscription.findOne({
      school: sid,
      $or: [
        { status: 'pending' },
        { status: 'approved', remainingQuestions: { $gt: 0 } },
      ],
    })
    if (existing) {
      return res.status(400).json({
        message: existing.status === 'pending'
          ? 'Une demande est déjà en attente de validation.'
          : `Votre établissement dispose déjà d'une souscription active (${existing.remainingQuestions} questions restantes).`,
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
      paymentMethod: 'screenshot',
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

// POST /api/ai/subscription/subscribe-wallet — paiement DIRECT avec le solde portefeuille (avec PIN)
router.post('/subscription/subscribe-wallet', ...directorOnly, async (req, res) => {
  try {
    const { packageId, pin } = req.body
    const sid = schoolId(req)
    if (!sid) return res.status(400).json({ message: 'Aucune école associée à votre compte' })
    if (!packageId) return res.status(400).json({ message: 'Offre IA requise' })
    if (!pin) return res.status(400).json({ message: 'Code PIN requis' })

    const pkg = await AiPackage.findById(packageId)
    if (!pkg || !pkg.isActive) return res.status(404).json({ message: 'Offre IA introuvable ou indisponible' })

    // Vérifie si une souscription active a encore du quota
    const activeSub = await AiSubscription.findOne({
      school: sid,
      status: 'approved',
      remainingQuestions: { $gt: 0 },
    }).sort({ approvedAt: -1 })

    if (activeSub) {
      return res.status(400).json({
        message: `Votre établissement dispose déjà d'une souscription active (${activeSub.remainingQuestions} questions restantes).`,
      })
    }

    // Vérifie le code PIN du portefeuille
    const u = await User.findById(req.user._id).select('+walletPin')
    if (!u.walletPin) {
      return res.status(400).json({ message: "Veuillez d'abord créer votre code PIN dans votre portefeuille." })
    }
    const pinOk = await bcrypt.compare(String(pin), u.walletPin)
    if (!pinOk) return res.status(401).json({ message: 'Code PIN incorrect.' })

    // Vérifie le solde du portefeuille
    const w = await wallet.getOrCreateWallet(req.user._id, { role: req.user.role, school: sid })
    const price = Number(pkg.price)
    if (w.balance < price) {
      return res.status(400).json({
        message: `Solde insuffisant (${w.balance.toLocaleString()} FCFA disponible, ${price.toLocaleString()} FCFA requis). Veuillez recharger votre portefeuille.`,
      })
    }

    // Marque toute ancienne souscription comme expirée
    await AiSubscription.updateMany(
      { school: sid, status: { $in: ['pending', 'approved'] } },
      { $set: { status: 'expired' } }
    )

    // Débit du solde du directeur
    await wallet.debit(req.user._id, {
      amount: price,
      type: 'ai_subscription',
      description: `Souscription IA — ${pkg.name}`,
      meta: { packageId: pkg._id, packageName: pkg.name, questions: pkg.totalQuestions },
    })

    // Création immédiate de la souscription approuvée
    const sub = await AiSubscription.create({
      director: req.user._id,
      school: sid,
      package: pkg._id,
      packageName: pkg.name,
      totalQuestions: pkg.totalQuestions,
      usedQuestions: 0,
      remainingQuestions: pkg.totalQuestions,
      price,
      currency: pkg.currency || 'F CFA',
      paymentMethod: 'wallet',
      status: 'approved',
      approvedAt: new Date(),
      approvedBy: req.user._id,
    })

    // Activation immédiate de l'accès chat IA du directeur
    await User.updateOne({ _id: req.user._id }, { $set: { aiAccess: true, aiAccessGrantedAt: new Date() } })

    // Encaissement du revenu par l'administrateur de la plateforme (best-effort)
    try {
      const admin = await wallet.getPlatformAdmin()
      if (admin) {
        await wallet.credit(admin._id, {
          amount: price,
          type: 'ai_subscription_revenue',
          role: 'admin',
          counterparty: req.user._id,
          description: `Souscription IA (portefeuille) — ${pkg.name} (${req.user.school?.name || 'École'})`,
          meta: { aiSubscription: String(sub._id), packageId: String(pkg._id), method: 'wallet' },
        })
      }
    } catch (e) {
      console.error('[subscribe-wallet:admin_credit] error:', e.message)
    }

    res.status(201).json({
      success: true,
      data: sub,
      message: 'Souscription IA activée avec succès depuis votre portefeuille !',
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/ai/subscription/subscribe-mobile — souscrit via débit Mobile Money Ikeepay H2H
router.post('/subscription/subscribe-mobile', ...directorOnly, async (req, res) => {
  try {
    const { packageId, phone, operator, country = 'CM', otp } = req.body
    const sid = schoolId(req)
    if (!sid) return res.status(400).json({ message: 'Aucune école associée à votre compte' })
    if (!packageId) return res.status(400).json({ message: 'Offre IA requise' })

    const rawPhone = String(phone || '').replace(/[^0-9]/g, '')
    if (!rawPhone || !operator) {
      return res.status(400).json({ message: 'Numéro de téléphone et opérateur Mobile Money requis pour le débit direct.' })
    }

    const pkg = await AiPackage.findById(packageId)
    if (!pkg || !pkg.isActive) return res.status(404).json({ message: 'Offre IA introuvable ou indisponible' })

    // Vérifie si une souscription active a encore du quota
    const activeSub = await AiSubscription.findOne({
      school: sid,
      status: 'approved',
      remainingQuestions: { $gt: 0 },
    }).sort({ approvedAt: -1 })

    if (activeSub) {
      return res.status(400).json({
        message: `Votre établissement dispose déjà d'une souscription active (${activeSub.remainingQuestions} questions restantes).`,
      })
    }

    const reference = genRef('ais')
    const { mode } = await ikeepay.resolveConfig()
    const normCountry = String(country || 'CM').trim().toUpperCase()
    const targetCurrency = ikeepay.getCountryCurrency ? ikeepay.getCountryCurrency(normCountry) : (normCountry === 'CM' ? 'XAF' : 'XOF')
    const amount = Number(pkg.price)

    const intent = await PaymentIntent.create({
      reference,
      purpose: 'ai_subscription',
      amount,
      currency: targetCurrency,
      payerPhone: rawPhone,
      payerOperator: operator,
      payerName: req.user.name,
      payerEmail: req.user.email || '',
      initiatedBy: req.user._id,
      school: sid,
      mode,
      meta: {
        packageId: String(pkg._id),
        packageName: pkg.name,
        totalQuestions: pkg.totalQuestions,
        schoolId: String(sid),
        directorId: String(req.user._id),
      },
    })

    const result = await ikeepay.createCollection({
      amount,
      phone: rawPhone,
      operator,
      reference,
      callbackUrl: callbackUrl(),
      customerEmail: req.user.email || '',
      country: normCountry,
      currency: targetCurrency,
      otp,
    })

    if (result.transaction_id || result.id) {
      intent.providerTransactionId = result.transaction_id || result.id
      await intent.save()
    }

    const paymentLink = result.payment_link || result.redirect_url || (result.data && (result.data.payment_link || result.data.redirect_url)) || null

    res.json({
      success: true,
      reference,
      amount,
      mode,
      currency: targetCurrency,
      transaction: result,
      payment_link: paymentLink,
      message: 'Demande de paiement envoyée. Validez sur votre téléphone Mobile Money.',
    })
  } catch (err) {
    console.error('subscribe-mobile error:', err.message)
    res.status(err.status || 500).json({ message: err.message, data: err.data })
  }
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
// SOUSCRIPTIONS & RECHARGES IA UTILISATEURS (role: 'utilisateur')
// ═════════════════════════════════════════════════════════════════════════════

// POST /api/ai/user-subscription/wallet — Recharge via portefeuille KATD-SCHÜLE
router.post('/user-subscription/wallet', protect, async (req, res) => {
  try {
    const { packageId, pin } = req.body
    if (!packageId) return res.status(400).json({ message: 'Forfait IA requis' })

    const user = await User.findById(req.user._id).select('+walletPin')
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' })

    if (user.walletPin && pin) {
      const pinMatch = await user.matchPin(pin)
      if (!pinMatch) return res.status(400).json({ message: 'Code PIN portefeuille incorrect' })
    }

    const pkg = await AiPackage.findById(packageId)
    if (!pkg || !pkg.isActive) return res.status(404).json({ message: 'Forfait IA introuvable ou inactif' })

    const price = Number(pkg.price)
    const userWallet = await wallet.getOrCreateWallet(user._id)
    if (userWallet.balance < price) {
      return res.status(400).json({
        message: `Solde insuffisant dans votre portefeuille (${userWallet.balance.toLocaleString('fr-FR')} ${userWallet.currency}). Veuillez recharger votre portefeuille ou payer par Mobile Money.`,
        code: 'INSUFFICIENT_FUNDS',
      })
    }

    const reference = genRef('uai_w')

    // 1. Débit du portefeuille de l'utilisateur
    await wallet.debit(user._id, {
      amount: price,
      type: 'ai_user_subscription',
      role: user.role,
      description: `Recharge IA — ${pkg.name} (+${pkg.totalQuestions} requêtes)`,
      meta: { packageId: String(pkg._id), totalQuestions: pkg.totalQuestions, reference },
    })

    // 2. Crédit de l'administrateur plateforme
    try {
      const admin = await wallet.getPlatformAdmin()
      if (admin) {
        await wallet.credit(admin._id, {
          amount: price,
          type: 'ai_subscription_revenue',
          role: 'admin',
          counterparty: user._id,
          description: `Recharge IA utilisateur (portefeuille) — ${pkg.name} de ${user.name}`,
          meta: { packageId: String(pkg._id), userId: String(user._id), reference },
        })
      }
    } catch (adminErr) {
      console.error('[user-subscription:wallet] credit admin error:', adminErr.message)
    }

    // 3. Création de l'enregistrement de souscription
    const sub = await UserAiSubscription.create({
      user: user._id,
      package: pkg._id,
      packageName: pkg.name,
      totalQuestions: pkg.totalQuestions,
      price,
      currency: pkg.currency || 'F CFA',
      paymentMethod: 'wallet',
      paymentReference: reference,
      status: 'approved',
      approvedAt: new Date(),
    })

    // 4. Crédit effectif du quota à l'utilisateur
    user.aiQuestionsQuota = (user.aiQuestionsQuota || 0) + pkg.totalQuestions
    user.aiAccessDisabled = false
    user.aiAccess = true
    user.aiAccessGrantedAt = new Date()
    await user.save()

    const quota = await getUserQuotaInfo(user._id)

    res.json({
      success: true,
      data: sub,
      quota,
      message: `Félicitations ! Votre forfait IA a été activé (+${pkg.totalQuestions} requêtes).`,
    })
  } catch (err) {
    console.error('user-subscription/wallet error:', err.message)
    res.status(500).json({ message: err.message })
  }
})

// POST /api/ai/user-subscription/mobile-initiate — Démarre paiement Mobile Money (Ikeepay H2H)
router.post('/user-subscription/mobile-initiate', protect, async (req, res) => {
  try {
    const { packageId, phone, operator, country = 'CM', otp } = req.body
    if (!packageId) return res.status(400).json({ message: 'Forfait IA requis' })

    const rawPhone = String(phone || '').replace(/[^0-9]/g, '')
    if (!rawPhone || !operator) {
      return res.status(400).json({ message: 'Numéro de téléphone et opérateur Mobile Money requis.' })
    }

    const pkg = await AiPackage.findById(packageId)
    if (!pkg || !pkg.isActive) return res.status(404).json({ message: 'Forfait IA introuvable ou indisponible' })

    const reference = genRef('uai_m')
    const { mode } = await ikeepay.resolveConfig()
    const normCountry = String(country || 'CM').trim().toUpperCase()
    const targetCurrency = ikeepay.getCountryCurrency ? ikeepay.getCountryCurrency(normCountry) : (normCountry === 'CM' ? 'XAF' : 'XOF')
    const amount = Number(pkg.price)

    const intent = await PaymentIntent.create({
      reference,
      purpose: 'user_ai_subscription',
      amount,
      currency: targetCurrency,
      payerPhone: rawPhone,
      payerOperator: operator,
      payerName: req.user.name,
      payerEmail: req.user.email || '',
      initiatedBy: req.user._id,
      mode,
      meta: {
        packageId: String(pkg._id),
        packageName: pkg.name,
        totalQuestions: pkg.totalQuestions,
        userId: String(req.user._id),
      },
    })

    await UserAiSubscription.create({
      user: req.user._id,
      package: pkg._id,
      packageName: pkg.name,
      totalQuestions: pkg.totalQuestions,
      price: amount,
      currency: targetCurrency,
      paymentMethod: 'mobile_money',
      paymentReference: reference,
      paymentIntent: intent._id,
      status: 'pending',
    })

    const result = await ikeepay.createCollection({
      amount,
      phone: rawPhone,
      operator,
      reference,
      callbackUrl: callbackUrl(),
      customerEmail: req.user.email || '',
      country: normCountry,
      currency: targetCurrency,
      otp,
    })

    if (result.transaction_id || result.id) {
      intent.providerTransactionId = result.transaction_id || result.id
      await intent.save()
    }

    const paymentLink = result.payment_link || result.redirect_url || (result.data && (result.data.payment_link || result.data.redirect_url)) || null

    res.json({
      success: true,
      reference,
      amount,
      mode,
      currency: targetCurrency,
      transaction: result,
      payment_link: paymentLink,
      message: 'Demande de paiement envoyée. Validez sur votre téléphone Mobile Money pour activer vos requêtes IA.',
    })
  } catch (err) {
    console.error('user-subscription/mobile-initiate error:', err.message)
    res.status(err.status || 500).json({ message: err.message, data: err.data })
  }
})

// ═════════════════════════════════════════════════════════════════════════════
// GESTION IA UTILISATEURS (administrateur principal)
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/ai/admin/user-ai-config
router.get('/admin/user-ai-config', ...adminOnly, async (req, res) => {
  try {
    const cfg = await AiConfig.getConfig()
    res.json({
      success: true,
      data: {
        userFreeTrialQuota: typeof cfg.userFreeTrialQuota === 'number' ? cfg.userFreeTrialQuota : 20,
        userAiGlobalEnabled: cfg.userAiGlobalEnabled !== false,
        enabled: cfg.enabled !== false,
      },
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/ai/admin/user-ai-config
router.post('/admin/user-ai-config', ...adminOnly, async (req, res) => {
  try {
    const { userFreeTrialQuota, userAiGlobalEnabled } = req.body
    const cfg = await AiConfig.getConfig()
    if (userFreeTrialQuota !== undefined) {
      cfg.userFreeTrialQuota = Math.max(0, parseInt(userFreeTrialQuota, 10) || 0)
    }
    if (userAiGlobalEnabled !== undefined) {
      cfg.userAiGlobalEnabled = Boolean(userAiGlobalEnabled)
    }
    await cfg.save()
    res.json({
      success: true,
      data: {
        userFreeTrialQuota: cfg.userFreeTrialQuota,
        userAiGlobalEnabled: cfg.userAiGlobalEnabled,
        enabled: cfg.enabled,
      },
      message: 'Configuration IA utilisateurs mise à jour avec succès.',
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/ai/admin/toggle-all-users — Active / désactive l'IA pour l'ensemble des utilisateurs
router.post('/admin/toggle-all-users', ...adminOnly, async (req, res) => {
  try {
    const { enabled } = req.body
    const isEnable = enabled !== false
    const cfg = await AiConfig.getConfig()
    cfg.userAiGlobalEnabled = isEnable
    await cfg.save()

    if (isEnable) {
      await User.updateMany(
        { role: 'utilisateur' },
        { $set: { aiAccessDisabled: false, aiAccess: true } }
      )
    } else {
      await User.updateMany(
        { role: 'utilisateur' },
        { $set: { aiAccessDisabled: true } }
      )
    }

    res.json({
      success: true,
      message: isEnable
        ? "L'IA a été activée pour tous les utilisateurs avec succès !"
        : "L'IA a été désactivée pour tous les utilisateurs.",
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/ai/admin/user-ai-stats — Statistiques & Chiffre d'affaires IA utilisateurs
router.get('/admin/user-ai-stats', ...adminOnly, async (req, res) => {
  try {
    const [cfg, totalUsers, activeUsersWithQuota, subscriptions, usageLogsCount] = await Promise.all([
      AiConfig.getConfig(),
      User.countDocuments({ role: 'utilisateur' }),
      User.countDocuments({
        role: 'utilisateur',
        aiAccessDisabled: { $ne: true },
        $or: [
          { aiQuestionsQuota: { $gt: 0 } },
          { aiFreeTrialUsed: { $lt: cfg.userFreeTrialQuota || 20 } },
        ],
      }),
      UserAiSubscription.find({ status: 'approved' }).select('price totalQuestions paymentMethod'),
      AiUsageLog.countDocuments({ school: null }),
    ])

    const totalRevenue = subscriptions.reduce((sum, s) => sum + (s.price || 0), 0)
    const totalPurchasedQuestions = subscriptions.reduce((sum, s) => sum + (s.totalQuestions || 0), 0)

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsersWithQuota,
        totalSubscriptions: subscriptions.length,
        totalRevenue,
        totalPurchasedQuestions,
        usageLogsCount,
        freeTrialQuota: cfg.userFreeTrialQuota || 20,
        globalEnabled: cfg.userAiGlobalEnabled !== false && cfg.enabled !== false,
      },
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/ai/admin/user-subscriptions — Historique des paiements & souscriptions utilisateurs
router.get('/admin/user-subscriptions', ...adminOnly, async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query
    const filter = {}
    if (status && status !== 'all') filter.status = status

    const subs = await UserAiSubscription.find(filter)
      .populate('user', 'name email phone avatar')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10))
      .skip((parseInt(page, 10) - 1) * parseInt(limit, 10))

    const total = await UserAiSubscription.countDocuments(filter)

    res.json({
      success: true,
      data: subs,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/ai/admin/users — Liste des utilisateurs avec métriques IA
router.get('/admin/users', ...adminOnly, async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query
    const filter = { role: 'utilisateur' }
    if (search && String(search).trim()) {
      const q = String(search).trim()
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
      ]
    }

    const cfg = await AiConfig.getConfig()
    const trialTotal = typeof cfg.userFreeTrialQuota === 'number' ? cfg.userFreeTrialQuota : 20

    const users = await User.find(filter)
      .select('name email phone avatar aiQuestionsQuota aiFreeTrialUsed aiAccessDisabled aiAccess createdAt')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10))
      .skip((parseInt(page, 10) - 1) * parseInt(limit, 10))

    const total = await User.countDocuments(filter)

    const list = users.map((u) => {
      const trialUsed = u.aiFreeTrialUsed || 0
      const trialRemaining = Math.max(0, trialTotal - trialUsed)
      const purchased = u.aiQuestionsQuota || 0
      return {
        _id: u._id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        avatar: u.avatar,
        aiQuestionsQuota: purchased,
        aiFreeTrialUsed: trialUsed,
        aiFreeTrialRemaining: trialRemaining,
        totalRemaining: trialRemaining + purchased,
        aiAccessDisabled: !!u.aiAccessDisabled,
        aiAccess: !!u.aiAccess,
        createdAt: u.createdAt,
      }
    })

    res.json({
      success: true,
      data: list,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/ai/admin/user/:userId/toggle — Active / désactive l'IA pour un utilisateur spécifique
router.post('/admin/user/:userId/toggle', ...adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' })

    const { disabled } = req.body
    if (disabled !== undefined) {
      user.aiAccessDisabled = Boolean(disabled)
    } else {
      user.aiAccessDisabled = !user.aiAccessDisabled
    }

    if (!user.aiAccessDisabled) {
      user.aiAccess = true
      user.aiAccessGrantedAt = new Date()
    }
    await user.save()

    res.json({
      success: true,
      data: {
        _id: user._id,
        aiAccessDisabled: user.aiAccessDisabled,
      },
      message: user.aiAccessDisabled
        ? `L'accès IA de ${user.name} a été désactivé.`
        : `L'accès IA de ${user.name} a été activé avec succès.`,
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/ai/admin/user/:userId/credit — Crédite manuellement des requêtes à un utilisateur
router.post('/admin/user/:userId/credit', ...adminOnly, async (req, res) => {
  try {
    const { amount, reason } = req.body
    const qty = parseInt(amount, 10)
    if (!qty || isNaN(qty)) {
      return res.status(400).json({ message: 'Nombre de requêtes invalide' })
    }

    const user = await User.findById(req.params.userId)
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' })

    user.aiQuestionsQuota = Math.max(0, (user.aiQuestionsQuota || 0) + qty)
    user.aiAccessDisabled = false
    user.aiAccess = true
    await user.save()

    // Enregistre dans UserAiSubscription pour historique
    await UserAiSubscription.create({
      user: user._id,
      packageName: reason || `Attribution manuelle admin (+${qty})`,
      totalQuestions: qty,
      price: 0,
      paymentMethod: 'admin_grant',
      status: 'approved',
      approvedAt: new Date(),
    })

    const quota = await getUserQuotaInfo(user._id)

    res.json({
      success: true,
      data: quota,
      message: `${qty} requêtes IA ont été créditées à ${user.name} avec succès.`,
    })
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

    // Contrôles spécifiques aux utilisateurs publics
    if (req.user.role === 'utilisateur') {
      if (cfg.userAiGlobalEnabled === false) {
        return res.status(403).json({ message: "L'assistant IA pour les utilisateurs est temporairement désactivé par l'administrateur." })
      }
      if (req.user.aiAccessDisabled) {
        return res.status(403).json({ message: "Votre accès à l'assistant IA a été désactivé par l'administrateur." })
      }
      const quotaInfo = await getUserQuotaInfo(req.user._id)
      if (quotaInfo.totalRemaining <= 0) {
        return res.status(403).json({
          code: 'QUOTA_EXHAUSTED',
          message: USER_QUOTA_EXHAUSTED_MSG,
          quota: quotaInfo,
        })
      }
    }

    const sid = schoolId(req)
    let sub = sid ? await getActiveSubscription(sid) : null
    if (!sub && req.user.role !== 'utilisateur' && req.user.role !== 'super_admin') {
      return res.status(403).json({ message: "Aucune souscription IA active pour votre établissement." })
    }
    if (sub && sub.remainingQuestions <= 0) {
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
        school: sid || null,
        title: String(message).trim().slice(0, 60),
        messages: [],
      })
    }

    // Construit le contexte (10 derniers échanges) + nouvelle question
    const history = conversation.messages.slice(-10).map((m) => ({ role: m.role, content: m.content }))
    const userMessage = { role: 'user', content: String(message).trim() }

    // Recherche web en direct (navigateur) pour enrichir la réponse et garantir une exactitude irréprochable
    let webSearch = { results: [], query: '' }
    try {
      webSearch = await performWebSearch(userMessage.content)
    } catch (searchErr) {
      console.error('[AiChat web search error]:', searchErr.message)
    }

    const searchContext = buildSearchContext(webSearch.results, webSearch.query)

    const basePrompt = cfg.systemPrompt || "Tu es l'assistant pédagogique et administratif d'excellence de KATD-SCHÜLE."
    const accuracyInstruction = `
CONSIGNES ESSENTIELLES :
- Réponds toujours dans un français parfait, irréprochable et sans la moindre faute d'orthographe ou de syntaxe.
- Sois rigoureux, exact, clair et EXHAUSTIF : termine TOUJOURS complètement tes explications, tes listes et tes phrases jusqu'au point final. Ne t'arrête jamais en plein milieu d'une phrase.
- Si la question demande une énumération (ex: régions, pays, étapes, départements), cite-les TOUTES de manière méthodique et ordonnée, sans omission, avec leurs détails essentiels (ex: chefs-lieux, caractéristiques).
- Si la question porte sur un sujet d'enseignement ou pédagogique, structure ta réponse avec méthode (concepts clés, définitions précises, formules ou démarches, exemples concrets).
`

    const effectiveSystemPrompt = [basePrompt, searchContext, accuracyInstruction].filter(Boolean).join('\n\n')

    const chatConfig = {
      ...(cfg.toObject ? cfg.toObject() : cfg),
      systemPrompt: effectiveSystemPrompt,
      maxTokens: Math.max(Number(cfg.maxTokens) || 4000, 4000), // Empêche toute coupure de réponse
    }

    // Décrément préliminaire ou contrôle pour utilisateur public
    let userConsumed = null
    if (req.user.role === 'utilisateur') {
      try {
        userConsumed = await consumeUserQuota(req.user._id)
      } catch (quotaErr) {
        return res.status(403).json({
          code: quotaErr.code || 'QUOTA_EXHAUSTED',
          message: quotaErr.message,
        })
      }
    }

    let result
    try {
      result = await generateChatResponse({ messages: [...history, userMessage], config: chatConfig })
    } catch (err) {
      if (userConsumed) {
        await refundUserQuota(req.user._id, userConsumed.source).catch(() => {})
      }
      const status = err instanceof OpenAiError ? err.status : 500
      return res.status(status).json({ message: err.message })
    }

    // Décrément ATOMIQUE du quota si souscription école active (garde anti-course : ne descend pas sous 0)
    let updated = sub
    if (sub) {
      updated = await AiSubscription.findOneAndUpdate(
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
    }

    // Persiste l'échange
    conversation.messages.push(userMessage)
    conversation.messages.push({ role: 'assistant', content: result.content })
    await conversation.save()

    // Journalise l'utilisation (stats + anti-abus)
    AiUsageLog.create({
      user: req.user._id,
      school: sid || null,
      subscription: sub?._id || null,
      model: result.model,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      totalTokens: result.usage.totalTokens,
    }).catch((e) => console.error('AiUsageLog:', e.message))

    res.json({
      success: true,
      data: {
        conversationId: conversation._id,
        messages: conversation.messages,
        answer: result.content,
        reply: result.content,
        quota: updated ? {
          remaining: updated.remainingQuestions,
          used: updated.usedQuestions,
          total: updated.totalQuestions,
        } : null,
        remainingQuestions: updated ? updated.remainingQuestions : 9999,
        usedQuestions: updated ? updated.usedQuestions : 0,
        totalQuestions: updated ? updated.totalQuestions : 9999,
        userQuota: userConsumed,
        webSearch: {
          performed: webSearch.results.length > 0,
          sourcesCount: webSearch.results.length,
          sources: webSearch.results.map((r) => ({ title: r.title, link: r.link })),
        },
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
