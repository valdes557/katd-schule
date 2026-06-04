const express = require('express')
const router = express.Router()
const Class = require('../models/Class')
const Student = require('../models/Student')
const { protect, authorize } = require('../middleware/auth')
const { getSchoolId, resolveSchoolId, getTeacherClassIds, applyCycleScope, enforceCyclePermission, asyncHandler } = require('../utils/routeHelpers')

// GET /api/classes
router.get('/', protect, asyncHandler(async (req, res) => {
  const schoolId = resolveSchoolId(req)
  if (!schoolId) return res.json({ success: true, data: [] })
  const query = { school: schoolId }
  await applyCycleScope(query, schoolId, req.user.role)
  if (req.query.cycle && req.user.role === 'super_admin') query.cycle = req.query.cycle

  if (req.user.role === 'enseignant') {
    const teacherClassIds = await getTeacherClassIds(req.user._id)
    if (teacherClassIds.length === 0) return res.json({ success: true, data: [] })
    query._id = { $in: teacherClassIds }
  }
  const classes = await Class.find(query).populate('mainTeacher', 'firstName lastName').sort({ cycle: 1, name: 1 })
  res.json({ success: true, data: classes })
}))

// GET /api/classes/:id
router.get('/:id', protect, asyncHandler(async (req, res) => {
  const cls = await Class.findById(req.params.id).populate('mainTeacher')
  if (!cls) return res.status(404).json({ message: 'Classe non trouvée' })
  const students = await Student.find({ class: cls._id }).sort({ lastName: 1 })
  res.json({ success: true, data: { ...cls.toObject(), students } })
}))

// POST /api/classes
router.post('/', protect, authorize('directeur', 'super_admin'), asyncHandler(async (req, res) => {
  const schoolId = getSchoolId(req)
  if (!schoolId) return res.status(400).json({ message: 'École requise' })
  if (await enforceCyclePermission(req, res)) return
  const cls = await Class.create({ ...req.body, school: schoolId })
  res.status(201).json({ success: true, data: cls })
}))

// PUT /api/classes/:id
router.put('/:id', protect, authorize('directeur', 'super_admin'), asyncHandler(async (req, res) => {
  const cls = await Class.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
  if (!cls) return res.status(404).json({ message: 'Classe non trouvée' })
  res.json({ success: true, data: cls })
}))

// DELETE /api/classes/:id
router.delete('/:id', protect, authorize('directeur', 'super_admin'), asyncHandler(async (req, res) => {
  await Class.findByIdAndDelete(req.params.id)
  res.json({ success: true, message: 'Classe supprimée' })
}))

module.exports = router
