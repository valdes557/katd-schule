const express = require('express')
const router = express.Router()
const Teacher = require('../models/Teacher')
const User = require('../models/User')
const { protect, authorize } = require('../middleware/auth')
const { getSchoolId, resolveSchoolId, applyCycleScope, enforceCyclePermission, asyncHandler } = require('../utils/routeHelpers')

// GET /api/teachers
router.get('/', protect, asyncHandler(async (req, res) => {
  const schoolId = resolveSchoolId(req)
  if (!schoolId) return res.json({ success: true, total: 0, data: [] })
  const { search, status, page = 1, limit = 50 } = req.query
  const query = { school: schoolId }
  await applyCycleScope(query, schoolId, req.user.role)
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ]
  }
  if (status) query.status = status
  const total = await Teacher.countDocuments(query)
  const teachers = await Teacher.find(query)
    .populate('classes', 'name level cycle room')
    .populate('user', 'email')
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .sort({ lastName: 1 })
  res.json({ success: true, total, data: teachers })
}))

// GET /api/teachers/:id
router.get('/:id', protect, asyncHandler(async (req, res) => {
  const teacher = await Teacher.findById(req.params.id).populate('classes school user')
  if (!teacher) return res.status(404).json({ message: 'Enseignant non trouvé' })
  res.json({ success: true, data: teacher })
}))

// POST /api/teachers — creates teacher + User account with login credentials
router.post('/', protect, authorize('directeur', 'super_admin'), asyncHandler(async (req, res) => {
  const schoolId = getSchoolId(req)
  const { firstName, lastName, email, phone, gender, subjects, speciality, password, classes, cycle } = req.body

  if (await enforceCyclePermission(req, res)) return

  let userId = null
  if (email && password) {
    const existing = await User.findOne({ email })
    if (existing) return res.status(400).json({ message: 'Cet email est déjà utilisé' })
    const user = await User.create({
      name: `${lastName} ${firstName}`,
      email, password,
      role: 'enseignant',
      school: schoolId,
    })
    userId = user._id
  }

  const teacher = await Teacher.create({
    firstName, lastName, email, phone, gender,
    subjects: Array.isArray(subjects) ? subjects : (subjects || '').split(',').map((s) => s.trim()).filter(Boolean),
    speciality,
    cycle,
    classes: classes || [],
    school: schoolId,
    user: userId,
  })

  const populated = await Teacher.findById(teacher._id).populate('classes', 'name level cycle room').populate('user', 'email')
  res.status(201).json({ success: true, data: populated })
}))

// PUT /api/teachers/:id
router.put('/:id', protect, authorize('directeur', 'super_admin'), asyncHandler(async (req, res) => {
  const { password, email, ...rest } = req.body
  if (rest.subjects && typeof rest.subjects === 'string') {
    rest.subjects = rest.subjects.split(',').map((s) => s.trim()).filter(Boolean)
  }

  const teacher = await Teacher.findById(req.params.id)
  if (!teacher) return res.status(404).json({ message: 'Enseignant non trouvé' })

  if (teacher.user && password) {
    const u = await User.findById(teacher.user)
    if (u) { u.password = password; await u.save() }
  }
  if (teacher.user && email) {
    await User.findByIdAndUpdate(teacher.user, { email })
  }

  Object.assign(teacher, rest)
  if (email) teacher.email = email
  await teacher.save()
  const populated = await Teacher.findById(teacher._id).populate('classes', 'name level cycle room').populate('user', 'email')
  res.json({ success: true, data: populated })
}))

// DELETE /api/teachers/:id
router.delete('/:id', protect, authorize('directeur', 'super_admin'), asyncHandler(async (req, res) => {
  const teacher = await Teacher.findById(req.params.id)
  if (!teacher) return res.status(404).json({ message: 'Enseignant non trouvé' })

  await Teacher.findByIdAndDelete(teacher._id)

  const tasks = []
  if (teacher.user) tasks.push(User.findByIdAndDelete(teacher.user))
  if (teacher.email) tasks.push(User.findOneAndDelete({ email: teacher.email }))
  if (tasks.length) await Promise.all(tasks)

  res.json({ success: true, message: 'Enseignant supprimé' })
}))

module.exports = router
