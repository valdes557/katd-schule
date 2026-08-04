const express = require('express')
const router = express.Router()
const Student = require('../models/Student')
const User = require('../models/User')
const { protect, authorize } = require('../middleware/auth')
const School = require('../models/School')
const Teacher = require('../models/Teacher')
const { upload } = require('../config/cloudinary')

// When the body comes from multipart/form-data, nested objects (parent, address)
// arrive as JSON strings — parse them back into objects before saving.
const parseNested = (body) => {
  const out = { ...body }
  for (const key of ['parent', 'address']) {
    if (typeof out[key] === 'string') {
      try { out[key] = JSON.parse(out[key]) } catch (_) { /* leave as-is */ }
    }
  }
  return out
}

// @route  GET /api/students
router.get('/', protect, async (req, res) => {
  try {
    const { search, class: className, classId, cycle, page = 1, limit = 50 } = req.query
    const schoolId = req.user.school?._id || req.user.school

    // For non-teachers, always scope students to the current school
    if (req.user.role !== 'enseignant' && !schoolId) {
      return res.json({ success: true, total: 0, data: [] })
    }

    const query = {}
    if (schoolId && req.user.role !== 'enseignant') {
      query.school = schoolId
    }

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
    if (req.user.role === 'super_admin') {
      if (cycle) query.cycle = cycle
    } else if (req.user.role !== 'enseignant') {
      const school = await School.findById(schoolId).select('subscription.cycle')
      if (school?.subscription?.cycle) query.cycle = school.subscription.cycle
    }

    // Teachers can only view students from their assigned classes
    if (req.user.role === 'enseignant') {
      const t = await Teacher.findOne({ user: req.user._id }).select('classes')
      const teacherClassIds = (t?.classes || []).map((c) => c.toString())
      if (!teacherClassIds || teacherClassIds.length === 0) {
        return res.json({ success: true, total: 0, data: [] })
      }
      if (classId) {
        if (!teacherClassIds.includes(classId.toString())) {
          return res.json({ success: true, total: 0, data: [] })
        }
        query.class = classId
      } else {
        query.class = { $in: teacherClassIds }
      }
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
router.post('/', protect, authorize('directeur', 'super_admin'), upload.single('photo'), async (req, res) => {
  try {
    const body = parseNested(req.body)
    const schoolId = req.user.school?._id || req.user.school
    if (req.user.role === 'directeur') {
      const school = await School.findById(schoolId).select('subscription.cycle')
      if (school?.subscription?.cycle && body.cycle && body.cycle !== school.subscription.cycle) {
        return res.status(403).json({ message: `Cycle non autorisé. Votre abonnement est « ${school.subscription.cycle} ». ` })
      }
    }
    const photo = req.file?.path || body.photo || ''
    const student = await Student.create({ ...body, photo, school: schoolId })

    if (body.teacher && student.class) {
      await Teacher.findByIdAndUpdate(body.teacher, { $addToSet: { classes: student.class } })
    }

    res.status(201).json({ success: true, data: student })
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Conflit d\'unité unique (matricule ou email déjà utilisé). Veuillez réessayer.' })
    res.status(500).json({ message: err.message })
  }
})

// @route  PUT /api/students/:id
router.put('/:id', protect, authorize('directeur', 'enseignant', 'super_admin'), upload.single('photo'), async (req, res) => {
  try {
    const updates = parseNested(req.body)
    if (req.file?.path) updates.photo = req.file.path
    const student = await Student.findByIdAndUpdate(req.params.id, updates, {
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
    const student = await Student.findById(req.params.id)
    if (!student) return res.status(404).json({ message: 'Élève non trouvé' })
    // Supprime aussi le compte de connexion élève éventuel pour libérer ses identifiants
    // (permet de recréer plus tard un élève avec le même email/identifiants sans conflit).
    if (student.user) await User.findByIdAndDelete(student.user)
    await student.deleteOne()
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
    const hasClassAssigned = !!student.class

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
    const { generateUserMatricule } = require('../utils/matricule')
    const matricule = await generateUserMatricule('parent', student.school)
    const user = await User.create({
      name: req.body.name || student.parent?.name || `Parent de ${student.firstName}`,
      email,
      password: rawPassword,
      role: 'parent',
      school: student.school,
      phone: req.body.phone || student.parent?.phone,
      matricule,
    })

    student.parentUser = user._id
    if (req.body.email) student.parent = { ...student.parent, email: req.body.email }
    await student.save()

    // Fetch teachers of the child's class so the director sees what is attributed
    const Teacher = require('../models/Teacher')
    const classTeachers = student.class
      ? await Teacher.find({ classes: student.class._id }).select('firstName lastName email subjects speciality')
      : []

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
        class: student.class ? {
          name: student.class.name,
          level: student.class.level,
          cycle: student.class.cycle,
          room: student.class.room,
        } : null,
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

// POST /api/students/:id/student-account — le principal crée un compte de connexion pour l'élève (Secondaire)
router.post('/:id/student-account', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).populate('class', 'name level cycle room')
    if (!student) return res.status(404).json({ message: 'Élève non trouvé' })
    if (req.user.role !== 'super_admin' && String(student.school) !== String(req.user.school?._id || req.user.school)) {
      return res.status(403).json({ message: 'Élève hors de votre établissement' })
    }

    // Compte déjà existant ?
    if (student.user) {
      const existing = await User.findById(student.user)
      if (existing) return res.status(400).json({ message: 'Un compte élève existe déjà', data: { email: existing.email } })
    }

    const email = (req.body.email || '').trim().toLowerCase()
    if (!email) return res.status(400).json({ message: "Email de l'élève requis" })
    const already = await User.findOne({ email })
    if (already) return res.status(400).json({ message: 'Cet email est déjà utilisé' })

    const rawPassword = req.body.password || `eleve${Math.floor(10000 + Math.random() * 90000)}`
    const { generateUserMatricule } = require('../utils/matricule')
    // Réutilise le matricule élève existant s'il est libre côté User, sinon en génère un ELV-...
    let matricule = student.matricule || null
    if (matricule && (await User.findOne({ matricule }))) matricule = null
    if (!matricule) matricule = await generateUserMatricule('eleve', student.school)

    const user = await User.create({
      name: `${student.lastName} ${student.firstName}`,
      email,
      password: rawPassword,
      role: 'eleve',
      school: student.school,
      matricule,
    })
    student.user = user._id
    await student.save()

    res.status(201).json({
      success: true,
      message: 'Compte élève créé avec succès',
      data: {
        email,
        rawPassword,
        matricule,
        userId: user._id,
        studentName: `${student.lastName} ${student.firstName}`,
        class: student.class ? { name: student.class.name, level: student.class.level } : null,
      },
    })
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Cet email est déjà utilisé' })
    res.status(500).json({ message: err.message })
  }
})

// GET /api/students/me — l'élève connecté récupère sa fiche (notes/EDT via son id)
router.get('/me/profile', protect, authorize('eleve'), async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id })
      .populate('class', 'name level cycle room')
      .populate('school', 'name cycles')
    if (!student) return res.status(404).json({ message: 'Aucune fiche élève liée à ce compte' })
    res.json({ success: true, data: student })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/students/me/homeworks — les devoirs de la classe de l'élève connecté
router.get('/me/homeworks', protect, authorize('eleve'), async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id }).select('class school')
    if (!student?.class) return res.json({ success: true, data: [] })
    const Homework = require('../models/Homework')
    const homeworks = await Homework.find({ school: student.school, class: student.class })
      .populate('class', 'name level')
      .sort({ dueDate: -1 })
      .limit(200)
    res.json({ success: true, data: homeworks })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// Construit le dossier discipline d'un élève : retards à l'entrée (scan portier),
// absences/retards en classe (appels), permissions. Partagé élève / parent.
async function buildDiscipline(student) {
  const EntryAttendance = require('../models/EntryAttendance')
  const Attendance = require('../models/Attendance')
  const PermissionRequest = require('../models/PermissionRequest')

  const [entries, classAttendance, permissions] = await Promise.all([
    // Retards à l'entrée de l'école (scan portier)
    EntryAttendance.find({ student: student._id }).sort({ day: -1 }).limit(200).lean(),
    // Appels en classe où l'élève figure
    Attendance.find({ class: student.class, 'records.student': student._id }).sort({ date: -1 }).limit(200).lean(),
    // Permissions le concernant (sortie / absence / retard justifié)
    PermissionRequest.find({ student: student._id }).sort({ createdAt: -1 }).limit(100)
      .populate('decidedBy', 'name role').lean(),
  ])

  // Extrait le statut de l'élève dans chaque appel
  const classRecords = classAttendance.map((a) => {
    const rec = (a.records || []).find((r) => String(r.student) === String(student._id))
    return { date: a.date, status: rec?.status || null }
  }).filter((r) => r.status)

  const lateEntries = entries.filter((e) => e.status === 'late')
  const summary = {
    entryLate: lateEntries.length,
    entryLateMinutes: lateEntries.reduce((s, e) => s + (e.lateMinutes || 0), 0),
    classAbsent: classRecords.filter((r) => r.status === 'absent').length,
    classLate: classRecords.filter((r) => r.status === 'late').length,
    classExcused: classRecords.filter((r) => r.status === 'excused').length,
    permissionsApproved: permissions.filter((p) => p.status === 'approved').length,
    permissionsPending: permissions.filter((p) => p.status === 'pending').length,
  }

  return { summary, entries, classRecords, permissions }
}

// GET /api/students/me/discipline — dossier discipline de l'élève connecté
router.get('/me/discipline', protect, authorize('eleve'), async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id }).select('class school firstName lastName')
    if (!student) return res.status(404).json({ message: 'Aucune fiche élève liée à ce compte' })
    const data = await buildDiscipline(student)
    res.json({ success: true, data })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/students/:id/discipline — dossier discipline d'un enfant (parent) ou d'un
// élève de l'école (directeur, VP, SG).
router.get('/:id/discipline', protect, authorize('parent', 'directeur', 'vice_principal', 'surveillant_general', 'super_admin'), async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).select('class school firstName lastName parentUser')
    if (!student) return res.status(404).json({ message: 'Élève non trouvé' })
    if (req.user.role === 'parent') {
      if (String(student.parentUser || '') !== String(req.user._id)) {
        return res.status(403).json({ message: 'Accès refusé' })
      }
    } else if (req.user.role !== 'super_admin') {
      const sid = req.user.school?._id || req.user.school
      if (String(student.school) !== String(sid)) return res.status(403).json({ message: 'Accès refusé' })
    }
    const data = await buildDiscipline(student)
    res.json({ success: true, data: { ...data, student: { _id: student._id, firstName: student.firstName, lastName: student.lastName } } })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/students/me/fees — frais de scolarité de l'élève connecté (lecture seule)
router.get('/me/fees', protect, authorize('eleve'), async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id }).select('school')
    if (!student) return res.status(404).json({ message: 'Aucune fiche élève liée à ce compte' })
    const Fee = require('../models/Fee')
    const fees = await Fee.find({ student: student._id }).sort({ createdAt: -1 }).lean()
    const totalDue = fees.reduce((s, f) => s + (f.amount || 0), 0)
    const totalPaid = fees.reduce((s, f) => s + (f.paid || 0), 0)
    res.json({ success: true, data: { fees, totalDue, totalPaid, remaining: totalDue - totalPaid } })
  } catch (err) {
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
