const express = require('express')
const router = express.Router()
const Class = require('../models/Class')
const Student = require('../models/Student')
const { protect, authorize } = require('../middleware/auth')
const School = require('../models/School')
const Teacher = require('../models/Teacher')

// GET /api/classes
router.get('/', protect, async (req, res) => {
  try {
    const userSchool = req.user.school?._id || req.user.school
    const schoolId = req.user.role === 'super_admin' ? (req.query.schoolId || userSchool) : userSchool
    if (!schoolId) return res.json({ success: true, data: [] })
    const query = { school: schoolId }
    // Directors and other roles should be scoped to the school's subscribed cycle by default
    if (req.user.role !== 'super_admin') {
      const school = await School.findById(schoolId).select('subscription.cycle')
      if (school?.subscription?.cycle) query.cycle = school.subscription.cycle
    }
    if (req.query.cycle && req.user.role === 'super_admin') query.cycle = req.query.cycle

    // Teachers only see their assigned classes
    if (req.user.role === 'enseignant') {
      const t = await Teacher.findOne({ user: req.user._id }).select('classes')
      if (!t || !t.classes || t.classes.length === 0) return res.json({ success: true, data: [] })
      query._id = { $in: t.classes.map((c) => c.toString()) }
    }
    const classes = await Class.find(query).populate('mainTeacher', 'firstName lastName').sort({ cycle: 1, name: 1 })
    res.json({ success: true, data: classes })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/classes/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id).populate('mainTeacher')
    if (!cls) return res.status(404).json({ message: 'Classe non trouvée' })
    const students = await Student.find({ class: cls._id }).sort({ lastName: 1 })
    res.json({ success: true, data: { ...cls.toObject(), students } })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/classes
router.post('/', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const schoolId = req.user.school?._id || req.user.school
    if (!schoolId) return res.status(400).json({ message: 'École requise' })
    if (req.user.role === 'directeur') {
      const school = await School.findById(schoolId).select('subscription.cycle')
      if (school?.subscription?.cycle && req.body.cycle && req.body.cycle !== school.subscription.cycle) {
        return res.status(403).json({ message: `Cycle non autorisé. Votre abonnement est « ${school.subscription.cycle} ». ` })
      }
    }
    const cls = await Class.create({ ...req.body, school: schoolId })
    res.status(201).json({ success: true, data: cls })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/classes/:id
router.put('/:id', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const cls = await Class.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    if (!cls) return res.status(404).json({ message: 'Classe non trouvée' })
    res.json({ success: true, data: cls })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/classes/:id
router.delete('/:id', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    await Class.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: 'Classe supprimée' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
