// routes/payments.js — Paiements SEBPay (collectes) : souscription directeur, webhook
const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const PaymentIntent = require('../models/PaymentIntent')
const sebpay = require('../services/sebpayService')
const { provisionDirector } = require('../services/directorProvisioning')
const wallet = require('../services/walletService')
const School = require('../models/School')
const User = require('../models/User')

const SUBSCRIPTION_FEE_DIRECTOR = Number(process.env.SUBSCRIPTION_FEE_DIRECTOR || 40000)

function genRef(prefix) {
  return prefix + '_' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex')
}
function callbackUrl() {
  const base = process.env.SERVER_URL || ''
  return base.replace(/\/$/, '') + '/api/payments/webhook'
}

// POST /api/payments/subscription/initiate — démarre la collecte de souscription directeur
router.post('/subscription/initiate', async (req, res) => {
  try {
    const { schoolName, directorName, email, whatsapp, cycle, plan,
            cityName, neighborhoodName, countryName, phone, operator } = req.body
    if (!schoolName || !directorName || !email || !phone || !operator) {
      return res.status(400).json({ message: 'Champs requis manquants (école, directeur, email, numéro, opérateur)' })
    }
    const amount = SUBSCRIPTION_FEE_DIRECTOR
    const reference = genRef('sub')
    const { mode } = await sebpay.resolveConfig()
    const intent = await PaymentIntent.create({
      reference, purpose: 'subscription', amount, currency: 'XOF',
      payerPhone: phone, payerOperator: operator, payerName: directorName, payerEmail: email,
      mode,
      meta: { schoolName, directorName, email, whatsapp, cycle: cycle || 'primaire',
              plan: plan || 'annual', cityName, neighborhoodName, countryName },
    })
    const result = await sebpay.createCollection({
      amount, phone, operator, reference, callbackUrl: callbackUrl(),
    })
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
    console.error('initiate subscription error:', err.message)
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
      reference, purpose: 'enrollment', amount: fee, currency: 'XOF',
      payerPhone: phone, payerOperator: operator, payerName: payerName || studentName || '',
      payerEmail: payerEmail || '', school: school._id, beneficiary: school.director, mode,
      meta: { studentName, studentId, classId, schoolName: school.name },
    })
    const result = await sebpay.createCollection({ amount: fee, phone, operator, reference, callbackUrl: callbackUrl() })
    if (result.transaction_id) { intent.sebpayTransactionId = result.transaction_id; await intent.save() }
    return res.json({ success: true, reference, amount: fee, mode, transaction: result,
      message: 'Demande de paiement envoyée. Validez sur votre téléphone Mobile Money.' })
  } catch (err) {
    console.error('initiate enrollment error:', err.message)
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
        const rs = (remote.status || remote.data && remote.data.status || '').toLowerCase()
        if (rs === 'approved' || rs === 'rejected') {
          await applyOutcome(intent, rs, remote)
        }
      } catch (e) { /* ignore polling errors */ }
    }
    const fresh = await PaymentIntent.findById(intent._id)
    return res.json({ success: true, status: fresh.status, fulfilled: fresh.fulfilled, purpose: fresh.purpose })
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
    const status = (payload.status || '').toLowerCase()
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
      await provisionDirector({
        schoolName: m.schoolName, directorName: m.directorName, email: m.email,
        whatsapp: m.whatsapp, cycle: m.cycle, plan: m.plan, amount: intent.amount,
        cityName: m.cityName, neighborhoodName: m.neighborhoodName, countryName: m.countryName,
      })
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
      // Dépôt directeur sur son propre portefeuille
      if (intent.initiatedBy) {
        await wallet.credit(intent.initiatedBy, {
          amount: intent.amount, type: 'deposit', role: 'directeur', school: intent.school,
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
  }
}

module.exports = router