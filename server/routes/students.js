const express = require('express')
const router = express.Router()
const Student = require('../models/Student')
const User = require('../models/User')
const { protect, authorize } = require('../middleware/auth')
const School = require('../models/School')

// @route  GET /api/students
router.get('/', protect, async (req, res) => {
  try {
    const { search, class: className, classId, cycle, page = 1, limit = 50 } = req.query
    const schoolId = req.user.school?._id || req.user.school
    if (!schoolId) return res.json({ success: true, total: 0, data: [] })
    const query = { school: schoolId }

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { matricule: { $regex: search, $options: 'i' } },
      ]
    }
    if (classId) query.class = classId
    else if (className) query.class = className
    // Directors and other roles are scoped to the school's subscribed cycle by default
    if (req.user.role !== 'super_admin') {
      const school = await School.findById(schoolId).select('subscription.cycle')
      if (school?.subscription?.cycle) query.cycle = school.subscription.cycle
    } else if (cycle) {
      query.cycle = cycle
    }

    const total = await Student.countDocuments(query)
    const students = await Student.find(query)
      .populate('class', 'name level cycle room')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ lastName: 1 })

    res.json({ success: true, total, data: students })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// @route  GET /api/students/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).populate('class school')
    if (!student) return res.status(404).json({ message: 'Élève non trouvé' })
    res.json({ success: true, data: student })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// @route  POST /api/students
router.post('/', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const schoolId = req.user.school?._id || req.user.school
    if (req.user.role === 'directeur') {
      const school = await School.findById(schoolId).select('subscription.cycle')
      if (school?.subscription?.cycle && req.body.cycle && req.body.cycle !== school.subscription.cycle) {
        return res.status(403).json({ message: `Cycle non autorisé. Votre abonnement est « ${school.subscription.cycle} ». ` })
      }
    }
    const student = await Student.create({ ...req.body, school: schoolId })
    res.status(201).json({ success: true, data: student })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// @route  PUT /api/students/:id
router.put('/:id', protect, authorize('directeur', 'enseignant', 'super_admin'), async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true,
    })
    if (!student) return res.status(404).json({ message: 'Élève non trouvé' })
    res.json({ success: true, data: student })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// @route  DELETE /api/students/:id
router.delete('/:id', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id)
    if (!student) return res.status(404).json({ message: 'Élève non trouvé' })
    res.json({ success: true, message: 'Élève supprimé' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/students/:id/parent-account — Director creates parent login account
router.post('/:id/parent-account', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).populate('class', 'name level cycle room')
    if (!student) return res.status(404).json({ message: 'Élève non trouvé' })

    // Block if no class assigned — parent must see class & teachers
    if (!student.class) {
      return res.status(400).json({
        message: 'Cet élève doit être affecté à une classe avant de créer le compte parent. Le parent doit pouvoir voir la classe, les enseignants et le programme.',
      })
    }

    // Use provided email or fall back to parent.email on student record
    const email = req.body.email || student.parent?.email
    if (!email) return res.status(400).json({ message: 'Email du parent requis' })

    // Check if account already exists
    if (student.parentUser) {
      const existing = await User.findById(student.parentUser)
      if (existing) return res.status(400).json({ message: 'Un compte parent existe déjà pour cet élève', data: { email: existing.email } })
    }

    const already = await User.findOne({ email })
    if (already) {
      // Just link the existing parent user to this student
      student.parentUser = already._id
      await student.save()
      return res.json({ success: true, message: 'Compte existant lié à cet élève', data: { email, linked: true } })
    }

    const rawPassword = req.body.password || `parent${Math.floor(10000 + Math.random() * 90000)}`
    const user = await User.create({
      name: req.body.name || student.parent?.name || `Parent de ${student.firstName}`,
      email,
      password: rawPassword,
      role: 'parent',
      school: student.school,
      phone: req.body.phone || student.parent?.phone,
    })

    student.parentUser = user._id
    if (req.body.email) student.parent = { ...student.parent, email: req.body.email }
    await student.save()

    // Fetch teachers of the child's class so the director sees what is attributed
    const Teacher = require('../models/Teacher')
    const classTeachers = await Teacher.find({ classes: student.class._id })
      .select('firstName lastName email subjects speciality')

    // Build WhatsApp link to send credentials to the parent's phone if available
    const phoneDigits = (req.body.phone || student.parent?.phone || '').replace(/\D/g, '')
    const waText = [
      `*KATD-SCHÜLE — Accès parent*`,
      ``,
      `Bonjour ${req.body.name || student.parent?.name || 'cher parent'},`,
      `Un compte parent a été créé pour suivre ${student.lastName} ${student.firstName}.`,
      ``,
      `🔐 Identifiants de connexion`,
      `• Email : ${email}`,
      `• Mot de passe : ${rawPassword}`,
      ``,
      `📚 Classe : ${student.class?.name || ''}${student.class?.level ? ` (${student.class.level})` : ''}`,
      `🚀 Connectez-vous : ${(process.env.CLIENT_URL || 'http://localhost:5173')}/login`,
      ``,
      `Merci.`,
    ].join('\n')
    const whatsappLink = phoneDigits ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(waText)}` : null

    res.status(201).json({
      success: true,
      message: 'Compte parent créé avec succès',
      data: {
        email,
        rawPassword,
        userId: user._id,
        studentName: `${student.lastName} ${student.firstName}`,
        class: {
          name: student.class.name,
          level: student.class.level,
          cycle: student.class.cycle,
          room: student.class.room,
        },
        teachers: classTeachers.map((t) => ({
          fullName: `${t.lastName} ${t.firstName}`,
          email: t.email,
          subjects: t.subjects,
          speciality: t.speciality,
        })),
        whatsappLink,
      },
    })
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Cet email est déjà utilisé' })
    res.status(500).json({ message: err.message })
  }
})

// GET /api/students/with-parents — list students with parent account status (for director)
router.get('/with-parents', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const schoolId = req.user.school?._id || req.user.school
    const students = await Student.find({ school: schoolId, status: 'active' })
      .populate('class', 'name level')
      .populate('parentUser', 'email lastLogin')
      .sort({ lastName: 1 })
    res.json({ success: true, data: students })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/students/link-parent — link an existing parent user to multiple students by email
router.post('/link-parent', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const { email, studentIds } = req.body
    if (!email || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ message: 'Email et liste des élèves requis' })
    }
    const user = await User.findOne({ email, role: 'parent' })
    if (!user) return res.status(404).json({ message: 'Compte parent introuvable pour cet email' })
    const schoolId = req.user.school?._id || req.user.school
    const updated = await Student.updateMany(
      { _id: { $in: studentIds }, school: schoolId },
      { $set: { parentUser: user._id } }
    )
    res.json({ success: true, message: 'Parent associé aux élèves sélectionnés', data: { matched: updated.matchedCount || updated.n, modified: updated.modifiedCount || updated.nModified } })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
