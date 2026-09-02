// routes/payments.js — Paiements Ikeepay (collectes) : souscription directeur, webhook
const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const mongoose = require('mongoose')
const PaymentIntent = require('../models/PaymentIntent')
const WithdrawalRequest = require('../models/WithdrawalRequest')
const WalletTransaction = require('../models/WalletTransaction')
const ikeepay = require('../services/ikeepayService')
const { provisionDirector, activateExistingSchool } = require('../services/directorProvisioning')
const wallet = require('../services/walletService')
const School = require('../models/School')
const User = require('../models/User')
const SubscriptionPlan = require('../models/SubscriptionPlan')
const { sendEmail } = require('../utils/emailService')

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

// Normalise les nombreux libellés de statut Ikeepay vers 'approved' | 'rejected' | 'pending'
const APPROVED_STATES = ['approved', 'success', 'successful', 'completed', 'complete', 'paid', 'confirmed']
const REJECTED_STATES = ['rejected', 'failed', 'failure', 'declined', 'cancelled', 'canceled', 'expired', 'error']
function mapStatus(raw) {
  const s = String(raw || '').toLowerCase().trim()
  if (APPROVED_STATES.includes(s)) return 'approved'
  if (REJECTED_STATES.includes(s)) return 'rejected'
  return 'pending'
}
// Extrait la raison d'échec renvoyée par Ikeepay (champs variables selon l'API).
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
    const operators = await ikeepay.listOperators(req.query.country)
    return res.json({ success: true, operators, currency: ikeepay.DEFAULT_CURRENCY, country: req.query.country || ikeepay.DEFAULT_COUNTRY })
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
    const { mode } = await ikeepay.resolveConfig()

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
                ' montant=' + amount + ' ' + ikeepay.DEFAULT_CURRENCY)

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
      reference, purpose: 'subscription', amount, currency: ikeepay.DEFAULT_CURRENCY,
      payerPhone: phone, payerOperator: operator, payerName: directorName || meta.schoolName,
      payerEmail: email || '', mode, meta,
    })
    const result = await ikeepay.createCollection({
      amount, phone, operator, reference, callbackUrl: callbackUrl(), customerEmail: email || '',
    })
    console.log('Ikeepay collection créée [' + reference + '] amount=' + amount +
                ' operator=' + operator + ' →', JSON.stringify(result))
    if (result.transaction_id || result.id) {
      intent.providerTransactionId = result.transaction_id || result.id
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
    const { mode } = await ikeepay.resolveConfig()
    const intent = await PaymentIntent.create({
      reference, purpose: 'enrollment', amount: fee, currency: ikeepay.DEFAULT_CURRENCY,
      payerPhone: phone, payerOperator: operator, payerName: payerName || studentName || '',
      payerEmail: payerEmail || '', school: school._id, beneficiary: school.director, mode,
      meta: { studentName, studentId, classId, schoolName: school.name },
    })
    const result = await ikeepay.createCollection({ amount: fee, phone, operator, reference, callbackUrl: callbackUrl(), customerEmail: payerEmail || '' })
    if (result.transaction_id || result.id) { intent.providerTransactionId = result.transaction_id || result.id; await intent.save() }
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
    // Si toujours en attente, on tente une vérification active auprès d'Ikeepay
    if (intent.status === 'pending') {
      try {
        const remote = await ikeepay.getTransactionStatus(intent.providerTransactionId || intent.reference)
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

// Détermine le statut FIABLE d'un webhook. Si la signature HMAC est valide, on fait
// confiance au payload. Sinon (pas de secret configuré / signature absente), on réconcilie
// activement le statut auprès d'Ikeepay : on ne crédite JAMAIS sur un webhook non vérifié.
// Retourne 'approved' | 'rejected' | 'pending', ou null si la vérification est impossible.
async function verifiedStatus(raw, payload, signature, lookupId) {
  if (await ikeepay.verifyWebhookSignature(raw, signature)) {
    return mapStatus(payload.status || (payload.data && payload.data.status))
  }
  try {
    const remote = await ikeepay.getTransactionStatus(lookupId)
    return mapStatus(remote.status || (remote.data && remote.data.status))
  } catch (e) {
    return null
  }
}

// POST /api/payments/webhook — notification Ikeepay (collecte OU payout), signée HMAC.
// Exposé aussi via l'alias court POST /api/webhook (voir server.js) pour la passerelle Ikeepay.
async function webhookHandler(req, res) {
  try {
    const payload = req.body || {}
    const raw = req.rawBody || JSON.stringify(payload)
    const signature = req.headers[ikeepay.SIGNATURE_HEADER]
    const d = payload.data && typeof payload.data === 'object' ? payload.data : {}
    const reference = payload.external_reference || payload.reference || d.external_reference || d.reference
    const providerId = payload.transaction_id || payload.id || payload.provider_reference || d.transaction_id || d.id || d.provider_reference
    if (!reference) return res.status(400).json({ message: 'external_reference manquant' })

    // Payout (retrait) : nos références de payout commencent par « wd_ »
    if (String(reference).startsWith('wd_')) {
      const wr = await WithdrawalRequest.findOne({ providerRef: reference })
      if (!wr) return res.status(404).json({ message: 'Retrait introuvable' })
      if (wr.status === 'paid' || wr.status === 'rejected') return res.json({ success: true, message: 'Déjà traité' })
      const status = await verifiedStatus(raw, payload, signature, wr.providerPayoutId || providerId || reference)
      if (!status) { console.warn('Webhook Ikeepay payout non vérifié [' + reference + ']'); return res.status(401).json({ message: 'Signature invalide' }) }
      await applyPayoutOutcome(wr, status, payload, providerId)
      return res.json({ success: true })
    }

    // Collecte : PaymentIntent
    const intent = await PaymentIntent.findOne({ reference })
    if (!intent) return res.status(404).json({ message: 'Intent introuvable' })
    if (intent.fulfilled) return res.json({ success: true, message: 'Déjà traité' })
    const status = await verifiedStatus(raw, payload, signature, intent.providerTransactionId || providerId || reference)
    if (!status) { console.warn('Webhook Ikeepay collecte non vérifié [' + reference + ']'); return res.status(401).json({ message: 'Signature invalide' }) }
    await applyOutcome(intent, status, payload)
    return res.json({ success: true })
  } catch (err) {
    console.error('webhook error:', err.message)
    return res.status(500).json({ message: err.message })
  }
}
router.post('/webhook', webhookHandler)

// Applique le résultat d'un payout (retrait) — idempotent.
// Succès → règle le montant bloqué (settleLocked) et marque « payé ».
// Échec  → débloque (unlock) + écriture de remboursement + marque « rejeté ».
async function applyPayoutOutcome(wr, status, raw, providerId) {
  if (wr.status === 'paid' || wr.status === 'rejected') return
  if (providerId && !wr.providerPayoutId) wr.providerPayoutId = providerId
  if (status === 'approved') {
    await wallet.settleLocked(wr.user, wr.amount)
    wr.status = 'paid'; wr.processedAt = new Date()
    await wr.save()
    try {
      const u = await User.findById(wr.user)
      if (u?.email) await sendEmail({ to: u.email, subject: 'Retrait effectué — KATD-SCHÜLE',
        html: '<p>Votre retrait de <b>' + (wr.netAmount || wr.amount).toLocaleString('fr-FR') + ' FCFA</b> a été envoyé sur ' + wr.momoNumber + '.</p>' })
    } catch (e) {}
  } else if (status === 'rejected') {
    await wallet.unlock(wr.user, wr.amount)
    const w = await wallet.getOrCreateWallet(wr.user)
    await WalletTransaction.create({ wallet: w._id, owner: wr.user, direction: 'credit',
      amount: wr.amount, currency: wr.currency, type: 'withdrawal_refund', balanceAfter: w.balance,
      withdrawal: wr._id, description: 'Remboursement retrait échoué (payout)' })
    wr.status = 'rejected'; wr.processedAt = new Date()
    wr.rejectionReason = extractReason(raw) || 'Échec du payout'
    await wr.save()
    try {
      const u = await User.findById(wr.user)
      if (u?.email) await sendEmail({ to: u.email, subject: 'Retrait échoué — KATD-SCHÜLE',
        html: '<p>Votre retrait de <b>' + wr.amount.toLocaleString('fr-FR') + ' FCFA</b> n\'a pas pu aboutir ; le montant a été recrédité sur votre portefeuille.</p>' })
    } catch (e) {}
    console.warn('Ikeepay PAYOUT ÉCHEC [' + wr.providerRef + '] montant=' + wr.amount + ' raison=' + (extractReason(raw) || '(aucune)'))
  }
}

// Applique le résultat d'un paiement (centralisé, idempotent)
async function applyOutcome(intent, status, raw) {
  if (intent.fulfilled) return
  if (status === 'approved') {
    intent.status = 'approved'
    if (raw && (raw.transaction_id || raw.id)) intent.providerTransactionId = raw.transaction_id || raw.id
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
          paymentIntent: intent._id, providerTransactionId: intent.providerTransactionId,
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
          paymentIntent: intent._id, providerTransactionId: intent.providerTransactionId,
          description: 'Dépôt sur le portefeuille',
        })
        // Parrainage : au TOUT PREMIER dépôt du filleul, le parrain gagne 70 F (chantier 16).
        try {
          const u = await User.findById(intent.initiatedBy).select('name firstDepositDone referredBy')
          if (u && !u.firstDepositDone) {
            u.firstDepositDone = true
            await u.save()
            if (u.referredBy) {
              await wallet.credit(u.referredBy, {
                amount: 70, type: 'referral_bonus', counterparty: u._id,
                description: 'Bonus parrainage — 1er dépôt de ' + (u.name || 'votre filleul'),
                meta: { godchild: String(u._id) },
              })
            }
          }
        } catch (e) { console.error('[deposit:referral] ' + intent.initiatedBy + ' :', e.message) }
        // Règlement de l'arriéré de frais de maintenance au prochain dépôt (chantier 20).
        try {
          const { applyMaintenanceOnDeposit } = require('../jobs/scheduler')
          await applyMaintenanceOnDeposit(intent.initiatedBy)
        } catch (e) { console.error('[deposit:maintenance] ' + intent.initiatedBy + ' :', e.message) }
      }
    } else if (intent.purpose === 'merchant') {
      // Activation d'un compte marchand : bascule le statut + s'assure du portefeuille
      if (intent.initiatedBy) {
        await User.updateOne({ _id: intent.initiatedBy }, { $set: { isMerchant: true, merchantSince: new Date() } })
        await wallet.getOrCreateWallet(intent.initiatedBy)
        // Frais d'activation encaissés par l'admin plateforme (best-effort, traçabilité)
        try {
          const admin = await wallet.getPlatformAdmin()
          if (admin) {
            await wallet.credit(admin._id, {
              amount: intent.amount, type: 'merchant_signup', role: 'admin',
              counterparty: intent.initiatedBy, paymentIntent: intent._id,
              providerTransactionId: intent.providerTransactionId,
              description: "Frais d'activation marchand",
            })
          }
        } catch (e) { /* activation faite même si le crédit admin échoue */ }
      }
    } else if (intent.purpose === 'shareholder') {
      // Souscription actionnaire : crée la part (1% / zone / durée) + encaisse la somme (admin).
      // La somme est NON REMBOURSABLE (cf. termes) — elle va directement à l'admin plateforme.
      if (intent.initiatedBy) {
        const m = intent.meta || {}
        const Shareholding = require('../models/Shareholding')
        const years = Number(m.durationYears) || 35
        const startAt = new Date()
        const endAt = new Date(startAt)
        endAt.setFullYear(endAt.getFullYear() + years)
        await Shareholding.create({
          user: intent.initiatedBy, planKey: m.planKey, planLabel: m.planLabel || '',
          percent: Number(m.percent) || 1, amount: intent.amount, durationYears: years,
          zone: m.zone || '', startAt, endAt, status: 'active', paymentIntent: intent._id,
        })
        try {
          const admin = await wallet.getPlatformAdmin()
          if (admin) {
            await wallet.credit(admin._id, {
              amount: intent.amount, type: 'shareholder_subscription', role: 'admin',
              counterparty: intent.initiatedBy, paymentIntent: intent._id,
              providerTransactionId: intent.providerTransactionId,
              description: 'Souscription actionnaire — ' + (m.planLabel || m.planKey || ''),
              meta: { planKey: m.planKey, zone: m.zone || '' },
            })
          }
        } catch (e) { /* part créée même si le crédit admin échoue */ }
      }
    } else if (intent.purpose === 'boost') {
      // Boost payé par Mobile Money : encaisse le revenu (admin) puis active la campagne.
      // Idempotent (garde intent.fulfilled ci-dessous). L'activation elle-même est idempotente.
      try {
        const BoostCampaign = require('../models/BoostCampaign')
        const lifecycle = require('../services/boostLifecycleService')
        const campaignId = intent.meta && intent.meta.campaignId
        const campaign = campaignId
          ? await BoostCampaign.findById(campaignId)
          : await BoostCampaign.findOne({ paymentIntent: intent._id })
        if (campaign) {
          try {
            const admin = await wallet.getPlatformAdmin()
            if (admin) {
              await wallet.credit(admin._id, {
                amount: intent.amount, type: 'boost_revenue', role: 'admin', counterparty: intent.initiatedBy,
                paymentIntent: intent._id, providerTransactionId: intent.providerTransactionId,
                description: 'Revenu boost (Mobile Money)', meta: { boostCampaign: String(campaign._id) },
              })
            }
          } catch (e) { /* campagne activée même si le crédit admin échoue */ }
          await lifecycle.activateCampaign(campaign)
        }
      } catch (e) { console.error('[payment:boost] ' + intent.reference + ' :', e.message) }
    }
    intent.fulfilled = true
    await intent.save()
  } else if (status === 'rejected') {
    intent.status = 'rejected'
    intent.rawWebhook = raw || {}
    await intent.save()
    // Boost : paiement Mobile Money échoué → annule la campagne restée en attente.
    if (intent.purpose === 'boost') {
      try {
        const BoostCampaign = require('../models/BoostCampaign')
        const campaignId = intent.meta && intent.meta.campaignId
        const campaign = campaignId
          ? await BoostCampaign.findById(campaignId)
          : await BoostCampaign.findOne({ paymentIntent: intent._id })
        if (campaign && campaign.status === 'pending_payment') { campaign.status = 'cancelled'; await campaign.save() }
      } catch (e) { /* best-effort */ }
    }
    // Trace le motif exact du rejet (montant, plafond, opérateur…) pour diagnostic
    console.warn('Ikeepay REJET [' + intent.reference + '] purpose=' + intent.purpose +
                 ' amount=' + intent.amount + ' operator=' + intent.payerOperator +
                 ' raison=' + (extractReason(raw) || '(aucune)') +
                 ' brut=' + JSON.stringify(raw || {}))
  }
}

module.exports = router
// Handler exposé pour l'alias court /api/webhook (server.js) — même logique que /api/payments/webhook.
module.exports.webhookHandler = webhookHandler