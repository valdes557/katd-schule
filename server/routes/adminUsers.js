// routes/adminUsers.js — Super admin : gestion de tous les utilisateurs de la plateforme
// (liste + soldes portefeuille + total global + compte externe MoMo, blocage, suppression).
const express = require('express')
const mongoose = require('mongoose')
const router = express.Router()
const { protect } = require('../middleware/auth')
const User = require('../models/User')
const Wallet = require('../models/Wallet')
const School = require('../models/School')
const Student = require('../models/Student')
const Message = require('../models/Message')
const Mail = require('../models/Mail')
const YouTubeHistory = require('../models/YouTubeHistory')
const YouTubeFavorite = require('../models/YouTubeFavorite')
const AiConversation = require('../models/AiConversation')
const AiUsageLog = require('../models/AiUsageLog')
const UserAiSubscription = require('../models/UserAiSubscription')
const PushSubscription = require('../models/PushSubscription')
const ParentalControl = require('../models/ParentalControl')
const Document = require('../models/Document')
const walletService = require('../services/walletService')

// Persistance serveur de l'activation du système d'approvisionnement utilisateur
const userFundingConfigSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: 'admin_users_funding', unique: true },
    enabled: { type: Boolean, default: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
)
const UserFundingConfig = mongoose.models.UserFundingConfig || mongoose.model('UserFundingConfig', userFundingConfigSchema)

async function isUserFundingEnabled() {
  const cfg = await UserFundingConfig.findOne({ singleton: 'admin_users_funding' }).lean()
  return cfg ? cfg.enabled !== false : true
}

// Garde stricte : rôle super_admin uniquement.
function superAdminOnly(req, res, next) {
  if (req.user.role !== 'super_admin') return res.status(403).json({ message: 'Action réservée au super-administrateur' })
  next()
}

const ONLINE_WINDOW_MS = 3 * 60 * 1000 // « en ligne » = actif il y a moins de 3 min
const isOnline = (u) => !!(u.isOnline && u.lastActivity && (Date.now() - new Date(u.lastActivity).getTime()) < ONLINE_WINDOW_MS)

// GET /api/admin/users — tous les utilisateurs + solde + compte externe. Filtres role, q ; pagination.
router.get('/', protect, superAdminOnly, async (req, res) => {
  try {
    const { role, q } = req.query
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50))

    const filter = {}
    if (role) filter.role = role
    if (q && String(q).trim()) {
      const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      filter.$or = [{ name: rx }, { email: rx }, { phone: rx }, { matricule: rx }, { walletAccountNo: rx }]
    }

    const [users, wallets, schools, userFundingEnabled] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).lean(),
      Wallet.find().select('owner balance locked').lean(),
      School.find().select('name').lean(),
      isUserFundingEnabled(),
    ])

    const balByOwner = {}
    for (const w of wallets) balByOwner[String(w.owner)] = { balance: w.balance || 0, locked: w.locked || 0 }
    const schoolName = {}
    for (const s of schools) schoolName[String(s._id)] = s.name

    let rows = users.map((u) => {
      const bal = balByOwner[String(u._id)] || { balance: 0, locked: 0 }
      return {
        _id: u._id, name: u.name, email: u.email, role: u.role, phone: u.phone || '',
        matricule: u.matricule || '', walletAccountNo: u.walletAccountNo || '',
        school: u.school ? (schoolName[String(u.school)] || '') : '',
        isActive: u.isActive !== false, isMerchant: u.isMerchant === true, isOnline: isOnline(u), createdAt: u.createdAt,
        balance: bal.balance, locked: bal.locked,
        externalAccount: {
          operator: u.externalAccount?.operator || '',
          number: u.externalAccount?.number || '',
          name: u.externalAccount?.name || '',
        },
      }
    })

    // Statistiques calculées sur l'ensemble filtré (avant pagination).
    const stats = {
      totalUsers: rows.length,
      totalBalance: rows.reduce((s, r) => s + (r.balance || 0), 0),
      totalLocked: rows.reduce((s, r) => s + (r.locked || 0), 0),
      onlineCount: rows.filter((r) => r.isOnline).length,
      blockedCount: rows.filter((r) => !r.isActive).length,
      byRole: {},
    }
    for (const r of rows) stats.byRole[r.role] = (stats.byRole[r.role] || 0) + 1

    const total = rows.length
    const pages = Math.max(1, Math.ceil(total / limit))
    const paged = rows.slice((page - 1) * limit, (page - 1) * limit + limit)

    res.json({ success: true, users: paged, total, page, pages, stats, userFundingEnabled })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/admin/users/funding-config — état du module d'approvisionnement utilisateur
router.get('/funding-config', protect, superAdminOnly, async (_req, res) => {
  try {
    const enabled = await isUserFundingEnabled()
    res.json({ success: true, enabled })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/admin/users/funding-config — activer ou désactiver/retirer l'outil d'approvisionnement
// Remarque : désactiver l'outil masque et bloque les nouveaux approvisionnements sans supprimer le journal comptable existant.
router.put('/funding-config', protect, superAdminOnly, async (req, res) => {
  try {
    const enabled = Boolean(req.body?.enabled)
    await UserFundingConfig.findOneAndUpdate(
      { singleton: 'admin_users_funding' },
      { $set: { enabled, updatedBy: req.user._id } },
      { upsert: true, new: true }
    )
    res.json({
      success: true,
      enabled,
      message: enabled
        ? "Système d'approvisionnement des portefeuilles réactivé."
        : "Système d'approvisionnement désactivé (les transactions comptables passées restent tracées).",
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/admin/users/:id/fund — créditer le portefeuille d'un utilisateur avec trace WalletTransaction
router.put('/:id/fund', protect, superAdminOnly, async (req, res) => {
  try {
    const enabled = await isUserFundingEnabled()
    if (!enabled) {
      return res.status(403).json({ message: "Le système d'approvisionnement des portefeuilles est actuellement désactivé." })
    }
    const amt = Math.round(Number(req.body?.amount))
    if (!Number.isFinite(amt) || amt < 100 || amt > 50000000) {
      return res.status(400).json({ message: 'Montant invalide (entre 100 et 50 000 000 F).' })
    }
    const target = await User.findById(req.params.id).select('name email role school walletAccountNo')
    if (!target) return res.status(404).json({ message: 'Utilisateur introuvable' })

    const reason = String(req.body?.reason || '').trim().slice(0, 200)
    const { wallet } = await walletService.credit(target._id, {
      amount: amt,
      type: 'adjustment',
      role: target.role,
      school: target.school || null,
      counterparty: req.user._id,
      reason: reason || `Approvisionnement compte utilisateur (${req.user.email})`,
      description: `Approvisionnement portefeuille ${target.walletAccountNo || target.email} par administrateur (${req.user.email})${reason ? ' — ' + reason : ''}`,
      meta: {
        source: 'admin_users_fund',
        adminId: String(req.user._id),
        adminEmail: req.user.email,
        targetEmail: target.email,
        walletAccountNo: target.walletAccountNo || '',
        reason,
      },
    })

    res.json({
      success: true,
      balance: wallet.balance,
      message: `Portefeuille de ${target.name} (${target.email}) crédité de ${amt.toLocaleString('fr-FR')} F.`,
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/admin/users/:id/block — bloquer/débloquer (isActive). body { blocked: true|false }
router.put('/:id/block', protect, superAdminOnly, async (req, res) => {
  try {
    const blocked = req.body.blocked === true || req.body.blocked === 'true'
    if (String(req.params.id) === String(req.user._id)) {
      return res.status(400).json({ message: 'Vous ne pouvez pas bloquer votre propre compte' })
    }
    const target = await User.findById(req.params.id).select('role')
    if (!target) return res.status(404).json({ message: 'Utilisateur introuvable' })
    if (target.role === 'super_admin') return res.status(400).json({ message: 'Impossible de bloquer un super-administrateur' })
    await User.updateOne({ _id: req.params.id }, { $set: { isActive: !blocked } })
    res.json({ success: true, message: blocked ? 'Utilisateur bloqué' : 'Utilisateur débloqué', isActive: !blocked })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// DELETE /api/admin/users/:id — supprimer définitivement un compte et ses données personnelles non financières
// (garde-fous : pas soi-même, pas un super_admin ; les journaux financiers & d'audit sont conservés pour la traçabilité comptable).
router.delete('/:id', protect, superAdminOnly, async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user._id)) {
      return res.status(400).json({ message: 'Vous ne pouvez pas supprimer votre propre compte' })
    }
    const target = await User.findById(req.params.id).select('role')
    if (!target) return res.status(404).json({ message: 'Utilisateur introuvable' })
    if (target.role === 'super_admin') return res.status(400).json({ message: 'Impossible de supprimer un super-administrateur' })

    const uid = req.params.id
    await User.deleteOne({ _id: uid })

    // Purge des données personnelles / d'activité de l'utilisateur (best-effort en parallèle).
    // Les écritures comptables & d'audit (WalletTransaction, WithdrawalRequest, PaymentIntent, AuditLog) restent intactes.
    await Promise.allSettled([
      Wallet.deleteOne({ owner: uid }),
      Message.deleteMany({ $or: [{ sender: uid }, { recipient: uid }] }),
      Mail.updateMany({ registeredBy: uid }, { $set: { registeredBy: null } }),
      Student.updateMany({ parentUser: uid }, { $set: { parentUser: null } }),
      Student.updateMany({ user: uid }, { $set: { user: null } }),
      YouTubeHistory.deleteMany({ user: uid }),
      YouTubeFavorite.deleteMany({ user: uid }),
      AiConversation.deleteMany({ user: uid }),
      AiUsageLog.deleteMany({ user: uid }),
      UserAiSubscription.deleteMany({ user: uid }),
      PushSubscription.deleteMany({ user: uid }),
      ParentalControl.deleteMany({ parent: uid }),
      Document.deleteMany({ parent: uid }),
    ])

    res.json({ success: true, message: 'Utilisateur et ses données personnelles supprimés définitivement.' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
