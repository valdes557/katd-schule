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
// Répartition : 70% pour l'agent de collecte (770 FCFA) versé sur son portefeuille commissions séparé
//               30% pour la gestion des collectes / plateforme (330 FCFA) versé sur le compte admin.
async function applyMonthlyFeesForAgent(agentId) {
  try {
    const agent = await CollectAgent.findById(agentId).populate('user', 'name email phone')
    if (!agent || agent.status !== 'active') return

    const currentMonth = getCurrentMonthStr()
    const clients = await CollectClient.find({ agent: agentId, status: 'active' })
    if (clients.length === 0) return

    const cfg = await CollectConfig.getOrCreate()
    const feePerClient = Number(cfg.monthlyFee) || 1100
    const agentShare = Math.round(feePerClient * 0.70) // 770 FCFA
    const platformShare = feePerClient - agentShare // 330 FCFA

    let newlyDeductedCount = 0
    const recordsToCreate = []

    for (const client of clients) {
      if (client.lastMonthlyFeeMonth !== currentMonth) {
        // Déduction des 1 100 FCFA sur le compte de collecte du client
        client.balance -= feePerClient
        client.lastMonthlyFeeMonth = currentMonth
        await client.save()

        recordsToCreate.push({
          agent: agent._id,
          agentUser: agent.user?._id || agent.user,
          agencyName: agent.agencyName,
          agentName: agent.user?.name || agent.agencyName,
          client: client._id,
          clientName: client.fullName,
          month: currentMonth,
          amount: feePerClient,
          agentShare,
          platformShare,
          deductedAt: new Date(),
        })
        newlyDeductedCount++
      }
    }

    if (recordsToCreate.length > 0) {
      const createdRecords = await CollectFeeRecord.insertMany(recordsToCreate)
      const totalAmount = newlyDeductedCount * feePerClient
      const totalAgentShare = newlyDeductedCount * agentShare
      const totalPlatformShare = newlyDeductedCount * platformShare

      // 1. Crédit du portefeuille séparé de commissions de l'agent (70%)
      agent.commissionBalance = (agent.commissionBalance || 0) + totalAgentShare
      agent.commissionTotalEarned = (agent.commissionTotalEarned || 0) + totalAgentShare
      await agent.save()

      // 2. Crédit de la plateforme / gestion des collectes (30%)
      const platformAdmin = await wallet.getPlatformAdmin()
      if (platformAdmin) {
        const adminWallet = await wallet.getOrCreateWallet(platformAdmin._id, { role: 'admin' })
        adminWallet.balance += totalPlatformShare
        adminWallet.totalIn += totalPlatformShare
        await adminWallet.save()

        const tx = await WalletTransaction.create({
          wallet: adminWallet._id,
          owner: platformAdmin._id,
          direction: 'credit',
          amount: totalPlatformShare,
          currency: adminWallet.currency || 'XAF',
          type: 'fee_collected',
          balanceAfter: adminWallet.balance,
          counterparty: agent.user?._id || agent.user,
          description: 'Frais de gestion collecte (30%) — ' + agent.agencyName + ' (' + newlyDeductedCount + ' clients)',
          meta: {
            feeType: 'collect_platform_share',
            agentId: String(agent._id),
            agentName: agent.user?.name || agent.agencyName,
            agencyName: agent.agencyName,
            clientCount: newlyDeductedCount,
            month: currentMonth,
            baseAmount: totalAmount,
            agentShare: totalAgentShare,
            platformShare: totalPlatformShare,
          },
        })

        // Associe le txId aux enregistrements
        await CollectFeeRecord.updateMany(
          { _id: { $in: createdRecords.map((r) => r._id) } },
          { $set: { walletTransaction: tx._id } }
        )
      }
    }
  } catch (err) {
    console.error('[applyMonthlyFeesForAgent error]:', err.message)
  }
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
      defaultDailyTarget: cfg.defaultDailyTarget,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. STATUT DE L'AGENT & ADHÉSION (Opt-in)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/collect/my-agent-status — Vérifie si l'utilisateur connecté est un agent de collecte ou un client enregistré
router.get('/my-agent-status', protect, async (req, res) => {
  try {
    const agent = await CollectAgent.findOne({ user: req.user._id })
    const cfg = await CollectConfig.getOrCreate()

    // Vérifie si l'utilisateur est un client enregistré par un agent (par user._id, email ou téléphone)
    const cleanPh = String(req.user.phone || '').replace(/[^0-9]/g, '')
    const userEmail = String(req.user.email || '').trim().toLowerCase()
    let clientDoc = await CollectClient.findOne({ user: req.user._id }).populate('agent')
    if (!clientDoc) {
      const orConds = []
      if (userEmail) orConds.push({ email: userEmail })
      if (cleanPh) {
        const phEnd = cleanPh.slice(-9)
        const phReg = new RegExp(phEnd + '$')
        orConds.push({ phone: phReg }, { momoMtn: phReg }, { momoOrange: phReg })
      }
      if (orConds.length > 0) {
        clientDoc = await CollectClient.findOne({ $or: orConds }).populate('agent')
        if (clientDoc && !clientDoc.user) {
          clientDoc.user = req.user._id
          await clientDoc.save()
        }
      }
    }

    res.json({
      success: true,
      isAgent: !!agent,
      agent,
      termsAccepted: !!agent?.termsAccepted,
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
    const agent = await CollectAgent.findOne({ user: req.user._id })
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

    // 2. Collectes du jour
    const todayCollections = await DailyCollection.find({ agent: agent._id, date: today })
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
      agent: agent._id,
      date: monthRegex,
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
    const collections = await DailyCollection.find({ agent: agent._id, date }).sort({ createdAt: -1 })

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

    // SI LE STATUT EST 'PAYE' : PAIEMENT EN ARGENT RÉEL EXIGÉ
    if (status === 'paye') {
      if (paymentMethod === 'wallet') {
        // Débit en argent réel du portefeuille de l'agent
        try {
          await wallet.debit(req.user._id, {
            amount: amt,
            type: 'transfer_sent',
            description: "Collecte journalière client : " + client.fullName + " (" + client.accountNumber + ")",
            meta: {
              reason: 'agent_collect_pay',
              clientId: String(client._id),
              agentId: String(agent._id),
            },
          })
        } catch (walletErr) {
          return res.status(400).json({
            message: "Solde insuffisant dans votre portefeuille pour régler cette collecte (" + amt.toLocaleString('fr-FR') + " FCFA). Veuillez recharger votre portefeuille ou choisir Mobile Money.",
          })
        }
      } else if (paymentMethod === 'momo' || paymentMethod === 'mtn' || paymentMethod === 'orange') {
        const phoneToUse = momoPhone || agent.phone
        const opToUse = momoOperator || (paymentMethod === 'orange' ? 'orange' : 'mtn')
        if (!phoneToUse) {
          return res.status(400).json({ message: 'Numéro de téléphone Mobile Money requis pour le paiement' })
        }

        const PaymentIntent = require('../models/PaymentIntent')
        const providerRef = "col_agent_" + Date.now()
        const base = (process.env.SERVER_URL || '').replace(/\/$/, '')

        const pi = await PaymentIntent.create({
          user: req.user._id,
          type: 'collect_deposit',
          amount: amt,
          currency: country === 'CM' ? 'XAF' : 'XOF',
          provider: 'ikeepay',
          providerRef,
          meta: { agentId: String(agent._id), clientId: String(client._id), clientName: client.fullName },
        })

        const directRes = await ikeepay.createDirectCharge({
          amount: amt,
          phone: phoneToUse,
          operator: opToUse,
          country,
          currency: country === 'CM' ? 'XAF' : 'XOF',
          reference: providerRef,
          otp,
          callbackUrl: base + "/api/payments/webhook",
        })

        if (directRes.status === 'approved' || directRes.status === 'success') {
          pi.status = 'approved'
          pi.fulfilled = true
          await pi.save()
        }
      }
    }

    const finalNeighborhood = String(neighborhood || client.neighborhood || '').trim()

    // Vérifie s'il existe déjà une saisie pour ce client à cette date : RÈGLE STRICTE, IMMUABLE
    const existingCol = await DailyCollection.findOne({ client: client._id, date: collectionDate })
    if (existingCol) {
      return res.status(400).json({
        message: "La collecte pour ce client a déjà été enregistrée pour cette date (" + collectionDate + ") avec le statut " + (existingCol.status === 'paye' ? 'Collecté' : 'Non payé') + ". Elle ne peut plus être modifiée.",
      })
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
      paymentMethod,
      notes: notes || '',
      datetime: new Date(),
    })

    if (status === 'paye') {
      client.balance += amt
    }
    await client.save()

    res.json({
      success: true,
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

    const dTarget = Number(dailyTarget) || 1000
    const mTarget = Number(monthlyTarget) || (dTarget * 31)

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

    const dTarget = Number(dailyTarget) || 1000
    const mTarget = Number(monthlyTarget) || (dTarget * 31)

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

    const collections = await DailyCollection.find({ client: client._id }).sort({ date: -1 }).limit(100)
    const fees = await CollectFeeRecord.find({ client: client._id }).sort({ month: -1 })

    res.json({ success: true, client, collections, fees })
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
    const providerRef = `col_momo_${Date.now()}`
    const base = (process.env.SERVER_URL || '').replace(/\/$/, '')

    const pi = await PaymentIntent.create({
      user: req.user._id,
      type: 'collect_deposit',
      amount: amt,
      currency: country === 'CM' ? 'XAF' : 'XOF',
      provider: 'ikeepay',
      providerRef,
      meta: {
        agentId: String(agent._id),
        clientId: String(client._id),
        clientName: client.fullName,
      },
    })

    const directRes = await ikeepay.createDirectCharge({
      amount: amt,
      phone,
      operator,
      country,
      currency: country === 'CM' ? 'XAF' : 'XOF',
      reference: providerRef,
      otp,
      callbackUrl: `${base}/api/payments/webhook`,
    })

    if (directRes.status === 'approved' || directRes.status === 'success') {
      pi.status = 'approved'
      pi.fulfilled = true
      await pi.save()

      client.balance += amt
      await client.save()

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
        paymentMethod: 'momo',
        notes: 'Approvisionnement Mobile Money direct',
        datetime: new Date(),
      })

      return res.json({
        success: true,
        status: 'approved',
        message: 'Approvisionnement validé avec succès !',
        newClientBalance: client.balance,
      })
    }

    res.json({
      success: true,
      reference: providerRef,
      status: 'pending',
      message: 'Demande de débit Mobile Money initiée. Validez sur votre téléphone.',
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
          totalAgentShare: { $sum: { $ifNull: ['$agentShare', 770] } },
          totalPlatformShare: { $sum: { $ifNull: ['$platformShare', 330] } },
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
    const { termsAndConditions, monthlyFee } = req.body
    const cfg = await CollectConfig.getOrCreate()
    if (termsAndConditions !== undefined) cfg.termsAndConditions = termsAndConditions
    if (monthlyFee !== undefined) cfg.monthlyFee = Number(monthlyFee)
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

// GET /api/collect/client/dashboard — Dashboard du client exactement comme sur la capture
router.get('/client/dashboard', protect, async (req, res) => {
  try {
    const cleanPh = String(req.user.phone || '').replace(/[^0-9]/g, '')
    const userEmail = String(req.user.email || '').trim().toLowerCase()
    let client = await CollectClient.findOne({ user: req.user._id })
    if (!client) {
      const orConds = []
      if (userEmail) orConds.push({ email: userEmail })
      if (cleanPh) {
        const phEnd = cleanPh.slice(-9)
        const phReg = new RegExp(phEnd + '$')
        orConds.push({ phone: phReg }, { momoMtn: phReg }, { momoOrange: phReg })
      }
      if (orConds.length > 0) {
        client = await CollectClient.findOne({ $or: orConds })
        if (client && !client.user) {
          client.user = req.user._id
          await client.save()
        }
      }
    }

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

    // Historique récent des opérations (dépôts et retraits)
    const recentHistory = await DailyCollection.find({ client: client._id }).sort({ date: -1, datetime: -1 }).limit(30)

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
        firstDayOfWeek, // pour alignement sur Lu-Di
      },
      stats: {
        totalBalance: client.balance || 0,
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
      history: recentHistory,
    })
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

    const cleanPh = String(req.user.phone || '').replace(/[^0-9]/g, '')
    let client = await CollectClient.findOne({ user: req.user._id })
    if (!client && cleanPh) {
      client = await CollectClient.findOne({ phone: new RegExp(cleanPh.slice(-9) + '$') })
      if (client && !client.user) {
        client.user = req.user._id
        await client.save()
      }
    }
    if (!client) {
      return res.status(404).json({ message: 'Compte client introuvable.' })
    }

    const agent = await CollectAgent.findById(client.agent).populate('user', 'name email phone')

    if (paymentMethod === 'wallet') {
      await wallet.debit(req.user._id, {
        amount: amt,
        type: 'transfer_sent',
        description: `Paiement collecte journalière — ${client.fullName} (${client.accountNumber})`,
        meta: { reason: 'client_collect_pay', clientId: String(client._id) },
      })
    } else if (paymentMethod === 'momo') {
      if (!phone || !operator) {
        return res.status(400).json({ message: 'Numéro et opérateur Mobile Money requis' })
      }
      const PaymentIntent = require('../models/PaymentIntent')
      const providerRef = `col_pay_${Date.now()}`
      const base = (process.env.SERVER_URL || '').replace(/\/$/, '')

      const pi = await PaymentIntent.create({
        user: req.user._id,
        type: 'collect_deposit',
        amount: amt,
        currency: country === 'CM' ? 'XAF' : 'XOF',
        provider: 'ikeepay',
        providerRef,
        meta: { clientId: String(client._id), clientName: client.fullName },
      })

      const directRes = await ikeepay.createDirectCharge({
        amount: amt,
        phone,
        operator,
        country,
        currency: country === 'CM' ? 'XAF' : 'XOF',
        reference: providerRef,
        otp,
        callbackUrl: `${base}/api/payments/webhook`,
      })

      if (directRes.status === 'approved' || directRes.status === 'success') {
        pi.status = 'approved'
        pi.fulfilled = true
        await pi.save()
      }
    }

    // Mise à jour du solde client
    client.balance += amt
    await client.save()

    // Enregistrement dans DailyCollection pour aujourd'hui
    const today = getTodayStr()
    let col = await DailyCollection.findOne({ client: client._id, date: today })
    if (col) {
      col.amount = (col.amount || 0) + amt
      col.status = 'paye'
      col.paymentMethod = paymentMethod
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
        paymentMethod,
        notes: 'Payé par le client depuis son espace',
        datetime: new Date(),
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

// POST /api/collect/client/withdraw — Le client retire lui-même le montant qu'il veut
router.post('/client/withdraw', protect, async (req, res) => {
  try {
    const { amount, payoutMethod = 'wallet', momoNumber, momoOperator, accountName, country = 'CM' } = req.body
    const amt = Number(amount)
    if (!amt || amt <= 0) {
      return res.status(400).json({ message: 'Montant de retrait invalide' })
    }

    const cleanPh = String(req.user.phone || '').replace(/[^0-9]/g, '')
    let client = await CollectClient.findOne({ user: req.user._id })
    if (!client && cleanPh) {
      client = await CollectClient.findOne({ phone: new RegExp(cleanPh.slice(-9) + '$') })
      if (client && !client.user) {
        client.user = req.user._id
        await client.save()
      }
    }
    if (!client) {
      return res.status(404).json({ message: 'Compte client introuvable.' })
    }

    if (client.balance < amt) {
      return res.status(400).json({
        message: `Solde insuffisant pour ce retrait. Votre solde disponible est de ${client.balance.toLocaleString('fr-FR')} FCFA.`,
      })
    }

    const agent = await CollectAgent.findById(client.agent).populate('user', 'name email phone')

    if (payoutMethod === 'wallet') {
      await wallet.credit(req.user._id, {
        amount: amt,
        type: 'transfer_received',
        description: `Retrait depuis mon compte de collecte journalière (${client.accountNumber})`,
        meta: { reason: 'client_collect_withdraw', clientId: String(client._id) },
      })
    } else if (payoutMethod === 'momo') {
      if (!momoNumber || !momoOperator) {
        return res.status(400).json({ message: 'Numéro et opérateur Mobile Money requis pour le retrait' })
      }
      try {
        await ikeepay.createPayout({
          amount: amt,
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
      notes: `Retrait effectué par le client vers ${payoutMethod === 'wallet' ? 'Portefeuille' : momoNumber}`,
      datetime: new Date(),
    })

    res.json({
      success: true,
      message: `Votre retrait de ${amt.toLocaleString('fr-FR')} FCFA a été effectué avec succès !`,
      newBalance: client.balance,
      record,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
