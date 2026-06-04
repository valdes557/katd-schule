const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const bcrypt = require('bcryptjs')
const Enrollment = require('../models/Enrollment')
const Class = require('../models/Class')
const School = require('../models/School')
const Student = require('../models/Student')
const User = require('../models/User')
const { protect, authorize } = require('../middleware/auth')
const { sendEnrollmentApprovalEmail, sendEnrollmentRejectionEmail } = require('../utils/emailService')
const { generateMatricule } = require('../utils/matricule')

// Multer config for payment proof
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, `proof-${unique}${path.extname(file.originalname)}`)
  },
})
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } })

// GET /api/enrollments/school/:schoolId/classes — Public: get classes with fees for a school
router.get('/school/:schoolId/classes', async (req, res) => {
  try {
    const classes = await Class.find({ school: req.params.schoolId })
      .select('name level cycle enrollmentFee capacity stats.totalStudents')
      .sort({ cycle: 1, name: 1 })
    res.json({ success: true, data: classes })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: err.message })
  }
})

// POST /api/enrollments — Public: submit enrollment request
router.post('/', upload.single('paymentProof'), async (req, res) => {
  try {
    const { firstName, lastName, dateOfBirth, placeOfBirth, gender, email, phone, schoolId, classId, fatherName, motherName, fatherPhone } = req.body

    if (!firstName || !lastName || !dateOfBirth || !placeOfBirth || !gender || !email || !schoolId || !classId) {
      return res.status(400).json({ message: 'Tous les champs obligatoires doivent être remplis' })
    }

    if (!req.file) {
      return res.status(400).json({ message: 'La preuve de paiement est obligatoire' })
    }

    // Verify school and class exist
    const school = await School.findById(schoolId)
    if (!school) return res.status(404).json({ message: 'École non trouvée' })

    const cls = await Class.findById(classId)
    if (!cls) return res.status(404).json({ message: 'Classe non trouvée' })

    // Check if already has a pending enrollment for same school
    const existing = await Enrollment.findOne({ email, school: schoolId, status: 'pending' })
    if (existing) {
      return res.status(400).json({ message: 'Vous avez déjà une demande en attente pour cette école' })
    }

    const enrollment = await Enrollment.create({
      firstName,
      lastName,
      dateOfBirth,
      placeOfBirth,
      gender,
      email,
      phone,
      fatherName,
      motherName,
      fatherPhone,
      school: schoolId,
      class: classId,
      className: `${cls.name} (${cls.level})`,
      amount: cls.enrollmentFee || school.enrollmentFee || 0,
      paymentProof: `/uploads/${req.file.filename}`,
    })

    res.status(201).json({
      success: true,
      message: 'Votre demande d\'inscription a été envoyée avec succès. Elle est en attente d\'approbation par le directeur.',
      data: enrollment,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: err.message })
  }
})

// GET /api/enrollments — Director: list enrollment requests for their school
router.get('/', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query
    const schoolId = req.user.school?._id || req.user.school
    const query = { school: schoolId }
    if (status) query.status = status

    const total = await Enrollment.countDocuments(query)
    const enrollments = await Enrollment.find(query)
      .populate('class', 'name level cycle enrollmentFee')
      .populate('school', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))

    res.json({ success: true, total, data: enrollments })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/enrollments/:id/approve — Director approves enrollment
router.put('/:id/approve', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id).populate('school class')
    if (!enrollment) return res.status(404).json({ message: 'Demande non trouvée' })
    if (enrollment.status !== 'pending') {
      return res.status(400).json({ message: 'Cette demande a déjà été traitée' })
    }

    // Generate matricule using atomic per-school-year counter
    const matricule = await generateMatricule(enrollment.school._id)

    // Generate password (hashed by User model pre-save)
    const baseName = (enrollment.firstName || 'eleve')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/[^a-z]/g, '') || 'eleve'
    const rawPassword = `${baseName}${Math.floor(1000 + Math.random() * 9000)}`

    // Create User account for the student
    const userAccount = await User.create({
      name: `${enrollment.lastName} ${enrollment.firstName}`,
      email: enrollment.email,
      password: rawPassword,
      role: 'eleve',
      school: enrollment.school._id,
      isActive: true,
    })

    // Create Student record
    const student = await Student.create({
      firstName: enrollment.firstName,
      lastName: enrollment.lastName,
      matricule,
      dateOfBirth: enrollment.dateOfBirth,
      gender: enrollment.gender,
      school: enrollment.school._id,
      class: enrollment.class._id,
      cycle: enrollment.class.cycle,
      parent: {
        name: enrollment.fatherName || enrollment.motherName || enrollment.lastName,
        phone: enrollment.fatherPhone || enrollment.phone || '',
        relation: enrollment.fatherName ? 'pere' : (enrollment.motherName ? 'mere' : 'tuteur'),
      },
      status: 'active',
      user: userAccount._id,
    })

    // Update enrollment
    enrollment.status = 'approved'
    enrollment.approvedAt = new Date()
    enrollment.approvedBy = req.user._id
    enrollment.studentCreated = student._id
    enrollment.userCreated = userAccount._id
    await enrollment.save()

    // Update class stats
    await Class.findByIdAndUpdate(enrollment.class._id, { $inc: { 'stats.totalStudents': 1 } })

    // Send approval email with credentials
    await sendEnrollmentApprovalEmail({
      enrollment,
      student,
      credentials: { email: enrollment.email, password: rawPassword },
    })

    // Build WhatsApp receipt link if phone is provided
    let whatsappLink = null
    if (enrollment.phone) {
      const phoneDigits = enrollment.phone.replace(/\D/g, '')
      const receipt = [
        `*KATD-SCHÜLE — Inscription approuvée ✅*`,
        ``,
        `Bonjour ${enrollment.firstName} ${enrollment.lastName},`,
        `Votre inscription à *${enrollment.school.name}* a été approuvée.`,
        ``,
        `📋 *Reçu d'inscription*`,
        `• Nom : ${enrollment.lastName} ${enrollment.firstName}`,
        `• Né(e) le : ${new Date(enrollment.dateOfBirth).toLocaleDateString('fr-FR')} à ${enrollment.placeOfBirth}`,
        `• Classe : ${enrollment.className}`,
        `• Montant payé : ${enrollment.amount.toLocaleString()} F CFA`,
        `• Matricule : ${student.matricule}`,
        ``,
        `🔐 *Identifiants de connexion*`,
        `• Email : ${enrollment.email}`,
        `• Mot de passe : ${rawPassword}`,
        ``,
        `Connectez-vous : ${process.env.CLIENT_URL || 'http://localhost:5173'}/login`,
      ].join('\n')
      whatsappLink = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(receipt)}`
    }

    res.json({
      success: true,
      message: 'Inscription approuvée. L\'élève a été notifié par email.',
      data: { enrollment, student, user: userAccount, whatsappLink },
    })
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Un compte avec cet email existe déjà' })
    }
    console.error(err)
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/enrollments/:id/reject — Director rejects enrollment
router.put('/:id/reject', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id).populate('school class')
    if (!enrollment) return res.status(404).json({ message: 'Demande non trouvée' })
    if (enrollment.status !== 'pending') {
      return res.status(400).json({ message: 'Cette demande a déjà été traitée' })
    }

    enrollment.status = 'rejected'
    enrollment.rejectionReason = req.body.reason || ''
    await enrollment.save()

    // Send rejection email
    await sendEnrollmentRejectionEmail({ enrollment, reason: req.body.reason })

    res.json({ success: true, message: 'Demande rejetée. L\'utilisateur a été notifié.', data: enrollment })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/enrollments/students/:id/block — Director blocks a student
router.put('/students/:id/block', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
    if (!student) return res.status(404).json({ message: 'Élève non trouvé' })

    // Block user account
    if (student.user) {
      await User.findByIdAndUpdate(student.user, { isActive: false })
    }
    student.status = 'inactive'
    await student.save()

    res.json({ success: true, message: 'Compte élève bloqué' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/enrollments/students/:id/unblock — Director unblocks a student
router.put('/students/:id/unblock', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
    if (!student) return res.status(404).json({ message: 'Élève non trouvé' })

    if (student.user) {
      await User.findByIdAndUpdate(student.user, { isActive: true })
    }
    student.status = 'active'
    await student.save()

    res.json({ success: true, message: 'Compte élève débloqué' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
