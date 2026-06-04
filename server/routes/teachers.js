const express = require('express')
const router = express.Router()
const Teacher = require('../models/Teacher')
const User = require('../models/User')
const { protect, authorize } = require('../middleware/auth')
const School = require('../models/School')
const { escapeRegex } = require('../utils/sanitize')

// GET /api/teachers
router.get('/', protect, async (req, res) => {
  try {
    const userSchool = req.user.school?._id || req.user.school
    const schoolId = req.user.role === 'super_admin' ? (req.query.schoolId || userSchool) : userSchool
    if (!schoolId) return res.json({ success: true, total: 0, data: [] })
    const { search, status, page = 1, limit = 50 } = req.query
    const query = { school: schoolId }
    // Directors and other roles are scoped to the school's subscribed cycle by default
    if (req.user.role !== 'super_admin') {
      const school = await School.findById(schoolId).select('subscription.cycle')
      if (school?.subscription?.cycle) query.cycle = school.subscription.cycle
    }
    if (search) {
      const safe = escapeRegex(search)
      query.$or = [
        { firstName: { $regex: safe, $options: 'i' } },
        { lastName: { $regex: safe, $options: 'i' } },
        { email: { $regex: safe, $options: 'i' } },
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
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/teachers/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id).populate('classes school user')
    if (!teacher) return res.status(404).json({ message: 'Enseignant non trouvé' })
    res.json({ success: true, data: teacher })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/teachers — creates teacher + User account with login credentials
router.post('/', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const schoolId = req.user.school?._id || req.user.school
    const { firstName, lastName, email, phone, gender, subjects, speciality, password, classes, cycle } = req.body

    if (req.user.role === 'directeur') {
      const school = await School.findById(schoolId).select('subscription.cycle')
      if (school?.subscription?.cycle && cycle && cycle !== school.subscription.cycle) {
        return res.status(403).json({ message: `Cycle non autorisé. Votre abonnement est « ${school.subscription.cycle} ». ` })
      }
    }

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
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/teachers/:id
router.put('/:id', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const { password, email, ...rest } = req.body
    if (rest.subjects && typeof rest.subjects === 'string') {
      rest.subjects = rest.subjects.split(',').map((s) => s.trim()).filter(Boolean)
    }

    const teacher = await Teacher.findById(req.params.id)
    if (!teacher) return res.status(404).json({ message: 'Enseignant non trouvé' })

    // Update linked User account password if provided
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
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/teachers/:id
router.delete('/:id', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id)
    if (!teacher) return res.status(404).json({ message: 'Enseignant non trouvé' })

    await Teacher.findByIdAndDelete(teacher._id)

    const tasks = []
    if (teacher.user) tasks.push(User.findByIdAndDelete(teacher.user))
    if (teacher.email) tasks.push(User.findOneAndDelete({ email: teacher.email }))
    if (tasks.length) await Promise.all(tasks)

    res.json({ success: true, message: 'Enseignant supprimé' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
