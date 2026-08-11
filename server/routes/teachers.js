const express = require('express')
const router = express.Router()
const Teacher = require('../models/Teacher')
const User = require('../models/User')
const { protect, authorize } = require('../middleware/auth')
const School = require('../models/School')
const { generateUserMatricule } = require('../utils/matricule')
const wallet = require('../services/walletService')

// GET /api/teachers
router.get('/', protect, async (req, res) => {
  try {
    const userSchool = req.user.school?._id || req.user.school
    const schoolId = req.user.role === 'super_admin' ? (req.query.schoolId || userSchool) : userSchool
    if (!schoolId) return res.json({ success: true, total: 0, data: [] })
    const { search, status, page = 1, limit = 50 } = req.query
    const and = []
    // Le directeur voit les enseignants de son cycle abonné, MAIS aussi ceux dont
    // le cycle n'est pas défini (legacy / créés autrement) afin de toujours pouvoir
    // les gérer (modifier les identifiants, supprimer). Sinon un enseignant « invisible »
    // devient ingérable.
    if (req.user.role !== 'super_admin') {
      const school = await School.findById(schoolId).select('subscription.cycle')
      if (school?.subscription?.cycle) {
        and.push({ $or: [
          { cycle: school.subscription.cycle },
          { cycle: { $exists: false } },
          { cycle: null },
          { cycle: '' },
        ] })
      }
    }
    if (search) {
      and.push({ $or: [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ] })
    }
    const query = { school: schoolId }
    if (and.length) query.$and = and
    if (status) query.status = status
    const total = await Teacher.countDocuments(query)
    const teachers = await Teacher.find(query)
      .populate('classes', 'name level cycle room')
      .populate('user', 'email matricule isActive')
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
      const matricule = await generateUserMatricule('enseignant', schoolId)
      const user = await User.create({
        name: `${lastName} ${firstName}`,
        email, password,
        role: 'enseignant',
        school: schoolId,
        matricule,
      })
      userId = user._id
      // Crée le portefeuille de l'enseignant dès l'enregistrement
      try { await wallet.getOrCreateWallet(userId, { role: 'enseignant', school: schoolId }) } catch (e) { console.error('wallet enseignant:', e.message) }
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

    const populated = await Teacher.findById(teacher._id).populate('classes', 'name level cycle room').populate('user', 'email matricule')
    res.status(201).json({ success: true, data: populated })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/teachers/:id
router.put('/:id', protect, authorize('directeur', 'super_admin', 'vice_principal'), async (req, res) => {
  try {
    const { password, email, ...rest } = req.body
    if (rest.subjects && typeof rest.subjects === 'string') {
      rest.subjects = rest.subjects.split(',').map((s) => s.trim()).filter(Boolean)
    }

    const teacher = await Teacher.findById(req.params.id)
    if (!teacher) return res.status(404).json({ message: 'Enseignant non trouvé' })
    // Un directeur ne peut modifier que les enseignants de SA propre école.
    // req.user.school est PEUPLÉ (objet) par le middleware → normaliser en ID avant comparaison.
    if (req.user.role === 'directeur') {
      const mySchool = req.user.school?._id || req.user.school
      if (!mySchool || String(teacher.school) !== String(mySchool)) {
        return res.status(403).json({ message: "Vous ne pouvez modifier que les enseignants de votre école" })
      }
    }

    // Update linked User account password if provided
    if (teacher.user && password) {
      const u = await User.findById(teacher.user)
      if (u) { u.password = password; await u.save() }
    }
    if (teacher.user && email) {
      const normalized = String(email).trim().toLowerCase()
      // Refuse si l'email est déjà pris par un AUTRE compte (message clair au lieu d'un 500).
      const taken = await User.findOne({ email: normalized, _id: { $ne: teacher.user } })
      if (taken) return res.status(400).json({ message: 'Cet email est déjà utilisé par un autre compte' })
      await User.findByIdAndUpdate(teacher.user, { email: normalized })
    }

    Object.assign(teacher, rest)
    if (email) teacher.email = email
    await teacher.save()
    const populated = await Teacher.findById(teacher._id).populate('classes', 'name level cycle room').populate('user', 'email matricule')
    res.json({ success: true, data: populated })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/teachers/:id/toggle-active — suspend/réactive le compte de connexion de l'enseignant (G3)
router.put('/:id/toggle-active', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id)
    if (!teacher) return res.status(404).json({ message: 'Enseignant non trouvé' })
    if (req.user.role === 'directeur') {
      const mySchool = req.user.school?._id || req.user.school
      if (!mySchool || String(teacher.school) !== String(mySchool)) {
        return res.status(403).json({ message: 'Vous ne pouvez gérer que les enseignants de votre école' })
      }
    }
    if (!teacher.user) return res.status(400).json({ message: 'Cet enseignant n\'a pas de compte de connexion' })
    const account = await User.findById(teacher.user)
    if (!account) return res.status(404).json({ message: 'Compte de connexion introuvable' })
    account.isActive = account.isActive === false // inactif → actif, actif → inactif
    await account.save()
    res.json({ success: true, isActive: account.isActive, message: account.isActive ? 'Compte réactivé' : 'Compte suspendu' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/teachers/:id
router.delete('/:id', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id)
    if (!teacher) return res.status(404).json({ message: 'Enseignant non trouvé' })
    // Un directeur ne peut supprimer que les enseignants de SA propre école.
    // req.user.school est PEUPLÉ (objet) par le middleware → normaliser en ID avant comparaison.
    if (req.user.role === 'directeur') {
      const mySchool = req.user.school?._id || req.user.school
      if (!mySchool || String(teacher.school) !== String(mySchool)) {
        return res.status(403).json({ message: "Vous ne pouvez supprimer que les enseignants de votre école" })
      }
    }

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