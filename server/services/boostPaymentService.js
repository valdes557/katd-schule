// services/boostPaymentService.js — Couche d'abstraction de paiement pour les boosts.
// Deux fournisseurs : 'wallet' (débit instantané du portefeuille interne, confirmé serveur)
// et 'ikeepay' (collecte Mobile Money, confirmée par webhook signé). Ajouter un fournisseur
// (Stripe, PayPal…) = ajouter un cas ici, SANS toucher au reste de l'application.
//
// PRINCIPE : un paiement n'est JAMAIS réputé réussi sur un simple retour du frontend.
//  - wallet  : confirmé par le débit atomique côté serveur.
//  - ikeepay : confirmé par le webhook/réconciliation (applyOutcome dans routes/payments.js).
const crypto = require('crypto')
const User = require('../models/User')
const PaymentIntent = require('../models/PaymentIntent')
const walletService = require('./walletService')
const ikeepay = require('./ikeepayService')
const lifecycle = require('./boostLifecycleService')

function genRef(prefix) {
  return prefix + '_' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex')
}
function callbackUrl() {
  const base = process.env.SERVER_URL || ''
  return base.replace(/\/$/, '') + '/api/payments/webhook'
}

// Paiement par portefeuille interne : vérifie le PIN (s'il existe), débite l'utilisateur,
// crédite l'admin plateforme. Lève « Solde insuffisant » / « Code PIN incorrect » le cas échéant.
async function chargeWallet({ user, campaign, pin }) {
  const dbUser = await User.findById(user._id).select('+walletPin name role school')
  if (!dbUser) { const e = new Error('Utilisateur introuvable'); e.status = 404; throw e }
  if (dbUser.walletPin) {
    const ok = await dbUser.matchPin(pin)
    if (!ok) { const e = new Error('Code PIN incorrect.'); e.status = 403; throw e }
  }
  const { tx } = await walletService.debit(user._id, {
    amount: campaign.budget, type: 'boost', role: dbUser.role, school: dbUser.school || null,
    description: 'Boost de publication (' + campaign.durationKey + ')',
    meta: { boostCampaign: String(campaign._id), postId: String(campaign.post) },
  })
  try {
    const admin = await walletService.getPlatformAdmin()
    if (admin) {
      await walletService.credit(admin._id, {
        amount: campaign.budget, type: 'boost_revenue', role: 'admin', counterparty: user._id,
        description: 'Revenu boost — ' + (dbUser.name || 'utilisateur'),
        meta: { boostCampaign: String(campaign._id) },
      })
    }
  } catch (e) { /* le boost reste valide même si le crédit admin échoue */ }
  return { confirmed: true, paymentRef: String(tx._id) }
}

// Paiement Ikeepay Mobile Money : crée un PaymentIntent (purpose 'boost') + une collecte.
// Retourne { confirmed:false, reference } → activation au webhook.
async function chargeIkeepay({ user, campaign, phone, operator }) {
  const inline = !(phone && operator)
  const reference = genRef('bst')
  const { mode } = await ikeepay.resolveConfig()
  const intent = await PaymentIntent.create({
    reference, purpose: 'boost', amount: campaign.budget, currency: campaign.currency,
    payerPhone: phone || '', payerOperator: operator || '', payerName: user.name || '', payerEmail: user.email || '',
    initiatedBy: user._id, mode, meta: { campaignId: String(campaign._id) },
  })
  campaign.paymentIntent = intent._id
  campaign.paymentRef = reference
  await campaign.save()
  // Sans numéro/opérateur → paiement inline (iframe pk_…) ; sinon collecte H2H.
  if (inline) {
    const r = await ikeepay.inlineResponse(reference, campaign.budget, campaign.currency)
    return { confirmed: false, reference, mode: r.mode, inline: true, publicKey: r.publicKey }
  }
  const result = await ikeepay.createCollection({ amount: campaign.budget, phone, operator, reference, callbackUrl: callbackUrl() })
  if (result.transaction_id || result.id) { intent.providerTransactionId = result.transaction_id || result.id; await intent.save() }
  return { confirmed: false, reference, mode, transaction: result }
}

// Point d'entrée unique.
async function charge({ user, campaign, provider, pin, phone, operator }) {
  if (provider === 'wallet') {
    campaign.paymentProvider = 'wallet'
    const r = await chargeWallet({ user, campaign, pin })
    campaign.paymentRef = r.paymentRef
    await campaign.save()
    await lifecycle.activateCampaign(campaign)
    return { confirmed: true, campaign }
  }
  if (provider === 'ikeepay') {
    campaign.paymentProvider = 'ikeepay'
    await campaign.save()
    const r = await chargeIkeepay({ user, campaign, phone, operator })
    return { confirmed: false, reference: r.reference, mode: r.mode, inline: r.inline, publicKey: r.publicKey, campaign }
  }
  const e = new Error('Fournisseur de paiement non supporté'); e.status = 400; throw e
}

module.exports = { charge, chargeWallet, chargeIkeepay }
