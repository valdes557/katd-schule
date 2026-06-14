const express = require('express')
const router = express.Router()
const User = require('../models/User')
const Student = require('../models/Student')
const { protect, authorize } = require('../middleware/auth')
const { generateUserMatricule } = require('../utils/matricule')

// Toutes les routes : directeur ou super_admin, limitées à l'école de l'utilisateur.
router.use(protect, authorize('directeur', 'super_admin'))

const schoolOf = (req) => req.user.school?._id || req.user.school

// Construit un email normalisé (le modèle User est lowercase+trim).
const cleanEmail = (e) => (e || '').trim().toLowerCase()

// GET /api/parents — liste des parents de l'école avec leurs enfants
router.get('/', async (req, res) => {
  try {
    const schoolId = schoolOf(req)
    if (!schoolId) return res.json({ success: true, data: [] })

    // Parents rattachés à l'école + ceux référencés par un élève de l'école (legacy).
    const linkedIds = await Student.find({ school: schoolId, parentUser: { $ne: null } }).distinct('parentUser')
    const parents = await User.find({
      role: 'parent',
      $or: [{ school: schoolId }, { _id: { $in: linkedIds } }],
    }).select('name email phone lastLogin isActive matricule').sort({ name: 1 })

    // Enfants de chaque parent (dans cette école).
    const children = await Student.find({ school: schoolId, parentUser: { $in: parents.map((p) => p._id) } })
      .select('firstName lastName matricule class parentUser')
      .populate('class', 'name level')
      .lean()

    const byParent = new Map()
    for (const s of children) {
      const key = s.parentUser.toString()
      if (!byParent.has(key)) byParent.set(key, [])
      byParent.get(key).push({ _id: s._id, firstName: s.firstName, lastName: s.lastName, matricule: s.matricule, class: s.class })
    }

    const data = parents.map((p) => ({
      _id: p._id,
      name: p.name,
      email: p.email,
      phone: p.phone || '',
      matricule: p.matricule || '',
      lastLogin: p.lastLogin || null,
      isActive: p.isActive !== false,
      children: byParent.get(p._id.toString()) || [],
    }))

    res.json({ success: true, data })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/parents — créer un parent (+ associer des élèves optionnel)
router.post('/', async (req, res) => {
  try {
    const schoolId = schoolOf(req)
    const { name, phone, password, studentIds } = req.body
    const email = cleanEmail(req.body.email)
    if (!name || !email) return res.status(400).json({ message: 'Nom et email requis' })

    const existing = await User.findOne({ email })
    if (existing) return res.status(400).json({ message: 'Cet email est déjà utilisé par un autre compte' })

    const rawPassword = password || `parent${Math.floor(10000 + Math.random() * 90000)}`
    const matricule = await generateUserMatricule('parent', schoolId)
    const user = await User.create({
      name, email, phone: phone || '', password: rawPassword, role: 'parent', school: schoolId, matricule,
    })

    if (Array.isArray(studentIds) && studentIds.length > 0) {
      await Student.updateMany(
        { _id: { $in: studentIds }, school: schoolId },
        { $set: { parentUser: user._id } },
      )
    }

    res.status(201).json({
      success: true,
      message: 'Compte parent créé',
      data: { _id: user._id, name: user.name, email: user.email, phone: user.phone, matricule: user.matricule, rawPassword },
    })
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Cet email est déjà utilisé' })
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/parents/:id — modifier nom/email/téléphone et/ou mot de passe
router.put('/:id', async (req, res) => {
  try {
    const schoolId = schoolOf(req)
    const user = await User.findOne({ _id: req.params.id, role: 'parent' })
    if (!user) return res.status(404).json({ message: 'Parent introuvable' })

    // Vérifie que le parent appartient à l'école (par école ou via un élève lié).
    const belongs = (user.school && user.school.toString() === schoolId.toString()) ||
      (await Student.exists({ school: schoolId, parentUser: user._id }))
    if (!belongs) return res.status(403).json({ message: 'Accès refusé' })

    if (req.body.email !== undefined) {
      const email = cleanEmail(req.body.email)
      if (!email) return res.status(400).json({ message: 'Email invalide' })
      if (email !== user.email) {
        const taken = await User.findOne({ email, _id: { $ne: user._id } })
        if (taken) return res.status(400).json({ message: 'Cet email est déjà utilisé' })
        user.email = email
      }
    }
    if (req.body.name !== undefined) user.name = req.body.name
    if (req.body.phone !== undefined) user.phone = req.body.phone
    if (req.body.password) user.password = req.body.password // re-hashé par le hook pre-save
    if (!user.school) user.school = schoolId // rattache les parents legacy

    await user.save()
    res.json({ success: true, message: 'Parent mis à jour', data: { _id: user._id, name: user.name, email: user.email, phone: user.phone } })
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Cet email est déjà utilisé' })
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/parents/:id — suppression définitive + détache les élèves (libère l'email)
router.delete('/:id', async (req, res) => {
  try {
    const schoolId = schoolOf(req)
    const user = await User.findOne({ _id: req.params.id, role: 'parent' })
    if (!user) return res.status(404).json({ message: 'Parent introuvable' })

    const belongs = (user.school && user.school.toString() === schoolId.toString()) ||
      (await Student.exists({ school: schoolId, parentUser: user._id }))
    if (!belongs) return res.status(403).json({ message: 'Accès refusé' })

    // Détache de tous les élèves puis supprime définitivement (l'email redevient réutilisable).
    await Student.updateMany({ parentUser: user._id }, { $unset: { parentUser: '' } })
    await user.deleteOne()

    res.json({ success: true, message: 'Parent supprimé' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/parents/:id/students — définit la liste exacte des élèves associés
router.put('/:id/students', async (req, res) => {
  try {
    const schoolId = schoolOf(req)
    const { studentIds = [] } = req.body
    const user = await User.findOne({ _id: req.params.id, role: 'parent' })
    if (!user) return res.status(404).json({ message: 'Parent introuvable' })

    // Détache les élèves actuels de cette école, puis rattache la nouvelle liste.
    await Student.updateMany({ school: schoolId, parentUser: user._id }, { $unset: { parentUser: '' } })
    if (Array.isArray(studentIds) && studentIds.length > 0) {
      await Student.updateMany(
        { _id: { $in: studentIds }, school: schoolId },
        { $set: { parentUser: user._id } },
      )
    }
    res.json({ success: true, message: 'Associations mises à jour' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
