// routes/visitors.js — Registre des visiteurs (cycle Secondaire).
// Le portier enregistre les visiteurs (identité, motif, personne visitée) et pointe
// leur sortie ; le SG et le principal consultent le journal.
const express = require('express')
const router = express.Router()
const Visitor = require('../models/Visitor')
const { protect, authorize } = require('../middleware/auth')
const { todayKey, fmtTime } = require('../utils/timezone')

function schoolId(req) { return req.user.school?._id || req.user.school }

const WRITERS = ['portier', 'surveillant_general', 'directeur', 'super_admin']
const READERS = [...WRITERS, 'vice_principal', 'secretaire']

// POST /api/visitors — enregistrer un visiteur (entrée)
router.post('/', protect, authorize(...WRITERS), async (req, res) => {
  try {
    const sid = schoolId(req)
    if (!sid) return res.status(400).json({ message: 'Aucune école associée' })
    const { name, phone, idType, idNumber, reason, visiting, note } = req.body
    if (!name || !reason) return res.status(400).json({ message: 'Nom et motif requis' })

    const now = new Date()
    const visitor = await Visitor.create({
      school: sid, day: todayKey(now),
      name, phone: phone || '', idType: idType || '', idNumber: idNumber || '',
      reason, visiting: visiting || '', note: note || '',
      checkInAt: now, registeredBy: req.user._id,
    })
    res.status(201).json({ success: true, data: visitor })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/visitors/:id/checkout — pointer la sortie du visiteur
router.put('/:id/checkout', protect, authorize(...WRITERS), async (req, res) => {
  try {
    const visitor = await Visitor.findOne({ _id: req.params.id, school: schoolId(req) })
    if (!visitor) return res.status(404).json({ message: 'Visiteur non trouvé' })
    if (visitor.checkOutAt) return res.status(400).json({ message: 'Sortie déjà enregistrée' })
    visitor.checkOutAt = new Date()
    await visitor.save()
    res.json({ success: true, data: visitor })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/visitors?day=&from=&to=&q= — journal (jour par défaut : aujourd'hui)
router.get('/', protect, authorize(...READERS), async (req, res) => {
  try {
    const sid = schoolId(req)
    const { day, from, to, q } = req.query
    const query = { school: sid }
    if (from || to) {
      query.day = {}
      if (from) query.day.$gte = from
      if (to) query.day.$lte = to
    } else {
      query.day = day || todayKey()
    }
    if (q) query.name = { $regex: q.trim(), $options: 'i' }

    const visitors = await Visitor.find(query)
      .populate('registeredBy', 'name role')
      .sort({ checkInAt: -1 })
      .limit(1000)

    const list = visitors.map((v) => ({
      ...v.toObject(),
      checkInTime: v.checkInAt ? fmtTime(v.checkInAt) : null,
      checkOutTime: v.checkOutAt ? fmtTime(v.checkOutAt) : null,
    }))
    res.json({
      success: true,
      data: list,
      stats: { total: list.length, present: list.filter((v) => !v.checkOutAt).length },
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
