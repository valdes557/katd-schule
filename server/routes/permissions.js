// routes/permissions.js — Demandes de permission (cycle Secondaire).
// parent/eleve/enseignant demandent ; SG (ou principal) approuve/rejette ;
// le portier consulte les sorties autorisées du jour.
const express = require('express')
const router = express.Router()
const PermissionRequest = require('../models/PermissionRequest')
const Student = require('../models/Student')
const User = require('../models/User')
const { protect, authorize } = require('../middleware/auth')
const { todayKey } = require('../utils/timezone')

function schoolId(req) { return req.user.school?._id || req.user.school }

const DECIDERS = ['surveillant_general', 'directeur', 'super_admin']

// Push best-effort
function pushTo(userIds, payload) {
  try {
    const push = require('../services/pushService')
    if (userIds.length) push.sendToUsers(userIds, payload).catch(() => {})
  } catch (e) { /* best-effort */ }
}

// POST /api/permissions — créer une demande
router.post('/', protect, async (req, res) => {
  try {
    const sid = schoolId(req)
    if (!sid) return res.status(400).json({ message: 'Aucune école associée' })
    const { kind, reason, fromDate, toDate, studentId } = req.body
    if (!reason || !fromDate) return res.status(400).json({ message: 'Motif et date requis' })

    // Résout l'élève concerné : parent → un de ses enfants ; élève → sa propre fiche
    let student = null
    if (req.user.role === 'parent') {
      if (!studentId) return res.status(400).json({ message: 'Élève concerné requis' })
      student = await Student.findOne({ _id: studentId, parentUser: req.user._id })
      if (!student) return res.status(403).json({ message: 'Cet élève ne vous est pas rattaché' })
    } else if (req.user.role === 'eleve') {
      student = await Student.findOne({ user: req.user._id })
    }

    const request = await PermissionRequest.create({
      school: sid,
      requester: req.user._id,
      requesterRole: req.user.role,
      student: student?._id || null,
      kind: ['sortie', 'absence', 'retard'].includes(kind) ? kind : 'sortie',
      reason,
      fromDate: new Date(fromDate),
      toDate: toDate ? new Date(toDate) : null,
    })

    // Notifie les SG (et le principal) de la nouvelle demande
    const deciders = await User.find({ school: sid, role: { $in: ['surveillant_general', 'directeur'] }, isActive: { $ne: false } }).select('_id')
    pushTo(deciders.map((u) => u._id), {
      title: '📋 Nouvelle demande de permission',
      body: `${req.user.name} — ${request.kind} : ${reason.slice(0, 80)}`,
      url: '/dashboard/permissions',
    })

    res.status(201).json({ success: true, data: request })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/permissions — liste selon le rôle
// SG/principal : toutes (filtre ?status=) ; portier : approuvées du jour ; autres : les leurs
router.get('/', protect, async (req, res) => {
  try {
    const sid = schoolId(req)
    const query = { school: sid }
    if (DECIDERS.includes(req.user.role)) {
      if (req.query.status) query.status = req.query.status
    } else if (req.user.role === 'portier') {
      // Sorties autorisées valables aujourd'hui
      query.status = 'approved'
      const today = new Date(`${todayKey()}T00:00:00`)
      const tomorrow = new Date(today.getTime() + 24 * 3600 * 1000)
      query.$or = [
        { fromDate: { $lt: tomorrow }, toDate: { $gte: today } },
        { fromDate: { $gte: today, $lt: tomorrow }, toDate: null },
      ]
    } else {
      query.requester = req.user._id
    }
    const requests = await PermissionRequest.find(query)
      .populate('requester', 'name role')
      .populate('student', 'firstName lastName matricule class')
      .populate({ path: 'student', populate: { path: 'class', select: 'name' } })
      .populate('decidedBy', 'name role')
      .sort({ createdAt: -1 })
      .limit(500)
    res.json({ success: true, data: requests })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/permissions/:id/approve | /reject — SG ou principal
async function decide(req, res, status) {
  try {
    const request = await PermissionRequest.findOne({ _id: req.params.id, school: schoolId(req) })
    if (!request) return res.status(404).json({ message: 'Demande non trouvée' })
    if (request.status !== 'pending') return res.status(400).json({ message: 'Demande déjà traitée' })
    request.status = status
    request.decidedBy = req.user._id
    request.decidedAt = new Date()
    request.decisionNote = req.body.note || ''
    await request.save()

    // Notifie le demandeur + le portier (si approuvée)
    const targets = [request.requester]
    if (status === 'approved') {
      const porters = await User.find({ school: schoolId(req), role: 'portier', isActive: { $ne: false } }).select('_id')
      targets.push(...porters.map((u) => u._id))
    }
    pushTo(targets, {
      title: status === 'approved' ? '✅ Permission accordée' : '❌ Permission refusée',
      body: `${request.kind} — ${request.reason.slice(0, 80)}`,
      url: '/dashboard/permissions',
    })

    res.json({ success: true, data: request })
  } catch (err) { res.status(500).json({ message: err.message }) }
}

router.put('/:id/approve', protect, authorize(...DECIDERS), (req, res) => decide(req, res, 'approved'))
router.put('/:id/reject', protect, authorize(...DECIDERS), (req, res) => decide(req, res, 'rejected'))

module.exports = router
