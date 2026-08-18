const express = require('express')
const router = express.Router()
const Timetable = require('../models/Timetable')
const Teacher = require('../models/Teacher')
const Student = require('../models/Student')
const { protect, authorize } = require('../middleware/auth')

// GET all timetables for the school
router.get('/', protect, async (req, res) => {
  try {
    const query = { school: req.user.school?._id || req.user.school }
    if (!query.school) return res.json({ success: true, data: [] })

    // Scope by role
    if (req.user.role === 'enseignant') {
      const teacher = await Teacher.findOne({ user: req.user._id })
      if (!teacher) return res.json({ success: true, data: [] })
      query.class = { $in: (teacher.classes || []) }
    } else if (req.user.role === 'parent') {
      const children = await Student.find({ parentUser: req.user._id }).select('class')
      const ids = children.map((s) => s.class).filter(Boolean)
      if (ids.length === 0) return res.json({ success: true, data: [] })
      query.class = { $in: ids }
      // Les parents ne voient que les emplois du temps publiés (G4).
      // $ne: 'brouillon' inclut les documents legacy sans champ status.
      query.status = { $ne: 'brouillon' }
    } else if (req.user.role === 'eleve') {
      // L'élève (Secondaire) ne voit que l'emploi du temps de SA classe
      const me = await Student.findOne({ user: req.user._id }).select('class')
      if (!me?.class) return res.json({ success: true, data: [] })
      query.class = me.class
      // …et seulement s'il est publié (G4).
      query.status = { $ne: 'brouillon' }
    }
    const timetables = await Timetable.find(query).populate('class', 'name level cycle room')
    res.json({ success: true, data: timetables })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET timetable for a specific class
router.get('/class/:classId', protect, async (req, res) => {
  try {
    const schoolId = req.user.school?._id || req.user.school
    let tt = await Timetable.findOne({ school: schoolId, class: req.params.classId }).populate('class', 'name level cycle room')
    if (!tt) {
      tt = await Timetable.create({ school: schoolId, class: req.params.classId, slots: [] })
      tt = await Timetable.findById(tt._id).populate('class', 'name level cycle room')
    }
    res.json({ success: true, data: tt })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PUT update timetable for a class (add/update slots)
// Seul le directeur gère l'emploi du temps (création/modification/attribution/retrait).
// Les autres rôles (enseignant, vice-principal, parent, élève) sont en lecture seule.
router.put('/:id', protect, authorize('directeur'), async (req, res) => {
  try {
    const sid = req.user.school?._id || req.user.school
    const tt = await Timetable.findById(req.params.id)
    if (!tt) return res.status(404).json({ message: 'Emploi du temps non trouvé' })
    if (String(tt.school) !== String(sid)) return res.status(403).json({ message: 'Accès refusé' })
    Object.assign(tt, req.body)
    await tt.save()
    const populated = await Timetable.findById(tt._id).populate('class', 'name level cycle room')
    res.json({ success: true, data: populated })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/timetables/:id/publish — publie ou dépublie l'emploi du temps (G4).
// body { publish: true|false }. Publié → visible par les élèves et parents.
// Réservé au directeur (seul gestionnaire de l'emploi du temps).
router.put('/:id/publish', protect, authorize('directeur'), async (req, res) => {
  try {
    const publish = req.body.publish !== false // défaut : publier
    const tt = await Timetable.findById(req.params.id)
    if (!tt) return res.status(404).json({ message: 'Emploi du temps non trouvé' })
    // Scope école (le directeur ne gère que son école)
    const sid = req.user.school?._id || req.user.school
    if (String(tt.school) !== String(sid)) {
      return res.status(403).json({ message: 'Accès refusé' })
    }
    tt.status = publish ? 'publie' : 'brouillon'
    tt.publishedAt = publish ? new Date() : null
    tt.publishedBy = publish ? req.user._id : null
    await tt.save()
    const populated = await Timetable.findById(tt._id).populate('class', 'name level cycle room')
    res.json({ success: true, data: populated, message: publish ? 'Emploi du temps publié' : 'Publication retirée' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST add a slot to a timetable (directeur uniquement)
router.post('/:id/slots', protect, authorize('directeur'), async (req, res) => {
  try {
    const sid = req.user.school?._id || req.user.school
    const tt = await Timetable.findById(req.params.id)
    if (!tt) return res.status(404).json({ message: 'Emploi du temps non trouvé' })
    if (String(tt.school) !== String(sid)) return res.status(403).json({ message: 'Accès refusé' })
    tt.slots.push(req.body)
    await tt.save()
    res.json({ success: true, data: tt })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST assign/duplicate a timetable's slots to one OR several other classes/rooms
// Body: { classIds: [<classId>, ...] } — copie les créneaux de l'emploi source vers
// chaque classe cible (création si l'emploi n'existe pas encore). Seul le directeur
// peut attribuer le même emploi du temps à plusieurs classes de son choix.
router.post('/:id/assign-to', protect, authorize('directeur'), async (req, res) => {
  try {
    const schoolId = req.user.school?._id || req.user.school
    if (!schoolId) return res.status(400).json({ message: 'Aucune école associée à votre compte' })

    const source = await Timetable.findOne({ _id: req.params.id, school: schoolId })
    if (!source) return res.status(404).json({ message: 'Emploi du temps source non trouvé' })

    const { classIds } = req.body
    if (!Array.isArray(classIds) || classIds.length === 0) {
      return res.status(400).json({ message: 'Sélectionnez au moins une classe cible' })
    }

    // Copie profonde des créneaux (sans les _id de sous-documents pour en régénérer)
    const clonedSlots = (source.slots || []).map((s) => {
      const o = s.toObject ? s.toObject() : { ...s }
      delete o._id
      return o
    })

    let updated = 0
    for (const classId of classIds) {
      if (String(classId) === String(source.class)) continue // on saute la classe source
      await Timetable.findOneAndUpdate(
        { school: schoolId, class: classId },
        { $set: { slots: clonedSlots, academicYear: source.academicYear } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      updated++
    }

    res.json({ success: true, data: { updated } })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST retire (vide) l'emploi du temps de une ou plusieurs classes de l'école.
// Body: { classIds: [<classId>, ...] } — symétrique de /assign-to. Les créneaux sont
// effacés et l'emploi est repassé en brouillon (les élèves/parents ne le voient plus).
// Réservé au directeur.
router.post('/:id/unassign-from', protect, authorize('directeur'), async (req, res) => {
  try {
    const schoolId = req.user.school?._id || req.user.school
    if (!schoolId) return res.status(400).json({ message: 'Aucune école associée à votre compte' })

    const { classIds } = req.body
    if (!Array.isArray(classIds) || classIds.length === 0) {
      return res.status(400).json({ message: 'Sélectionnez au moins une classe' })
    }

    let updated = 0
    for (const classId of classIds) {
      const r = await Timetable.updateOne(
        { school: schoolId, class: classId },
        { $set: { slots: [], status: 'brouillon', publishedAt: null, publishedBy: null } },
      )
      if (r.matchedCount || r.n) updated++
    }

    res.json({ success: true, data: { updated } })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE a slot from a timetable (directeur uniquement)
router.delete('/:id/slots/:slotId', protect, authorize('directeur'), async (req, res) => {
  try {
    const sid = req.user.school?._id || req.user.school
    const tt = await Timetable.findById(req.params.id)
    if (!tt) return res.status(404).json({ message: 'Emploi du temps non trouvé' })
    if (String(tt.school) !== String(sid)) return res.status(403).json({ message: 'Accès refusé' })
    tt.slots = tt.slots.filter((s) => s._id.toString() !== req.params.slotId)
    await tt.save()
    res.json({ success: true, data: tt })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
