const express = require('express')
const router = express.Router()
const Subject = require('../models/Subject')
const Teacher = require('../models/Teacher')
const Student = require('../models/Student')
const { protect, authorize } = require('../middleware/auth')
const { resolveSchoolId, getSchoolId, getSubscribedCycle, getTeacherProfile, getParentChildren, enforceCyclePermission, asyncHandler } = require('../utils/routeHelpers')

router.get('/', protect, asyncHandler(async (req, res) => {
  const targetSchool = resolveSchoolId(req)
  const query = {}
  if (targetSchool) query.school = targetSchool
  else if (req.user.role !== 'super_admin') return res.json({ success: true, data: [] })
  if (req.query.cycle) query.cycle = req.query.cycle

  if (req.user.role === 'directeur' && targetSchool) {
    const cycle = await getSubscribedCycle(targetSchool)
    if (cycle) query.cycle = cycle
  }

  if (req.user.role === 'enseignant') {
    const teacher = await getTeacherProfile(req.user._id)
    if (!teacher) return res.json({ success: true, data: [] })
    const classIds = (teacher.classes || []).map((c) => c.toString())
    if (['Maternelle', 'Primaire'].includes(teacher.cycle)) {
      query.$or = [
        { cycle: teacher.cycle },
        { classes: { $in: classIds } },
        { teacher: teacher._id },
      ]
    } else {
      query.$or = [
        { teacher: teacher._id },
        { classes: { $in: classIds } },
      ]
    }
  }
  if (req.user.role === 'parent') {
    const children = await getParentChildren(req.user._id, 'class cycle')
    const childClassIds = children.map((s) => s.class).filter(Boolean)
    const childCycles = [...new Set(children.map((s) => s.cycle).filter(Boolean))]
    const primaryCycles = childCycles.filter((c) => ['Maternelle', 'Primaire'].includes(c))
    if (childClassIds.length === 0 && primaryCycles.length === 0) return res.json({ success: true, data: [] })
    if (primaryCycles.length > 0 && childClassIds.length > 0) {
      query.$or = [
        { classes: { $in: childClassIds } },
        { cycle: { $in: primaryCycles } },
      ]
    } else if (primaryCycles.length > 0) {
      query.cycle = { $in: primaryCycles }
    } else {
      query.classes = { $in: childClassIds }
    }
  }
  const subjects = await Subject.find(query)
    .populate('teacher', 'firstName lastName')
    .populate('classes', 'name level')
    .populate('school', 'name')
    .sort({ cycle: 1, name: 1 })
  res.json({ success: true, data: subjects })
}))

router.get('/:id', protect, asyncHandler(async (req, res) => {
  const subject = await Subject.findById(req.params.id).populate('teacher classes')
  if (!subject) return res.status(404).json({ message: 'Matière non trouvée' })
  res.json({ success: true, data: subject })
}))

router.post('/', protect, authorize('directeur', 'super_admin'), asyncHandler(async (req, res) => {
  const school = req.user.role === 'super_admin' ? (req.body.school || getSchoolId(req)) : getSchoolId(req)
  if (!school) return res.status(400).json({ message: 'École requise' })
  if (await enforceCyclePermission(req, res)) return
  if (['Maternelle', 'Primaire'].includes(req.body.cycle)) {
    delete req.body.teacher
  }
  const subject = await Subject.create({ ...req.body, school })
  res.status(201).json({ success: true, data: subject })
}))

router.put('/:id', protect, authorize('directeur', 'super_admin'), asyncHandler(async (req, res) => {
  if (['Maternelle', 'Primaire'].includes(req.body.cycle)) {
    delete req.body.teacher
  }
  const subject = await Subject.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
  if (!subject) return res.status(404).json({ message: 'Matière non trouvée' })
  res.json({ success: true, data: subject })
}))

router.delete('/:id', protect, authorize('directeur', 'super_admin'), asyncHandler(async (req, res) => {
  await Subject.findByIdAndDelete(req.params.id)
  res.json({ success: true, message: 'Matière supprimée' })
}))

module.exports = router
