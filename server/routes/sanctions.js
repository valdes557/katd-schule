// routes/sanctions.js — Sanctions disciplinaires (cycle Secondaire, G1).
// Le Surveillant Général (ou le Principal / VP) enregistre et annule les sanctions ;
// l'élève et son parent les consultent en lecture seule via le dossier discipline.
const express = require('express')
const router = express.Router()
const Sanction = require('../models/Sanction')
const Student = require('../models/Student')
const { protect, authorize } = require('../middleware/auth')

function schoolId(req) { return req.user.school?._id || req.user.school }

const WRITERS = ['surveillant_general', 'directeur', 'vice_principal', 'super_admin']

// Push best-effort (parent + élève de la sanction)
function pushTo(userIds, payload) {
  try {
    const push = require('../services/pushService')
    const ids = (userIds || []).filter(Boolean)
    if (ids.length) push.sendToUsers(ids, payload).catch(() => {})
  } catch (e) { /* best-effort */ }
}

const TYPE_LABELS = {
  avertissement: 'Avertissement',
  blame: 'Blâme',
  exclusion_temporaire: 'Exclusion temporaire',
  exclusion_definitive: 'Exclusion définitive',
  convocation: 'Convocation des parents',
  retenue: 'Retenue',
}

// POST /api/sanctions — enregistrer une sanction
router.post('/', protect, authorize(...WRITERS), async (req, res) => {
  try {
    const sid = schoolId(req)
    if (!sid) return res.status(400).json({ message: 'Aucune école associée' })
    const { studentId, type, reason, date, durationDays, note } = req.body
    if (!studentId || !type || !reason) {
      return res.status(400).json({ message: 'Élève, type et motif requis' })
    }
    if (!Sanction.TYPES.includes(type)) {
      return res.status(400).json({ message: 'Type de sanction invalide' })
    }

    // L'élève doit appartenir à l'école de l'agent
    const student = await Student.findOne({ _id: studentId, school: sid })
      .select('firstName lastName parentUser user class')
    if (!student) return res.status(404).json({ message: 'Élève non trouvé dans votre école' })

    const sanction = await Sanction.create({
      school: sid,
      student: student._id,
      type,
      reason: String(reason).trim(),
      date: date ? new Date(date) : new Date(),
      durationDays: type === 'exclusion_temporaire' || type === 'retenue' ? Math.max(0, Number(durationDays) || 0) : 0,
      decidedBy: req.user._id,
      decidedByRole: req.user.role,
      note: note || '',
    })

    // Notifie le parent et l'élève concernés
    pushTo([student.parentUser, student.user], {
      title: '⚠️ Sanction disciplinaire',
      body: `${TYPE_LABELS[type] || type} — ${student.lastName} ${student.firstName} : ${String(reason).slice(0, 80)}`,
      url: '/dashboard/eleve/discipline',
    })

    res.status(201).json({ success: true, data: sanction })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/sanctions?studentId=&type=&from=&to=&classId= — historique disciplinaire
router.get('/', protect, authorize(...WRITERS), async (req, res) => {
  try {
    const sid = schoolId(req)
    if (!sid) return res.json({ success: true, data: [] })
    const { studentId, type, from, to, classId } = req.query

    const query = { school: sid }
    if (studentId) query.student = studentId
    if (type && Sanction.TYPES.includes(type)) query.type = type
    if (from || to) {
      query.date = {}
      if (from) query.date.$gte = new Date(from)
      if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); query.date.$lte = d }
    }

    // Filtrage par classe : résout d'abord les élèves de la classe
    if (classId) {
      const ids = await Student.find({ school: sid, class: classId }).select('_id')
      query.student = { $in: ids.map((s) => s._id) }
    }

    const sanctions = await Sanction.find(query)
      .populate('student', 'firstName lastName matricule class')
      .populate('decidedBy', 'name role')
      .populate('canceledBy', 'name role')
      .sort({ date: -1, createdAt: -1 })
      .limit(1000)
      .lean()

    res.json({
      success: true,
      data: sanctions,
      stats: {
        total: sanctions.length,
        active: sanctions.filter((s) => !s.canceled).length,
      },
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/sanctions/:id/cancel — annuler une sanction (traçabilité : jamais supprimée)
router.put('/:id/cancel', protect, authorize(...WRITERS), async (req, res) => {
  try {
    const sanction = await Sanction.findOne({ _id: req.params.id, school: schoolId(req) })
    if (!sanction) return res.status(404).json({ message: 'Sanction non trouvée' })
    if (sanction.canceled) return res.status(400).json({ message: 'Sanction déjà annulée' })
    sanction.canceled = true
    sanction.canceledAt = new Date()
    sanction.canceledBy = req.user._id
    await sanction.save()
    res.json({ success: true, data: sanction })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
