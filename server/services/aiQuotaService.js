const AiSubscription = require('../models/AiSubscription')
const AiConfig = require('../models/AiConfig')
const User = require('../models/User')

const QUOTA_EXHAUSTED_MSG = 'Le quota de questions IA de votre établissement est épuisé.'
const USER_QUOTA_EXHAUSTED_MSG = 'Votre quota de requêtes IA est épuisé. Veuillez recharger votre forfait pour continuer.'

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

// ─────────────────────────────────────────────────────────────────────────────
// QUOTAS UTILISATEURS PUBLICS (role: 'utilisateur')
// ─────────────────────────────────────────────────────────────────────────────

// Récupère les métriques de quota d'un utilisateur
async function getUserQuotaInfo(userId) {
  const [cfg, user] = await Promise.all([
    AiConfig.getConfig(),
    User.findById(userId).select('aiQuestionsQuota aiFreeTrialUsed aiAccessDisabled role'),
  ])

  const trialTotal = typeof cfg.userFreeTrialQuota === 'number' ? cfg.userFreeTrialQuota : 20
  const trialUsed = user?.aiFreeTrialUsed || 0
  const trialRemaining = Math.max(0, trialTotal - trialUsed)
  const purchasedRemaining = user?.aiQuestionsQuota || 0
  const totalRemaining = trialRemaining + purchasedRemaining
  const isGlobalDisabled = !cfg.enabled || cfg.userAiGlobalEnabled === false
  const isUserDisabled = !!user?.aiAccessDisabled
  const canUse = !isGlobalDisabled && !isUserDisabled && totalRemaining > 0

  return {
    trialTotal,
    trialUsed,
    trialRemaining,
    purchasedRemaining,
    totalRemaining,
    isGlobalDisabled,
    isUserDisabled,
    canUse,
    globalEnabled: !isGlobalDisabled,
  }
}

// Consommation atomique d'une unité de quota pour un utilisateur public
async function consumeUserQuota(userId) {
  const [cfg, user] = await Promise.all([
    AiConfig.getConfig(),
    User.findById(userId).select('aiQuestionsQuota aiFreeTrialUsed aiAccessDisabled'),
  ])

  if (!user) throw new Error('Utilisateur introuvable')

  if (!cfg.enabled || cfg.userAiGlobalEnabled === false) {
    const err = new Error("L'assistant IA pour les utilisateurs est temporairement désactivé par l'administrateur.")
    err.code = 'AI_DISABLED'
    throw err
  }

  if (user.aiAccessDisabled) {
    const err = new Error("Votre accès à l'assistant IA a été désactivé par l'administrateur.")
    err.code = 'AI_USER_DISABLED'
    throw err
  }

  const trialTotal = typeof cfg.userFreeTrialQuota === 'number' ? cfg.userFreeTrialQuota : 20

  // 1. Essai gratuit d'abord s'il en reste
  if ((user.aiFreeTrialUsed || 0) < trialTotal) {
    const updated = await User.findOneAndUpdate(
      { _id: userId, aiFreeTrialUsed: { $lt: trialTotal } },
      { $inc: { aiFreeTrialUsed: 1 } },
      { new: true }
    )
    if (updated) {
      return {
        source: 'trial',
        trialRemaining: Math.max(0, trialTotal - updated.aiFreeTrialUsed),
        purchasedRemaining: updated.aiQuestionsQuota || 0,
        totalRemaining: Math.max(0, trialTotal - updated.aiFreeTrialUsed) + (updated.aiQuestionsQuota || 0),
      }
    }
  }

  // 2. Quota acheté ensuite
  const updatedPurchased = await User.findOneAndUpdate(
    { _id: userId, aiQuestionsQuota: { $gt: 0 } },
    { $inc: { aiQuestionsQuota: -1 } },
    { new: true }
  )

  if (updatedPurchased) {
    return {
      source: 'purchased',
      trialRemaining: 0,
      purchasedRemaining: updatedPurchased.aiQuestionsQuota || 0,
      totalRemaining: updatedPurchased.aiQuestionsQuota || 0,
    }
  }

  // 3. Quota épuisé
  const err = new Error(USER_QUOTA_EXHAUSTED_MSG)
  err.code = 'QUOTA_EXHAUSTED'
  err.status = 403
  throw err
}

// Remboursement du quota utilisateur en cas d'erreur de génération du service
async function refundUserQuota(userId, source = 'purchased') {
  if (!userId) return
  if (source === 'trial') {
    await User.findByIdAndUpdate(userId, { $inc: { aiFreeTrialUsed: -1 } })
  } else {
    await User.findByIdAndUpdate(userId, { $inc: { aiQuestionsQuota: 1 } })
  }
}

module.exports = {
  getActiveSubscription,
  consumeQuota,
  refundQuota,
  QUOTA_EXHAUSTED_MSG,
  USER_QUOTA_EXHAUSTED_MSG,
  getUserQuotaInfo,
  consumeUserQuota,
  refundUserQuota,
}

