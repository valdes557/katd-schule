const express = require('express')
const router = express.Router()
const Timetable = require('../models/Timetable')
const { protect, authorize } = require('../middleware/auth')
const { getSchoolId, getTeacherProfile, getParentChildren, asyncHandler } = require('../utils/routeHelpers')

// GET all timetables for the school
router.get('/', protect, asyncHandler(async (req, res) => {
  const query = { school: getSchoolId(req) }
  if (!query.school) return res.json({ success: true, data: [] })

  if (req.user.role === 'enseignant') {
    const teacher = await getTeacherProfile(req.user._id, 'classes')
    if (!teacher) return res.json({ success: true, data: [] })
    query.class = { $in: (teacher.classes || []) }
  } else if (req.user.role === 'parent') {
    const children = await getParentChildren(req.user._id, 'class')
    const ids = children.map((s) => s.class).filter(Boolean)
    if (ids.length === 0) return res.json({ success: true, data: [] })
    query.class = { $in: ids }
  }
  const timetables = await Timetable.find(query).populate('class', 'name level cycle room')
  res.json({ success: true, data: timetables })
}))

// GET timetable for a specific class
router.get('/class/:classId', protect, asyncHandler(async (req, res) => {
  const schoolId = getSchoolId(req)
  let tt = await Timetable.findOne({ school: schoolId, class: req.params.classId }).populate('class', 'name level cycle room')
  if (!tt) {
    tt = await Timetable.create({ school: schoolId, class: req.params.classId, slots: [] })
    tt = await Timetable.findById(tt._id).populate('class', 'name level cycle room')
  }
  res.json({ success: true, data: tt })
}))

// PUT update timetable for a class (add/update slots)
router.put('/:id', protect, authorize('directeur', 'super_admin', 'enseignant'), asyncHandler(async (req, res) => {
  const tt = await Timetable.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).populate('class', 'name level cycle room')
  if (!tt) return res.status(404).json({ message: 'Emploi du temps non trouvé' })
  res.json({ success: true, data: tt })
}))

// POST add a slot to a timetable
router.post('/:id/slots', protect, authorize('directeur', 'super_admin', 'enseignant'), asyncHandler(async (req, res) => {
  const tt = await Timetable.findById(req.params.id)
  if (!tt) return res.status(404).json({ message: 'Emploi du temps non trouvé' })
  tt.slots.push(req.body)
  await tt.save()
  res.json({ success: true, data: tt })
}))

// DELETE a slot from a timetable
router.delete('/:id/slots/:slotId', protect, authorize('directeur', 'super_admin', 'enseignant'), asyncHandler(async (req, res) => {
  const tt = await Timetable.findById(req.params.id)
  if (!tt) return res.status(404).json({ message: 'Emploi du temps non trouvé' })
  tt.slots = tt.slots.filter((s) => s._id.toString() !== req.params.slotId)
  await tt.save()
  res.json({ success: true, data: tt })
}))

module.exports = router
