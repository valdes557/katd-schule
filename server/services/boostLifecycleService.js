// services/boostLifecycleService.js — Cycle de vie des campagnes de boost.
// Activation (au paiement confirmé), complétion des campagnes expirées, notifications.
// Réutilise pushService (web-push) — best-effort, ne casse jamais l'opération métier.
const BoostCampaign = require('../models/BoostCampaign')
const SchoolPost = require('../models/SchoolPost')
const boostPricing = require('./boostPricingService')
const pushService = require('./pushService')

// États depuis lesquels une (ré)activation ne doit pas se refaire (idempotence).
const NON_ACTIVATABLE = ['active', 'pending_review', 'completed', 'refunded', 'rejected', 'cancelled']

// Snapshot des métriques d'un post (baseline pour le calcul des stats de campagne).
function snapshotStats(post) {
  return {
    views: post?.views || 0,
    likes: Array.isArray(post?.likes) ? post.likes.length : 0,
    comments: Array.isArray(post?.comments) ? post.comments.length : 0,
    shares: post?.shares || 0,
    downloads: post?.downloads || 0,
  }
}

// Stats métier (delta courant − baseline), sans persister. impressions/clicks vivent dans la campagne.
function computeStats(campaign, post) {
  const b = campaign.baselineStats || {}
  const cur = snapshotStats(post)
  return {
    impressions: campaign.stats?.impressions || 0,
    clicks: campaign.stats?.clicks || 0,
    newFollowers: campaign.stats?.newFollowers || 0,
    views: Math.max(0, cur.views - (b.views || 0)),
    likes: Math.max(0, cur.likes - (b.likes || 0)),
    comments: Math.max(0, cur.comments - (b.comments || 0)),
    shares: Math.max(0, cur.shares - (b.shares || 0)),
  }
}

// Active une campagne payée : fixe le statut (active ou pending_review), les dates et la
// baseline. Idempotent : ne réactive pas une campagne déjà active/terminée.
async function activateCampaign(campaign) {
  if (!campaign) return null
  if (NON_ACTIVATABLE.includes(campaign.status)) return campaign
  const cfg = await boostPricing.getConfig()
  const post = await SchoolPost.findById(campaign.post)
  const now = new Date()
  campaign.startsAt = now
  campaign.endsAt = new Date(now.getTime() + campaign.durationHours * 3600 * 1000)
  campaign.activatedAt = now
  campaign.baselineStats = snapshotStats(post)
  campaign.status = cfg.requireReview ? 'pending_review' : 'active'
  await campaign.save()
  const activated = campaign.status === 'active'
  pushService.sendToUser(campaign.user, {
    title: activated ? 'Boost activé' : 'Paiement confirmé',
    body: activated
      ? 'Votre publication est maintenant boostée.'
      : 'Votre paiement est confirmé. Votre boost est en cours de validation.',
    url: '/u/mes-boosts', tag: 'boost_' + campaign._id,
  })
  return campaign
}

// Recalcule et PERSISTE les stats métier d'une campagne (delta vs baseline).
async function refreshStats(campaign) {
  const post = await SchoolPost.findById(campaign.post)
  if (!post) return campaign
  const s = computeStats(campaign, post)
  campaign.stats.views = s.views
  campaign.stats.likes = s.likes
  campaign.stats.comments = s.comments
  campaign.stats.shares = s.shares
  await campaign.save()
  return campaign
}

// Termine les campagnes dont la durée est écoulée (active/pending_review → completed).
async function completeExpired() {
  const now = new Date()
  const due = await BoostCampaign.find({ status: { $in: ['active', 'pending_review'] }, endsAt: { $lte: now } })
  let done = 0
  for (const c of due) {
    try {
      await refreshStats(c)
      c.status = 'completed'
      await c.save()
      pushService.sendToUser(c.user, {
        title: 'Boost terminé',
        body: 'Votre campagne de boost est terminée. Consultez vos statistiques.',
        url: '/u/mes-boosts', tag: 'boost_end_' + c._id,
      })
      done++
    } catch (e) { console.error('[boost:complete] ' + c._id + ' :', e.message) }
  }
  return done
}

// Notifie une seule fois les campagnes qui se terminent bientôt (≤ 6h).
async function notifyEndingSoon() {
  const now = new Date()
  const soon = new Date(now.getTime() + 6 * 3600 * 1000)
  const list = await BoostCampaign.find({ status: 'active', endingNotified: { $ne: true }, endsAt: { $gt: now, $lte: soon } })
  let n = 0
  for (const c of list) {
    try {
      const hrs = Math.max(1, Math.round((new Date(c.endsAt).getTime() - now.getTime()) / 3600000))
      pushService.sendToUser(c.user, {
        title: 'Boost bientôt terminé',
        body: 'Votre boost se termine dans ' + hrs + ' heure' + (hrs > 1 ? 's' : '') + '.',
        url: '/u/mes-boosts', tag: 'boost_soon_' + c._id,
      })
      c.endingNotified = true
      await c.save()
      n++
    } catch (e) { console.error('[boost:endingSoon] ' + c._id + ' :', e.message) }
  }
  return n
}

module.exports = { activateCampaign, refreshStats, computeStats, completeExpired, notifyEndingSoon, snapshotStats }
