// routes/reports.js — Rapports internes (cycle Secondaire).
// Tous les membres de l'école peuvent envoyer un rapport au principal (directeur)
// ou au vice-principal ; chacun consulte sa boîte de réception / ses envois.
const express = require('express')
const router = express.Router()
const Report = require('../models/Report')
const User = require('../models/User')
const { protect } = require('../middleware/auth')

function schoolId(req) { return req.user.school?._id || req.user.school }

// POST /api/reports — envoyer un rapport {toRole, subject, body}
router.post('/', protect, async (req, res) => {
  try {
    const sid = schoolId(req)
    if (!sid) return res.status(400).json({ message: 'Aucune école associée' })
    const { toRole, subject, body } = req.body
    if (!['directeur', 'vice_principal'].includes(toRole)) {
      return res.status(400).json({ message: 'Destinataire invalide (principal ou vice-principal)' })
    }
    if (!subject || !body) return res.status(400).json({ message: 'Objet et contenu requis' })

    const report = await Report.create({
      school: sid,
      from: req.user._id,
      fromRole: req.user.role,
      toRole,
      subject: subject.trim(),
      body,
    })

    // Push best-effort aux destinataires
    try {
      const push = require('../services/pushService')
      const targets = await User.find({ school: sid, role: toRole, isActive: { $ne: false } }).select('_id')
      if (targets.length) {
        push.sendToUsers(targets.map((u) => u._id), {
          title: '📄 Nouveau rapport reçu',
          body: `${req.user.name} : ${subject.slice(0, 80)}`,
          url: '/dashboard/rapports-recus',
        }).catch(() => {})
      }
    } catch (e) { /* best-effort */ }

    res.status(201).json({ success: true, data: report })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/reports/inbox — boîte de réception (principal ou vice-principal)
router.get('/inbox', protect, async (req, res) => {
  try {
    if (!['directeur', 'vice_principal', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Accès réservé au principal et au vice-principal' })
    }
    const toRole = req.user.role === 'vice_principal' ? 'vice_principal' : 'directeur'
    const reports = await Report.find({ school: schoolId(req), toRole })
      .populate('from', 'name role matricule')
      .sort({ createdAt: -1 })
      .limit(500)
    const unread = reports.filter((r) => !r.readAt).length
    res.json({ success: true, unread, data: reports })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/reports/mine — mes rapports envoyés
router.get('/mine', protect, async (req, res) => {
  try {
    const reports = await Report.find({ school: schoolId(req), from: req.user._id })
      .sort({ createdAt: -1 })
      .limit(200)
    res.json({ success: true, data: reports })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/reports/:id/read — marquer lu (destinataire)
router.put('/:id/read', protect, async (req, res) => {
  try {
    const toRole = req.user.role === 'vice_principal' ? 'vice_principal' : req.user.role === 'directeur' ? 'directeur' : null
    if (!toRole && req.user.role !== 'super_admin') return res.status(403).json({ message: 'Accès refusé' })
    const query = { _id: req.params.id, school: schoolId(req) }
    if (toRole) query.toRole = toRole
    const report = await Report.findOne(query)
    if (!report) return res.status(404).json({ message: 'Rapport non trouvé' })
    if (!report.readAt) {
      report.readAt = new Date()
      report.readBy = req.user._id
      await report.save()
    }
    res.json({ success: true, data: report })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// DELETE /api/reports/:id — l'auteur peut supprimer son rapport non lu
router.delete('/:id', protect, async (req, res) => {
  try {
    const report = await Report.findOne({ _id: req.params.id, school: schoolId(req), from: req.user._id })
    if (!report) return res.status(404).json({ message: 'Rapport non trouvé' })
    if (report.readAt) return res.status(400).json({ message: 'Impossible de supprimer un rapport déjà lu' })
    await report.deleteOne()
    res.json({ success: true, message: 'Rapport supprimé' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
