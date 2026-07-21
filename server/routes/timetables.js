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
    } else if (req.user.role === 'eleve') {
      // L'élève (Secondaire) ne voit que l'emploi du temps de SA classe
      const me = await Student.findOne({ user: req.user._id }).select('class')
      if (!me?.class) return res.json({ success: true, data: [] })
      query.class = me.class
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
router.put('/:id', protect, authorize('directeur', 'super_admin', 'enseignant', 'vice_principal'), async (req, res) => {
  try {
    const tt = await Timetable.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).populate('class', 'name level cycle room')
    if (!tt) return res.status(404).json({ message: 'Emploi du temps non trouvé' })
    res.json({ success: true, data: tt })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST add a slot to a timetable
router.post('/:id/slots', protect, authorize('directeur', 'super_admin', 'enseignant', 'vice_principal'), async (req, res) => {
  try {
    const tt = await Timetable.findById(req.params.id)
    if (!tt) return res.status(404).json({ message: 'Emploi du temps non trouvé' })
    tt.slots.push(req.body)
    await tt.save()
    res.json({ success: true, data: tt })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST assign/duplicate a timetable's slots to one OR several other classes/rooms
// Body: { classIds: [<classId>, ...] } — copie les créneaux de l'emploi source vers
// chaque classe cible (création si l'emploi n'existe pas encore). Le directeur ET le
// personnel enseignant peuvent ainsi appliquer le même emploi du temps à plusieurs classes.
router.post('/:id/assign-to', protect, authorize('directeur', 'super_admin', 'enseignant', 'vice_principal'), async (req, res) => {
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

// DELETE a slot from a timetable
router.delete('/:id/slots/:slotId', protect, authorize('directeur', 'super_admin', 'enseignant', 'vice_principal'), async (req, res) => {
  try {
    const tt = await Timetable.findById(req.params.id)
    if (!tt) return res.status(404).json({ message: 'Emploi du temps non trouvé' })
    tt.slots = tt.slots.filter((s) => s._id.toString() !== req.params.slotId)
    await tt.save()
    res.json({ success: true, data: tt })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
