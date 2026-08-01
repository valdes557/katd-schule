const express = require('express')
const router = express.Router()
const School = require('../models/School')
const User = require('../models/User')
const SchoolRegistration = require('../models/SchoolRegistration')
const { protect, authorize } = require('../middleware/auth')
const { upload } = require('../config/cloudinary')
const { sendSubscriptionSuspendedEmail, sendSubscriptionReactivatedEmail } = require('../utils/emailService')
const { deleteSchoolCascade } = require('../services/schoolCascade')

// @route  GET /api/schools  (public)
router.get('/', async (req, res) => {
  try {
    const { search, cycle, page = 1, limit = 50 } = req.query
    const query = { isActive: { $ne: false } }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { 'address.city': { $regex: search, $options: 'i' } },
      ]
    }
    if (cycle) query.cycles = { $in: [cycle] }
    const total = await School.countDocuments(query)
    const schools = await School.find(query)
      .select('name slug logo description cycles address stats isValidated subscription')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 })
    res.json({ success: true, total, page: Number(page), data: schools })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// @route  GET /api/schools/mine  (directeur — get own school)
router.get('/mine', protect, async (req, res) => {
  try {
    const school = await School.findOne({ director: req.user._id }).populate('director', 'name email')
    if (!school) return res.status(404).json({ message: 'Aucune école associée' })
    res.json({ success: true, data: school })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// @route  GET /api/schools/access-status  (directeur connecté — exempté du blocage subscription)
// Retourne l'état de l'abonnement de l'école du directeur connecté sans être bloqué
// par le middleware d'expiration (utilisé par le frontend pour afficher les bannières).
router.get('/access-status', protect, async (req, res) => {
  try {
    const school = await School.findOne({ director: req.user._id }).select('subscription name')
    if (!school) return res.json({ hasAccess: false, status: null, daysLeft: null })
    const sub = school.subscription || {}
    const now = new Date()
    const endDate = sub.endDate ? new Date(sub.endDate) : null
    const daysLeft = endDate ? Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)) : null
    const hasAccess = school.hasActiveAccess()
    res.json({
      hasAccess,
      status: sub.status || null,
      plan: sub.plan || null,
      cycle: sub.cycle || null,
      endDate: sub.endDate || null,
      daysLeft,
      schoolName: school.name,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// @route  GET /api/schools/:id  (public)
router.get('/:id', async (req, res) => {
  try {
    const school = await School.findById(req.params.id).populate('director', 'name email')
    if (!school) return res.status(404).json({ message: 'École non trouvée' })
    res.json({ success: true, data: school })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// @route  POST /api/schools  (directeur or super_admin)
router.post('/', protect, authorize('directeur', 'super_admin'), upload.single('logo'), async (req, res) => {
  try {
    const existing = await School.findOne({ director: req.user._id })
    if (existing && req.user.role === 'directeur') {
      return res.status(400).json({ message: 'Vous avez déjà une école enregistrée' })
    }
    const logoUrl = req.file?.path || req.body.logo || ''
    const school = await School.create({
      ...req.body,
      logo: logoUrl,
      director: req.user._id,
    })
    await User.findByIdAndUpdate(req.user._id, { school: school._id })
    res.status(201).json({ success: true, data: school })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// @route  PUT /api/schools/:id  (directeur or super_admin) — supports logo upload
router.put('/:id', protect, authorize('directeur', 'super_admin'), upload.single('logo'), async (req, res) => {
  try {
    const updates = { ...req.body }
    if (req.file?.path) updates.logo = req.file.path
    // Parse nested fields sent as JSON strings from FormData
    if (typeof updates.address === 'string') { try { updates.address = JSON.parse(updates.address) } catch (_) {} }
    if (typeof updates.contact === 'string') { try { updates.contact = JSON.parse(updates.contact) } catch (_) {} }
    if (typeof updates.cycles === 'string') { try { updates.cycles = JSON.parse(updates.cycles) } catch (_) { updates.cycles = [updates.cycles] } }
    if (typeof updates.socials === 'string') { try { updates.socials = JSON.parse(updates.socials) } catch (_) {} }
    if (typeof updates.mobileMoneyAccounts === 'string') { try { updates.mobileMoneyAccounts = JSON.parse(updates.mobileMoneyAccounts) } catch (_) {} }
    if (updates.enrollmentFee !== undefined) updates.enrollmentFee = Number(updates.enrollmentFee) || 0

    const school = await School.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
    if (!school) return res.status(404).json({ message: 'École non trouvée' })
    res.json({ success: true, data: school })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// @route  GET /api/schools/:id/stats  (directeur)
router.get('/:id/stats', protect, async (req, res) => {
  try {
    const school = await School.findById(req.params.id).select('stats subscription')
    if (!school) return res.status(404).json({ message: 'École non trouvée' })
    res.json({ success: true, data: school })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// @route  PUT /api/schools/:id/subscription-status  (super_admin) — activer/désactiver la souscription
// Désactivée → le directeur, les enseignants et les parents de l'école perdent l'accès au dashboard.
router.put('/:id/subscription-status', protect, authorize('super_admin'), async (req, res) => {
  try {
    const active = req.body.active === true || req.body.active === 'true'
    const school = await School.findById(req.params.id).populate('director', 'name email')
    if (!school) return res.status(404).json({ message: 'École non trouvée' })

    school.subscription = school.subscription || {}
    school.subscription.status = active ? 'active' : 'suspended'
    await school.save()

    // Notification email au directeur (best-effort)
    const director = school.director
    if (director?.email) {
      try {
        if (active) {
          await sendSubscriptionReactivatedEmail({ to: director.email, directorName: director.name, schoolName: school.name })
        } else {
          await sendSubscriptionSuspendedEmail({ to: director.email, directorName: director.name, schoolName: school.name })
        }
      } catch (_) {}
    }

    res.json({
      success: true,
      message: active ? 'Souscription réactivée. Le directeur a été notifié par email.' : 'Souscription désactivée. Le directeur a été notifié par email.',
      data: school,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// @route  DELETE /api/schools/:id  (super_admin)
// Supprime l'école EN CASCADE : compte directeur, enseignants, élèves, classes,
// notes, wallets, messages... (voir services/schoolCascade.js). Libère tous les
// emails pour qu'ils puissent être réutilisés (nouvelle école, mêmes enseignants).
router.delete('/:id', protect, authorize('super_admin'), async (req, res) => {
  try {
    const result = await deleteSchoolCascade(req.params.id)
    if (!result) return res.status(404).json({ message: 'École non trouvée' })

    console.log(`[schoolCascade] École ${req.params.id} supprimée :`, JSON.stringify(result.deleted))
    if (result.errors.length) console.error('[schoolCascade] Erreurs :', result.errors)

    res.json({
      success: true,
      message: 'École, comptes liés (directeur, enseignants, élèves...) et toutes les données associées supprimés. Les emails sont de nouveau disponibles.',
      data: { deleted: result.deleted, errors: result.errors },
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
