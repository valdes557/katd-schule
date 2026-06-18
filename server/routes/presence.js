const express = require('express')
const router = express.Router()
const User = require('../models/User')
const School = require('../models/School')
const { protect, authorize } = require('../middleware/auth')

// Un utilisateur est « en ligne » si sa dernière activité date de moins de 3 minutes.
const ONLINE_WINDOW_MS = 3 * 60 * 1000

function schoolId(req) { return req.user.school?._id || req.user.school }

function presenceOf(u) {
  const online = !!(u.isOnline && u.lastActivity && (Date.now() - new Date(u.lastActivity).getTime()) < ONLINE_WINDOW_MS)
  return {
    id: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
    avatar: u.avatar || null,
    schoolId: u.school || null,
    online,
    lastLogin: u.lastLogin || null,
    lastLogout: u.lastLogout || null,
    lastActivity: u.lastActivity || null,
  }
}

// POST /api/presence/heartbeat — l'utilisateur connecté signale son activité
router.post('/heartbeat', protect, async (req, res) => {
  try {
    await User.updateOne({ _id: req.user._id }, { $set: { lastActivity: new Date(), isOnline: true } })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/presence/logout — marque l'utilisateur hors ligne (déconnexion)
router.post('/logout', protect, async (req, res) => {
  try {
    await User.updateOne({ _id: req.user._id }, { $set: { isOnline: false, lastLogout: new Date() } })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/presence — liste de présence
//   super_admin : tous les établissements (filtre ?school=) + parents inclus
//   directeur / enseignant : uniquement les utilisateurs de leur établissement
router.get('/', protect, authorize('super_admin', 'directeur', 'enseignant'), async (req, res) => {
  try {
    const isAdmin = req.user.role === 'super_admin'
    let query
    if (isAdmin) {
      query = { role: { $ne: 'super_admin' } }
      if (req.query.school) query.school = req.query.school
    } else {
      const sid = schoolId(req)
      if (!sid) return res.json({ success: true, data: { users: [], schools: [], canDelete: false } })
      query = { school: sid, _id: { $ne: req.user._id } }
    }

    const users = await User.find(query)
      .select('name email role avatar school lastLogin lastLogout lastActivity isOnline')
      .sort({ name: 1 })
      .lean()
    const data = users.map(presenceOf)

    let schools = []
    if (isAdmin) {
      const ids = [...new Set(data.filter((d) => d.schoolId).map((d) => d.schoolId.toString()))]
      const docs = await School.find({ _id: { $in: ids } }).select('name').lean()
      schools = docs.map((s) => ({ id: s._id, name: s.name }))
    }

    res.json({ success: true, data: { users: data, schools, canDelete: isAdmin } })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// DELETE /api/presence/:userId — réinitialise le suivi de présence d'un utilisateur (super_admin)
router.delete('/:userId', protect, authorize('super_admin'), async (req, res) => {
  try {
    const u = await User.findByIdAndUpdate(req.params.userId, {
      $unset: { lastLogin: '', lastLogout: '', lastActivity: '' },
      $set: { isOnline: false },
    })
    if (!u) return res.status(404).json({ message: 'Utilisateur introuvable' })
    res.json({ success: true, message: 'Suivi de présence réinitialisé' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
