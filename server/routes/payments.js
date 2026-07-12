// routes/payments.js — Paiements SEBPay (collectes) : souscription directeur, webhook
const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const mongoose = require('mongoose')
const PaymentIntent = require('../models/PaymentIntent')
const sebpay = require('../services/sebpayService')
const { provisionDirector, activateExistingSchool } = require('../services/directorProvisioning')
const wallet = require('../services/walletService')
const School = require('../models/School')
const User = require('../models/User')
const SubscriptionPlan = require('../models/SubscriptionPlan')

const SUBSCRIPTION_FEE_DIRECTOR = Number(process.env.SUBSCRIPTION_FEE_DIRECTOR || 40000)

// Résout le vrai prix depuis la BDD (jamais depuis le montant envoyé par le client).
// cycle = 'Primaire'|'Maternelle'|'Secondaire' ; billing = 'annual' -> annualPrice, sinon quarterlyPrice.
// Résout le montant de la souscription. Renvoie { amount, source, planName }.
//  source = 'plan-id'  -> plan exact choisi (idéal)
//         = 'cycle'    -> repli sur 1er plan actif du cycle
//         = 'default'  -> AUCUN plan trouvé -> SUBSCRIPTION_FEE_DIRECTOR (à signaler !)
async function resolveSubscriptionAmount(cycle, billing, planId) {
  const annual = String(billing || 'annual').toLowerCase().startsWith('annu')
  try {
    // 1) Priorité au plan EXACT sélectionné par l'utilisateur (par son _id).
    if (planId && mongoose.isValidObjectId(planId)) {
      const plan = await SubscriptionPlan.findById(planId)
      if (plan && plan.isActive) {
        const price = annual ? plan.annualPrice : plan.quarterlyPrice
        if (price > 0) return { amount: price, source: 'plan-id', planName: plan.name }
      }
    }
    // 2) Repli : premier plan actif du cycle (compat. anciens appels sans planId)
    if (cycle) {
      // 'Maternelle' est fusionnée dans 'Primaire' côté public
      const cycleQ = String(cycle).toLowerCase() === 'maternelle' ? 'Primaire' : cycle
      const rx = new RegExp('^' + String(cycleQ).trim() + '$', 'i')
      const plan = await SubscriptionPlan.findOne({ cycle: rx, isActive: true }).sort({ sortOrder: 1 })
      if (plan) {
        const price = annual ? plan.annualPrice : plan.quarterlyPrice
        if (price > 0) return { amount: price, source: 'cycle', planName: plan.name }
      }
    }
  } catch (e) { /* fallback ci-dessous */ }
  return { amount: SUBSCRIPTION_FEE_DIRECTOR, source: 'default', planName: null }
}

function genRef(prefix) {
  return prefix + '_' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex')
}
function callbackUrl() {
  const base = process.env.SERVER_URL || ''
  return base.replace(/\/$/, '') + '/api/payments/webhook'
}

// Normalise les nombreux libellés de statut SEBPay vers 'approved' | 'rejected' | 'pending'
const APPROVED_STATES = ['approved', 'success', 'successful', 'completed', 'complete', 'paid', 'confirmed']
const REJECTED_STATES = ['rejected', 'failed', 'failure', 'declined', 'cancelled', 'canceled', 'expired', 'error']
function mapStatus(raw) {
  const s = String(raw || '').toLowerCase().trim()
  if (APPROVED_STATES.includes(s)) return 'approved'
  if (REJECTED_STATES.includes(s)) return 'rejected'
  return 'pending'
}
// Extrait la raison d'échec renvoyée par SEBPay (champs variables selon l'API).
// Explore récursivement (obj, obj.data, obj.error…) pour ne rien rater du motif réel.
function extractReason(obj) {
  if (!obj || typeof obj !== 'object') return ''
  const found = []
  const FIELDS = ['reason', 'message', 'status_reason', 'failure_reason',
                  'error_message', 'detail', 'description', 'status_message']
  const dig = (o, depth) => {
    if (!o || typeof o !== 'object' || depth > 3) return
    for (const k of FIELDS) {
      if (typeof o[k] === 'string' && o[k].trim()) found.push(o[k].trim())
    }
    if (o.error) {
      if (typeof o.error === 'string' && o.error.trim()) found.push(o.error.trim())
      else dig(o.error, depth + 1)
    }
    if (o.data && typeof o.data === 'object') dig(o.data, depth + 1)
  }
  dig(obj, 0)
  return found[0] || ''
}

// GET /api/payments/operators — opérateurs Mobile Money supportés (pour peupler le formulaire)
router.get('/operators', async (req, res) => {
  try {
    const operators = await sebpay.listOperators(req.query.country)
    return res.json({ success: true, operators, currency: sebpay.DEFAULT_CURRENCY, country: req.query.country || sebpay.DEFAULT_COUNTRY })
  } catch (err) {
    console.error('list operators error:', err.message, err.data ? JSON.stringify(err.data) : '')
    return res.status(err.status || 500).json({ message: err.message, data: err.data })
  }
})

// POST /api/payments/subscription/initiate — démarre la collecte de souscription directeur
router.post('/subscription/initiate', async (req, res) => {
  try {
    const { schoolId, schoolName, directorName, email, whatsapp, cycle, plan, planId,
            cityName, neighborhoodName, countryName, phone, operator } = req.body
    if (!phone || !operator) {
      return res.status(400).json({ message: 'Numéro et opérateur Mobile Money requis' })
    }
    const reference = genRef('sub')
    const { mode } = await sebpay.resolveConfig()

    // Cas 1 : renouvellement d'une école existante (paiement après essai, sans re-remplir le formulaire)
    let meta, resolved
    if (schoolId) {
      const school = await School.findById(schoolId).select('name subscription contactEmail director cycles cycle')
      if (!school) return res.status(404).json({ message: 'École introuvable' })
      const schoolCycle = cycle || school.subscription?.cycle || (Array.isArray(school.cycles) ? school.cycles[0] : school.cycle)
      meta = { schoolId: String(school._id), schoolName: school.name,
               plan: plan || school.subscription?.plan || 'annual', planId: planId || null }
      resolved = await resolveSubscriptionAmount(schoolCycle, meta.plan, planId)
    } else {
      // Cas 2 : nouvelle souscription (création école + directeur au paiement)
      if (!schoolName || !directorName || !email) {
        return res.status(400).json({ message: 'Champs requis manquants (école, directeur, email)' })
      }
      meta = { schoolName, directorName, email, whatsapp, cycle: cycle || 'primaire',
               plan: plan || 'annual', planId: planId || null, cityName, neighborhoodName, countryName }
      resolved = await resolveSubscriptionAmount(meta.cycle, meta.plan, planId)
    }

    let amount = Math.round(Number(resolved.amount) || 0)
    console.log('Souscription: planId=' + (planId || '(absent)') + ' cycle=' + (meta.cycle || meta.schoolName) +
                ' plan=' + meta.plan + ' → source=' + resolved.source +
                (resolved.planName ? " plan='" + resolved.planName + "'" : '') +
                ' montant=' + amount + ' ' + sebpay.DEFAULT_CURRENCY)

    // Si le plan choisi est introuvable/inactif, on REFUSE plutôt que de facturer
    // silencieusement le tarif par défaut (SUBSCRIPTION_FEE_DIRECTOR). C'était la cause
    // du « 80000 au lieu du plan choisi » : un planId périmé (liste de plans en cache).
    if (resolved.source === 'default' && (planId || meta.cycle)) {
      return res.status(409).json({
        message: "Le plan sélectionné n'est plus disponible (il a peut-être été modifié ou désactivé). " +
                 "Rechargez la page (Ctrl+Maj+R) pour récupérer la liste à jour des plans, puis réessayez.",
        code: 'PLAN_UNRESOLVED',
      })
    }
    if (amount < 1) {
      return res.status(400).json({ message: "Le montant de la souscription est introuvable pour ce cycle/formule. Vérifiez la configuration des plans." })
    }

    const intent = await PaymentIntent.create({
      reference, purpose: 'subscription', amount, currency: sebpay.DEFAULT_CURRENCY,
      payerPhone: phone, payerOperator: operator, payerName: directorName || meta.schoolName,
      payerEmail: email || '', mode, meta,
    })
    const result = await sebpay.createCollection({
      amount, phone, operator, reference, callbackUrl: callbackUrl(),
    })
    console.log('SEBPay collection créée [' + reference + '] amount=' + amount +
                ' operator=' + operator + ' →', JSON.stringify(result))
    if (result.transaction_id) {
      intent.sebpayTransactionId = result.transaction_id
      await intent.save()
    }
    return res.json({
      success: true, reference, amount, mode,
      transaction: result,
      message: 'Demande de paiement envoyée. Validez le paiement sur votre téléphone Mobile Money.',
    })
  } catch (err) {
    console.error('initiate subscription error:', err.message, err.data ? JSON.stringify(err.data) : '')
    return res.status(err.status || 500).json({ message: err.message, data: err.data })
  }
})

// POST /api/payments/enrollment/initiate — frais d'inscription élève -> portefeuille directeur
router.post('/enrollment/initiate', async (req, res) => {
  try {
    const { schoolId, studentName, studentId, classId, amount,
            payerName, payerEmail, phone, operator } = req.body
    if (!schoolId || !phone || !operator) {
      return res.status(400).json({ message: 'École, numéro et opérateur Mobile Money requis' })
    }
    const school = await School.findById(schoolId)
    if (!school) return res.status(404).json({ message: 'École introuvable' })
    if (!school.director) return res.status(400).json({ message: "Cette école n'a pas de directeur associé" })
    const fee = Number(amount) || Number(school.enrollmentFee) || 0
    if (fee <= 0) return res.status(400).json({ message: "Le montant des frais d'inscription n'est pas défini" })

    const reference = genRef('enr')
    const { mode } = await sebpay.resolveConfig()
    const intent = await PaymentIntent.create({
      reference, purpose: 'enrollment', amount: fee, currency: sebpay.DEFAULT_CURRENCY,
      payerPhone: phone, payerOperator: operator, payerName: payerName || studentName || '',
      payerEmail: payerEmail || '', school: school._id, beneficiary: school.director, mode,
      meta: { studentName, studentId, classId, schoolName: school.name },
    })
    const result = await sebpay.createCollection({ amount: fee, phone, operator, reference, callbackUrl: callbackUrl() })
    if (result.transaction_id) { intent.sebpayTransactionId = result.transaction_id; await intent.save() }
    return res.json({ success: true, reference, amount: fee, mode, transaction: result,
      message: 'Demande de paiement envoyée. Validez sur votre téléphone Mobile Money.' })
  } catch (err) {
    console.error('initiate enrollment error:', err.message, err.data ? JSON.stringify(err.data) : '')
    return res.status(err.status || 500).json({ message: err.message, data: err.data })
  }
})

// GET /api/payments/status/:reference — le frontend interroge l'état
router.get('/status/:reference', async (req, res) => {
  try {
    const intent = await PaymentIntent.findOne({ reference: req.params.reference })
    if (!intent) return res.status(404).json({ message: 'Référence introuvable' })
    // Si toujours en attente, on tente une vérification active auprès de SEBPay
    if (intent.status === 'pending') {
      try {
        const remote = await sebpay.getCollectionStatus(intent.sebpayTransactionId || intent.reference)
        const rs = mapStatus(remote.status || (remote.data && remote.data.status))
        if (rs === 'approved' || rs === 'rejected') {
          await applyOutcome(intent, rs, remote)
        }
      } catch (e) { /* ignore polling errors */ }
    }
    const fresh = await PaymentIntent.findById(intent._id)
    return res.json({ success: true, status: fresh.status, fulfilled: fresh.fulfilled,
                      purpose: fresh.purpose, reason: fresh.status === 'rejected' ? extractReason(fresh.rawWebhook) : '',
                      credentials: (fresh.status === 'approved' && fresh.meta && fresh.meta.credentials) ? fresh.meta.credentials : null })
  } catch (err) {
    return res.status(500).json({ message: err.message })
  }
})

// POST /api/payments/webhook — notification SEBPay (signée HMAC)
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-sebpay-signature'] || req.headers['x-sebpay-signature'.toLowerCase()]
    const raw = req.rawBody || JSON.stringify(req.body || {})
    const valid = await sebpay.verifyWebhookSignature(raw, signature)
    if (!valid) {
      console.warn('Webhook SEBPay: signature invalide')
      return res.status(401).json({ message: 'Signature invalide' })
    }
    const payload = req.body || {}
    const reference = payload.external_reference
    const status = mapStatus(payload.status)
    if (!reference) return res.status(400).json({ message: 'external_reference manquant' })
    const intent = await PaymentIntent.findOne({ reference })
    if (!intent) return res.status(404).json({ message: 'Intent introuvable' })
    // Idempotence : déjà traité
    if (intent.fulfilled) return res.json({ success: true, message: 'Déjà traité' })
    await applyOutcome(intent, status, payload)
    return res.json({ success: true })
  } catch (err) {
    console.error('webhook error:', err.message)
    return res.status(500).json({ message: err.message })
  }
})

// Applique le résultat d'un paiement (centralisé, idempotent)
async function applyOutcome(intent, status, raw) {
  if (intent.fulfilled) return
  if (status === 'approved') {
    intent.status = 'approved'
    if (raw && (raw.transaction_id)) intent.sebpayTransactionId = raw.transaction_id
    intent.rawWebhook = raw || {}
    // Traitement selon la finalité
    if (intent.purpose === 'subscription') {
      const m = intent.meta || {}
      if (m.schoolId) {
        // Renouvellement d'une école existante (paiement après essai)
        await activateExistingSchool({ schoolId: m.schoolId, plan: m.plan, amount: intent.amount })
      } else {
        // Nouvelle souscription : création école + directeur
        const prov = await provisionDirector({
          schoolName: m.schoolName, directorName: m.directorName, email: m.email,
          whatsapp: m.whatsapp, cycle: m.cycle, plan: m.plan, amount: intent.amount,
          cityName: m.cityName, neighborhoodName: m.neighborhoodName, countryName: m.countryName,
        })
        // Conserve les identifiants pour les afficher au souscripteur via /status (chantier 1)
        intent.meta = { ...m, credentials: { email: m.email, password: prov.rawPassword, matricule: prov.matricule, whatsapp: m.whatsapp || '' } }
        intent.markModified('meta')
      }
    }
    else if (intent.purpose === 'enrollment') {
      // Crédite le portefeuille du directeur de l'école concernée
      if (intent.beneficiary) {
        const m = intent.meta || {}
        await wallet.credit(intent.beneficiary, {
          amount: intent.amount, type: 'enrollment', role: 'directeur', school: intent.school,
          paymentIntent: intent._id, sebpayTransactionId: intent.sebpayTransactionId,
          counterparty: intent.initiatedBy || null,
          description: "Frais d'inscription" + (m.studentName ? ' - ' + m.studentName : ''),
          meta: m,
        })
      }
    } else if (intent.purpose === 'deposit') {
      // Dépôt sur son propre portefeuille (directeur OU utilisateur /u)
      if (intent.initiatedBy) {
        await wallet.credit(intent.initiatedBy, {
          amount: intent.amount, type: 'deposit', school: intent.school,
          paymentIntent: intent._id, sebpayTransactionId: intent.sebpayTransactionId,
          description: 'Dépôt sur le portefeuille',
        })
      }
    }
    intent.fulfilled = true
    await intent.save()
  } else if (status === 'rejected') {
    intent.status = 'rejected'
    intent.rawWebhook = raw || {}
    await intent.save()
    // Trace le motif exact du rejet (montant, plafond, opérateur…) pour diagnostic
    console.warn('SEBPay REJET [' + intent.reference + '] purpose=' + intent.purpose +
                 ' amount=' + intent.amount + ' operator=' + intent.payerOperator +
                 ' raison=' + (extractReason(raw) || '(aucune)') +
                 ' brut=' + JSON.stringify(raw || {}))
  }
}

module.exports = router