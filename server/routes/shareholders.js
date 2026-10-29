// routes/shareholders.js — Programme actionnaires.
// Côté utilisateur : consultation des plans/termes + souscription payée via Ikeepay.
// Côté super admin : modification des termes/avantages/responsabilités/droits et des
// plans (prix, libellés…), + liste des actionnaires.
const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const { protect } = require('../middleware/auth')
const ShareholderConfig = require('../models/ShareholderConfig')
const Shareholding = require('../models/Shareholding')
const ShareholderPost = require('../models/ShareholderPost')
const PaymentIntent = require('../models/PaymentIntent')
const WalletTransaction = require('../models/WalletTransaction')
const User = require('../models/User')
const School = require('../models/School')
const ikeepay = require('../services/ikeepayService')

function genRef(p) { return p + '_' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex') }
function superAdminOnly(req, res, next) {
  if (req.user?.role !== 'super_admin') return res.status(403).json({ message: 'Accès réservé au super administrateur' })
  next()
}

// Plafond strict de promotion : 10% d'actions au total allouées sur la plateforme.
// Dès que le cumul des parts actives atteint 10%, la section de souscription est bloquée.

const ALL_FEE_CATEGORIES = [
  { key: 'subscription', label: "Frais de souscription d'école", desc: "Abonnements et licences annuels/mensuels des établissements scolaires" },
  { key: 'transfer_fee', label: "Frais de transfert d'argent", desc: "Frais prélevés sur les transferts P2P entre utilisateurs de la plateforme" },
  { key: 'withdrawal_fee', label: "Frais de retrait Mobile Money", desc: "Frais prélevés lors des retraits vers MTN et Orange Money" },
  { key: 'collect_fee', label: "Frais de collecte mensuelle", desc: "Frais de tenue de compte de 1 000 FCFA déduits chaque mois sur les collectes" },
  { key: 'client_signup', label: "Frais de souscription client collecte", desc: "Frais d'adhésion client d'épargne journalière (4 995 FCFA)" },
  { key: 'agent_signup', label: "Frais d'ouverture compte agent", desc: "Frais d'activation des agences et points de collecte (4 800 FCFA)" },
  { key: 'merchant_signup', label: "Frais d'ouverture compte Marchand", desc: "Frais d'adhésion et intégration des commerces partenaires" },
  { key: 'shareholder_subscription', label: "Frais de souscription des associés", desc: "Revenus issus des nouvelles parts d'actions souscrites" },
  { key: 'ai_subscription', label: "Frais de souscription IA", desc: "Crédits et souscriptions aux fonctionnalités d'intelligence artificielle" },
  { key: 'maintenance_fee', label: "Frais de maintenance système", desc: "Frais généraux d'infrastructure et de maintenance de la plateforme" },
]

const MAX_PROMO_PERCENT = 10

async function getPromoStats() {
  const rows = await Shareholding.aggregate([
    { $match: { status: 'active' } },
    { $group: { _id: null, total: { $sum: '$percent' } } },
  ])
  const totalSubscribed = rows[0]?.total || 0
  const remainingPercent = Math.max(0, MAX_PROMO_PERCENT - totalSubscribed)
  const isSoldOut = totalSubscribed >= MAX_PROMO_PERCENT
  const percentUsed = Math.min(100, Math.round((totalSubscribed / MAX_PROMO_PERCENT) * 100))
  return {
    maxPercent: MAX_PROMO_PERCENT,
    totalSubscribed,
    remainingPercent,
    isSoldOut,
    percentUsed,
  }
}

// ───────────────────────── UTILISATEUR ─────────────────────────

// GET /api/shareholders/config — plans actifs + textes (termes, avantages, droits…) + stats promo
router.get('/config', protect, async (req, res) => {
  try {
    const cfg = await ShareholderConfig.getOrCreate()
    const promo = await getPromoStats()
    res.json({
      success: true,
      terms: cfg.terms, advantages: cfg.advantages,
      responsibilities: cfg.responsibilities, rights: cfg.rights,
      plans: (cfg.plans || []).filter((p) => p.isActive !== false),
      promo,
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/shareholders/me — mes souscriptions d'actionnaire
router.get('/me', protect, async (req, res) => {
  try {
    const list = await Shareholding.find({ user: req.user._id }).sort({ createdAt: -1 })
    res.json({ success: true, shareholdings: list })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// Résout les utilisateurs de la zone d'attribution d'une part.
// - national / international : toute la plateforme (null = pas de filtre).
// - arrondissement / régional : utilisateurs rattachés aux écoles dont l'adresse
//   (ville / quartier / adresse) correspond à la zone saisie. Approximation assumée :
//   les comptes sans école n'ont pas de localisation en base.
function normalizeZoneText(str) {
  if (!str) return ''
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b1(er|ere)?\b/g, 'i')
    .replace(/\b2(e|eme|ème)?\b/g, 'ii')
    .replace(/\b3(e|eme|ème)?\b/g, 'iii')
    .replace(/\b4(e|eme|ème)?\b/g, 'iv')
    .replace(/\b5(e|eme|ème)?\b/g, 'v')
    .replace(/\b6(e|eme|ème)?\b/g, 'vi')
    .replace(/\b7(e|eme|ème)?\b/g, 'vii')
    .replace(/\b8(e|eme|ème)?\b/g, 'viii')
    .replace(/\b9(e|eme|ème)?\b/g, 'ix')
    .replace(/\b10(e|eme|ème)?\b/g, 'x')
    .replace(/[^a-z0-9]/g, '')
}

function buildZoneRegexList(zName) {
  if (!zName) return []
  const list = []
  const escapeRx = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  list.push(new RegExp(escapeRx(zName), 'i'))

  const romanMap = [
    { num: '1', rx: /(?:1(?:er|ere)?|i)\b/i },
    { num: '2', rx: /(?:2(?:e|eme|ème)?|ii)\b/i },
    { num: '3', rx: /(?:3(?:e|eme|ème)?|iii)\b/i },
    { num: '4', rx: /(?:4(?:e|eme|ème)?|iv)\b/i },
    { num: '5', rx: /(?:5(?:e|eme|ème)?|v)\b/i },
    { num: '6', rx: /(?:6(?:e|eme|ème)?|vi)\b/i },
    { num: '7', rx: /(?:7(?:e|eme|ème)?|vii)\b/i },
    { num: '8', rx: /(?:8(?:e|eme|ème)?|viii)\b/i },
    { num: '9', rx: /(?:9(?:e|eme|ème)?|ix)\b/i },
    { num: '10', rx: /(?:10(?:e|eme|ème)?|x)\b/i },
  ]

  for (const item of romanMap) {
    const pattern = new RegExp(`\\b(?:${item.num}(?:e|eme|ème|er|ere)?|${item.rx.source})\\b`, "i")
    if (pattern.test(zName)) {
      const baseName = zName.replace(pattern, '').trim()
      if (baseName.length >= 2) {
        const flexiblePattern = new RegExp(`${escapeRx(baseName)}[\\s\\-_/]*${item.rx.source}`, "i")
        list.push(flexiblePattern)
      }
    }
  }
  return list
}

async function zoneUserIds(sh) {
  if (!sh) return []
  if (sh.planKey === 'international' || sh.planKey === 'mondial') {
    // Portée mondiale / internationale : ensemble des utilisateurs de la plateforme
    return null
  }

  const zName = String(sh.zone || '').trim()
  let zId = sh.zoneId ? String(sh.zoneId) : null
  const mongoose = require('mongoose')

  // Résolution automatique si zoneId manquant
  if (!zId && zName) {
    try {
      const GeographicZone = require('../models/GeographicZone')
      const allZones = await GeographicZone.find({})
      const targetNorm = normalizeZoneText(zName)
      const matched = allZones.find((z) => {
        const norm = normalizeZoneText(z.name)
        return norm === targetNorm || (targetNorm.length >= 4 && (norm.includes(targetNorm) || targetNorm.includes(norm)))
      })
      if (matched) {
        zId = String(matched._id)
        if (typeof sh.save === 'function') {
          sh.zoneId = matched._id
          await sh.save().catch(() => {})
        }
      }
    } catch (_) {}
  }

  const userOr = []

  // 1. Correspondance par identifiant de zone (zoneId, arrondissementId, regionId, countryId, etc.)
  if (zId && mongoose.Types.ObjectId.isValid(zId)) {
    const objId = new mongoose.Types.ObjectId(zId)
    userOr.push({ 'geographicZone.zoneId': objId })
    userOr.push({ 'geographicZone.allZoneIds': objId })
    userOr.push({ 'geographicZone.arrondissementId': objId })
    userOr.push({ 'geographicZone.regionId': objId })
    userOr.push({ 'geographicZone.countryId': objId })
    userOr.push({ 'geographicZone.mondialId': objId })
  }

  // 2. Correspondance par libellé textuel de zone (avec tolérance chiffres romains / arabes)
  if (zName) {
    const regexes = buildZoneRegexList(zName)
    for (const rx of regexes) {
      userOr.push({ 'geographicZone.zoneName': rx })
      userOr.push({ 'geographicZone.arrondissementName': rx })
      userOr.push({ 'geographicZone.regionName': rx })
      userOr.push({ 'geographicZone.countryName': rx })
      userOr.push({ 'geographicZone.mondialName': rx })

      try {
        const schools = await School.find({
          $or: [{ 'address.city': rx }, { 'address.neighborhood': rx }, { 'address.address': rx }],
        }).select('_id')
        if (schools.length > 0) {
          userOr.push({ school: { $in: schools.map((s) => s._id) } })
        }
      } catch (_) {}
    }
  }

  // Plan national sans délimitation particulière : couvre tous les utilisateurs
  if (sh.planKey === 'national' && userOr.length === 0) {
    return null
  }

  if (userOr.length === 0) return []

  const users = await User.find({ $or: userOr }).select('_id')
  return users.map((u) => u._id)
}

// GET /api/shareholders/dashboard — portefeuille de l'actionnaire connecté.
// CONFIDENTIALITÉ : ne renvoie QUE des agrégats (compteurs et totaux) — jamais les
// transferts individuels, ni les soldes, ni l'identité des autres utilisateurs.
router.get('/dashboard', protect, async (req, res) => {
  try {
    const holdings = await Shareholding.find({ user: req.user._id, status: 'active' }).sort({ createdAt: -1 })
    if (holdings.length === 0) return res.status(403).json({ message: "Vous n'êtes pas encore actionnaire" })
    const main = holdings[0] // part la plus récente = zone d'attribution affichée

    const ids = await zoneUserIds(main)
    const ownerMatch = ids === null ? {} : { owner: { $in: ids } }

    // 1. Nombre d'utilisateurs total de la zone d'attribution
    const userCount = ids === null ? await User.countDocuments({}) : ids.length

    // 2-4. Agrégats de transactions de la zone (compteur, transferts+retraits, frais)
    const TRANSFER_TYPES = ['transfer_sent', 'salary_transfer', 'pension_payment']
    const FEE_TYPES = ['transfer_fee', 'maintenance_fee']
    const rows = await WalletTransaction.aggregate([
      { $match: ownerMatch },
      {
        $group: {
          _id: null,
          txCount: { $sum: 1 },
          transfersTotal: { $sum: { $cond: [{ $in: ['$type', TRANSFER_TYPES] }, '$amount', 0] } },
          withdrawalsTotal: { $sum: { $cond: [{ $eq: ['$type', 'withdrawal'] }, '$amount', 0] } },
          feesTotal: { $sum: { $cond: [{ $in: ['$type', FEE_TYPES] }, '$amount', 0] } },
        },
      },
    ])
    const agg = rows[0] || { txCount: 0, transfersTotal: 0, withdrawalsTotal: 0, feesTotal: 0 }

    // 5. Gains accumulés de l'actionnaire (dividendes versés par l'admin)
    const gainRows = await WalletTransaction.aggregate([
      { $match: { owner: req.user._id, type: 'shareholder_gain' } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ])
    const gains = gainRows[0] || { total: 0, count: 0 }

    // Calcul des revenus filtrés selon les catégories de frais attribuées au plan
    // et provenant STRICTEMENT des utilisateurs de la zone de l'associé
    const allowedCategories = (Array.isArray(main.allowedFeeCategories) && main.allowedFeeCategories.length > 0)
      ? main.allowedFeeCategories
      : ALL_FEE_CATEGORIES.map((x) => x.key)

    const zoneCategoryTotals = {}
    ALL_FEE_CATEGORIES.forEach((fc) => { zoneCategoryTotals[fc.key] = 0 })

    if (ids === null) {
      // Portée mondiale / internationale : prend le grand livre global de la plateforme
      const AdminCoAccount = require('../models/AdminCoAccount')
      const { acc1 } = await AdminCoAccount.ensureAccounts()
      const ledger = acc1?.ledger || []
      for (const fc of ALL_FEE_CATEGORIES) {
        const matching = ledger.filter((l) => l.category === fc.key)
        zoneCategoryTotals[fc.key] = matching.reduce((sum, e) => sum + (Number(e.totalPlatformAmount) || 0), 0)
      }
    } else if (ids.length > 0) {
      // Portée délimitée (arrondissement, régional, national local) :
      // agrège les mouvements de frais générés par les utilisateurs de cette zone
      const userTxRows = await WalletTransaction.aggregate([
        { $match: { owner: { $in: ids } } },
        {
          $group: {
            _id: '$type',
            totalAmount: { $sum: '$amount' },
          },
        },
      ])
      const byType = {}
      userTxRows.forEach((r) => { byType[r._id] = r.totalAmount || 0 })

      zoneCategoryTotals['transfer_fee'] = byType['transfer_fee'] || 0
      zoneCategoryTotals['withdrawal_fee'] = Math.round((byType['withdrawal'] || 0) * 0.01)
      zoneCategoryTotals['maintenance_fee'] = byType['maintenance_fee'] || 0
      zoneCategoryTotals['subscription'] = byType['subscription'] || 0
      zoneCategoryTotals['ai_subscription'] = (byType['ai_subscription'] || 0) + (byType['ai_subscription_revenue'] || 0)
      zoneCategoryTotals['collect_fee'] = byType['collect_fee'] || 0
      zoneCategoryTotals['merchant_signup'] = byType['merchant_signup'] || 0
      zoneCategoryTotals['agent_signup'] = (byType['agent_subscription'] || 0) + (byType['agent_signup'] || 0)
      zoneCategoryTotals['client_signup'] = (byType['client_subscription'] || 0) + (byType['client_signup'] || 0)
      zoneCategoryTotals['shareholder_subscription'] = (byType['shareholder_subscription'] || 0) + (byType['shareholder_payment'] || 0)
    }

    const categoryBreakdown = ALL_FEE_CATEGORIES.map((fc) => {
      const isAllowed = allowedCategories.includes(fc.key)
      const totalRevenue = isAllowed ? (zoneCategoryTotals[fc.key] || 0) : 0
      const shareholderShare = isAllowed ? Math.round(totalRevenue * ((Number(main.percent) || 1) / 100)) : 0
      return {
        key: fc.key,
        label: fc.label,
        desc: fc.desc,
        isAllowed,
        totalRevenue,
        shareholderShare,
      }
    })

    const eligiblePlatformFees = categoryBreakdown
      .filter((c) => c.isAllowed)
      .reduce((s, c) => s + c.totalRevenue, 0)

    const shareholderCalculatedShare = categoryBreakdown
      .filter((c) => c.isAllowed)
      .reduce((s, c) => s + c.shareholderShare, 0)

    // 6. Retraits cumulés de frais et solde retirable disponible
    const totalFeesEarned = Math.max(shareholderCalculatedShare, gains.total)

    const withdrawnRows = await WalletTransaction.aggregate([
      {
        $match: {
          owner: req.user._id,
          type: 'shareholder_fee_withdrawal',
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ])
    const totalFeesWithdrawn = withdrawnRows[0]?.total || 0
    const availableFeesBalance = Math.max(0, totalFeesEarned - totalFeesWithdrawn)

    const recentWithdrawals = await WalletTransaction.find({
      owner: req.user._id,
      type: 'shareholder_fee_withdrawal',
    }).sort({ createdAt: -1 }).limit(20)

    // 7. Publications du super admin (dépenses, sommes à payer, réunions…)
    const posts = await ShareholderPost.find({ isPublished: true }).sort({ createdAt: -1 }).limit(50)

    res.json({
      success: true,
      shareholdings: holdings,
      zone: { planKey: main.planKey, label: main.planLabel, zone: main.zone },
      stats: {
        userCount,
        txCount: agg.txCount,
        transfersTotal: agg.transfersTotal,
        withdrawalsTotal: agg.withdrawalsTotal,
        movementsTotal: agg.transfersTotal + agg.withdrawalsTotal,
        feesTotal: eligiblePlatformFees,
        gainsTotal: gains.total,
        gainsCount: gains.count,
        eligiblePlatformFees,
        shareholderCalculatedShare,
        totalFeesEarned,
        totalFeesWithdrawn,
        availableFeesBalance,
      },
      withdrawals: recentWithdrawals,
      allowedFeeCategories: allowedCategories,
      categoryBreakdown,
      posts,
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/shareholders/withdraw — retrait Mobile Money des frais d'associé
router.post('/withdraw', protect, async (req, res) => {
  try {
    const holdings = await Shareholding.find({ user: req.user._id, status: 'active' }).sort({ createdAt: -1 })
    if (holdings.length === 0) {
      return res.status(403).json({ message: "Vous n'avez aucune part d'associé active" })
    }
    const main = holdings[0]
    const { amount, momoNumber, momoOperator, accountName, pin, country = 'CM' } = req.body
    const amt = Number(amount)
    if (!amt || amt <= 0) return res.status(400).json({ message: 'Montant invalide' })
    if (!momoNumber) return res.status(400).json({ message: 'Numéro Mobile Money requis' })
    if (!accountName || !String(accountName).trim()) {
      return res.status(400).json({ message: 'Le nom du titulaire du numéro est obligatoire' })
    }

    const minW = 100
    if (amt < minW) {
      return res.status(400).json({ message: `Le montant minimum de retrait est de ${minW.toLocaleString('fr-FR')} FCFA` })
    }

    // Vérification du PIN du portefeuille
    const walletService = require('../services/walletService')
    const w = await walletService.getOrCreateWallet(req.user._id, { role: req.user.role, school: req.user.school?._id })
    if (!w.pinHash) {
      return res.status(400).json({ message: "Veuillez d'abord configurer votre code PIN de portefeuille dans les paramètres de votre compte." })
    }
    const isPinValid = await walletService.verifyPin(w, pin)
    if (!isPinValid) {
      return res.status(400).json({ message: 'Code PIN incorrect' })
    }

    // Calcul du solde disponible en frais
    const ids = await zoneUserIds(main)
    const allowedCategories = (Array.isArray(main.allowedFeeCategories) && main.allowedFeeCategories.length > 0)
      ? main.allowedFeeCategories
      : ALL_FEE_CATEGORIES.map((x) => x.key)

    const zoneCategoryTotals = {}
    ALL_FEE_CATEGORIES.forEach((fc) => { zoneCategoryTotals[fc.key] = 0 })

    if (ids === null) {
      const AdminCoAccount = require('../models/AdminCoAccount')
      const { acc1 } = await AdminCoAccount.ensureAccounts()
      const ledger = acc1?.ledger || []
      for (const fc of ALL_FEE_CATEGORIES) {
        const matching = ledger.filter((l) => l.category === fc.key)
        zoneCategoryTotals[fc.key] = matching.reduce((sum, e) => sum + (Number(e.totalPlatformAmount) || 0), 0)
      }
    } else if (ids.length > 0) {
      const userTxRows = await WalletTransaction.aggregate([
        { $match: { owner: { $in: ids } } },
        { $group: { _id: '$type', totalAmount: { $sum: '$amount' } } },
      ])
      const byType = {}
      userTxRows.forEach((r) => { byType[r._id] = r.totalAmount || 0 })
      zoneCategoryTotals['transfer_fee'] = byType['transfer_fee'] || 0
      zoneCategoryTotals['withdrawal_fee'] = Math.round((byType['withdrawal'] || 0) * 0.01)
      zoneCategoryTotals['maintenance_fee'] = byType['maintenance_fee'] || 0
      zoneCategoryTotals['subscription'] = byType['subscription'] || 0
      zoneCategoryTotals['ai_subscription'] = (byType['ai_subscription'] || 0) + (byType['ai_subscription_revenue'] || 0)
      zoneCategoryTotals['collect_fee'] = byType['collect_fee'] || 0
      zoneCategoryTotals['merchant_signup'] = byType['merchant_signup'] || 0
      zoneCategoryTotals['agent_signup'] = (byType['agent_subscription'] || 0) + (byType['agent_signup'] || 0)
      zoneCategoryTotals['client_signup'] = (byType['client_subscription'] || 0) + (byType['client_signup'] || 0)
      zoneCategoryTotals['shareholder_subscription'] = (byType['shareholder_subscription'] || 0) + (byType['shareholder_payment'] || 0)
    }

    const calculatedShare = ALL_FEE_CATEGORIES
      .filter((fc) => allowedCategories.includes(fc.key))
      .reduce((s, fc) => s + Math.round((zoneCategoryTotals[fc.key] || 0) * ((Number(main.percent) || 1) / 100)), 0)

    const gainRows = await WalletTransaction.aggregate([
      { $match: { owner: req.user._id, type: 'shareholder_gain' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ])
    const totalGains = gainRows[0]?.total || 0
    const totalFeesEarned = Math.max(calculatedShare, totalGains)

    const withdrawnRows = await WalletTransaction.aggregate([
      { $match: { owner: req.user._id, type: 'shareholder_fee_withdrawal' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ])
    const totalWithdrawn = withdrawnRows[0]?.total || 0
    const availableFeesBalance = Math.max(0, totalFeesEarned - totalWithdrawn)

    if (amt > availableFeesBalance) {
      return res.status(400).json({
        message: `Solde insuffisant. Vous disposez de ${availableFeesBalance.toLocaleString('fr-FR')} FCFA retirables sur vos frais d'associé.`
      })
    }

    const fee = Math.round(amt * 0.01)
    const netAmount = Math.max(0, amt - fee)
    const normCountry = String(country || 'CM').trim().toUpperCase()
    const targetCurrency = normCountry === 'CM' ? 'XAF' : 'XOF'
    const providerRef = 'sh_wd_' + Date.now().toString(36) + require('crypto').randomBytes(4).toString('hex')

    const ikeepay = require('../services/ikeepayService')
    let autoPayout = false
    let payoutResult = null
    try {
      payoutResult = await ikeepay.createPayout({
        amount: netAmount,
        phone: momoNumber,
        operator: momoOperator,
        reference: providerRef,
        callbackUrl: (process.env.BACKEND_URL || '') + '/api/wallet/webhook',
        accountName: String(accountName).trim(),
        country: normCountry,
        currency: targetCurrency,
      })
      autoPayout = true
    } catch (payErr) {
      console.warn('[Shareholder withdraw] Payout immédiat non abouti, bascule en file manuelle :', payErr.message)
    }

    const WithdrawalRequest = require('../models/WithdrawalRequest')
    const wr = await WithdrawalRequest.create({
      user: req.user._id,
      wallet: w._id,
      role: req.user.role || 'utilisateur',
      amount: amt,
      fee,
      netAmount,
      currency: targetCurrency,
      country: normCountry,
      momoNumber,
      momoOperator: momoOperator || '',
      accountName: String(accountName).trim(),
      reason: `Retrait frais d'associé plan ${main.planLabel || main.planKey} (${main.percent}%)`,
      status: autoPayout ? 'paid' : 'pending',
      providerRef,
      providerPayoutId: payoutResult?.transaction_id || payoutResult?.id || null,
      dueAt: new Date(Date.now() + 24 * 3600 * 1000),
    })

    await WalletTransaction.create({
      wallet: w._id,
      owner: req.user._id,
      direction: 'debit',
      amount: amt,
      currency: targetCurrency,
      type: 'shareholder_fee_withdrawal',
      description: `Retrait frais d'associé vers ${momoOperator ? momoOperator.toUpperCase() + ' ' : ''}${momoNumber} (${accountName}) - Net: ${netAmount.toLocaleString('fr-FR')} ${targetCurrency}`,
      meta: {
        isShareholderWithdrawal: true,
        planKey: main.planKey,
        percent: main.percent,
        fee,
        netAmount,
        momoNumber,
        momoOperator,
        accountName,
        withdrawalId: wr._id,
        autoPayout,
      },
    })

    try {
      const userDoc = await User.findById(req.user._id)
      const existingAccounts = userDoc.savedMomoAccounts || []
      const exists = existingAccounts.some((a) => a.operator === momoOperator && (a.phone === momoNumber || a.number === momoNumber))
      if (!exists) {
        userDoc.savedMomoAccounts.push({
          operator: momoOperator,
          phone: momoNumber,
          accountName: String(accountName).trim(),
        })
        await userDoc.save()
      }
    } catch (_) {}

    const remainingFeesBalance = Math.max(0, availableFeesBalance - amt)

    res.json({
      success: true,
      message: autoPayout
        ? `Retrait envoyé avec succès ! Vous allez recevoir ${netAmount.toLocaleString('fr-FR')} ${targetCurrency} sur votre compte Mobile Money.`
        : `Demande de retrait de ${amt.toLocaleString('fr-FR')} FCFA enregistrée (net : ${netAmount.toLocaleString('fr-FR')} ${targetCurrency} vers le ${momoNumber}).`,
      withdrawal: wr,
      availableFeesBalance: remainingFeesBalance,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/shareholders/withdrawals — historique des retraits de l'associé
router.get('/withdrawals', protect, async (req, res) => {
  try {
    const list = await WalletTransaction.find({
      owner: req.user._id,
      type: 'shareholder_fee_withdrawal',
    }).sort({ createdAt: -1 }).limit(50)
    res.json({ success: true, withdrawals: list })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/shareholders/subscribe — souscrit à un plan dynamique (paiement Mobile Money Ikeepay H2H).
// Body: { planKey, percent, zone, phone, operator, country, otp }.
// Calcul dynamique : Le prix est proportionnel au % (ex: 100 000 F pour 1%, 200 000 F pour 2%).
// Dès 3%, remise exceptionnelle automatique de 20%.
router.post('/subscribe', protect, async (req, res) => {
  try {
    const { planKey, percent, zone, phone, operator, country = 'CM', otp } = req.body
    if (!planKey) return res.status(400).json({ message: 'Plan requis' })
    const rawPhone = String(phone || '').replace(/[^0-9]/g, '')
    if (!rawPhone || !operator) {
      return res.status(400).json({ message: 'Numéro de téléphone et opérateur Mobile Money requis pour le débit direct.' })
    }

    const cfg = await ShareholderConfig.getOrCreate()
    const plan = (cfg.plans || []).find((p) => p.key === planKey && p.isActive !== false)
    if (!plan) return res.status(404).json({ message: 'Plan introuvable ou désactivé' })

    // Un même plan ne peut être souscrit qu'une fois par utilisateur (tant qu'il est actif)
    const existing = await Shareholding.findOne({ user: req.user._id, planKey, status: 'active' })
    if (existing) return res.status(400).json({ message: 'Vous avez déjà souscrit à ce plan' })

    // Calcul dynamique du pourcentage et du prix
    const requestedPercent = Math.max(1, Math.min(100, Math.floor(Number(percent) || Number(plan.percent) || 1)))

    // Contrôle strict de l'offre promotionnelle plafonnée à 10%
    const promo = await getPromoStats()
    if (promo.isSoldOut) {
      return res.status(400).json({
        message: "L'offre promotionnelle de 10% d'actions est entièrement atteinte. Les souscriptions sont fermées jusqu'à nouvel ordre."
      })
    }
    if (requestedPercent > promo.remainingPercent) {
      return res.status(400).json({
        message: `Offre promotionnelle limitée à 10% d'actions au total : il ne reste plus que ${promo.remainingPercent}% disponible(s).`
      })
    }

    const basePercent = Number(plan.percent) || 1
    const unitPrice = (Number(plan.price) || 0) / basePercent
    const rawPrice = requestedPercent * unitPrice
    const discountRate = requestedPercent >= 3 ? 0.20 : 0
    const finalPrice = Math.round(rawPrice * (1 - discountRate))

    const reference = genRef('shr')
    const { mode } = await ikeepay.resolveConfig()
    const normCountry = String(country || 'CM').trim().toUpperCase()
    const targetCurrency = ikeepay.getCountryCurrency ? ikeepay.getCountryCurrency(normCountry) : (normCountry === 'CM' ? 'XAF' : 'XOF')

    const intent = await PaymentIntent.create({
      reference, purpose: 'shareholder', amount: finalPrice, currency: targetCurrency,
      payerPhone: rawPhone, payerOperator: operator, initiatedBy: req.user._id,
      school: req.user.school?._id || null, mode,
      meta: {
        planKey: plan.key, planLabel: plan.label, percent: requestedPercent,
        durationYears: plan.durationYears, zone: String(zone || '').trim(),
        zoneId: req.body.zoneId || null,
        allowedFeeCategories: Array.isArray(plan.allowedFeeCategories) ? plan.allowedFeeCategories : ALL_FEE_CATEGORIES.map((x) => x.key),
        rawPrice, discountRate,
      },
    })
    const base = (process.env.SERVER_URL || '').replace(/\/$/, '')
    const result = await ikeepay.createCollection({
      amount: finalPrice, phone: rawPhone, operator, reference,
      callbackUrl: base + '/api/payments/webhook', country: normCountry,
      currency: targetCurrency, customerEmail: req.user.email || '', otp
    })
    if (result.transaction_id || result.id) { intent.providerTransactionId = result.transaction_id || result.id; await intent.save() }
    if (result.status === 'approved' || result.status === 'success') {
      try {
        const { applyOutcome } = require('./payments')
        await applyOutcome(intent, 'approved', result)
      } catch (e) {
        console.error('[shareholders:subscribe] auto-apply error:', e.message)
      }
    }
    const paymentLink = result.payment_link || result.redirect_url || (result.data && (result.data.payment_link || result.data.redirect_url)) || null
    res.json({
      success: true, reference, amount: finalPrice, mode, currency: targetCurrency,
      payment_link: paymentLink, message: 'Validez le paiement sur votre téléphone Mobile Money.'
    })
  } catch (err) { res.status(err.status || 500).json({ message: err.message }) }
})

// POST /api/shareholders/subscribe-wallet — souscrit à un plan dynamique en payant DIRECTEMENT
// depuis le solde du portefeuille. Body: { planKey, percent, zone, pin }.
// Le PRIX est résolu côté serveur selon le % choisi et 20% de remise dès 3%.
router.post('/subscribe-wallet', protect, async (req, res) => {
  try {
    const { planKey, percent, zone, pin } = req.body
    if (!planKey) return res.status(400).json({ message: 'Plan requis' })
    if (!pin) return res.status(400).json({ message: 'Code PIN requis' })

    const cfg = await ShareholderConfig.getOrCreate()
    const plan = (cfg.plans || []).find((p) => p.key === planKey && p.isActive !== false)
    if (!plan) return res.status(404).json({ message: 'Plan introuvable ou désactivé' })

    // Zone requise sauf pour le plan international
    const z = String(zone || '').trim()
    if (planKey !== 'international' && !z) return res.status(400).json({ message: 'Zone d\'attribution requise pour ce plan' })

    // Un même plan ne peut être souscrit qu'une fois par utilisateur (tant qu'il est actif)
    const existing = await Shareholding.findOne({ user: req.user._id, planKey, status: 'active' })
    if (existing) return res.status(400).json({ message: 'Vous avez déjà souscrit à ce plan' })

    // Vérifie le PIN du portefeuille
    const bcrypt = require('bcryptjs')
    const u = await User.findById(req.user._id).select('+walletPin')
    if (!u.walletPin) return res.status(400).json({ message: "Veuillez d'abord créer votre code PIN dans votre portefeuille" })
    const pinOk = await bcrypt.compare(String(pin), u.walletPin)
    if (!pinOk) return res.status(401).json({ message: 'Code PIN incorrect' })

    // Calcul dynamique du pourcentage et du prix (remise 20% dès 3%)
    const requestedPercent = Math.max(1, Math.min(100, Math.floor(Number(percent) || Number(plan.percent) || 1)))

    // Contrôle strict de l'offre promotionnelle plafonnée à 10%
    const promo = await getPromoStats()
    if (promo.isSoldOut) {
      return res.status(400).json({
        message: "L'offre promotionnelle de 10% d'actions est entièrement atteinte. Les souscriptions sont fermées jusqu'à nouvel ordre."
      })
    }
    if (requestedPercent > promo.remainingPercent) {
      return res.status(400).json({
        message: `Offre promotionnelle limitée à 10% d'actions au total : il ne reste plus que ${promo.remainingPercent}% disponible(s).`
      })
    }

    const basePercent = Number(plan.percent) || 1
    const unitPrice = (Number(plan.price) || 0) / basePercent
    const rawPrice = requestedPercent * unitPrice
    const discountRate = requestedPercent >= 3 ? 0.20 : 0
    const price = Math.round(rawPrice * (1 - discountRate))

    // Vérifie le solde
    const wallet = require('../services/walletService')
    const w = await wallet.getOrCreateWallet(req.user._id, { role: req.user.role, school: req.user.school?._id })
    if (w.balance < price) return res.status(400).json({ message: 'Solde insuffisant sur votre portefeuille (' + w.balance.toLocaleString('fr-FR') + ' FCFA). Effectuez d\'abord un dépôt.' })

    const years = Number(plan.durationYears) || 35
    const startAt = new Date()
    const endAt = new Date(startAt)
    endAt.setFullYear(endAt.getFullYear() + years)

    // Débit du souscripteur
    await wallet.debit(req.user._id, {
      amount: price, type: 'shareholder_payment',
      description: 'Souscription associé (' + requestedPercent + '%) — ' + (plan.label || plan.key),
      meta: { planKey: plan.key, zone: z, percent: requestedPercent, rawPrice, discountRate },
    })

    // Création de l'actionnariat
    const planFees = Array.isArray(plan.allowedFeeCategories)
      ? plan.allowedFeeCategories
      : ALL_FEE_CATEGORIES.map((x) => x.key)

    const shareholding = await Shareholding.create({
      user: req.user._id, planKey: plan.key, planLabel: plan.label || '',
      percent: requestedPercent, amount: price, durationYears: years,
      zone: z, zoneId: req.body.zoneId || null,
      allowedFeeCategories: planFees,
      startAt, endAt, status: 'active', paymentIntent: null,
    })

    // Crédit de l'admin plateforme (best-effort)
    try {
      const admin = await wallet.getPlatformAdmin()
      if (admin) {
        await wallet.credit(admin._id, {
          amount: price, type: 'shareholder_subscription', role: 'admin',
          counterparty: req.user._id,
          description: 'Souscription associé (portefeuille ' + requestedPercent + '%) — ' + (plan.label || plan.key),
          meta: { planKey: plan.key, zone: z, percent: requestedPercent, method: 'wallet' },
        })
      }
    } catch (e) {}

    try {
      const adminCoAccountsService = require('../services/adminCoAccountsService')
      await adminCoAccountsService.recordPlatformFee({
        category: 'shareholder_subscription',
        amount: price,
        description: 'Souscription actionnaire associé (' + requestedPercent + '%) — ' + (plan.label || plan.key),
        reference: String(shareholding._id || ''),
        meta: { planKey: plan.key, zone: z, percent: requestedPercent, method: 'wallet' },
      })
    } catch (coErr) {
      console.error('[AdminCoAccounts] shareholder_subscription error:', coErr.message)
    }

    res.json({ success: true, message: 'Souscription confirmée. Bienvenue parmi les associés !', shareholding, balance: w.balance - price })
  } catch (err) { res.status(err.status || 400).json({ message: err.message }) }
})

// ───────────────────────── SUPER ADMIN ─────────────────────────

// GET /api/shareholders/admin/config — config complète (y compris plans désactivés) + stats promo
router.get('/admin/config', protect, superAdminOnly, async (req, res) => {
  try {
    const cfg = await ShareholderConfig.getOrCreate()
    const promo = await getPromoStats()
    res.json({ success: true, config: cfg, promo })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/shareholders/admin/config — modifie termes/avantages/responsabilités/droits + plans
router.put('/admin/config', protect, superAdminOnly, async (req, res) => {
  try {
    const cfg = await ShareholderConfig.getOrCreate()
    const { terms, advantages, responsibilities, rights, plans } = req.body
    if (terms !== undefined) cfg.terms = String(terms)
    if (advantages !== undefined) cfg.advantages = String(advantages)
    if (responsibilities !== undefined) cfg.responsibilities = String(responsibilities)
    if (rights !== undefined) cfg.rights = String(rights)
    if (Array.isArray(plans)) {
      // Valide chaque plan : clé connue, prix > 0
      const KEYS = ['arrondissement', 'regional', 'national', 'international', 'mondial']
      for (const p of plans) {
        if (!KEYS.includes(p.key)) return res.status(400).json({ message: 'Clé de plan inconnue : ' + p.key })
        if (!(Number(p.price) > 0)) return res.status(400).json({ message: 'Prix invalide pour le plan ' + p.key })
      }
      cfg.plans = plans.map((p) => ({
        key: p.key, label: String(p.label || p.key), price: Number(p.price),
        percent: Number(p.percent) || 1, durationYears: Number(p.durationYears) || 35,
        description: String(p.description || ''), isActive: p.isActive !== false,
        allowedFeeCategories: Array.isArray(p.allowedFeeCategories) ? p.allowedFeeCategories : [],
      }))
    }
    await cfg.save()
    const promo = await getPromoStats()
    res.json({ success: true, config: cfg, promo })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/shareholders/admin/reset-promo — réinitialise les souscriptions pour remettre le quota promo à 10%
router.post('/admin/reset-promo', protect, superAdminOnly, async (req, res) => {
  try {
    const deleted = await Shareholding.deleteMany({})
    const promo = await getPromoStats()
    res.json({ success: true, message: 'Quota promotionnel réinitialisé à 10% avec succès.', deletedCount: deleted.deletedCount, promo })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/shareholders/admin/list — tous les actionnaires (avec identité)
router.get('/admin/list', protect, superAdminOnly, async (req, res) => {
  try {
    const filter = {}
    if (req.query.planKey) filter.planKey = req.query.planKey
    if (req.query.status) filter.status = req.query.status
    const list = await Shareholding.find(filter)
      .populate('user', 'name email phone walletAccountNo role')
      .sort({ createdAt: -1 }).limit(1000)
    const stats = {
      total: list.length,
      totalAmount: list.reduce((s, x) => s + (x.amount || 0), 0),
      byPlan: list.reduce((acc, x) => { acc[x.planKey] = (acc[x.planKey] || 0) + 1; return acc }, {}),
    }
    res.json({ success: true, shareholdings: list, stats })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/shareholders/admin/:id/revoke — révoque une souscription (gestion)
router.put('/admin/:id/revoke', protect, superAdminOnly, async (req, res) => {
  try {
    const s = await Shareholding.findByIdAndUpdate(req.params.id, { $set: { status: 'revoked' } }, { new: true })
    if (!s) return res.status(404).json({ message: 'Souscription introuvable' })
    res.json({ success: true, shareholding: s })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/shareholders/admin/:id — modifie/édite/active le plan d'un actionnaire.
// Body possible : { status, planKey, planLabel, percent, zone, durationYears, amount, startAt }
// (endAt recalculée si durée/startAt changent). status 'active' = réactivation.
router.put('/admin/:id', protect, superAdminOnly, async (req, res) => {
  try {
    const s = await Shareholding.findById(req.params.id)
    if (!s) return res.status(404).json({ message: 'Souscription introuvable' })
    const { status, planKey, planLabel, percent, zone, durationYears, amount, startAt, allowedFeeCategories } = req.body
    if (allowedFeeCategories !== undefined) s.allowedFeeCategories = Array.isArray(allowedFeeCategories) ? allowedFeeCategories : []
    if (status !== undefined) {
      if (!['active', 'expired', 'revoked'].includes(status)) return res.status(400).json({ message: 'Statut invalide' })
      s.status = status
    }
    if (planKey !== undefined) {
      if (!['arrondissement', 'regional', 'national', 'international', 'mondial'].includes(planKey)) {
        return res.status(400).json({ message: 'Palier invalide' })
      }
      s.planKey = planKey
    }
    if (planLabel !== undefined) s.planLabel = String(planLabel)
    if (percent !== undefined) { if (!(Number(percent) > 0)) return res.status(400).json({ message: '% invalide' }); s.percent = Number(percent) }
    if (zone !== undefined) s.zone = String(zone).trim()
    if (amount !== undefined) { if (!(Number(amount) > 0)) return res.status(400).json({ message: 'Montant invalide' }); s.amount = Number(amount) }
    if (startAt !== undefined) { const d = new Date(startAt); if (!isNaN(d)) s.startAt = d }
    if (durationYears !== undefined) { if (!(Number(durationYears) > 0)) return res.status(400).json({ message: 'Durée invalide' }); s.durationYears = Number(durationYears) }
    // Recalcule l'échéance depuis startAt + durationYears
    const end = new Date(s.startAt)
    end.setFullYear(end.getFullYear() + (Number(s.durationYears) || 35))
    s.endAt = end
    await s.save()
    res.json({ success: true, shareholding: s })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// DELETE /api/shareholders/admin/:id — supprime définitivement la souscription
router.delete('/admin/:id', protect, superAdminOnly, async (req, res) => {
  try {
    const s = await Shareholding.findByIdAndDelete(req.params.id)
    if (!s) return res.status(404).json({ message: 'Souscription introuvable' })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/shareholders/admin/:id/pay-gain — verse un gain/dividende à l'actionnaire
// (crédité sur son portefeuille, type shareholder_gain — alimente « gains accumulés »).
router.put('/admin/:id/pay-gain', protect, superAdminOnly, async (req, res) => {
  try {
    const { amount, note } = req.body
    const amt = Number(amount)
    if (!amt || amt <= 0) return res.status(400).json({ message: 'Montant invalide' })
    const s = await Shareholding.findById(req.params.id).populate('user', 'name')
    if (!s) return res.status(404).json({ message: 'Souscription introuvable' })
    const wallet = require('../services/walletService')
    await wallet.credit(s.user._id, {
      amount: amt, type: 'shareholder_gain', counterparty: req.user._id,
      description: 'Gain actionnaire — ' + (s.planLabel || s.planKey) + (note ? ' : ' + note : ''),
      meta: { shareholding: String(s._id), planKey: s.planKey, zone: s.zone || '' },
    })
    res.json({ success: true, message: 'Gain de ' + amt.toLocaleString('fr-FR') + ' F versé à ' + (s.user?.name || 'l\'actionnaire') })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ── Publications du super admin pour les actionnaires (dépenses, paiements, réunions…) ──

// GET /api/shareholders/admin/posts — toutes les publications (y compris brouillons)
router.get('/admin/posts', protect, superAdminOnly, async (req, res) => {
  try {
    const posts = await ShareholderPost.find({}).sort({ createdAt: -1 }).limit(200)
    res.json({ success: true, posts })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/shareholders/admin/posts — crée une publication
router.post('/admin/posts', protect, superAdminOnly, async (req, res) => {
  try {
    const { title, body, category, amount, meetingAt, meetingLink, meetingPlace, isPublished } = req.body
    if (!title || !String(title).trim()) return res.status(400).json({ message: 'Titre requis' })
    const post = await ShareholderPost.create({
      title: String(title).trim(), body: String(body || ''),
      category: ['depense', 'paiement', 'reunion', 'info'].includes(category) ? category : 'info',
      amount: amount != null && amount !== '' ? Number(amount) : null,
      meetingAt: meetingAt ? new Date(meetingAt) : null,
      meetingLink: String(meetingLink || ''), meetingPlace: String(meetingPlace || ''),
      isPublished: isPublished !== false, createdBy: req.user._id,
    })
    res.json({ success: true, post })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/shareholders/admin/posts/:id — modifie une publication
router.put('/admin/posts/:id', protect, superAdminOnly, async (req, res) => {
  try {
    const patch = {}
    const { title, body, category, amount, meetingAt, meetingLink, meetingPlace, isPublished } = req.body
    if (title !== undefined) patch.title = String(title).trim()
    if (body !== undefined) patch.body = String(body)
    if (category !== undefined && ['depense', 'paiement', 'reunion', 'info'].includes(category)) patch.category = category
    if (amount !== undefined) patch.amount = amount != null && amount !== '' ? Number(amount) : null
    if (meetingAt !== undefined) patch.meetingAt = meetingAt ? new Date(meetingAt) : null
    if (meetingLink !== undefined) patch.meetingLink = String(meetingLink)
    if (meetingPlace !== undefined) patch.meetingPlace = String(meetingPlace)
    if (isPublished !== undefined) patch.isPublished = !!isPublished
    const post = await ShareholderPost.findByIdAndUpdate(req.params.id, { $set: patch }, { new: true })
    if (!post) return res.status(404).json({ message: 'Publication introuvable' })
    res.json({ success: true, post })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// DELETE /api/shareholders/admin/posts/:id — supprime une publication
router.delete('/admin/posts/:id', protect, superAdminOnly, async (req, res) => {
  try {
    const post = await ShareholderPost.findByIdAndDelete(req.params.id)
    if (!post) return res.status(404).json({ message: 'Publication introuvable' })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
