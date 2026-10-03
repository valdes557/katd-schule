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
router.post('/', protect, authorize('directeur', 'super_admin', 'vice_principal'), async (req, res) => {
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
router.put('/:id', protect, authorize('directeur', 'super_admin', 'vice_principal'), async (req, res) => {
  try {
    const cls = await Class.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    if (!cls) return res.status(404).json({ message: 'Classe non trouvée' })
    res.json({ success: true, data: cls })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/classes/:id
router.delete('/:id', protect, authorize('directeur', 'super_admin', 'vice_principal'), async (req, res) => {
  try {
    await Class.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: 'Classe supprimée' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/classes/:id/evaluation-config — Configurer les évaluations d'une classe
router.put('/:id/evaluation-config', protect, authorize('directeur', 'super_admin', 'vice_principal'), async (req, res) => {
  try {
    const { types, annualCalculationMethod } = req.body
    const cls = await Class.findById(req.params.id)
    if (!cls) return res.status(404).json({ message: 'Classe non trouvée' })

    cls.evaluationConfig = {
      types: Array.isArray(types) ? types : [],
      annualCalculationMethod: annualCalculationMethod || 'moyenne_trimestres_egale',
    }
    await cls.save()

    res.json({ success: true, message: 'Configuration des évaluations enregistrée', data: cls })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/classes/:id/duplicate-evaluation-config — Dupliquer la configuration vers d'autres classes
router.post('/:id/duplicate-evaluation-config', protect, authorize('directeur', 'super_admin', 'vice_principal'), async (req, res) => {
  try {
    const { targetClassIds } = req.body
    if (!Array.isArray(targetClassIds) || targetClassIds.length === 0) {
      return res.status(400).json({ message: 'Sélectionnez au moins une classe cible' })
    }

    const sourceClass = await Class.findById(req.params.id)
    if (!sourceClass) return res.status(404).json({ message: 'Classe source non trouvée' })
    if (!sourceClass.evaluationConfig || !sourceClass.evaluationConfig.types?.length) {
      return res.status(400).json({ message: 'La classe source n\'a pas encore de configuration d\'évaluations à dupliquer' })
    }

    const result = await Class.updateMany(
      { _id: { $in: targetClassIds }, school: sourceClass.school },
      { $set: { evaluationConfig: sourceClass.evaluationConfig } }
    )

    res.json({
      success: true,
      message: `Configuration dupliquée avec succès vers ${result.modifiedCount} classe(s)`,
      data: { modifiedCount: result.modifiedCount },
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/classes/:id/sync-evaluations-to-agenda — Intégrer les évaluations configurées dans l'agenda
router.post('/:id/sync-evaluations-to-agenda', protect, authorize('directeur', 'super_admin', 'vice_principal'), async (req, res) => {
  try {
    const Timetable = require('../models/Timetable')
    const cls = await Class.findById(req.params.id)
    if (!cls) return res.status(404).json({ message: 'Classe non trouvée' })

    if (!cls.evaluationConfig?.types?.length) {
      return res.status(400).json({ message: 'Aucune évaluation configurée pour cette classe' })
    }

    let timetable = await Timetable.findOne({ class: cls._id, school: cls.school })
    if (!timetable) {
      timetable = await Timetable.create({
        school: cls.school,
        class: cls._id,
        slots: [],
      })
    }

    // Convertit chaque type d'évaluation en créneau d'évaluation dans l'agenda
    // Jour par défaut : Samedi ou Vendredi selon périodicité
    const existingEvalTitles = new Set(timetable.slots.map((s) => s.title))
    let addedCount = 0

    cls.evaluationConfig.types.forEach((ev, idx) => {
      const evalTitle = `[Évaluation] ${ev.name} (${ev.periodicity || 'trimestrielle'})`
      if (!existingEvalTitles.has(evalTitle)) {
        const day = ev.periodicity === 'hebdomadaire' ? 'Samedi' : (idx % 2 === 0 ? 'Vendredi' : 'Mercredi')
        const startTime = '10:00'
        const endTime = '12:00'
        timetable.slots.push({
          day,
          startTime,
          endTime,
          subject: ev.subjects?.join(', ') || 'Évaluation commune',
          type: 'evaluation',
          title: evalTitle,
          evaluationType: ev.code || ev.name,
          isScheduledEvaluation: true,
          color: '#EF4444', // Rouge vif pour les évaluations
        })
        existingEvalTitles.add(evalTitle)
        addedCount += 1
      }
    })

    if (addedCount > 0) {
      await timetable.save()
    }

    res.json({
      success: true,
      message: `${addedCount} évaluation(s) synchronisée(s) dans l'agenda de la classe`,
      data: timetable,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
