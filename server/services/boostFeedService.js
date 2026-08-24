// services/boostFeedService.js — Diffusion des publications boostées dans le feed.
// Sélectionne, pour un visiteur donné, quelques publications sponsorisées par SCORE de
// pertinence, en respectant la diversité (espacement) et en pénalisant la répétition.
// Règle : ne JAMAIS afficher systématiquement la même publication à tout le monde en tête.
const BoostCampaign = require('../models/BoostCampaign')
const boostPricing = require('./boostPricingService')

// Mémoire de répétition (best-effort, bornée) : combien de fois un visiteur a vu une
// campagne récemment. Purement en mémoire → réinitialisée au redémarrage (acceptable).
const recentImpressions = new Map() // clé: viewerId|campaignId -> compteur
const MAX_MAP = 5000
function bump(key) {
  const n = (recentImpressions.get(key) || 0) + 1
  recentImpressions.set(key, n)
  if (recentImpressions.size > MAX_MAP) {
    const first = recentImpressions.keys().next().value
    recentImpressions.delete(first)
  }
  return n
}
function repeats(key) { return recentImpressions.get(key) || 0 }

function engagementOf(post) {
  const likes = Array.isArray(post.likes) ? post.likes.length : 0
  const comments = Array.isArray(post.comments) ? post.comments.length : 0
  return likes + comments + (post.shares || 0) + Math.floor((post.views || 0) / 10)
}

// Score = baseScore + boostWeight + relevanceScore + engagementScore − repetitionPenalty
function computeBoostScore(campaign, post, viewer) {
  const base = 10
  const boostWeight = Math.min(40, (campaign.budget || 0) / 50) // budget élevé → plus de poids
  // Pertinence best-effort : bonus si la catégorie du post correspond aux intérêts ciblés,
  // ou si l'objectif est « visibility ». Reste fonctionnel sans données de ciblage.
  let relevance = 0
  const interests = (campaign.audience?.interests || []).map((s) => String(s).toLowerCase())
  if (post.category && interests.includes(String(post.category).toLowerCase())) relevance += 15
  if (campaign.objective === 'visibility') relevance += 5
  const engagement = Math.min(30, engagementOf(post))
  const viewerId = viewer ? String(viewer._id || viewer.id || 'anon') : 'anon'
  const penalty = repeats(viewerId + '|' + campaign._id) * 8
  // Légère rotation déterministe pour éviter un ordre figé (hash des derniers hexs de l'id).
  const jitter = (parseInt(String(campaign._id).slice(-2), 16) || 0) % 5
  return base + boostWeight + relevance + engagement + jitter - penalty
}

// Retourne des publications sponsorisées (objets simples prêts pour le feed) pour ce visiteur.
async function getSponsoredFor(viewer, { excludeIds = [], limit = 3 } = {}) {
  let cfg = null
  try { cfg = await boostPricing.getConfig() } catch (_) {}
  const max = Math.max(0, Math.min(Number(limit) || 0, cfg?.maxSponsoredPerPage ?? 3))
  if (max === 0) return { posts: [], campaignIds: [] }
  const now = new Date()
  const viewerId = viewer ? String(viewer._id || viewer.id || '') : ''
  const exclude = new Set((excludeIds || []).map(String))

  const campaigns = await BoostCampaign.find({ status: 'active', endsAt: { $gt: now } })
    .sort({ activatedAt: -1 })
    .limit(60)
    .populate({ path: 'post', populate: { path: 'author', select: 'name avatar' } })
    .lean()

  const candidates = []
  for (const c of campaigns) {
    const post = c.post
    if (!post || post.isPublic === false) continue                                   // post retiré / privé
    if (exclude.has(String(post._id))) continue                                      // déjà dans la page organique
    if (viewerId && String(post.author?._id || post.author) === viewerId) continue   // pas mon propre post
    candidates.push({ campaign: c, post, score: computeBoostScore(c, post, viewer) })
  }
  candidates.sort((a, b) => b.score - a.score)

  const chosen = candidates.slice(0, max)
  const posts = chosen.map(({ campaign, post }) => {
    if (viewerId) bump(viewerId + '|' + campaign._id)
    return { ...post, isSponsored: true, boostCampaign: String(campaign._id), sponsoredObjective: campaign.objective }
  })
  return { posts, campaignIds: chosen.map((c) => String(c.campaign._id)) }
}

// Incrémente les impressions des campagnes servies (best-effort, asynchrone).
async function incrementImpressions(campaignIds) {
  if (!Array.isArray(campaignIds) || !campaignIds.length) return
  try { await BoostCampaign.updateMany({ _id: { $in: campaignIds } }, { $inc: { 'stats.impressions': 1 } }) }
  catch (e) { /* best-effort */ }
}

// Insère les sponsorisés dans la liste organique, espacés d'un post sponsorisé tous les `ratio`.
function interleave(organic, sponsored, ratio = 5) {
  if (!sponsored || !sponsored.length) return organic
  const r = Math.max(2, Number(ratio) || 5)
  const out = []
  let si = 0
  for (let i = 0; i < organic.length; i++) {
    out.push(organic[i])
    if (si < sponsored.length && (i + 1) % r === 0) out.push(sponsored[si++])
  }
  while (si < sponsored.length) out.push(sponsored[si++]) // reste éventuel en fin de liste
  return out
}

module.exports = { getSponsoredFor, incrementImpressions, interleave, computeBoostScore }
