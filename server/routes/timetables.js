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

// GET /api/timetables/conflicts — Détecter les conflits d'enseignants, de salles ou d'horaires
router.get('/conflicts', protect, authorize('directeur', 'super_admin', 'vice_principal'), async (req, res) => {
  try {
    const schoolId = req.user.school?._id || req.user.school
    const timetables = await Timetable.find({ school: schoolId }).populate('class', 'name level').lean()

    const conflicts = []
    const allSlots = []

    // Helper conversion heure "HH:MM" en minutes
    const toMinutes = (timeStr) => {
      if (!timeStr) return 0
      const [h, m] = timeStr.split(':').map(Number)
      return (h || 0) * 60 + (m || 0)
    }

    // Aplatir tous les créneaux avec référence de classe
    for (const tt of timetables) {
      for (const slot of tt.slots || []) {
        const startM = toMinutes(slot.startTime)
        const endM = toMinutes(slot.endTime)

        // Détection antériorité / horaire incohérent
        if (endM <= startM) {
          conflicts.push({
            type: 'horaire_invalide',
            severity: 'haute',
            day: slot.day,
            className: tt.class?.name || 'Inconnue',
            classId: tt.class?._id,
            subject: slot.subject,
            teacher: slot.teacher,
            startTime: slot.startTime,
            endTime: slot.endTime,
            description: `L'heure de fin (${slot.endTime}) est antérieure ou égale à l'heure de début (${slot.startTime}) dans la classe ${tt.class?.name}.`,
          })
        }

        allSlots.push({
          slotId: slot._id,
          classId: tt.class?._id,
          className: tt.class?.name || 'Inconnue',
          day: slot.day,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          startM,
          endM,
          subject: slot.subject,
          teacher: slot.teacher?.trim().toLowerCase(),
          teacherRaw: slot.teacher,
          teacherRef: slot.teacherRef,
          room: slot.room?.trim().toLowerCase(),
          roomRaw: slot.room,
          type: slot.type || 'cours',
          title: slot.title,
        })
      }
    }

    // Comparaison croisée de créneaux pour conflits enseignant ou salle
    for (let i = 0; i < allSlots.length; i++) {
      for (let j = i + 1; j < allSlots.length; j++) {
        const s1 = allSlots[i]
        const s2 = allSlots[j]

        // Ne comparer que si c'est le même jour (ou même date ponctuelle) et deux classes différentes
        const sameDay = s1.day === s2.day && (!s1.date || !s2.date || s1.date === s2.date)
        const diffClasses = String(s1.classId) !== String(s2.classId)

        if (!sameDay || !diffClasses) continue

        // Chevauchement horaire : start1 < end2 && end1 > start2
        const overlaps = s1.startM < s2.endM && s1.endM > s2.startM

        if (overlaps) {
          // Conflit enseignant
          const sameTeacher = (s1.teacherRef && s2.teacherRef && String(s1.teacherRef) === String(s2.teacherRef)) ||
            (s1.teacher && s2.teacher && s1.teacher === s2.teacher)

          if (sameTeacher) {
            conflicts.push({
              type: 'enseignant_double_classe',
              severity: 'haute',
              day: s1.day,
              date: s1.date || s2.date,
              teacher: s1.teacherRaw,
              class1: s1.className,
              class2: s2.className,
              subject1: s1.subject,
              subject2: s2.subject,
              timeRange: `${Math.max(s1.startM, s2.startM) === s1.startM ? s1.startTime : s2.startTime} - ${Math.min(s1.endM, s2.endM) === s1.endM ? s1.endTime : s2.endTime}`,
              description: `L'enseignant « ${s1.teacherRaw} » est programmé simultanément en ${s1.className} (${s1.startTime}-${s1.endTime}) et en ${s2.className} (${s2.startTime}-${s2.endTime}) le ${s1.day}.`,
            })
          }

          // Conflit de salle
          const sameRoom = s1.room && s2.room && s1.room === s2.room
          if (sameRoom) {
            conflicts.push({
              type: 'salle_double_attribution',
              severity: 'moyenne',
              day: s1.day,
              date: s1.date || s2.date,
              room: s1.roomRaw,
              class1: s1.className,
              class2: s2.className,
              timeRange: `${s1.startTime} - ${s1.endTime}`,
              description: `La salle « ${s1.roomRaw} » est assignée simultanément à ${s1.className} et ${s2.className} le ${s1.day}.`,
            })
          }
        }
      }
    }

    res.json({
      success: true,
      hasConflicts: conflicts.length > 0,
      conflictCount: conflicts.length,
      conflicts,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/timetables/all-activities — Lister toutes les activités (cours, évaluations, sorties, réunions) par mois ou par année
router.get('/all-activities', protect, async (req, res) => {
  try {
    const Activity = require('../models/Activity')
    const Event = require('../models/Event')
    const schoolId = req.user.school?._id || req.user.school
    const { month, year, classId } = req.query

    const currentYear = new Date().getFullYear()
    const targetYear = Number(year) || currentYear

    // 1. Emploi du temps / cours et évaluations
    const ttQuery = { school: schoolId }
    if (classId) ttQuery.class = classId
    const timetables = await Timetable.find(ttQuery).populate('class', 'name level').lean()

    // 2. Activités scolaires (sorties, sport, kermesses)
    const actQuery = { school: schoolId }
    if (classId) actQuery.class = classId
    const activities = await Activity.find(actQuery).populate('class', 'name').lean()

    // 3. Événements généraux (réunions, examens)
    const events = await Event.find({ school: schoolId }).lean()

    const combined = []

    // Insérer les activités scolaires
    activities.forEach((act) => {
      const actDate = act.date ? new Date(act.date) : null
      if (actDate && actDate.getFullYear() === targetYear) {
        if (!month || String(actDate.getMonth() + 1).padStart(2, '0') === month) {
          combined.push({
            id: act._id,
            category: 'activite_scolaire',
            title: act.title,
            type: act.type, // sortie, sport, kermesse...
            date: actDate.toISOString().slice(0, 10),
            location: act.location,
            className: act.class?.name || 'Toutes classes',
            description: act.description,
            requiresAuthorization: act.requiresAuthorization,
          })
        }
      }
    })

    // Insérer les événements
    events.forEach((ev) => {
      const evDate = ev.startDate ? new Date(ev.startDate) : null
      if (evDate && evDate.getFullYear() === targetYear) {
        if (!month || String(evDate.getMonth() + 1).padStart(2, '0') === month) {
          combined.push({
            id: ev._id,
            category: 'evenement',
            title: ev.title,
            type: ev.type, // reunion, ceremonie, examen...
            date: evDate.toISOString().slice(0, 10),
            location: ev.location,
            className: 'Établissement entier',
            description: ev.description,
            audience: ev.audience,
          })
        }
      }
    })

    // Insérer les créneaux récurrents & évaluations de l'agenda
    timetables.forEach((tt) => {
      (tt.slots || []).forEach((slot) => {
        combined.push({
          id: slot._id,
          category: slot.type === 'evaluation' ? 'evaluation_programmee' : 'cours',
          title: slot.title || `${slot.subject} (${slot.teacher || 'Enseignant non spécifié'})`,
          type: slot.type || 'cours',
          day: slot.day,
          startTime: slot.startTime,
          endTime: slot.endTime,
          room: slot.room,
          className: tt.class?.name || 'Classe',
          classId: tt.class?._id,
          isRecurring: true,
        })
      })
    })

    res.json({
      success: true,
      year: targetYear,
      month: month || 'all',
      totalActivities: combined.length,
      data: combined,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
