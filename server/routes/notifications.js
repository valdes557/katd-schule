const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/auth')
const User = require('../models/User')
const Student = require('../models/Student')
const Teacher = require('../models/Teacher')
const Announcement = require('../models/Announcement')
const Event = require('../models/Event')
const SharedDocument = require('../models/SharedDocument')
const Activity = require('../models/Activity')
const Resource = require('../models/Resource')
const Homework = require('../models/Homework')
const SchoolPost = require('../models/SchoolPost')

// Rubriques publiables suivies par les badges de nouveautés.
const RUBRICS = ['social', 'annonces', 'activites', 'ressources', 'documents', 'infos', 'devoirs']

const audienceFor = (role) =>
  role === 'parent' ? ['all', 'parents']
  : role === 'enseignant' ? ['all', 'teachers']
  : ['all', 'parents', 'teachers']

// GET /api/notifications/counts — nombre de nouveautés non lues par rubrique
router.get('/counts', protect, async (req, res) => {
  try {
    const schoolId = req.user.school?._id || req.user.school
    const empty = RUBRICS.reduce((o, k) => ({ ...o, [k]: 0 }), {})
    if (!schoolId) return res.json({ success: true, data: empty })

    const userId = req.user._id
    const role = req.user.role
    const userDoc = await User.findById(userId).select('rubricSeen')
    const seen = (key) => userDoc?.rubricSeen?.get?.(key) || null
    // Filtre temporel : éléments créés après la dernière consultation (tout si jamais vu)
    const since = (key) => { const d = seen(key); return d ? { $gt: d } : { $exists: true } }

    // Classes pertinentes pour le périmètre de l'utilisateur
    let childClassIds = []
    let teacherClassIds = []
    if (role === 'parent') {
      const children = await Student.find({ parentUser: userId }).select('class').lean()
      childClassIds = children.map((c) => c.class).filter(Boolean)
    } else if (role === 'enseignant') {
      const t = await Teacher.findOne({ user: userId }).select('classes').lean()
      teacherClassIds = (t?.classes || [])
    }
    const aud = audienceFor(role)

    // Périmètre de classe pour activités / ressources / devoirs / documents ciblés
    const classScope =
      role === 'parent' ? childClassIds
      : role === 'enseignant' ? teacherClassIds
      : null // directeur/admin : toute l'école

    const [annonces, infos, documents, activites, ressources, devoirs, social] = await Promise.all([
      // Annonces (école + audience)
      Announcement.countDocuments({ school: schoolId, audience: { $in: aud }, createdAt: since('annonces') }),
      // Informations générales (Event, école + audience)
      Event.countDocuments({ school: schoolId, audience: { $in: aud }, createdAt: since('infos') }),
      // Documents partagés (école ; pour parent/enseignant : doc école-large OU classe pertinente)
      SharedDocument.countDocuments({
        school: schoolId,
        createdAt: since('documents'),
        uploadedBy: { $ne: userId },
        ...(classScope ? { $or: [{ class: null }, { class: { $in: classScope } }] } : {}),
      }),
      // Activités (école ; classe pertinente selon rôle)
      Activity.countDocuments({
        school: schoolId,
        createdAt: since('activites'),
        createdByUser: { $ne: userId },
        ...(classScope ? { class: { $in: classScope } } : {}),
      }),
      // Ressources (école ; au moins une classe pertinente)
      Resource.countDocuments({
        school: schoolId,
        createdAt: since('ressources'),
        author: { $ne: userId },
        ...(classScope ? { classes: { $in: classScope } } : {}),
      }),
      // Devoirs (classe pertinente ; directeur = toute l'école)
      Homework.countDocuments({
        school: schoolId,
        createdAt: since('devoirs'),
        ...(classScope ? { class: { $in: classScope } } : {}),
      }),
      // Social (fil de l'école ; pas mes propres posts)
      SchoolPost.countDocuments({ school: schoolId, createdAt: since('social'), author: { $ne: userId } }),
    ])

    res.json({ success: true, data: { annonces, infos, documents, activites, ressources, devoirs, social } })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/notifications/seen { rubric } — marque une rubrique comme consultée maintenant
router.post('/seen', protect, async (req, res) => {
  try {
    const { rubric } = req.body
    if (!rubric || !RUBRICS.includes(rubric)) return res.status(400).json({ message: 'Rubrique invalide' })
    await User.updateOne({ _id: req.user._id }, { $set: { [`rubricSeen.${rubric}`]: new Date() } })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
