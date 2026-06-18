const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const { body, validationResult } = require('express-validator')
const User = require('../models/User')
const { protect } = require('../middleware/auth')
const { upload } = require('../config/cloudinary')
const { sendEmail } = require('../utils/emailService')

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  })
}

// @route  POST /api/auth/register
router.post(
  '/register',
  [
    body('name').notEmpty().withMessage('Le nom est requis'),
    body('email').isEmail().withMessage('Email invalide'),
    body('password').isLength({ min: 6 }).withMessage('Le mot de passe doit comporter au moins 6 caractères'),
  ],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    try {
      const { name, email, password, role } = req.body
      const existing = await User.findOne({ email })
      if (existing) {
        return res.status(400).json({ message: 'Cet email est déjà utilisé' })
      }

      const user = await User.create({ name, email, password, role: role || 'directeur' })
      const token = generateToken(user._id)

      res.status(201).json({
        success: true,
        token,
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
      })
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  }
)

// @route  POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Email invalide'),
    body('password').notEmpty().withMessage('Le mot de passe est requis'),
  ],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    try {
      const { email, password } = req.body
      const user = await User.findOne({ email }).populate('school')
      if (!user || !(await user.matchPassword(password))) {
        return res.status(401).json({ message: 'Email ou mot de passe incorrect' })
      }
      if (user.isActive === false) {
        return res.status(403).json({ message: 'Votre compte a été désactivé. Contactez l\'administrateur.' })
      }

      const now = new Date()
      user.lastLogin = now
      user.lastActivity = now
      user.isOnline = true
      await user.save({ validateBeforeSave: false })

      const token = generateToken(user._id)

      res.json({
        success: true,
        token,
        user: { id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar, phone: user.phone, matricule: user.matricule },
        school: user.school,
      })
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  }
)

// @route  GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  const u = req.user
  res.json({
    success: true,
    user: { id: u._id, name: u.name, email: u.email, role: u.role, avatar: u.avatar, phone: u.phone, matricule: u.matricule },
    school: u.school || null,
  })
})

// @route  PUT /api/auth/password
router.put('/password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    const user = await User.findById(req.user._id)
    const isMatch = await user.matchPassword(currentPassword)
    if (!isMatch) {
      return res.status(400).json({ message: 'Mot de passe actuel incorrect' })
    }
    user.password = newPassword
    await user.save()
    res.json({ success: true, message: 'Mot de passe mis à jour' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// @route  POST /api/auth/forgot-password — public: réinitialise le mot de passe
// directement à partir de l'email (l'utilisateur saisit uniquement le nouveau mot de passe).
router.post('/forgot-password', async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase()
    const { newPassword } = req.body
    if (!email || !newPassword) {
      return res.status(400).json({ message: 'Email et nouveau mot de passe requis' })
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères' })
    }
    const user = await User.findOne({ email })
    if (!user) {
      return res.status(404).json({ message: 'Aucun compte associé à cet email' })
    }
    if (user.isActive === false) {
      return res.status(403).json({ message: 'Ce compte est désactivé. Contactez l\'administrateur.' })
    }
    user.password = newPassword
    await user.save()
    res.json({ success: true, message: 'Mot de passe réinitialisé. Vous pouvez vous connecter.' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// @route  PUT /api/auth/profile — update basic profile fields
router.put('/profile', protect, async (req, res) => {
  try {
    const { name, phone } = req.body
    const user = await User.findById(req.user._id)
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' })
    if (name !== undefined) user.name = name
    if (phone !== undefined) user.phone = phone
    await user.save()
    res.json({ success: true, user: { id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar, phone: user.phone, matricule: user.matricule } })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// @route  POST /api/auth/avatar — upload avatar image
router.post('/avatar', protect, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file?.path) return res.status(400).json({ message: 'Aucun fichier reçu' })
    const user = await User.findByIdAndUpdate(req.user._id, { avatar: req.file.path }, { new: true })
    res.json({ success: true, user: { id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar, phone: user.phone, matricule: user.matricule } })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router

// Admin/director password reset for a user account (e.g., students created before hashing fix)
// @route  POST /api/auth/admin-reset-password
router.post('/admin-reset-password', protect, async (req, res) => {
  try {
    const actor = req.user
    if (!['super_admin', 'directeur'].includes(actor.role)) {
      return res.status(403).json({ message: 'Accès refusé' })
    }
    const { email } = req.body
    if (!email) return res.status(400).json({ message: 'Email requis' })

    const user = await User.findOne({ email }).populate('school')
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' })

    // Directors can only reset passwords for users in their school
    if (actor.role === 'directeur') {
      const actorSchoolId = actor.school?._id?.toString() || actor.school?.toString()
      const targetSchoolId = user.school?._id?.toString() || user.school?.toString()
      if (!actorSchoolId || !targetSchoolId || actorSchoolId !== targetSchoolId) {
        return res.status(403).json({ message: 'Vous ne pouvez réinitialiser que les comptes de votre école' })
      }
    }

    // Generate a clean password (remove accents/specials) to avoid confusion
    const baseName = (user.name || user.role || 'user')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z]/g, '') || 'user'
    const rawPassword = `${baseName}${Math.floor(10000 + Math.random() * 90000)}`

    user.password = rawPassword
    await user.save()

    // Best-effort email notification
    try {
      await sendEmail({
        to: user.email,
        subject: '🔐 Nouveau mot de passe — KATD-SCHÜLE',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px">
            <h2 style="margin-bottom:8px;color:#111827">Vos identifiants ont été réinitialisés</h2>
            <p style="color:#374151">Bonjour ${user.name || ''},</p>
            <p style="color:#374151">Voici vos nouveaux identifiants :</p>
            <table style="width:100%;font-size:14px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;margin:12px 0">
              <tr><td style="padding:10px 12px;color:#6B7280">Email</td><td style="padding:10px 12px;color:#111827;font-weight:700;text-align:right">${user.email}</td></tr>
              <tr><td style="padding:10px 12px;color:#6B7280">Mot de passe</td><td style="padding:10px 12px;color:#111827;font-weight:700;letter-spacing:1px;text-align:right">${rawPassword}</td></tr>
            </table>
            <p style="color:#6B7280;font-size:12px">Veuillez changer ce mot de passe après votre connexion.</p>
            <div style="margin-top:16px">
              <a href="${process.env.CLIENT_URL || 'https://katd-schule.vercel.app'}/login" style="display:inline-block;background:#2563EB;color:white;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Se connecter</a>
            </div>
          </div>
        `,
      })
    } catch (_) {}

    res.json({ success: true, email: user.email, rawPassword })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})
