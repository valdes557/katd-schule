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

// Envoie le push d'une annonce à ses destinataires (best-effort). Réutilisé par la
// publication immédiate (POST) et par la publication différée (scheduler).
function pushAnnouncement(announcement) {
  announcementRecipients(announcement.school, announcement.audience, announcement.createdBy).then((ids) => {
    pushService.sendToUsers(ids, {
      title: announcement.title || 'Nouvelle annonce',
      body: (announcement.content || '').slice(0, 100),
      url: '/dashboard/annonces',
      tag: 'ann_' + announcement._id.toString(),
    })
  }).catch(() => {})
}

// GET /api/announcements — annonces visibles par l'utilisateur courant
router.get('/', protect, async (req, res) => {
  try {
    const sid = schoolId(req)
    if (!sid) return res.json({ success: true, data: [] })

    const isManager = ['directeur', 'super_admin', 'secretaire'].includes(req.user.role)
    const query = { school: sid }
    if (!isManager) {
      // Les lecteurs ne voient que les annonces publiées de leur audience ;
      // les gestionnaires voient aussi leurs annonces programmées (pour les gérer).
      query.status = 'publiee'
      query.audience = { $in: audiencesFor(req.user.role) }
    }

    const items = await Announcement.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(req.query.limit) || 100)
    res.json({ success: true, data: items })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/announcements — le directeur publie (ou programme) une annonce
router.post('/', protect, authorize('directeur', 'super_admin', 'secretaire'), async (req, res) => {
  try {
    const { title, content, audience, scheduledAt } = req.body
    if (!content || String(content).trim().length === 0) {
      return res.status(400).json({ message: "Le contenu de l'annonce est requis" })
    }
    const sid = schoolId(req)
    if (!sid) return res.status(400).json({ message: 'Aucune école associée à votre compte' })

    // Programmation : une date > 30 s dans le futur diffère la publication.
    let status = 'publiee'
    let scheduled = null
    if (scheduledAt) {
      const when = new Date(scheduledAt)
      if (isNaN(when.getTime())) return res.status(400).json({ message: 'Date de programmation invalide' })
      if (when.getTime() > Date.now() + 30 * 1000) { status = 'programmee'; scheduled = when }
    }

    const finalAudience = ['all', 'parents', 'teachers'].includes(audience) ? audience : 'all'
    const announcement = await Announcement.create({
      school: sid,
      title: title?.trim() || '',
      content: content.trim(),
      audience: finalAudience,
      // La secrétaire publie au nom de la Direction
      onBehalfOf: req.user.role === 'secretaire' ? 'La Direction' : '',
      status,
      scheduledAt: scheduled,
      publishedAt: status === 'publiee' ? new Date() : null,
      createdBy: req.user._id,
    })

    // Push immédiat seulement si publiée maintenant ; sinon le scheduler s'en charge.
    if (status === 'publiee') pushAnnouncement(announcement)

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
// Exposé pour le scheduler (publication différée des annonces programmées).
module.exports.pushAnnouncement = pushAnnouncement
