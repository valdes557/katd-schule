// routes/collect.js — Module complet de Collecte Journalière.
// Permet à un utilisateur de devenir Agent de Collecte (après acceptation des termes et conditions rédigés par l'admin).
// L'agent gère ses clients, ses collectes du jour (payé/non payé), l'approvisionnement des comptes (Momo / Wallet),
// et transmet son rapport journalier à l'administrateur.
// RÈGLE DE SANCTUARISATION : Ni l'agent ni l'administrateur ne peuvent retirer l'argent de collecte d'un client.
const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/auth')
const CollectConfig = require('../models/CollectConfig')
const CollectAgent = require('../models/CollectAgent')
const CollectClient = require('../models/CollectClient')
const DailyCollection = require('../models/DailyCollection')
const CollectReport = require('../models/CollectReport')
const CollectFeeRecord = require('../models/CollectFeeRecord')
const CollectAdminWithdrawal = require('../models/CollectAdminWithdrawal')
const Wallet = require('../models/Wallet')
const WalletTransaction = require('../models/WalletTransaction')
const User = require('../models/User')
const wallet = require('../services/walletService')
const ikeepay = require('../services/ikeepayService')
const adminCoAccountsService = require('../services/adminCoAccountsService')

function getTodayStr() {
  const d = new Date()
  return d.toISOString().slice(0, 10) // 'YYYY-MM-DD'
}

function getCurrentMonthStr() {
  const d = new Date()
  return d.toISOString().slice(0, 7) // 'YYYY-MM'
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'super_admin' && req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Accès réservé à l’administrateur' })
  }
  next()
}

// ── Fonction utilitaire : Déduction mensuelle des frais de tenue de compte (1 100 FCFA / client) ──
// RÈGLE STRICTE : Déduction effectuée UNIQUEMENT si le client dispose d'un solde >= 2 000 FCFA.
// Prélèvement total : 1 000 FCFA.
// Répartition : 70% de 1 000 FCFA = 700 FCFA pour l'agent (portefeuille de commissions séparé),
//               30% de 1 000 FCFA = 300 FCFA pour le super administrateur (gestion des collectes catégorie Frais).
// Total pour l'admin plateforme : 300 FCFA.
// Total pour l'agent : 700 FCFA.
async function checkAndApplyMonthlyFeeForClient(client, agent) {
  try {
    if (!client) return false
    const currentMonth = getCurrentMonthStr()
    const fee = 1000
    const maintenanceFee = 0
    const commissionBase = 1000
    const agentShare = 700
    const platformShare = 300

    // Déduit UNIQUEMENT si le mois en cours n'a pas encore été prélevé ET que le solde client est >= 2 000 FCFA
    if (client.lastMonthlyFeeMonth === currentMonth || (Number(client.balance) || 0) < 2000) {
      return false
    }

    client.balance -= fee
    client.lastMonthlyFeeMonth = currentMonth
    await client.save()

    let agentDoc = agent
    if (!agentDoc && client.agent) {
      agentDoc = await CollectAgent.findById(client.agent).populate('user', 'name email phone')
    }

    if (agentDoc) {
      agentDoc.commissionBalance = (agentDoc.commissionBalance || 0) + agentShare
      agentDoc.commissionTotalEarned = (agentDoc.commissionTotalEarned || 0) + agentShare
      await agentDoc.save()
    }

    const platformAdmin = await wallet.getPlatformAdmin()
    let tx = null
    if (platformAdmin) {
      const adminWallet = await wallet.getOrCreateWallet(platformAdmin._id, { role: 'admin' })
      adminWallet.balance += platformShare
      adminWallet.totalIn += platformShare
      await adminWallet.save()

      tx = await WalletTransaction.create({
        wallet: adminWallet._id,
        owner: platformAdmin._id,
        direction: 'credit',
        amount: platformShare,
        currency: adminWallet.currency || 'XAF',
        type: 'fee_collected',
        balanceAfter: adminWallet.balance,
        counterparty: agentDoc?.user?._id || agentDoc?.user || null,
        description: 'Frais de collecte mensuels (30% de 1 000 F) — Client ' + client.fullName + ' (' + client.accountNumber + ')',
        meta: {
          feeType: 'collect_monthly_fees',
          agentId: agentDoc ? String(agentDoc._id) : null,
          clientId: String(client._id),
          clientName: client.fullName,
          month: currentMonth,
          baseAmount: fee,
          maintenanceFee,
          commissionBase,
          agentShare,
          platformShare,
        },
      })
    }

    await CollectFeeRecord.create({
      agent: agentDoc?._id || client.agent,
      agentUser: agentDoc?.user?._id || agentDoc?.user || null,
      agencyName: agentDoc?.agencyName || 'Collecte',
      agentName: agentDoc?.user?.name || agentDoc?.agencyName || 'Agent',
      client: client._id,
      clientName: client.fullName,
      month: currentMonth,
      amount: fee,
      maintenanceFee,
      commissionBase,
      agentShare,
      platformShare,
      walletTransaction: tx?._id || null,
      deductedAt: new Date(),
    })

    // Répartition automatique 60% Compte 1 / 40% Compte 2 (Frais de fonctionnement mensuel)
    try {
      await adminCoAccountsService.recordPlatformFee({
        category: 'collect_fee',
        amount: platformShare,
        description: 'Frais de fonctionnement mensuel (collecte journalière) — Client ' + client.fullName + ' (' + client.accountNumber + ')',
        reference: 'colfee_' + currentMonth + '_' + client._id,
      })
    } catch (coErr) {
      console.error('[AdminCoAccounts] collect_fee error:', coErr.message)
    }

    return true
  } catch (err) {
    console.error('[checkAndApplyMonthlyFeeForClient error]:', err.message)
    return false
  }
}

async function applyMonthlyFeesForAgent(agentId) {
  try {
    const agent = await CollectAgent.findById(agentId).populate('user', 'name email phone')
    if (!agent || agent.status !== 'active') return

    const currentMonth = getCurrentMonthStr()
    const clients = await CollectClient.find({ agent: agentId, status: 'active' })
    if (clients.length === 0) return

    for (const client of clients) {
      // Conditionné strictement au solde >= 2 000 FCFA
      if (client.lastMonthlyFeeMonth !== currentMonth && (Number(client.balance) || 0) >= 2000) {
        await checkAndApplyMonthlyFeeForClient(client, agent)
      }
    }
  } catch (err) {
    console.error('[applyMonthlyFeesForAgent error]:', err.message)
  }
}

// Résout un client pour un utilisateur connecté (par ID, email, téléphone ou MoMo)
async function resolveClientForUser(user) {
  if (!user) return null
  let client = await CollectClient.findOne({ user: user._id })
  if (client) return client

  const cleanPh = String(user.phone || '').replace(/[^0-9]/g, '')
  const userEmail = String(user.email || '').trim().toLowerCase()
  const orConds = []
  if (userEmail) {
    orConds.push({ email: userEmail })
  }
  if (cleanPh && cleanPh.length >= 8) {
    const phEnd = cleanPh.slice(-9)
    const flexiblePattern = phEnd.split('').join('\\D*')
    const phReg = new RegExp(flexiblePattern)
    orConds.push({ phone: phReg }, { momoMtn: phReg }, { momoOrange: phReg })
  }
  if (orConds.length > 0) {
    client = await CollectClient.findOne({ $or: orConds })
    if (client) {
      if (!client.user) {
        client.user = user._id
        await client.save()
      }
      return client
    }
  }

  // Fallback : parcourir les clients non encore liés et comparer les numéros nettoyés
  if (cleanPh && cleanPh.length >= 8) {
    const unlinked = await CollectClient.find({ user: null })
    const targetDigits = cleanPh.slice(-9)
    const found = unlinked.find((c) => {
      const cPh = String(c.phone || '').replace(/[^0-9]/g, '').slice(-9)
      const cMtn = String(c.momoMtn || '').replace(/[^0-9]/g, '').slice(-9)
      const cOra = String(c.momoOrange || '').replace(/[^0-9]/g, '').slice(-9)
      return (cPh && cPh === targetDigits) || (cMtn && cMtn === targetDigits) || (cOra && cOra === targetDigits)
    })
    if (found) {
      found.user = user._id
      await found.save()
      return found
    }
  }

  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CONFIGURATION & TERMES (Consultation publique / authentifiée)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/collect/config — Récupère les termes et conditions et les frais
router.get('/config', protect, async (req, res) => {
  try {
    const cfg = await CollectConfig.getOrCreate()
    res.json({
      success: true,
      termsAndConditions: cfg.termsAndConditions,
      monthlyFee: cfg.monthlyFee,
      agentSubscriptionFee: cfg.agentSubscriptionFee ?? 4995,
      clientSubscriptionFee: cfg.clientSubscriptionFee ?? 4995,
      clientSubscriptionInterval: cfg.clientSubscriptionInterval ?? 'annual',
      defaultDailyTarget: cfg.defaultDailyTarget,
      cagnotteLockTerms: cfg.cagnotteLockTerms,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. STATUT DE L'AGENT & ADHÉSION (Opt-in)
// ─────────────────────────────────────────────────────────────────────────────


// RÈGLE : Si l'agent a déjà créé des clients ou avait déjà un compte agent existant,
// sa souscription est automatiquement validée (dispense de paywall rétroactif)
async function ensureAgentSubscriptionGrandfathered(agent) {
  if (!agent) return agent
  if (agent.subscriptionPaid) return agent

  const clientCount = await CollectClient.countDocuments({ agent: agent._id })
  if (clientCount > 0) {
    agent.subscriptionPaid = true
    agent.subscriptionPaidAt = agent.subscriptionPaidAt || agent.createdAt || new Date()
    agent.subscriptionPaymentMethod = 'grandfathered'
    agent.subscriptionAmount = 0
    if (!agent.subscriptionHistory) agent.subscriptionHistory = []
    agent.subscriptionHistory.push({
      action: 'grandfathered',
      performerName: 'Système',
      notes: `Compte agent existant avec ${clientCount} client(s) : souscription validée automatiquement sans frais rétroactifs.`,
      date: new Date(),
    })
    await agent.save()
    console.log(`[CollectAgent] Souscription validée automatiquement pour l'agent existant ${agent.agencyName} (${clientCount} clients)`)
  }
  return agent
}

// GET /api/collect/my-agent-status — Vérifie si l'utilisateur connecté est un agent de collecte ou un client enregistré
router.get('/my-agent-status', protect, async (req, res) => {
  try {
    let agent = await CollectAgent.findOne({ user: req.user._id })
    if (agent && !agent.subscriptionPaid) {
      agent = await ensureAgentSubscriptionGrandfathered(agent)
    }
    const cfg = await CollectConfig.getOrCreate()

    // Résolution robuste du client
    let clientDoc = await resolveClientForUser(req.user)
    if (clientDoc && clientDoc.populate) {
      await clientDoc.populate('agent')
    }

    res.json({
      success: true,
      isAgent: !!agent,
      collectWalletBalance: agent?.collectWalletBalance || 0,
      collectWalletTotalFunded: agent?.collectWalletTotalFunded || 0,
      collectWalletTotalSpent: agent?.collectWalletTotalSpent || 0,
      agent,
      termsAccepted: !!agent?.termsAccepted,
      subscriptionPaid: !!agent?.subscriptionPaid,
      subscriptionAmount: agent?.subscriptionAmount || 0,
      agentSubscriptionFee: cfg.agentSubscriptionFee ?? 4995,
      clientSubscriptionFee: cfg.clientSubscriptionFee ?? 4995,
      clientSubscriptionInterval: cfg.clientSubscriptionInterval ?? 'annual',
      status: agent ? agent.status : null,
      isClient: !!clientDoc,
      client: clientDoc,
      termsAndConditions: cfg.termsAndConditions,
      monthlyFee: cfg.monthlyFee,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/collect/opt-in — L'utilisateur accepte les termes et devient Agent de Collecte
router.post('/opt-in', protect, async (req, res) => {
  try {
    const { agencyName, phone, city, neighborhood } = req.body
    if (!agencyName || !String(agencyName).trim()) {
      return res.status(400).json({ message: "Le nom de l'agence ou de l'agent est requis." })
    }
    if (!phone || !String(phone).trim()) {
      return res.status(400).json({ message: 'Le numéro de téléphone est obligatoire.' })
    }

    let agent = await CollectAgent.findOne({ user: req.user._id })
    if (agent) {
      if (agent.status === 'revoked' || agent.status === 'suspended') {
        return res.status(403).json({
          message: "Votre compte d'agent a été suspendu ou révoqué par l'administrateur. Veuillez contacter le support.",
        })
      }
      agent.agencyName = String(agencyName).trim()
      agent.phone = String(phone).trim()
      if (city) agent.city = String(city).trim()
      if (neighborhood) agent.neighborhood = String(neighborhood).trim()
      agent.termsAccepted = true
      agent.termsAcceptedAt = new Date()
      await agent.save()
      return res.json({ success: true, message: "Compte d'agent mis à jour avec succès !", agent })
    }

    agent = await CollectAgent.create({
      user: req.user._id,
      agencyName: String(agencyName).trim(),
      phone: String(phone).trim(),
      city: String(city || '').trim(),
      neighborhood: String(neighborhood || '').trim(),
      termsAccepted: true,
      termsAcceptedAt: new Date(),
      status: 'active',
    })

    res.json({
      success: true,
      message: 'Félicitations ! Vous êtes désormais Agent de Collecte Journalière.',
      agent,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/collect/agent/pay-subscription-wallet — Paiement des frais d'ouverture compte agent (4 995 FCFA) par portefeuille
router.post('/agent/pay-subscription-wallet', protect, async (req, res) => {
  try {
    const agent = await CollectAgent.findOne({ user: req.user._id })
    if (!agent) {
      return res.status(404).json({ message: "Compte d'agent introuvable" })
    }
    if (agent.subscriptionPaid) {
      return res.json({ success: true, message: 'Souscription déjà réglée.', agent })
    }

    const cfg = await CollectConfig.getOrCreate()
    const fee = Number(cfg.agentSubscriptionFee) || 4995

    const userWallet = await wallet.getOrCreateWallet(req.user._id)
    if (userWallet.balance < fee) {
      return res.status(400).json({
        message: `Solde portefeuille insuffisant (${userWallet.balance.toLocaleString('fr-FR')} FCFA). Requis : ${fee.toLocaleString('fr-FR')} FCFA.`,
      })
    }

    // Débit du portefeuille de l'agent
    await wallet.debit(req.user._id, {
      amount: fee,
      type: 'agent_subscription',
      description: "Frais d'ouverture compte agent de collecte (4 995 FCFA)",
      meta: { agentId: String(agent._id) },
    })

    // Marquer l'agent comme souscrit
    agent.subscriptionPaid = true
    agent.subscriptionPaidAt = new Date()
    agent.subscriptionAmount = fee
    agent.subscriptionPaymentMethod = 'wallet'
    agent.subscriptionReference = `agsub_w_${Date.now()}`
    await agent.save()

    // Répartir dans les comptes administrateurs associés (60% Compte 1 / 40% Compte 2)
    try {
      await adminCoAccountsService.recordPlatformFee({
        category: 'agent_signup',
        amount: fee,
        description: `Frais d'ouverture compte agent de collecte — ${agent.agencyName || agent.phone}`,
        reference: agent.subscriptionReference,
      })
    } catch (coErr) {
      console.error('[AdminCoAccounts] recordPlatformFee agent_signup error:', coErr.message)
    }

    res.json({
      success: true,
      message: 'Félicitations ! Votre souscription agent a été payée avec succès.',
      agent,
    })
  } catch (err) {
    console.error('[pay-subscription-wallet error]:', err)
    res.status(500).json({ message: err.message || 'Erreur lors du paiement de la souscription' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// 2bis. PORTEFEUILLE COMMISSIONS SÉPARÉ DE L'AGENT (70% des frais de collecte)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/collect/agent/commission-wallet — Solde commissions, éligibilité retrait (règle 1 mois) & historique
router.get('/agent/commission-wallet', protect, async (req, res) => {
  try {
    const agent = await CollectAgent.findOne({ user: req.user._id })
    if (!agent) {
      return res.status(403).json({ message: "Vous n'avez pas de compte d'agent de collecte." })
    }

    // Synchronisation automatique des commissions
    await applyMonthlyFeesForAgent(agent._id)
    const freshAgent = await CollectAgent.findById(agent._id)

    const now = Date.now()
    const accountOpenedAt = freshAgent.termsAcceptedAt || freshAgent.createdAt || new Date()
    const lastWithdrawalAt = freshAgent.lastCommissionWithdrawal

    // Règle des 1 mois : 30 jours à compter de l'ouverture du compte, ou 30 jours après le dernier retrait
    const baseDate = lastWithdrawalAt ? new Date(lastWithdrawalAt) : new Date(accountOpenedAt)
    const nextWithdrawalDate = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000)
    const canWithdraw = now >= nextWithdrawalDate.getTime()
    const msRemaining = Math.max(0, nextWithdrawalDate.getTime() - now)
    const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000))

    res.json({
      success: true,
      balance: freshAgent.commissionBalance || 0,
      totalEarned: freshAgent.commissionTotalEarned || 0,
      totalWithdrawn: freshAgent.commissionTotalWithdrawn || 0,
      accountOpenedAt,
      lastWithdrawalAt,
      canWithdraw,
      nextWithdrawalDate,
      daysRemaining,
      withdrawals: (freshAgent.commissionWithdrawals || []).sort((a, b) => new Date(b.withdrawnAt) - new Date(a.withdrawnAt)),
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/collect/agent/commission-withdraw — Retrait du portefeuille commissions vers portefeuille ou Mobile Money
router.post('/agent/commission-withdraw', protect, async (req, res) => {
  try {
    const agent = await CollectAgent.findOne({ user: req.user._id })
    if (!agent || agent.status !== 'active') {
      return res.status(403).json({ message: 'Accès réservé aux agents actifs.' })
    }

    const { amount, destination = 'wallet', phone, operator = 'mtn', accountName } = req.body
    const amt = Number(amount)
    if (!amt || amt <= 0) {
      return res.status(400).json({ message: 'Montant de retrait invalide.' })
    }

    if ((agent.commissionBalance || 0) < amt) {
      return res.status(400).json({
        message: 'Solde de commissions insuffisant (' + (agent.commissionBalance || 0).toLocaleString('fr-FR') + ' FCFA disponibles).',
      })
    }

    // Vérification de la règle d'1 mois
    const now = Date.now()
    const accountOpenedAt = agent.termsAcceptedAt || agent.createdAt || new Date()
    const lastWithdrawalAt = agent.lastCommissionWithdrawal
    const baseDate = lastWithdrawalAt ? new Date(lastWithdrawalAt) : new Date(accountOpenedAt)
    const nextWithdrawalDate = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000)

    if (now < nextWithdrawalDate.getTime()) {
      const daysRemaining = Math.ceil((nextWithdrawalDate.getTime() - now) / (24 * 60 * 60 * 1000))
      return res.status(400).json({
        message: 'Le retrait des commissions n\'est possible qu\'après 1 mois complet. Prochain retrait disponible dans ' + daysRemaining + ' jour(s) (le ' + nextWithdrawalDate.toLocaleDateString('fr-FR') + ').',
      })
    }

    // Exécution du retrait
    if (destination === 'wallet') {
      // Crédit du portefeuille principal de l'agent
      await wallet.credit(req.user._id, {
        amount: amt,
        type: 'transfer_received',
        description: 'Retrait de commissions de collecte (70%) vers portefeuille personnel',
        meta: { reason: 'agent_commission_withdraw', agentId: String(agent._id) },
      })
    } else if (destination === 'momo') {
      const payoutPhone = phone || agent.phone
      if (!payoutPhone) {
        return res.status(400).json({ message: 'Numéro Mobile Money requis pour le retrait.' })
      }
      try {
        await ikeepay.createPayout({
          amount: amt,
          phone: payoutPhone,
          operator: operator || 'mtn',
          accountName: accountName || agent.agencyName,
          country: 'CM',
          currency: 'XAF',
          reference: 'wd_comm_' + Date.now(),
        })
      } catch (payoutErr) {
        console.warn('[Commission Payout warning]:', payoutErr.message)
      }
    }

    // Débit du solde commissions
    agent.commissionBalance = Math.max(0, (agent.commissionBalance || 0) - amt)
    agent.commissionTotalWithdrawn = (agent.commissionTotalWithdrawn || 0) + amt
    agent.lastCommissionWithdrawal = new Date()
    agent.commissionWithdrawals.push({
      amount: amt,
      destination,
      phone: phone || agent.phone || '',
      operator: operator || '',
      accountName: accountName || agent.agencyName || '',
      withdrawnAt: new Date(),
      status: 'completed',
    })
    await agent.save()

    res.json({
      success: true,
      message: 'Retrait de vos commissions de ' + amt.toLocaleString('fr-FR') + ' FCFA effectué avec succès !',
      commissionBalance: agent.commissionBalance,
      lastCommissionWithdrawal: agent.lastCommissionWithdrawal,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// 3. TABLEAU DE BORD DE L'AGENT & STATISTIQUES
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/collect/agent/dashboard — Statistiques journalières & mensuelles
router.get('/agent/dashboard', protect, async (req, res) => {
  try {
    let agent = await CollectAgent.findOne({ user: req.user._id })
    if (agent && !agent.subscriptionPaid) {
      agent = await ensureAgentSubscriptionGrandfathered(agent)
    }
    if (!agent) {
      return res.status(403).json({ message: "Vous n'avez pas encore activé votre compte d'agent de collecte." })
    }
    if (agent.status !== 'active') {
      return res.status(403).json({
        message: "Votre compte d'agent est actuellement " + (agent.status === 'suspended' ? 'suspendu' : 'révoqué') + " par l'administrateur.",
      })
    }

    // Synchronisation automatique des frais mensuels (1 100 FCFA) pour les clients de cet agent
    await applyMonthlyFeesForAgent(agent._id)

    const today = getTodayStr()
    const currentMonth = getCurrentMonthStr()

    // 1. Tous les clients enregistrés
    const clients = await CollectClient.find({ agent: agent._id }).sort({ createdAt: -1 })
    const totalClients = clients.length
    const activeClientsCount = clients.filter((c) => c.status === 'active').length

    const clientIds = clients.map((cl) => cl._id)

    // 2. Collectes du jour (y compris collectes effectuées directement par les clients en ligne)
    const todayCollections = await DailyCollection.find({
      $or: [
        { agent: agent._id, date: today },
        { client: { $in: clientIds }, date: today },
      ],
    })
    const paidCollectionsToday = todayCollections.filter((c) => c.status === 'paye')
    const unpaidCollectionsToday = todayCollections.filter((c) => c.status === 'non_paye')

    const totalCollectedToday = paidCollectionsToday.reduce((sum, c) => sum + (c.amount || 0), 0)
    const paidClientsCount = paidCollectionsToday.length

    // Clients en retard aujourd'hui : clients sans collecte payée enregistrée aujourd'hui ou marqués non payé
    const paidClientIds = new Set(paidCollectionsToday.map((c) => String(c.client)))
    const lateClientsCount = clients.filter((c) => !paidClientIds.has(String(c._id))).length

    // 3. Total collecté ce mois-ci
    const monthRegex = new RegExp('^' + currentMonth)
    const monthCollections = await DailyCollection.find({
      $or: [
        { agent: agent._id, date: monthRegex },
        { client: { $in: clientIds }, date: monthRegex },
      ],
      status: 'paye',
    })
    const totalCollectedMonth = monthCollections.reduce((sum, c) => sum + (c.amount || 0), 0)

    // 4. Solde cumulé total des comptes clients de cet agent
    const totalClientBalances = clients.reduce((sum, c) => sum + (c.balance || 0), 0)

    const nowMs = Date.now()
    const acctOpened = agent.termsAcceptedAt || agent.createdAt || new Date()
    const lastWd = agent.lastCommissionWithdrawal
    const baseWdDate = lastWd ? new Date(lastWd) : new Date(acctOpened)
    const nextWdDate = new Date(baseWdDate.getTime() + 30 * 24 * 60 * 60 * 1000)
    const canWithdrawCommission = nowMs >= nextWdDate.getTime()
    const daysRemainingCommission = Math.max(0, Math.ceil((nextWdDate.getTime() - nowMs) / (24 * 60 * 60 * 1000)))

    res.json({
      success: true,
      agent,
      commissionWallet: {
        balance: agent.commissionBalance || 0,
        totalEarned: agent.commissionTotalEarned || 0,
        totalWithdrawn: agent.commissionTotalWithdrawn || 0,
        canWithdraw: canWithdrawCommission,
        nextWithdrawalDate: nextWdDate,
        daysRemaining: daysRemainingCommission,
      },
      stats: {
        today,
        currentMonth,
        totalClients,
        activeClientsCount,
        paidClientsCount,
        lateClientsCount,
        unpaidCount: unpaidCollectionsToday.length,
        totalCollectedToday,
        totalCollectedMonth,
        totalClientBalances,
      },
      todayCollections,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. COLLECTE DU JOUR (Tableau, ajout, modification, suppression)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/collect/agent/daily?date=YYYY-MM-DD — Récupère le tableau de collecte pour une date
router.get('/agent/daily', protect, async (req, res) => {
  try {
    const agent = await CollectAgent.findOne({ user: req.user._id })
    if (!agent || agent.status !== 'active') {
      return res.status(403).json({ message: 'Accès réservé aux agents actifs' })
    }

    const date = req.query.date || getTodayStr()

    // Clients actifs de cet agent ou de sa zone
    const agentNeighborhood = String(agent.neighborhood || '').trim()
    const conds = [{ agent: agent._id }]
    if (agentNeighborhood) {
      conds.push({ neighborhood: agentNeighborhood })
    }
    const clients = await CollectClient.find({
      $or: conds,
      status: 'active',
    }).sort({ fullName: 1 })

    const clientIds = clients.map((cl) => cl._id)
    // Récupère les collectes de l'agent ET celles réglées directement par les clients
    const collections = await DailyCollection.find({
      $or: [
        { agent: agent._id, date },
        { client: { $in: clientIds }, date },
      ],
    }).sort({ createdAt: -1 })

    // Identifier les clients sans collecte aujourd'hui -> automatiquement marqués 'non_collecte'
    const collectedClientIds = new Set(collections.map((c) => String(c.client)))
    const fullDailyList = [...collections]

    for (const cl of clients) {
      if (!collectedClientIds.has(String(cl._id))) {
        fullDailyList.push({
          _id: 'pending_' + cl._id + '_' + date,
          agent: agent._id,
          agentUser: req.user._id,
          client: cl._id,
          clientName: cl.fullName,
          clientPhone: cl.phone,
          neighborhood: cl.neighborhood,
          date,
          amount: 0,
          status: 'non_collecte', // Statut automatique non collecté
          paymentMethod: '—',
          notes: 'Non collecté ce jour',
          isPending: true,
          clientBalance: cl.balance,
        })
      }
    }

    res.json({ success: true, date, collections: fullDailyList })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/collect/agent/daily — Enregistre une collecte journalière en argent réel
router.post('/agent/daily', protect, async (req, res) => {
  try {
    const agent = await CollectAgent.findOne({ user: req.user._id })
    if (!agent || agent.status !== 'active') {
      return res.status(403).json({ message: 'Accès réservé aux agents actifs' })
    }

    const { clientId, amount, neighborhood, paymentMethod = 'wallet', momoPhone, momoOperator = 'mtn', country = 'CM', otp, notes, date } = req.body
    const status = 'paye'
    if (!clientId) return res.status(400).json({ message: 'Client obligatoire' })

    const agentNeighborhood = String(agent.neighborhood || '').trim().toLowerCase()
    let client = await CollectClient.findById(clientId)
    if (!client) return res.status(404).json({ message: 'Client introuvable' })

    const clientNeighborhood = String(client.neighborhood || '').trim().toLowerCase()
    const isAllowed = client.agent.equals(agent._id) || (agentNeighborhood && clientNeighborhood === agentNeighborhood)
    if (!isAllowed) {
      return res.status(403).json({ message: "Vous n'avez pas l'autorisation de collecter pour un client situé hors de votre zone" })
    }

    const collectionDate = date || getTodayStr()
    const amt = Number(amount) || 0
    if (status === 'paye' && amt <= 0) {
      return res.status(400).json({ message: 'Le montant de la collecte doit être supérieur à 0' })
    }

    const finalNeighborhood = String(neighborhood || client.neighborhood || '').trim()

    // Vérifie s'il existe déjà une saisie pour ce client à cette date : RÈGLE STRICTE, IMMUABLE
    const existingCol = await DailyCollection.findOne({ client: client._id, date: collectionDate })
    if (existingCol) {
      return res.status(400).json({
        message: "La collecte pour ce client a déjà été enregistrée pour cette date (" + collectionDate + ") avec le statut " + (existingCol.status === 'paye' ? 'Collecté' : 'Non payé') + ". Elle ne peut plus être modifiée.",
      })
    }

    // SI LE PAIEMENT EST PAR MOBILE MONEY : DÉBIT STRICT AVANT VALIDATION
    if (status === 'paye' && (paymentMethod === 'momo' || paymentMethod === 'mtn' || paymentMethod === 'orange')) {
      const phoneToUse = momoPhone || agent.phone
      const opToUse = momoOperator || (paymentMethod === 'orange' ? 'orange' : 'mtn')
      if (!phoneToUse) {
        return res.status(400).json({ message: 'Numéro de téléphone Mobile Money requis pour le paiement' })
      }

      const PaymentIntent = require('../models/PaymentIntent')
      const providerRef = "col_agent_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6)
      const base = (process.env.SERVER_URL || '').replace(/\/$/, '')

      const pi = await PaymentIntent.create({
        reference: providerRef,
        purpose: 'collect_deposit',
        amount: amt,
        currency: country === 'CM' ? 'XAF' : 'XOF',
        initiatedBy: req.user._id,
        payerPhone: phoneToUse,
        payerOperator: opToUse,
        status: 'pending',
        meta: {
          agentId: String(agent._id),
          clientId: String(client._id),
          clientName: client.fullName,
          source: 'agent_daily',
          date: collectionDate,
          neighborhood: finalNeighborhood,
          notes: notes || '',
        },
      })

      const directRes = await ikeepay.createCollection({
        amount: amt,
        phone: phoneToUse,
        operator: opToUse,
        country,
        currency: country === 'CM' ? 'XAF' : 'XOF',
        reference: providerRef,
        otp,
        callbackUrl: base + "/api/payments/webhook",
      })

      if (directRes.transaction_id || directRes.id) {
        pi.providerTransactionId = directRes.transaction_id || directRes.id
        await pi.save()
      }

      // En mode Mobile Money direct H2H (MTN / Orange), l'initialisation du débit
      // nécessite IMPÉRATIVEMENT la saisie du code PIN secret sur le téléphone portable.
      // On ne crée pas DailyCollection et on ne crédite pas le compte client maintenant.
      // La validation et le crédit seront appliqués UNIQUEMENT après confirmation réseau effective (polling /status ou webhook).
      return res.json({
        success: true,
        pending: true,
        reference: providerRef,
        amount: amt,
        payment_link: directRes.payment_link || directRes.redirect_url || null,
        message: 'Demande de débit Mobile Money envoyée sur votre téléphone. Veuillez valider avec votre code PIN pour finaliser la collecte.',
      })
    }

    // SI LE PAIEMENT EST PAR PORTEFEUILLE COLLECTE AGENT OU WALLET
    if (status === 'paye' && (paymentMethod === 'wallet' || paymentMethod === 'collect_wallet')) {
      const cBal = Number(agent.collectWalletBalance || 0)
      if (cBal < amt) {
        return res.status(400).json({
          message: `Solde insuffisant dans votre Portefeuille Collecte (${cBal.toLocaleString('fr-FR')} FCFA disponibles). Veuillez approvisionner votre Portefeuille Collecte depuis votre portefeuille utilisateur avant de collecter ce client.`,
        })
      }
      agent.collectWalletBalance = Math.max(0, cBal - amt)
      agent.collectWalletTotalSpent = (agent.collectWalletTotalSpent || 0) + amt
      await agent.save()
    }

    const col = await DailyCollection.create({
      agent: agent._id,
      agentUser: req.user._id,
      client: client._id,
      clientName: client.fullName,
      clientPhone: client.phone,
      neighborhood: finalNeighborhood,
      date: collectionDate,
      amount: amt,
      status,
      paymentMethod: paymentMethod === 'mtn' || paymentMethod === 'orange' ? 'momo' : paymentMethod,
      notes: notes || 'Collecté par agent',
      datetime: new Date(),
    })

    if (status === 'paye') {
      client.balance += amt
      await client.save()
      await checkAndApplyMonthlyFeeForClient(client, agent)
    } else {
      await client.save()
    }

    res.json({
      success: true,
      status: 'approved',
      message: status === 'paye'
        ? "Collecte de " + amt.toLocaleString('fr-FR') + " FCFA réglée et créditée avec succès."
        : 'Statut non payé enregistré pour ce jour.',
      collection: col,
      newClientBalance: client.balance,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/collect/agent/daily/:id — Interdit : la collecte créée est immuable
router.put('/agent/daily/:id', protect, async (req, res) => {
  return res.status(403).json({
    message: "Règle de sécurité : L'agent ne peut pas modifier le statut ou les informations d'une collecte déjà enregistrée.",
  })
})

// DELETE /api/collect/agent/daily/:id — Supprime une saisie erronée
router.delete('/agent/daily/:id', protect, async (req, res) => {
  try {
    const agent = await CollectAgent.findOne({ user: req.user._id })
    if (!agent || agent.status !== 'active') {
      return res.status(403).json({ message: 'Accès réservé aux agents actifs' })
    }

    const col = await DailyCollection.findOne({ _id: req.params.id, agent: agent._id })
    if (!col) return res.status(404).json({ message: 'Ligne introuvable' })

    const client = await CollectClient.findById(col.client)
    if (client && col.status === 'paye') {
      client.balance -= col.amount
      await client.save()
    }

    await DailyCollection.deleteOne({ _id: col._id })
    res.json({ success: true, message: 'Ligne de collecte supprimée avec succès' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. GESTION DES CLIENTS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/collect/agent/clients — Liste des clients enregistrés par l'agent
router.get('/agent/clients', protect, async (req, res) => {
  try {
    const agent = await CollectAgent.findOne({ user: req.user._id })
    if (!agent || agent.status !== 'active') {
      return res.status(403).json({ message: 'Accès réservé aux agents actifs' })
    }

    const today = getTodayStr()
    const agentZone = String(agent.neighborhood || '').trim()
    const zoneQuery = agentZone ? [{ neighborhood: new RegExp('^' + agentZone + '$', 'i') }] : []
    const query = {
      $or: [
        { agent: agent._id },
        ...zoneQuery
      ]
    }
    const clients = await CollectClient.find(query).sort({ createdAt: -1 }).lean()

    // Récupère les statuts du jour pour chaque client
    const clientIds = clients.map((c) => c._id)
    const todayCols = await DailyCollection.find({ client: { $in: clientIds }, date: today }).lean()
    const todayMap = {}
    for (const c of todayCols) {
      todayMap[String(c.client)] = c
    }

    const enriched = clients.map((c) => ({
      ...c,
      isOwnClient: String(c.agent) === String(agent._id),
      todayCollection: todayMap[String(c._id)] || null,
      todayStatus: todayMap[String(c._id)] ? todayMap[String(c._id)].status : 'en_attente',
    }))

    res.json({ success: true, clients: enriched })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/collect/agent/clients — Ajout d'un nouveau client avec numéros Mobile Money et email utilisateur
router.post('/agent/clients', protect, async (req, res) => {
  try {
    const agent = await CollectAgent.findOne({ user: req.user._id })
    if (!agent || agent.status !== 'active') {
      return res.status(403).json({ message: 'Accès réservé aux agents actifs' })
    }

    const { fullName, phone, momoMtn, momoOrange, email, neighborhood, city, cni, dailyTarget, monthlyTarget, notes, agentSignature, clientSignature, termsContent } = req.body
    if (!fullName || !String(fullName).trim()) {
      return res.status(400).json({ message: 'Nom et prénom du client requis' })
    }

    const mtnVal = String(momoMtn || '').trim()
    const orangeVal = String(momoOrange || '').trim()
    if (!mtnVal && !orangeVal) {
      return res.status(400).json({
        message: 'Veuillez obligatoirement renseigner au moins un numéro Mobile Money (MTN MoMo ou Orange Money) pour le client.',
      })
    }

    if (!neighborhood || !String(neighborhood).trim()) {
      return res.status(400).json({ message: 'Quartier obligatoire' })
    }

    if (!agentSignature || !clientSignature) {
      return res.status(400).json({
        message: "La signature numérique au doigt de l'agent et du client sur les Termes & Conditions est obligatoire pour créer le compte.",
      })
    }

    const cleanPh = String(phone || mtnVal || orangeVal || '').replace(/[^0-9]/g, '')
    const cleanEmail = String(email || '').trim().toLowerCase()

    let linkedUser = null
    if (cleanEmail) {
      linkedUser = await User.findOne({ email: cleanEmail })
    }
    if (!linkedUser && cleanPh) {
      linkedUser = await User.findOne({
        $or: [
          { phone: cleanPh },
          { phone: new RegExp(cleanPh.slice(-9) + '$') },
        ],
      })
    }

    const dTarget = Number(dailyTarget) || 0
    const mTarget = Number(monthlyTarget) || 0

    const cfg = await CollectConfig.getOrCreate()
    const finalTerms = String(termsContent || cfg.termsAndConditions || '')

    const client = await CollectClient.create({
      agent: agent._id,
      agentUser: req.user._id,
      user: linkedUser ? linkedUser._id : null,
      fullName: String(fullName).trim(),
      phone: String(phone || mtnVal || orangeVal).trim(),
      email: cleanEmail,
      momoMtn: mtnVal,
      momoOrange: orangeVal,
      neighborhood: String(neighborhood).trim(),
      city: String(city || agent.city || '').trim(),
      cni: String(cni || '').trim(),
      dailyTarget: dTarget,
      monthlyTarget: mTarget,
      balance: 0,
      notes: notes || '',
      termsAccepted: true,
      termsSignedAt: new Date(),
      agentSignature: String(agentSignature || '').trim(),
      clientSignature: String(clientSignature || '').trim(),
      termsContent: finalTerms,
    })

    // Déduction des frais mensuels (1 100 FCFA) pour ce client
    await applyMonthlyFeesForAgent(agent._id)

    res.json({
      success: true,
      message: linkedUser
        ? "Client enregistré et rattaché au compte utilisateur de " + linkedUser.name + " avec succès !"
        : 'Client enregistré avec succès.',
      client,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/collect/agent/activate-by-email — Activer directement le compte collecte d'un utilisateur par son email
router.post('/agent/activate-by-email', protect, async (req, res) => {
  try {
    const agent = await CollectAgent.findOne({ user: req.user._id })
    if (!agent || agent.status !== 'active') {
      return res.status(403).json({ message: 'Accès réservé aux agents actifs' })
    }

    const { email, dailyTarget, monthlyTarget, momoMtn, momoOrange, neighborhood } = req.body
    if (!email || !String(email).trim()) {
      return res.status(400).json({ message: "L'adresse email utilisateur est obligatoire" })
    }

    const cleanEmail = String(email).trim().toLowerCase()
    const targetUser = await User.findOne({ email: cleanEmail })

    // Vérifie si cet utilisateur possède déjà un compte collecte
    const existingClient = await CollectClient.findOne({
      $or: [
        ...(targetUser ? [{ user: targetUser._id }] : []),
        { email: cleanEmail },
      ],
    })

    if (existingClient) {
      if (targetUser && !existingClient.user) {
        existingClient.user = targetUser._id
        await existingClient.save()
      }
      return res.status(400).json({
        message: "Cet utilisateur (" + existingClient.fullName + ") possède déjà un compte collecte actif (N° " + existingClient.accountNumber + ").",
        client: existingClient,
      })
    }

    const mtnVal = String(momoMtn || '').trim()
    const orangeVal = String(momoOrange || '').trim()
    const userPhone = targetUser?.phone || ''

    let finalMtn = mtnVal
    let finalOrange = orangeVal
    if (!finalMtn && !finalOrange && userPhone) {
      if (/^(237)?(67|68|650|651|652|653|654)/.test(userPhone)) finalMtn = userPhone
      else finalOrange = userPhone
    }

    if (!finalMtn && !finalOrange) {
      return res.status(400).json({
        message: 'Veuillez obligatoirement renseigner au moins un numéro Mobile Money (MTN MoMo ou Orange Money) pour ce client.',
      })
    }

    const dTarget = Number(dailyTarget) || 0
    const mTarget = Number(monthlyTarget) || 0

    const client = await CollectClient.create({
      agent: agent._id,
      agentUser: req.user._id,
      user: targetUser ? targetUser._id : null,
      fullName: targetUser?.name ? targetUser.name : ("Client (" + cleanEmail.split('@')[0] + ")"),
      phone: userPhone || finalMtn || finalOrange,
      email: cleanEmail,
      momoMtn: finalMtn,
      momoOrange: finalOrange,
      neighborhood: String(neighborhood || agent.neighborhood || 'Quartier principal').trim(),
      city: String(agent.city || '').trim(),
      dailyTarget: dTarget,
      monthlyTarget: mTarget,
      balance: 0,
      notes: targetUser ? ("Activé par email via le compte utilisateur de " + targetUser.name) : 'Pré-activé par email',
      termsAccepted: true,
      termsSignedAt: new Date(),
      termsContent: (await CollectConfig.getOrCreate()).termsAndConditions,
    })

    await applyMonthlyFeesForAgent(agent._id)

    res.json({
      success: true,
      message: targetUser
        ? "Compte collecte activé avec succès pour l'utilisateur " + targetUser.name + " ! Dès sa prochaine connexion, son dashboard d'épargne sera immédiatement opérationnel."
        : "Compte collecte pré-activé pour " + cleanEmail + ". Dès qu'il créera son compte utilisateur, il y aura directement accès.",
      client,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/collect/agent/clients/:id — Détails d'un client et historique de ses collectes
router.get('/agent/clients/:id', protect, async (req, res) => {
  try {
    const agent = await CollectAgent.findOne({ user: req.user._id })
    if (!agent) return res.status(403).json({ message: 'Accès refusé' })

    const client = await CollectClient.findById(req.params.id)
    if (!client) return res.status(404).json({ message: 'Client introuvable' })
    const agentZone = String(agent.neighborhood || '').trim().toLowerCase()
    const clientZone = String(client.neighborhood || '').trim().toLowerCase()
    const isAllowed = client.agent.equals(agent._id) || (agentZone && clientZone === agentZone)
    if (!isAllowed) {
      return res.status(403).json({ message: "Vous n'avez pas l'autorisation d'approvisionner un client hors de votre zone" })
    }

    const collections = await DailyCollection.find({ client: client._id }).sort({ date: -1, datetime: -1 }).limit(300)
    const fees = await CollectFeeRecord.find({ client: client._id }).sort({ month: -1 })

    // Agrégation du cumul des collectes par mois pour ce client
    const monthlySummary = await DailyCollection.aggregate([
      { $match: { client: client._id, status: 'paye' } },
      {
        $group: {
          _id: { $substr: ['$date', 0, 7] }, // 'YYYY-MM'
          totalAmount: { $sum: '$amount' },
          daysCount: { $sum: 1 },
          lastPaymentDate: { $max: '$date' },
        },
      },
      { $sort: { _id: -1 } },
    ])

    const currentMonth = getCurrentMonthStr()
    const currentMonthTotal = monthlySummary.find((m) => m._id === currentMonth)?.totalAmount || 0

    res.json({ success: true, client, collections, monthlySummary, currentMonthTotal, fees })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/collect/agent/clients/:id — Modification des infos client
router.put('/agent/clients/:id', protect, async (req, res) => {
  try {
    const agent = await CollectAgent.findOne({ user: req.user._id })
    if (!agent || agent.status !== 'active') return res.status(403).json({ message: 'Accès refusé' })

    const client = await CollectClient.findById(req.params.id)
    if (!client) return res.status(404).json({ message: 'Client introuvable' })
    const agentZone = String(agent.neighborhood || '').trim().toLowerCase()
    const clientZone = String(client.neighborhood || '').trim().toLowerCase()
    const isAllowed = client.agent.equals(agent._id) || (agentZone && clientZone === agentZone)
    if (!isAllowed) {
      return res.status(403).json({ message: "Vous n'avez pas l'autorisation d'approvisionner un client hors de votre zone" })
    }

    const { fullName, phone, momoMtn, momoOrange, email, neighborhood, city, cni, dailyTarget, status, notes } = req.body
    if (fullName) client.fullName = String(fullName).trim()
    if (phone) client.phone = String(phone).trim()
    if (momoMtn !== undefined) client.momoMtn = String(momoMtn).trim()
    if (momoOrange !== undefined) client.momoOrange = String(momoOrange).trim()
    if (email !== undefined) {
      client.email = String(email).trim().toLowerCase()
      if (client.email && !client.user) {
        const u = await User.findOne({ email: client.email })
        if (u) client.user = u._id
      }
    }
    if (neighborhood) client.neighborhood = String(neighborhood).trim()
    if (city !== undefined) client.city = String(city).trim()
    if (cni !== undefined) client.cni = String(cni).trim()
    if (dailyTarget !== undefined) client.dailyTarget = Number(dailyTarget)
    if (status) client.status = status
    if (notes !== undefined) client.notes = notes

    await client.save()
    res.json({ success: true, message: 'Informations du client mises à jour', client })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. APPROVISIONNEMENT DES COMPTES CLIENTS (Momo & Wallet)
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/collect/agent/clients/:id/deposit-wallet — Approvisionnement depuis le Portefeuille de l'agent
router.post('/agent/clients/:id/deposit-wallet', protect, async (req, res) => {
  try {
    const agent = await CollectAgent.findOne({ user: req.user._id })
    if (!agent || agent.status !== 'active') {
      return res.status(403).json({ message: 'Accès réservé aux agents actifs' })
    }

    const client = await CollectClient.findOne({ _id: req.params.id, agent: agent._id })
    if (!client) return res.status(404).json({ message: 'Client introuvable' })

    const { amount, notes } = req.body
    const amt = Number(amount)
    if (!amt || amt <= 0) return res.status(400).json({ message: 'Montant invalide' })

    // Débit du portefeuille de l'agent
    await wallet.debit(req.user._id, {
      amount: amt,
      type: 'transfer_sent',
      description: `Approvisionnement compte collecte client : ${client.fullName} (${client.accountNumber})`,
      meta: {
        reason: 'collect_topup',
        clientId: String(client._id),
        clientName: client.fullName,
      },
    })

    // Crédit du solde collecte du client
    client.balance += amt
    await client.save()

    // Vérifie et applique la déduction mensuelle des frais (1100 F) si solde >= 1100 F
    await checkAndApplyMonthlyFeeForClient(client, agent)

    // Enregistre l'opération dans la collecte journalière
    const today = getTodayStr()
    await DailyCollection.create({
      agent: agent._id,
      agentUser: req.user._id,
      client: client._id,
      clientName: client.fullName,
      clientPhone: client.phone,
      neighborhood: client.neighborhood,
      date: today,
      amount: amt,
      status: 'paye',
      paymentMethod: 'wallet',
      notes: notes || 'Approvisionnement par portefeuille agent',
      datetime: new Date(),
    })

    res.json({
      success: true,
      message: `Compte client approvisionné de ${amt.toLocaleString('fr-FR')} FCFA depuis votre portefeuille avec succès.`,
      newClientBalance: client.balance,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/collect/agent/clients/:id/deposit-momo — Approvisionnement par Mobile Money direct (H2H)
router.post('/agent/clients/:id/deposit-momo', protect, async (req, res) => {
  try {
    const agent = await CollectAgent.findOne({ user: req.user._id })
    if (!agent || agent.status !== 'active') {
      return res.status(403).json({ message: 'Accès réservé aux agents actifs' })
    }

    const client = await CollectClient.findOne({ _id: req.params.id, agent: agent._id })
    if (!client) return res.status(404).json({ message: 'Client introuvable' })

    const { amount, phone, operator, country = 'CM', otp } = req.body
    const amt = Number(amount)
    if (!amt || amt <= 0) return res.status(400).json({ message: 'Montant invalide' })
    if (!phone || !operator) return res.status(400).json({ message: 'Numéro et opérateur Mobile Money requis' })

    const PaymentIntent = require('../models/PaymentIntent')
    const providerRef = `col_momo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const base = (process.env.SERVER_URL || '').replace(/\/$/, '')

    const pi = await PaymentIntent.create({
      reference: providerRef,
      purpose: 'collect_deposit',
      amount: amt,
      currency: country === 'CM' ? 'XAF' : 'XOF',
      initiatedBy: req.user._id,
      payerPhone: phone,
      payerOperator: operator,
      status: 'pending',
      meta: {
        agentId: String(agent._id),
        clientId: String(client._id),
        clientName: client.fullName,
        source: 'agent_deposit_momo',
      },
    })

    const directRes = await ikeepay.createCollection({
      amount: amt,
      phone,
      operator,
      country,
      currency: country === 'CM' ? 'XAF' : 'XOF',
      reference: providerRef,
      otp,
      callbackUrl: `${base}/api/payments/webhook`,
    })

    if (directRes.transaction_id || directRes.id) {
      pi.providerTransactionId = directRes.transaction_id || directRes.id
      await pi.save()
    }

    // Le débit Mobile Money direct nécessite impérativement la validation par code PIN sur le téléphone.
    // Le crédit effectif sera appliqué automatiquement par applyOutcome dès confirmation du réseau.
    return res.json({
      success: true,
      reference: providerRef,
      status: 'pending',
      amount: amt,
      payment_link: directRes.payment_link || directRes.redirect_url || null,
      message: 'Demande de débit Mobile Money initiée. Validez sur votre téléphone avec votre code PIN pour créditer le compte.',
      newClientBalance: client.balance,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. RAPPORTS JOURNALIERS (Envoi automatique à l'administrateur)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/collect/agent/reports — Liste des rapports journaliers de l'agent
router.get('/agent/reports', protect, async (req, res) => {
  try {
    const agent = await CollectAgent.findOne({ user: req.user._id })
    if (!agent) return res.status(403).json({ message: 'Accès refusé' })

    const reports = await CollectReport.find({ agent: agent._id }).sort({ date: -1 }).limit(60)
    res.json({ success: true, reports })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/collect/agent/reports/submit — Envoie ou met à jour le rapport journalier pour l'administrateur
router.post('/agent/reports/submit', protect, async (req, res) => {
  try {
    const agent = await CollectAgent.findOne({ user: req.user._id }).populate('user', 'name')
    if (!agent || agent.status !== 'active') return res.status(403).json({ message: 'Accès réservé aux agents actifs' })

    const date = req.body.date || getTodayStr()
    const { notes } = req.body

    const clients = await CollectClient.find({ agent: agent._id, status: 'active' })
    const todayCols = await DailyCollection.find({ agent: agent._id, date })

    const paidCols = todayCols.filter((c) => c.status === 'paye')
    const unpaidCols = todayCols.filter((c) => c.status === 'non_paye')
    const totalCollected = paidCols.reduce((sum, c) => sum + (c.amount || 0), 0)

    let report = await CollectReport.findOne({ agent: agent._id, date })
    if (report) {
      report.totalClients = clients.length
      report.paidClientsCount = paidCols.length
      report.unpaidClientsCount = unpaidCols.length
      report.totalCollected = totalCollected
      report.sentToAdmin = true
      report.sentAt = new Date()
      if (notes !== undefined) report.notes = notes
      await report.save()
    } else {
      report = await CollectReport.create({
        agent: agent._id,
        agentUser: req.user._id,
        agencyName: agent.agencyName,
        agentName: agent.user?.name || agent.agencyName,
        date,
        totalClients: clients.length,
        paidClientsCount: paidCols.length,
        unpaidClientsCount: unpaidCols.length,
        totalCollected,
        sentToAdmin: true,
        sentAt: new Date(),
        notes: notes || '',
      })
    }

    res.json({ success: true, message: "Rapport journalier transmis à l'administrateur avec succès !", report })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. GESTION DES COLLECTES CÔTÉ ADMINISTRATEUR
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/collect/admin/overview — Vue d'ensemble pour l'administrateur
router.get('/admin/overview', protect, adminOnly, async (req, res) => {
  try {
    const totalAgents = await CollectAgent.countDocuments({})
    const activeAgents = await CollectAgent.countDocuments({ status: 'active' })
    const suspendedAgents = await CollectAgent.countDocuments({ status: { $in: ['suspended', 'revoked'] } })
    const totalClients = await CollectClient.countDocuments({})

    const today = getTodayStr()
    const currentMonth = getCurrentMonthStr()

    const todayCols = await DailyCollection.find({ date: today, status: 'paye' })
    const todayCollected = todayCols.reduce((sum, c) => sum + (c.amount || 0), 0)

    const monthRegex = new RegExp('^' + currentMonth)
    const monthCols = await DailyCollection.find({ date: monthRegex, status: 'paye' })
    const monthCollected = monthCols.reduce((sum, c) => sum + (c.amount || 0), 0)

    const feeRecords = await CollectFeeRecord.find({})
    const totalFeesCollected = feeRecords.reduce((sum, r) => sum + (r.amount || 0), 0)

    res.json({
      success: true,
      stats: {
        totalAgents,
        activeAgents,
        suspendedAgents,
        totalClients,
        todayCollected,
        monthCollected,
        totalFeesCollected,
      },
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/collect/admin/agents — Liste des agents de collecte avec leurs chiffres
router.get('/admin/agents', protect, adminOnly, async (req, res) => {
  try {
    const agents = await CollectAgent.find({}).sort({ createdAt: -1 }).populate('user', 'name email phone avatar')
    const today = getTodayStr()
    const currentMonth = getCurrentMonthStr()
    const monthRegex = new RegExp('^' + currentMonth)

    const enriched = await Promise.all(
      agents.map(async (ag) => {
        const clientCount = await CollectClient.countDocuments({ agent: ag._id })

        // RÈGLE GRANDFATHERING : Si l'agent a déjà créé des clients, sa souscription est automatiquement validée
        if (clientCount > 0 && !ag.subscriptionPaid) {
          ag.subscriptionPaid = true
          ag.subscriptionPaidAt = ag.subscriptionPaidAt || ag.createdAt || new Date()
          ag.subscriptionPaymentMethod = 'grandfathered'
          if (!ag.subscriptionHistory) ag.subscriptionHistory = []
          ag.subscriptionHistory.push({
            action: 'grandfathered',
            performedBy: ag.user?._id || ag._id,
            performerName: 'Système (Compte existant avec clients)',
            date: new Date(),
            notes: `Souscription validée automatiquement : compte agent existant ayant déjà ${clientCount} client(s).`,
          })
          await ag.save()
        }
        const todayCols = await DailyCollection.find({ agent: ag._id, date: today, status: 'paye' })
        const todayAmount = todayCols.reduce((s, c) => s + (c.amount || 0), 0)

        const monthCols = await DailyCollection.find({ agent: ag._id, date: monthRegex, status: 'paye' })
        const monthAmount = monthCols.reduce((s, c) => s + (c.amount || 0), 0)

        const fees = await CollectFeeRecord.find({ agent: ag._id })
        const totalFees = fees.reduce((s, f) => s + (f.amount || 0), 0)

        return {
          ...ag.toObject(),
          clientCount,
          todayAmount,
          monthAmount,
          totalFees,
        }
      })
    )

    res.json({ success: true, agents: enriched })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/collect/admin/agents/:id — Détails d'un agent spécifique
router.get('/admin/agents/:id', protect, adminOnly, async (req, res) => {
  try {
    const agent = await CollectAgent.findById(req.params.id).populate('user', 'name email phone avatar')
    if (!agent) return res.status(404).json({ message: 'Agent introuvable' })

    const clients = await CollectClient.find({ agent: agent._id }).sort({ createdAt: -1 })
    const reports = await CollectReport.find({ agent: agent._id }).sort({ date: -1 }).limit(30)
    const recentCollections = await DailyCollection.find({ agent: agent._id }).sort({ date: -1 }).limit(50)
    const fees = await CollectFeeRecord.find({ agent: agent._id }).sort({ month: -1 })

    res.json({
      success: true,
      agent,
      clients,
      reports,
      recentCollections,
      fees,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/collect/admin/agents/:id/status — Modifier le statut (retirer / suspendre / réactiver un agent)
router.post('/admin/agents/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const agent = await CollectAgent.findById(req.params.id)
    if (!agent) return res.status(404).json({ message: 'Agent introuvable' })

    const { status, reason } = req.body
    if (!['active', 'suspended', 'revoked'].includes(status)) {
      return res.status(400).json({ message: 'Statut invalide' })
    }

    agent.status = status
    agent.statusReason = reason || ''
    if (status !== 'active') {
      agent.suspendedAt = new Date()
      agent.suspendedBy = req.user._id
    } else {
      agent.suspendedAt = null
      agent.suspendedBy = null
    }
    await agent.save()

    const label = status === 'active' ? 'réactivé' : status === 'suspended' ? 'suspendu' : 'retiré de ses fonctions'
    res.json({ success: true, message: `Agent ${label} avec succès.`, agent })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})


// POST /api/collect/admin/agents/:id/subscription — L'administrateur active/valide ou révoque la souscription d'un agent
router.post('/admin/agents/:id/subscription', protect, adminOnly, async (req, res) => {
  try {
    const agent = await CollectAgent.findById(req.params.id).populate('user', 'name email phone')
    if (!agent) return res.status(404).json({ message: 'Agent introuvable' })

    const { active = true, notes = '' } = req.body

    agent.subscriptionPaid = !!active
    if (active) {
      agent.subscriptionPaidAt = new Date()
      agent.subscriptionPaymentMethod = 'admin_override'
      agent.subscriptionActivatedBy = req.user._id
      if (!agent.subscriptionHistory) agent.subscriptionHistory = []
      agent.subscriptionHistory.push({
        action: 'admin_activated',
        performedBy: req.user._id,
        performerName: req.user.name || req.user.email || 'Administrateur',
        date: new Date(),
        notes: notes || `Souscription validée et activée manuellement par l'administrateur (${req.user.name || req.user.email}).`,
      })
    } else {
      if (!agent.subscriptionHistory) agent.subscriptionHistory = []
      agent.subscriptionHistory.push({
        action: 'admin_deactivated',
        performedBy: req.user._id,
        performerName: req.user.name || req.user.email || 'Administrateur',
        date: new Date(),
        notes: notes || `Souscription désactivée par l'administrateur.`,
      })
    }

    await agent.save()

    res.json({
      success: true,
      message: active
        ? `La souscription de l'agent ${agent.agencyName || agent.user?.name} a été validée avec succès par l'administrateur.`
        : `La souscription de l'agent a été désactivée.`,
      agent,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/collect/admin/subscription-history — Historique des validations de souscription
router.get('/admin/subscription-history', protect, adminOnly, async (req, res) => {
  try {
    const agents = await CollectAgent.find({}).populate('user', 'name email phone')
    const events = []

    for (const ag of agents) {
      for (const h of ag.subscriptionHistory || []) {
        events.push({
          type: 'agent',
          agentId: ag._id,
          agentName: ag.agencyName || ag.user?.name || 'Agent',
          userPhone: ag.phone || ag.user?.phone || '—',
          action: h.action,
          performerName: h.performerName || 'Administrateur',
          date: h.date,
          notes: h.notes,
        })
      }
      if (ag.subscriptionPaid && (!ag.subscriptionHistory || ag.subscriptionHistory.length === 0)) {
        events.push({
          type: 'agent',
          agentId: ag._id,
          agentName: ag.agencyName || ag.user?.name || 'Agent',
          userPhone: ag.phone || ag.user?.phone || '—',
          action: ag.subscriptionPaymentMethod || 'active',
          performerName: ag.subscriptionPaymentMethod === 'admin_override' ? 'Administrateur' : (ag.subscriptionPaymentMethod === 'grandfathered' ? 'Système (compte existant)' : 'Paiement agent'),
          date: ag.subscriptionPaidAt || ag.createdAt,
          notes: ag.subscriptionPaymentMethod === 'admin_override' ? "Validé manuellement par l'administrateur" : `Souscription active (${ag.subscriptionPaymentMethod || 'payé'})`,
        })
      }
    }

    // Clients souscrits
    const subscribedClients = await CollectClient.find({ subscriptionPaid: true }).populate('user', 'name email phone')
    for (const cl of subscribedClients) {
      events.push({
        type: 'client',
        clientId: cl._id,
        clientName: cl.fullName,
        accountNumber: cl.accountNumber,
        userPhone: cl.phone,
        action: 'client_subscribed',
        performerName: cl.subscriptionPaymentMethod === 'wallet' ? 'Portefeuille KATD' : 'Mobile Money Direct',
        date: cl.subscriptionPaidAt || cl.createdAt,
        notes: `Souscription client ${cl.subscriptionInterval === 'monthly' ? 'mensuelle' : 'annuelle'} (${(cl.subscriptionAmount || 4995).toLocaleString('fr-FR')} FCFA)`,
      })
    }

    events.sort((a, b) => new Date(b.date) - new Date(a.date))

    res.json({ success: true, history: events })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/collect/admin/fees-summary — Synthèse des frais par agence/agent
router.get('/admin/fees-summary', protect, adminOnly, async (req, res) => {
  try {
    const records = await CollectFeeRecord.aggregate([
      {
        $group: {
          _id: '$agent',
          agencyName: { $first: '$agencyName' },
          agentName: { $first: '$agentName' },
          agentUser: { $first: '$agentUser' },
          totalClientsCount: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalAgentShare: { $sum: { $ifNull: ['$agentShare', 700] } },
          totalPlatformShare: { $sum: { $ifNull: ['$platformShare', 300] } },
          totalMaintenanceFees: { $sum: { $ifNull: ['$maintenanceFee', 100] } },
          lastDeductedAt: { $max: '$deductedAt' },
        },
      },
      { $sort: { totalAmount: -1 } },
    ])

    res.json({ success: true, summary: records })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/collect/admin/trigger-monthly-fees — Exécute la déduction mensuelle pour tous les agents
router.post('/admin/trigger-monthly-fees', protect, adminOnly, async (req, res) => {
  try {
    const activeAgents = await CollectAgent.find({ status: 'active' })
    for (const ag of activeAgents) {
      await applyMonthlyFeesForAgent(ag._id)
    }
    res.json({ success: true, message: 'Déduction et synchronisation des frais mensuels effectuées avec succès.' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})


// POST /api/collect/admin/clients/:id/withdraw — Retrait ordonné par le Super Administrateur depuis le compte d'un client
router.post('/admin/clients/:id/withdraw', protect, adminOnly, async (req, res) => {
  try {
    const client = await CollectClient.findById(req.params.id)
    if (!client) return res.status(404).json({ message: 'Client introuvable' })

    const { amount, payoutMethod = 'momo', momoNumber, momoOperator, notes } = req.body
    const amt = Number(amount)
    if (!amt || amt <= 0) {
      return res.status(400).json({ message: 'Montant de retrait invalide (doit être supérieur à 0).' })
    }

    if (client.balance < amt) {
      return res.status(400).json({
        message: 'Solde insuffisant pour ce retrait. Solde disponible : ' + client.balance.toLocaleString('fr-FR') + ' FCFA.',
      })
    }

    // Déduction du solde du client
    client.balance -= amt
    await client.save()

    const today = getTodayStr()
    const agent = await CollectAgent.findById(client.agent).populate('user', 'name email phone')

    // Enregistrement dans DailyCollection
    const record = await DailyCollection.create({
      agent: client.agent,
      agentUser: agent?.user?._id || client.agentUser,
      client: client._id,
      clientName: client.fullName,
      clientPhone: client.phone,
      neighborhood: client.neighborhood,
      date: today,
      amount: -amt,
      type: 'retrait',
      status: 'retrait',
      paymentMethod: payoutMethod,
      notes: 'Retrait ordonné par l\'administrateur (' + (req.user.name || 'Admin') + ') vers ' + (payoutMethod === 'momo' ? (momoOperator + ' ' + momoNumber) : payoutMethod) + (notes ? ' - ' + notes : ''),
      datetime: new Date(),
    })

    // Enregistrement dans l'historique complet des retraits administrateur avec tous les détails
    const adminWithdrawal = await CollectAdminWithdrawal.create({
      admin: req.user._id,
      adminName: req.user.name || 'Super Administrateur',
      adminEmail: req.user.email || '',
      adminRole: req.user.role || 'super_admin',
      client: client._id,
      clientName: client.fullName,
      clientAccountNumber: client.accountNumber,
      clientPhone: client.phone,
      neighborhood: client.neighborhood,
      amount: amt,
      payoutMethod,
      momoOperator: momoOperator || '',
      momoNumber: momoNumber || '',
      notes: notes || '',
      executedAt: new Date(),
    })

    // Best effort Mobile Money payout si demandé
    if (payoutMethod === 'momo' && momoNumber && momoOperator) {
      try {
        await ikeepay.createPayout({
          amount: amt,
          phone: momoNumber,
          operator: momoOperator,
          accountName: client.fullName,
          country: 'CM',
          currency: 'XAF',
          reference: 'wd_adm_' + Date.now(),
        })
      } catch (payoutErr) {
        console.warn('[Admin Collect Payout warning]:', payoutErr.message)
      }
    }

    res.json({
      success: true,
      message: 'Retrait de ' + amt.toLocaleString('fr-FR') + ' FCFA validé avec succès pour ' + client.fullName + ' !',
      newBalance: client.balance,
      withdrawal: adminWithdrawal,
      client,
      record,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/collect/admin/withdrawals-history — Historique de tous les retraits effectués par l'administrateur
router.get('/admin/withdrawals-history', protect, adminOnly, async (req, res) => {
  try {
    const withdrawals = await CollectAdminWithdrawal.find({})
      .populate('admin', 'name email role phone')
      .populate('client', 'fullName accountNumber neighborhood phone')
      .sort({ executedAt: -1 })
      .limit(200)
    res.json({ success: true, withdrawals })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/collect/admin/terms — Modification des termes et conditions par l'administrateur
router.put('/admin/terms', protect, adminOnly, async (req, res) => {
  try {
    const { termsAndConditions, monthlyFee, agentSubscriptionFee, clientSubscriptionFee, clientSubscriptionInterval, cagnotteLockTerms } = req.body
    const cfg = await CollectConfig.getOrCreate()
    if (termsAndConditions !== undefined) cfg.termsAndConditions = termsAndConditions
    if (cagnotteLockTerms !== undefined) cfg.cagnotteLockTerms = cagnotteLockTerms
    if (monthlyFee !== undefined) cfg.monthlyFee = Number(monthlyFee)
    if (agentSubscriptionFee !== undefined) cfg.agentSubscriptionFee = Math.max(0, Number(agentSubscriptionFee) || 0)
    if (clientSubscriptionFee !== undefined) cfg.clientSubscriptionFee = Math.max(0, Number(clientSubscriptionFee) || 0)
    if (clientSubscriptionInterval !== undefined && ['annual', 'monthly'].includes(clientSubscriptionInterval)) {
      cfg.clientSubscriptionInterval = clientSubscriptionInterval
    }
    cfg.updatedBy = req.user._id
    await cfg.save()

    res.json({ success: true, message: 'Termes et conditions mis à jour avec succès.', config: cfg })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 9. ESPACE CLIENT ("ÉPARGNEZ AU QUOTIDIEN")
// ─────────────────────────────────────────────────────────────────────────────


// POST /api/collect/client/subscribe-wallet — Souscription client par Portefeuille utilisateur (4 995 FCFA)
router.post('/client/subscribe-wallet', protect, async (req, res) => {
  try {
    const cfg = await CollectConfig.getOrCreate()
    const fee = Number(cfg.clientSubscriptionFee) || 4995
    const interval = cfg.clientSubscriptionInterval || 'annual'

    // 1. Débit du portefeuille personnel de l'utilisateur
    try {
      await wallet.debit(req.user._id, {
        amount: fee,
        type: 'transfer_sent',
        description: `Souscription Client Collecte Journalière (${interval === 'monthly' ? 'Mensuelle' : 'Annuelle'})`,
        meta: { reason: 'client_collect_signup', fee, interval },
      })
    } catch (wErr) {
      return res.status(400).json({
        message: `Solde insuffisant dans votre portefeuille KATD pour payer la souscription (${fee.toLocaleString('fr-FR')} FCFA). Veuillez approvisionner votre portefeuille ou choisir Mobile Money.`,
      })
    }

    // 2. Recherche ou création du compte client
    let client = await resolveClientForUser(req.user)
    const expires = new Date()
    if (interval === 'monthly') {
      expires.setMonth(expires.getMonth() + 1)
    } else {
      expires.setFullYear(expires.getFullYear() + 1)
    }

    const { neighborhood, city, cni, momoMtn, momoOrange } = req.body

    if (client) {
      client.subscriptionPaid = true
      client.subscriptionPaidAt = new Date()
      client.subscriptionExpiresAt = expires
      client.subscriptionAmount = fee
      client.subscriptionInterval = interval
      client.subscriptionPaymentMethod = 'wallet'
      client.isSelfSubscribed = true
      if (neighborhood) client.neighborhood = neighborhood
      if (city) client.city = city
      if (cni) client.cni = cni
      if (momoMtn) client.momoMtn = momoMtn
      if (momoOrange) client.momoOrange = momoOrange
      await client.save()
    } else {
      client = await CollectClient.create({
        user: req.user._id,
        fullName: req.user.name || 'Client Épargne',
        phone: req.user.phone || momoMtn || momoOrange || '',
        email: req.user.email || '',
        momoMtn: momoMtn || '',
        momoOrange: momoOrange || '',
        neighborhood: neighborhood || 'Quartier principal',
        city: city || '',
        cni: cni || '',
        isSelfSubscribed: true,
        subscriptionPaid: true,
        subscriptionPaidAt: new Date(),
        subscriptionExpiresAt: expires,
        subscriptionAmount: fee,
        subscriptionInterval: interval,
        subscriptionPaymentMethod: 'wallet',
        status: 'active',
        termsAccepted: true,
        termsSignedAt: new Date(),
      })
    }

    // 3. Répartition 60% Compte 1 / 40% Compte 2
    await adminCoAccountsService.recordPlatformFee({
      category: 'client_signup',
      amount: fee,
      description: `Frais de souscription client collecte journalière (${client.fullName})`,
      reference: 'wal_sub_' + Date.now(),
    })

    return res.json({
      success: true,
      message: 'Félicitations ! Votre souscription au service Collecte Journalière a été validée avec succès.',
      client,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/collect/client/dashboard — Dashboard du client exactement comme sur la capture
router.get('/client/dashboard', protect, async (req, res) => {
  try {
    const client = await resolveClientForUser(req.user)

    if (!client) {
      return res.status(404).json({
        message: "Vous n'avez pas encore été enregistré comme client par un agent de collecte.",
      })
    }

    const agent = await CollectAgent.findById(client.agent).populate('user', 'name phone email avatar')

    // Dates et calcul du mois
    const now = new Date()
    const year = now.getFullYear()
    const monthIndex = now.getMonth() // 0 = Janvier, 9 = Octobre
    const currentDay = now.getDate()

    const MONTH_NAMES = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
    ]
    const monthName = MONTH_NAMES[monthIndex]
    const monthStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}` // 'YYYY-MM'
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate() // ex: 31 pour Octobre

    // Objectif mensuel
    const dailyTarget = client.dailyTarget || 1000
    const monthlyTarget = client.monthlyTarget || (dailyTarget * daysInMonth)

    // Collectes du mois
    const monthCollections = await DailyCollection.find({
      client: client._id,
      date: new RegExp('^' + monthStr),
    }).lean()

    const collectionMap = {}
    for (const c of monthCollections) {
      collectionMap[c.date] = c
    }

    const todayStr = `${monthStr}-${String(currentDay).padStart(2, '0')}`
    const todayCol = collectionMap[todayStr]
    const todayPaid = todayCol && todayCol.status === 'paye' ? todayCol.amount : 0
    const todayStatus = todayCol && todayCol.status === 'paye' ? 'paye' : 'en_attente'

    // Construction du calendrier des jours du mois
    // Calcul du premier jour de la semaine (1 = Lundi, 7 = Dimanche)
    const firstDayDate = new Date(year, monthIndex, 1)
    let firstDayOfWeek = firstDayDate.getDay() // 0 = Dimanche, 1 = Lundi, ...
    if (firstDayOfWeek === 0) firstDayOfWeek = 7 // format européen Lu=1..Di=7

    let paidDaysCount = 0
    let missedDaysCount = 0
    const calendarDays = []

    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${monthStr}-${String(d).padStart(2, '0')}`
      const col = collectionMap[dStr]
      let dayStatus = 'a_venir'

      if (d < currentDay) {
        if (col && col.status === 'paye') {
          dayStatus = 'paye'
          paidDaysCount++
        } else {
          dayStatus = 'manque'
          missedDaysCount++
        }
      } else if (d === currentDay) {
        if (col && col.status === 'paye') {
          dayStatus = 'paye'
          paidDaysCount++
        } else {
          dayStatus = 'en_attente'
        }
      } else {
        dayStatus = 'a_venir'
      }

      calendarDays.push({
        day: d,
        date: dStr,
        status: dayStatus,
        amount: col ? col.amount : 0,
      })
    }

    const daysRemaining = Math.max(0, daysInMonth - currentDay)
    const progressPercent = monthlyTarget > 0 ? Math.min(100, Math.round((client.balance / monthlyTarget) * 100)) : 0

    // Historique complet des collectes par mois (supervision et suivi mensuel)
    const monthlyHistory = await DailyCollection.aggregate([
      { $match: { client: client._id, status: 'paye' } },
      {
        $group: {
          _id: { $substr: ['$date', 0, 7] }, // 'YYYY-MM'
          totalAmount: { $sum: '$amount' },
          daysCount: { $sum: 1 },
          lastPaymentDate: { $max: '$date' },
        },
      },
      { $sort: { _id: -1 } },
    ])

    const monthPaidCollections = monthCollections.filter((c) => c.status === 'paye')
    const currentMonthTotal = monthPaidCollections.reduce((sum, c) => sum + (c.amount || 0), 0)

    // Historique récent des opérations
    const recentHistory = await DailyCollection.find({ client: client._id }).sort({ date: -1, datetime: -1 }).limit(50)

    res.json({
      success: true,
      client,
      agent,
      month: {
        label: `${monthName} ${year}`,
        monthIndex,
        year,
        daysInMonth,
        currentDay,
        firstDayOfWeek,
      },
      stats: {
        totalBalance: Math.max(0, (typeof client.balance === 'number' ? client.balance : currentMonthTotal) || 0),
        currentMonthTotal: Math.max(0, currentMonthTotal || 0),
        monthlyTarget,
        dailyTarget,
        paidDaysCount,
        daysInMonth,
        daysRemaining,
        progressPercent,
        todayPaid,
        todayStatus,
      },
      calendar: calendarDays,
      monthlyHistory,
      history: recentHistory,
      cagnotte: {
        cycleStart: client.cagnotteCycleStart,
        cycleEnd: client.cagnotteCycleEnd,
        lockStatus: client.cagnotteLockStatus || 'standard_month',
        lockUntil: client.cagnotteLockUntil || client.cagnotteCycleEnd,
        isLocked: (client.cagnotteLockUntil || client.cagnotteCycleEnd) ? (new Date() < new Date(client.cagnotteLockUntil || client.cagnotteCycleEnd)) : false,
        isCycleEnded: (client.cagnotteLockUntil || client.cagnotteCycleEnd) ? (new Date() >= new Date(client.cagnotteLockUntil || client.cagnotteCycleEnd)) : true,
        lockContract: client.cagnotteLockContract || null,
        earlyWithdrawFeeRate: 0.03,
      },
    })

    // Vérification de notification d'échéance cagnotte
    if (client.balance > 0 && (client.cagnotteLockUntil || client.cagnotteCycleEnd) && new Date() >= new Date(client.cagnotteLockUntil || client.cagnotteCycleEnd)) {
      if (!client.cagnotteNotifiedAt) {
        try {
          const sendEmail = require('../utils/sendEmail')
          await sendEmail({
            to: client.email || req.user.email,
            subject: `Échéance de votre cagnotte de collecte (${client.balance.toLocaleString('fr-FR')} FCFA sans frais) — KATD-SCHÜLE`,
            html: `<p>Bonjour <b>${client.fullName}</b>,</p><p>Votre cycle de cagnotte de collecte journalière est arrivé à échéance ! Votre solde de <b>${client.balance.toLocaleString('fr-FR')} FCFA</b> est disponible au retrait sans aucun frais (0%).</p><p>Connectez-vous dès maintenant à votre espace pour effectuer votre retrait ou transférer vos fonds vers votre portefeuille.</p>`,
          })
          client.cagnotteNotifiedAt = new Date()
          await client.save()
        } catch (_) {}
      }
    }
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/collect/client/pay — Le client paie lui-même sa collecte journalière
router.post('/client/pay', protect, async (req, res) => {
  try {
    const { amount, paymentMethod = 'wallet', phone, operator, country = 'CM', otp } = req.body
    const amt = Number(amount)
    if (!amt || amt <= 0) {
      return res.status(400).json({ message: 'Montant de collecte invalide' })
    }

    const client = await resolveClientForUser(req.user)
    if (!client) {
      return res.status(404).json({ message: 'Compte client introuvable.' })
    }

    const agent = await CollectAgent.findById(client.agent).populate('user', 'name email phone')

    if (paymentMethod === 'wallet') {
      try {
        await wallet.debit(req.user._id, {
          amount: amt,
          type: 'transfer_sent',
          description: `Paiement collecte journalière — ${client.fullName} (${client.accountNumber})`,
          meta: { reason: 'client_collect_pay', clientId: String(client._id) },
        })
      } catch (wErr) {
        return res.status(400).json({
          message: 'Solde insuffisant dans votre portefeuille KATD. Veuillez approvisionner votre portefeuille ou choisir Mobile Money.',
        })
      }

      // Mise à jour du solde client
      client.balance += amt
      await client.save()

      // Vérifie et applique les frais mensuels si solde >= 2 000 FCFA
      await checkAndApplyMonthlyFeeForClient(client, agent)

      // Enregistrement dans DailyCollection pour aujourd'hui
      const today = getTodayStr()
      let col = await DailyCollection.findOne({ client: client._id, date: today })
      if (col) {
        col.amount = (col.amount || 0) + amt
        col.status = 'paye'
        col.paymentMethod = 'wallet'
        col.notes = 'Payé par le client depuis son portefeuille KATD'
        col.datetime = new Date()
        await col.save()
      } else {
        col = await DailyCollection.create({
          agent: client.agent,
          agentUser: agent?.user?._id || client.agentUser,
          client: client._id,
          clientName: client.fullName,
          clientPhone: client.phone,
          neighborhood: client.neighborhood,
          date: today,
          amount: amt,
          status: 'paye',
          paymentMethod: 'wallet',
          notes: 'Payé par le client depuis son portefeuille KATD',
          datetime: new Date(),
        })
      }

      return res.json({
        success: true,
        status: 'approved',
        message: 'Paiement de ' + amt.toLocaleString('fr-FR') + ' FCFA validé avec succès depuis votre portefeuille !',
        client,
        collection: col,
        newBalance: client.balance,
      })
    }

    // PAIEMENT VIA MOBILE MONEY (MTN / ORANGE)
    if (paymentMethod === 'momo' || paymentMethod === 'mtn' || paymentMethod === 'orange') {
      const phoneToUse = phone || client.momoMtn || client.momoOrange || client.phone
      const opToUse = operator || (paymentMethod === 'orange' ? 'orange' : 'mtn')
      if (!phoneToUse) {
        return res.status(400).json({ message: 'Numéro et opérateur Mobile Money requis' })
      }
      const PaymentIntent = require('../models/PaymentIntent')
      const providerRef = `col_pay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      const base = (process.env.SERVER_URL || '').replace(/\/$/, '')

      const pi = await PaymentIntent.create({
        reference: providerRef,
        purpose: 'collect_payment',
        amount: amt,
        currency: country === 'CM' ? 'XAF' : 'XOF',
        initiatedBy: req.user._id,
        payerPhone: phoneToUse,
        payerOperator: opToUse,
        status: 'pending',
        meta: {
          clientId: String(client._id),
          clientName: client.fullName,
          source: 'client_pay',
          date: getTodayStr(),
          neighborhood: client.neighborhood,
        },
      })

      const directRes = await ikeepay.createCollection({
        amount: amt,
        phone: phoneToUse,
        operator: opToUse,
        country,
        currency: country === 'CM' ? 'XAF' : 'XOF',
        reference: providerRef,
        otp,
        callbackUrl: `${base}/api/payments/webhook`,
      })

      if (directRes.transaction_id || directRes.id) {
        pi.providerTransactionId = directRes.transaction_id || directRes.id
        await pi.save()
      }

      // Le paiement Mobile Money nécessite impérativement la saisie du code PIN par le client sur son téléphone.
      // Le compte client ne sera crédité qu'après confirmation effective par l'opérateur (webhook ou polling /status).
      return res.json({
        success: true,
        pending: true,
        reference: providerRef,
        amount: amt,
        payment_link: directRes.payment_link || directRes.redirect_url || null,
        message: 'Demande de débit Mobile Money envoyée sur votre téléphone. Veuillez valider avec votre code PIN pour confirmer le paiement.',
      })
    }

    // Notification par email à l'agent
    try {
      const agentUser = agent?.user
      if (agentUser?.email) {
        const { sendEmail } = require('../utils/emailService')
        await sendEmail({
          to: agentUser.email,
          subject: `Paiement de collecte journalière — ${client.fullName}`,
          html: `
            <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
              <h2 style="color: #059669; margin-top: 0;">Paiement de collecte journalière reçu</h2>
              <p>Bonjour <b>${agentUser.name || agent.agencyName}</b>,</p>
              <p>Votre client(e) <b>${client.fullName}</b> (N° Compte : <b>${client.accountNumber}</b>) vient d'effectuer lui-même le versement de sa collecte journalière pour aujourd'hui.</p>
              <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 10px; margin: 15px 0;">
                <p style="margin: 4px 0;"><b>Montant versé :</b> <span style="color: #059669; font-size: 17px; font-weight: bold;">${amt.toLocaleString('fr-FR')} FCFA</span></p>
                <p style="margin: 4px 0;"><b>Date du paiement :</b> ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                <p style="margin: 4px 0;"><b>Nouveau solde du client :</b> <span style="font-weight: bold;">${client.balance.toLocaleString('fr-FR')} FCFA</span></p>
                <p style="margin: 4px 0;"><b>Mode de règlement :</b> ${paymentMethod === 'wallet' ? 'Portefeuille KATD' : 'Mobile Money'}</p>
              </div>
              <p style="color: #4b5563; font-size: 13px;">Votre tableau de bord d'agent et les statistiques du jour ont été mis à jour automatiquement.</p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
              <p style="font-size: 11px; color: #9ca3af; text-align: center;">KATD-SCHÜLE • Système de Collecte & Épargne Sécurisée</p>
            </div>
          `,
        })
      }
    } catch (emailErr) {
      console.error('[Collect Client Pay Email Error]:', emailErr.message)
    }

    res.json({
      success: true,
      message: `Votre collecte de ${amt.toLocaleString('fr-FR')} FCFA a été payée avec succès !`,
      newBalance: client.balance,
      todayCollection: col,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/collect/client/withdraw — Retrait de la cagnotte cumulée (sans frais à échéance, ou 3% si anticipé)
router.post('/client/withdraw', protect, async (req, res) => {
  try {
    const { amount, payoutMethod = 'wallet', momoNumber, momoOperator, accountName, country = 'CM' } = req.body
    const amt = Number(amount)
    if (!amt || amt <= 0) {
      return res.status(400).json({ message: 'Montant de retrait invalide' })
    }

    const client = await resolveClientForUser(req.user)
    if (!client) {
      return res.status(404).json({ message: 'Compte client introuvable.' })
    }

    if (client.balance < amt) {
      return res.status(400).json({
        message: `Solde insuffisant pour ce retrait. Votre solde disponible est de ${client.balance.toLocaleString('fr-FR')} FCFA.`,
      })
    }

    const agent = await CollectAgent.findById(client.agent).populate('user', 'name email phone')

    // Calcul des frais de retrait anticipé (3%) si le retrait a lieu avant l'échéance de 1 mois ou de blocage
    const now = new Date()
    const lockDeadline = client.cagnotteLockUntil || client.cagnotteCycleEnd
    const isEarly = lockDeadline ? (now < new Date(lockDeadline)) : false

    let feeAmount = 0
    let netAmount = amt

    if (isEarly) {
      feeAmount = Math.round(amt * 0.03)
      netAmount = amt - feeAmount

      // Enregistrement des frais de retrait (3%) répartis dans les comptes administrateurs (60% Compte 1, 40% Compte 2)
      try {
        const adminCoAccountsService = require('../services/adminCoAccountsService')
        await adminCoAccountsService.recordPlatformFee({
          category: 'withdrawal_fee',
          amount: feeAmount,
          description: `Frais de retrait anticipé cagnotte client (3%) - ${client.fullName} (${client.accountNumber})`,
          performedBy: req.user?.email || 'system',
        })
      } catch (feeErr) {
        console.error('[Collect] Erreur enregistrement frais admin 3%:', feeErr.message)
      }
    }

    if (payoutMethod === 'wallet') {
      await wallet.credit(req.user._id, {
        amount: netAmount,
        type: 'transfer_received',
        description: isEarly
          ? `Retrait anticipé cagnotte collecte (${client.accountNumber}) — Net reçu : ${netAmount.toLocaleString('fr-FR')} FCFA (Frais 3% : ${feeAmount.toLocaleString('fr-FR')} F)`
          : `Retrait à échéance cagnotte collecte (${client.accountNumber}) — Montant : ${netAmount.toLocaleString('fr-FR')} FCFA (0% frais)`,
        meta: { reason: 'client_collect_withdraw', clientId: String(client._id), baseAmount: amt, fee: feeAmount, isEarly },
      })
    } else if (payoutMethod === 'momo') {
      if (!momoNumber || !momoOperator) {
        return res.status(400).json({ message: 'Numéro et opérateur Mobile Money requis pour le retrait' })
      }
      try {
        await ikeepay.createPayout({
          amount: netAmount,
          phone: momoNumber,
          operator: momoOperator,
          accountName: accountName || client.fullName,
          country,
          currency: country === 'CM' ? 'XAF' : 'XOF',
          reference: `wd_col_${Date.now()}`,
        })
      } catch (payoutErr) {
        console.warn('[Collect Payout warning]:', payoutErr.message)
      }
    }

    // Déduction du solde client
    client.balance -= amt
    // Si la totalité du solde a été retirée, relancer un nouveau cycle mensuel
    if (client.balance <= 0) {
      const nextStart = new Date()
      const nextEnd = new Date(nextStart)
      nextEnd.setMonth(nextEnd.getMonth() + 1)
      client.cagnotteCycleStart = nextStart
      client.cagnotteCycleEnd = nextEnd
      client.cagnotteLockStatus = 'standard_month'
      client.cagnotteLockUntil = nextEnd
      client.cagnotteNotifiedAt = null
    }
    await client.save()

    // Enregistrement de l'opération dans DailyCollection
    const today = getTodayStr()
    const record = await DailyCollection.create({
      agent: client.agent,
      agentUser: agent?.user?._id || client.agentUser,
      client: client._id,
      clientName: client.fullName,
      clientPhone: client.phone,
      neighborhood: client.neighborhood,
      date: today,
      amount: -amt,
      type: 'retrait',
      status: 'retrait',
      paymentMethod: payoutMethod,
      notes: isEarly
        ? `Retrait anticipé vers ${payoutMethod === 'wallet' ? 'Portefeuille' : momoNumber} (Net : ${netAmount} F, Frais 3% : ${feeAmount} F)`
        : `Retrait à échéance vers ${payoutMethod === 'wallet' ? 'Portefeuille' : momoNumber} (Net : ${netAmount} F, 0% frais)`,
      datetime: new Date(),
    })

    res.json({
      success: true,
      message: isEarly
        ? `Retrait anticipé de ${amt.toLocaleString('fr-FR')} FCFA validé. Montant net reçu : ${netAmount.toLocaleString('fr-FR')} FCFA (Frais de retrait 3% : ${feeAmount.toLocaleString('fr-FR')} FCFA).`
        : `Votre retrait de ${amt.toLocaleString('fr-FR')} FCFA a été effectué sans frais avec succès !`,
      newBalance: client.balance,
      netAmount,
      feeAmount,
      isEarly,
      record,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.checkAndApplyMonthlyFeeForClient = checkAndApplyMonthlyFeeForClient
router.resolveClientForUser = resolveClientForUser

// ─────────────────────────────────────────────────────────────────────────────
// NOUVEAUX ENDPOINTS : PORTEFEUILLE COLLECTE AGENT & CAGNOTTE BLOQUÉE
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/collect/agent/fund-collect-wallet — Approvisionne le Portefeuille Collecte depuis le portefeuille utilisateur
router.post('/agent/fund-collect-wallet', protect, async (req, res) => {
  try {
    const agent = await CollectAgent.findOne({ user: req.user._id })
    if (!agent || agent.status !== 'active') {
      return res.status(403).json({ message: 'Accès réservé aux agents de collecte actifs' })
    }

    const { amount } = req.body
    const amt = Math.round(Number(amount) || 0)
    if (!amt || amt <= 0) {
      return res.status(400).json({ message: 'Veuillez saisir un montant valide (minimum 100 FCFA).' })
    }

    const userWallet = await wallet.getOrCreateWallet(req.user._id)
    if (userWallet.balance < amt) {
      return res.status(400).json({
        message: `Solde insuffisant dans votre portefeuille utilisateur (${userWallet.balance.toLocaleString('fr-FR')} FCFA disponibles). Veuillez d'abord effectuer un dépôt dans votre portefeuille.`,
      })
    }

    // Débit du portefeuille utilisateur
    await wallet.debit(req.user._id, {
      amount: amt,
      type: 'transfer_sent',
      description: `Approvisionnement Portefeuille Collecte Agent (${agent.agencyName})`,
      meta: {
        reason: 'agent_fund_collect_wallet',
        agentId: String(agent._id),
      },
    })

    // Crédit du portefeuille collecte de l'agent
    agent.collectWalletBalance = (agent.collectWalletBalance || 0) + amt
    agent.collectWalletTotalFunded = (agent.collectWalletTotalFunded || 0) + amt
    await agent.save()

    const freshUserWallet = await wallet.getOrCreateWallet(req.user._id)

    res.json({
      success: true,
      message: `Votre Portefeuille Collecte a été approvisionné de ${amt.toLocaleString('fr-FR')} FCFA avec succès !`,
      collectWalletBalance: agent.collectWalletBalance,
      userWalletBalance: freshUserWallet.balance,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/collect/client/lock-cagnotte — Le client bloque lui-même sa cagnotte avec signature numérique
router.post('/client/lock-cagnotte', protect, async (req, res) => {
  try {
    const { durationMonths = 1, termsContent, clientSignature } = req.body
    const months = Math.max(1, Math.min(36, Number(durationMonths) || 1))

    if (!clientSignature) {
      return res.status(400).json({ message: 'La signature numérique du client est obligatoire pour valider le blocage de la cagnotte.' })
    }

    const client = await resolveClientForUser(req.user)
    if (!client) return res.status(404).json({ message: 'Compte client introuvable.' })

    const lockStart = new Date()
    const lockEnd = new Date(lockStart)
    lockEnd.setMonth(lockEnd.getMonth() + months)

    const year = lockStart.getFullYear()
    const crypto = require('crypto')
    const rnd = crypto.randomInt(1000, 9999)
    const contractNumber = `CAG-LOCK-${year}-${rnd}`

    const cfg = await CollectConfig.getOrCreate()
    const finalTerms = termsContent || cfg.cagnotteLockTerms

    client.cagnotteLockStatus = 'custom_locked'
    client.cagnotteLockUntil = lockEnd
    client.cagnotteCycleEnd = lockEnd
    client.cagnotteLockContract = {
      contractNumber,
      lockDurationMonths: months,
      lockUntil: lockEnd,
      termsContent: finalTerms,
      clientSignature,
      signedAt: lockStart,
    }

    await client.save()

    try {
      const sendEmail = require('../utils/sendEmail')
      await sendEmail({
        to: client.email || req.user.email,
        subject: `Confirmation de blocage de votre cagnotte (${contractNumber}) — KATD-SCHÜLE`,
        html: `<p>Bonjour <b>${client.fullName}</b>,</p><p>Nous confirmons la sanctuarisation de votre cagnotte pour une durée de <b>${months} mois</b> jusqu'au <b>${lockEnd.toLocaleDateString('fr-FR')}</b>.</p><p>Votre contrat officiel signé numériquement porte la référence : <b>${contractNumber}</b>. Un exemplaire est consultable à tout moment dans votre espace client.</p>`,
      })
    } catch (_) {}

    res.json({
      success: true,
      message: `Votre cagnotte a été bloquée pour une durée de ${months} mois (jusqu'au ${lockEnd.toLocaleDateString('fr-FR')}). Contrat ${contractNumber} certifié avec succès.`,
      contract: client.cagnotteLockContract,
      lockUntil: lockEnd,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/collect/client/transfer-to-wallet — Virement immédiat du solde cagnotte vers le portefeuille utilisateur
router.post('/client/transfer-to-wallet', protect, async (req, res) => {
  try {
    const client = await resolveClientForUser(req.user)
    if (!client) return res.status(404).json({ message: 'Compte client introuvable.' })

    const amt = Number(client.balance) || 0
    if (amt <= 0) {
      return res.status(400).json({ message: 'Votre solde de cagnotte est vide.' })
    }

    const now = new Date()
    const lockDeadline = client.cagnotteLockUntil || client.cagnotteCycleEnd
    const isEarly = lockDeadline ? (now < new Date(lockDeadline)) : false

    let feeAmount = 0
    let netAmount = amt

    if (isEarly) {
      feeAmount = Math.round(amt * 0.03)
      netAmount = amt - feeAmount

      const adminCoAccountsService = require('../services/adminCoAccountsService')
      try {
        await adminCoAccountsService.recordPlatformFee({
          category: 'withdrawal_fee',
          amount: feeAmount,
          description: `Frais de retrait anticipé cagnotte client (3%) - ${client.fullName} (${client.accountNumber})`,
          performedBy: req.user?.email || 'system',
        })
      } catch (fErr) {
        console.error('[Collect] Erreur enregistrement frais 3% admin:', fErr.message)
      }
    }

    await wallet.credit(req.user._id, {
      amount: netAmount,
      type: 'transfer_received',
      description: isEarly
        ? `Transfert anticipé cagnotte vers portefeuille (${client.accountNumber}) — Net reçu : ${netAmount.toLocaleString('fr-FR')} FCFA (Frais 3% : ${feeAmount.toLocaleString('fr-FR')} F)`
        : `Transfert à échéance cagnotte vers portefeuille (${client.accountNumber}) — Montant : ${netAmount.toLocaleString('fr-FR')} FCFA (0% frais)`,
      meta: { reason: 'client_cagnotte_to_wallet', clientId: String(client._id), baseAmount: amt, fee: feeAmount, isEarly },
    })

    client.balance = 0
    const nextStart = new Date()
    const nextEnd = new Date(nextStart)
    nextEnd.setMonth(nextEnd.getMonth() + 1)
    client.cagnotteCycleStart = nextStart
    client.cagnotteCycleEnd = nextEnd
    client.cagnotteLockStatus = 'standard_month'
    client.cagnotteLockUntil = nextEnd
    client.cagnotteNotifiedAt = null
    client.cagnotteAutoTransferredAt = new Date()
    await client.save()

    const today = getTodayStr()
    await DailyCollection.create({
      agent: client.agent,
      agentUser: client.agentUser,
      client: client._id,
      clientName: client.fullName,
      clientPhone: client.phone,
      neighborhood: client.neighborhood,
      date: today,
      amount: -amt,
      type: 'retrait',
      status: 'retrait',
      paymentMethod: 'wallet',
      notes: `Transfert total cagnotte vers portefeuille KATD (Net : ${netAmount} F, Frais : ${feeAmount} F)`,
      datetime: new Date(),
    })

    res.json({
      success: true,
      message: `Votre cagnotte de ${amt.toLocaleString('fr-FR')} FCFA a été transférée vers votre portefeuille avec succès (Montant net reçu : ${netAmount.toLocaleString('fr-FR')} FCFA) !`,
      newBalance: 0,
      netAmount,
      feeAmount,
      isEarly,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/collect/admin/locked-contracts — Liste des contrats de blocage signés par les clients
router.get('/admin/locked-contracts', protect, adminOnly, async (req, res) => {
  try {
    const clients = await CollectClient.find({
      'cagnotteLockContract.contractNumber': { $exists: true, $ne: '' },
    })
      .populate('agent', 'agencyName phone')
      .sort({ 'cagnotteLockContract.signedAt': -1 })
      .lean()

    const contracts = clients.map((cl) => ({
      clientId: cl._id,
      accountNumber: cl.accountNumber,
      clientName: cl.fullName,
      clientPhone: cl.phone,
      clientEmail: cl.email,
      neighborhood: cl.neighborhood,
      balance: cl.balance,
      agentAgencyName: cl.agent?.agencyName || 'Non assigné',
      agentPhone: cl.agent?.phone || '',
      contract: cl.cagnotteLockContract,
      lockUntil: cl.cagnotteLockUntil,
      isCurrentlyLocked: cl.cagnotteLockUntil ? new Date() < new Date(cl.cagnotteLockUntil) : false,
    }))

    res.json({ success: true, contracts })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
