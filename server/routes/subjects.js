const express = require('express')
const router = express.Router()
const Subject = require('../models/Subject')
const Teacher = require('../models/Teacher')
const Student = require('../models/Student')
const { protect, authorize } = require('../middleware/auth')
const School = require('../models/School')

router.get('/', protect, async (req, res) => {
  try {
    const userSchool = req.user.school?._id || req.user.school
    // Super admin can target any school via ?schoolId=...
    const targetSchool = req.user.role === 'super_admin'
      ? (req.query.schoolId || userSchool)
      : userSchool
    const query = {}
    if (targetSchool) query.school = targetSchool
    else if (req.user.role !== 'super_admin') return res.json({ success: true, data: [] })
    if (req.query.cycle) query.cycle = req.query.cycle

    // Director cycle scoping: directors only see subjects for their subscribed cycle
    if (req.user.role === 'directeur' && targetSchool) {
      const school = await School.findById(targetSchool).select('subscription.cycle')
      if (school?.subscription?.cycle) query.cycle = school.subscription.cycle
    }

    // Scope: teacher only sees subjects taught in his classes (or by him directly)
    if (req.user.role === 'enseignant') {
      const teacher = await Teacher.findOne({ user: req.user._id })
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
    // Scope: parent only sees subjects of their children's classes
    if (req.user.role === 'parent') {
      const children = await Student.find({ parentUser: req.user._id }).select('class cycle')
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
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/:id', protect, async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id).populate('teacher classes')
    if (!subject) return res.status(404).json({ message: 'Matière non trouvée' })
    res.json({ success: true, data: subject })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const userSchool = req.user.school?._id || req.user.school
    // super_admin must provide school in body; directeur uses their own school
    const school = req.user.role === 'super_admin' ? (req.body.school || userSchool) : userSchool
    if (!school) return res.status(400).json({ message: 'École requise' })
    // Enforce director's subscribed cycle
    if (req.user.role === 'directeur') {
      const sc = await School.findById(school).select('subscription.cycle')
      if (sc?.subscription?.cycle && req.body.cycle && req.body.cycle !== sc.subscription.cycle) {
        return res.status(403).json({ message: `Cycle non autorisé. Votre abonnement est « ${sc.subscription.cycle} ». ` })
      }
    }
    // For Maternelle/Primaire, prevent associating a teacher directly
    if (['Maternelle', 'Primaire'].includes(req.body.cycle)) {
      delete req.body.teacher
    }
    const subject = await Subject.create({ ...req.body, school })
    res.status(201).json({ success: true, data: subject })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.put('/:id', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    // For Maternelle/Primaire, prevent associating a teacher directly
    if (['Maternelle', 'Primaire'].includes(req.body.cycle)) {
      delete req.body.teacher
    }
    const subject = await Subject.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    if (!subject) return res.status(404).json({ message: 'Matière non trouvée' })
    res.json({ success: true, data: subject })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.delete('/:id', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    await Subject.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: 'Matière supprimée' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
