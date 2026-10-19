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
// Déduit les 1 100 FCFA sur chaque client actif pour le mois en cours s'ils n'ont pas encore été prélevés,
// et crédite le total correspondant sur le portefeuille de l'administrateur sous le nom de l'agence/agent.
async function applyMonthlyFeesForAgent(agentId) {
  try {
    const agent = await CollectAgent.findById(agentId).populate('user', 'name email phone')
    if (!agent || agent.status !== 'active') return

    const currentMonth = getCurrentMonthStr()
    const clients = await CollectClient.find({ agent: agentId, status: 'active' })
    if (clients.length === 0) return

    const cfg = await CollectConfig.getOrCreate()
    const feePerClient = Number(cfg.monthlyFee) || 1100

    let newlyDeductedCount = 0
    const recordsToCreate = []

    for (const client of clients) {
      if (client.lastMonthlyFeeMonth !== currentMonth) {
        // Déduction des frais de gestion
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
          deductedAt: new Date(),
        })
        newlyDeductedCount++
      }
    }

    if (recordsToCreate.length > 0) {
      const createdRecords = await CollectFeeRecord.insertMany(recordsToCreate)
      const totalAmount = newlyDeductedCount * feePerClient

      // Crédit de la somme totale perçue sur le portefeuille de l'administrateur
      const platformAdmin = await wallet.getPlatformAdmin()
      if (platformAdmin) {
        const adminWallet = await wallet.getOrCreateWallet(platformAdmin._id, { role: 'admin' })
        adminWallet.balance += totalAmount
        adminWallet.totalIn += totalAmount
        await adminWallet.save()

        const tx = await WalletTransaction.create({
          wallet: adminWallet._id,
          owner: platformAdmin._id,
          direction: 'credit',
          amount: totalAmount,
          currency: adminWallet.currency || 'XAF',
          type: 'fee_collected',
          balanceAfter: adminWallet.balance,
          counterparty: agent.user?._id || agent.user,
          description: `Frais de collecte journalière — ${agent.agencyName} (${newlyDeductedCount} clients)`,
          meta: {
            feeType: 'collect',
            agentId: String(agent._id),
            agentName: agent.user?.name || agent.agencyName,
            agencyName: agent.agencyName,
            clientCount: newlyDeductedCount,
            month: currentMonth,
            baseAmount: totalAmount,
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

// GET /api/collect/my-agent-status — Vérifie si l'utilisateur connecté est un agent de collecte
router.get('/my-agent-status', protect, async (req, res) => {
  try {
    const agent = await CollectAgent.findOne({ user: req.user._id })
    const cfg = await CollectConfig.getOrCreate()
    res.json({
      success: true,
      isAgent: !!agent,
      agent,
      termsAccepted: !!agent?.termsAccepted,
      status: agent ? agent.status : null,
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

    res.json({
      success: true,
      agent,
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
    res.json({ success: true, date, collections })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/collect/agent/daily — Enregistre une collecte journalière
router.post('/agent/daily', protect, async (req, res) => {
  try {
    const agent = await CollectAgent.findOne({ user: req.user._id })
    if (!agent || agent.status !== 'active') {
      return res.status(403).json({ message: 'Accès réservé aux agents actifs' })
    }

    const { clientId, amount, neighborhood, status = 'paye', paymentMethod = 'especes', notes, date } = req.body
    if (!clientId) return res.status(400).json({ message: 'Client obligatoire' })

    const client = await CollectClient.findOne({ _id: clientId, agent: agent._id })
    if (!client) return res.status(404).json({ message: 'Client introuvable dans votre agence' })

    const collectionDate = date || getTodayStr()
    const amt = Number(amount) || 0
    const finalNeighborhood = String(neighborhood || client.neighborhood || '').trim()

    // Vérifie s'il existe déjà une saisie pour ce client à cette date
    let col = await DailyCollection.findOne({ client: client._id, date: collectionDate })
    if (col) {
      // Ajuste l'ancien solde si le statut précédent était 'paye'
      if (col.status === 'paye') {
        client.balance -= col.amount
      }
      col.amount = amt
      col.neighborhood = finalNeighborhood
      col.status = status
      col.paymentMethod = paymentMethod
      col.notes = notes || ''
      col.datetime = new Date()
      await col.save()
    } else {
      col = await DailyCollection.create({
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
    }

    // Si payé : on crédite le compte du client
    if (status === 'paye') {
      client.balance += amt
    }
    await client.save()

    res.json({ success: true, message: 'Collecte enregistrée avec succès', collection: col, newClientBalance: client.balance })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/collect/agent/daily/:id — Modifie une ligne de collecte mal renseignée
router.put('/agent/daily/:id', protect, async (req, res) => {
  try {
    const agent = await CollectAgent.findOne({ user: req.user._id })
    if (!agent || agent.status !== 'active') {
      return res.status(403).json({ message: 'Accès réservé aux agents actifs' })
    }

    const col = await DailyCollection.findOne({ _id: req.params.id, agent: agent._id })
    if (!col) return res.status(404).json({ message: 'Ligne de collecte introuvable' })

    const client = await CollectClient.findById(col.client)
    if (!client) return res.status(404).json({ message: 'Client associé introuvable' })

    const { amount, neighborhood, status, paymentMethod, notes } = req.body

    // Annule l'effet précédent sur le solde client
    if (col.status === 'paye') {
      client.balance -= col.amount
    }

    const newAmt = amount !== undefined ? Number(amount) : col.amount
    const newStatus = status !== undefined ? status : col.status

    col.amount = newAmt
    if (neighborhood) col.neighborhood = String(neighborhood).trim()
    col.status = newStatus
    if (paymentMethod) col.paymentMethod = paymentMethod
    if (notes !== undefined) col.notes = notes

    await col.save()

    // Applique le nouveau solde si payé
    if (newStatus === 'paye') {
      client.balance += newAmt
    }
    await client.save()

    res.json({ success: true, message: 'Ligne de collecte mise à jour', collection: col, newClientBalance: client.balance })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
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
    const clients = await CollectClient.find({ agent: agent._id }).sort({ createdAt: -1 }).lean()

    // Récupère les statuts du jour pour chaque client
    const todayCols = await DailyCollection.find({ agent: agent._id, date: today }).lean()
    const todayMap = {}
    for (const c of todayCols) {
      todayMap[String(c.client)] = c
    }

    const enriched = clients.map((c) => ({
      ...c,
      todayCollection: todayMap[String(c._id)] || null,
      todayStatus: todayMap[String(c._id)] ? todayMap[String(c._id)].status : 'en_attente',
    }))

    res.json({ success: true, clients: enriched })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/collect/agent/clients — Ajout d'un nouveau client
router.post('/agent/clients', protect, async (req, res) => {
  try {
    const agent = await CollectAgent.findOne({ user: req.user._id })
    if (!agent || agent.status !== 'active') {
      return res.status(403).json({ message: 'Accès réservé aux agents actifs' })
    }

    const { fullName, phone, neighborhood, city, cni, dailyTarget, notes } = req.body
    if (!fullName || !String(fullName).trim()) {
      return res.status(400).json({ message: 'Nom et prénom du client requis' })
    }
    if (!phone || !String(phone).trim()) {
      return res.status(400).json({ message: 'Numéro de téléphone requis' })
    }
    if (!neighborhood || !String(neighborhood).trim()) {
      return res.status(400).json({ message: 'Quartier obligatoire' })
    }

    const client = await CollectClient.create({
      agent: agent._id,
      agentUser: req.user._id,
      fullName: String(fullName).trim(),
      phone: String(phone).trim(),
      neighborhood: String(neighborhood).trim(),
      city: String(city || agent.city || '').trim(),
      cni: String(cni || '').trim(),
      dailyTarget: Number(dailyTarget) || 1000,
      balance: 0,
      notes: notes || '',
    })

    // Déduction des frais mensuels (1 100 FCFA) pour ce client
    await applyMonthlyFeesForAgent(agent._id)

    res.json({ success: true, message: 'Client enregistré avec succès', client })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/collect/agent/clients/:id — Détails d'un client et historique de ses collectes
router.get('/agent/clients/:id', protect, async (req, res) => {
  try {
    const agent = await CollectAgent.findOne({ user: req.user._id })
    if (!agent) return res.status(403).json({ message: 'Accès refusé' })

    const client = await CollectClient.findOne({ _id: req.params.id, agent: agent._id })
    if (!client) return res.status(404).json({ message: 'Client introuvable' })

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

    const client = await CollectClient.findOne({ _id: req.params.id, agent: agent._id })
    if (!client) return res.status(404).json({ message: 'Client introuvable' })

    const { fullName, phone, neighborhood, city, cni, dailyTarget, status, notes } = req.body
    if (fullName) client.fullName = String(fullName).trim()
    if (phone) client.phone = String(phone).trim()
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

module.exports = router
