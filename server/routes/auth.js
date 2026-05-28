const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const { body, validationResult } = require('express-validator')
const User = require('../models/User')
const { protect } = require('../middleware/auth')

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

      user.lastLogin = new Date()
      await user.save({ validateBeforeSave: false })

      const token = generateToken(user._id)

      res.json({
        success: true,
        token,
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
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
    user: { id: u._id, name: u.name, email: u.email, role: u.role },
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

module.exports = router
