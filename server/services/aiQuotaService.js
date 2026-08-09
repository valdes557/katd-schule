// services/aiQuotaService.js — Quota IA partagé (souscription école).
// Contrat identique à routes/ai.js : décrément atomique, expiration à 0.
// Utilisé par les cours IA (aiCourses) sans toucher au chat existant.
const AiSubscription = require('../models/AiSubscription')

const QUOTA_EXHAUSTED_MSG = 'Le quota de questions IA de votre établissement est épuisé.'

// Souscription IA active (approuvée) d'une école, ou null.
async function getActiveSubscription(sid) {
  if (!sid) return null
  return AiSubscription.findOne({ school: sid, status: 'approved' }).sort({ approvedAt: -1 })
}

// Décrément ATOMIQUE d'une unité de quota (garde anti-course : ne descend pas sous 0).
// Renvoie la souscription à jour, ou null si le quota est épuisé.
async function consumeQuota(sub) {
  const updated = await AiSubscription.findOneAndUpdate(
    { _id: sub._id, remainingQuestions: { $gt: 0 } },
    { $inc: { usedQuestions: 1, remainingQuestions: -1 } },
    { new: true }
  )
  if (updated && updated.remainingQuestions === 0) {
    await AiSubscription.updateOne({ _id: updated._id }, { $set: { status: 'expired' } })
  }
  return updated
}

// Remboursement d'une unité (échec de génération : on ne facture pas une panne).
async function refundQuota(subId) {
  await AiSubscription.findOneAndUpdate(
    { _id: subId },
    { $inc: { usedQuestions: -1, remainingQuestions: 1 } }
  )
  // Si le remboursement redonne du quota à une souscription expirée, la réactive
  await AiSubscription.updateOne(
    { _id: subId, status: 'expired', remainingQuestions: { $gt: 0 } },
    { $set: { status: 'approved' } }
  )
}

module.exports = { getActiveSubscription, consumeQuota, refundQuota, QUOTA_EXHAUSTED_MSG }
