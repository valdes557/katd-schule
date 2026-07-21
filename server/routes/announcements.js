const express = require('express')
const router = express.Router()
const Announcement = require('../models/Announcement')
const User = require('../models/User')
const Student = require('../models/Student')
const { protect, authorize } = require('../middleware/auth')
const pushService = require('../services/pushService')

function schoolId(req) { return req.user.school?._id || req.user.school }

// Destinataires push d'une annonce selon l'audience (all / parents / teachers).
async function announcementRecipients(sid, audience, excludeId) {
  const ids = []
  if (audience === 'all' || audience === 'teachers') {
    const staff = await User.find({ school: sid, role: { $in: ['enseignant'] }, isActive: { $ne: false } }).select('_id').lean()
    ids.push(...staff.map((u) => u._id.toString()))
  }
  if (audience === 'all' || audience === 'parents') {
    const students = await Student.find({ school: sid, parentUser: { $ne: null }, status: 'active' }).select('parentUser').lean()
    ids.push(...students.map((s) => s.parentUser?.toString()).filter(Boolean))
  }
  const ex = excludeId?.toString()
  return [...new Set(ids)].filter((id) => id !== ex)
}

// Audiences visibles selon le rôle de l'utilisateur
function audiencesFor(role) {
  if (role === 'parent') return ['all', 'parents']
  if (role === 'enseignant') return ['all', 'teachers']
  return ['all', 'parents', 'teachers'] // directeur / super_admin : tout
}

// GET /api/announcements — annonces visibles par l'utilisateur courant
router.get('/', protect, async (req, res) => {
  try {
    const sid = schoolId(req)
    if (!sid) return res.json({ success: true, data: [] })

    const query = { school: sid }
    if (req.user.role !== 'directeur' && req.user.role !== 'super_admin') {
      query.audience = { $in: audiencesFor(req.user.role) }
    }

    const items = await Announcement.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(req.query.limit) || 100)
    res.json({ success: true, data: items })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/announcements — le directeur publie une annonce
router.post('/', protect, authorize('directeur', 'super_admin', 'secretaire'), async (req, res) => {
  try {
    const { title, content, audience } = req.body
    if (!content || String(content).trim().length === 0) {
      return res.status(400).json({ message: "Le contenu de l'annonce est requis" })
    }
    const sid = schoolId(req)
    if (!sid) return res.status(400).json({ message: 'Aucune école associée à votre compte' })

    const finalAudience = ['all', 'parents', 'teachers'].includes(audience) ? audience : 'all'
    const announcement = await Announcement.create({
      school: sid,
      title: title?.trim() || '',
      content: content.trim(),
      audience: finalAudience,
      createdBy: req.user._id,
    })

    // Push aux destinataires de l'annonce (best-effort).
    announcementRecipients(sid, finalAudience, req.user._id).then((ids) => {
      pushService.sendToUsers(ids, {
        title: announcement.title || 'Nouvelle annonce',
        body: content.trim().slice(0, 100),
        url: '/dashboard/annonces',
        tag: 'ann_' + announcement._id.toString(),
      })
    }).catch(() => {})

    res.status(201).json({ success: true, data: announcement })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// DELETE /api/announcements/:id
router.delete('/:id', protect, authorize('directeur', 'super_admin', 'secretaire'), async (req, res) => {
  try {
    const r = await Announcement.findOneAndDelete({ _id: req.params.id, school: schoolId(req) })
    if (!r) return res.status(404).json({ message: 'Annonce non trouvée' })
    res.json({ success: true, message: 'Annonce supprimée' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
