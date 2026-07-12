// routes/adminUsers.js — Super admin : gestion de tous les utilisateurs de la plateforme
// (liste + soldes portefeuille + total global + compte externe MoMo, blocage, suppression).
const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/auth')
const User = require('../models/User')
const Wallet = require('../models/Wallet')
const School = require('../models/School')
const WalletTransaction = require('../models/WalletTransaction')

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

    const [users, wallets, schools] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).lean(),
      Wallet.find().select('owner balance locked').lean(),
      School.find().select('name').lean(),
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

    res.json({ success: true, users: paged, total, page, pages, stats })
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

// DELETE /api/admin/users/:id — supprimer un compte (garde-fous : pas soi-même, pas un super_admin).
router.delete('/:id', protect, superAdminOnly, async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user._id)) {
      return res.status(400).json({ message: 'Vous ne pouvez pas supprimer votre propre compte' })
    }
    const target = await User.findById(req.params.id).select('role')
    if (!target) return res.status(404).json({ message: 'Utilisateur introuvable' })
    if (target.role === 'super_admin') return res.status(400).json({ message: 'Impossible de supprimer un super-administrateur' })
    await User.deleteOne({ _id: req.params.id })
    try { await Wallet.deleteOne({ owner: req.params.id }) } catch (e) {}
    res.json({ success: true, message: 'Utilisateur supprimé' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
