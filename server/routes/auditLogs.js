// routes/auditLogs.js — Consultation du journal des actions sensibles (F3).
// Directeur : journal de SON école. Super_admin : toute la plateforme.
// Lecture seule — le journal est alimenté par le middleware auditTrail.
const express = require('express')
const router = express.Router()
const AuditLog = require('../models/AuditLog')
const { protect, authorize } = require('../middleware/auth')

function schoolId(req) { return req.user.school?._id || req.user.school }

// GET /api/audit-logs?action=&actor=&from=&to=&page=&limit=
router.get('/', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const query = {}
    if (req.user.role !== 'super_admin') {
      const sid = schoolId(req)
      if (!sid) return res.json({ success: true, data: [], total: 0, page: 1, pages: 0 })
      query.school = sid
    } else if (req.query.school) {
      query.school = req.query.school
    }
    if (req.query.action) query.action = { $in: String(req.query.action).split(',') }
    if (req.query.actor) query.actor = req.query.actor
    if (req.query.from || req.query.to) {
      query.createdAt = {}
      if (req.query.from) query.createdAt.$gte = new Date(req.query.from)
      if (req.query.to) query.createdAt.$lte = new Date(req.query.to)
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50))
    const [items, total] = await Promise.all([
      AuditLog.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      AuditLog.countDocuments(query),
    ])
    res.json({ success: true, data: items, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/audit-logs/actions — liste des types d'action présents (pour le filtre)
router.get('/actions', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const match = req.user.role === 'super_admin' ? {} : { school: schoolId(req) }
    const actions = await AuditLog.distinct('action', match)
    res.json({ success: true, data: actions.sort() })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
