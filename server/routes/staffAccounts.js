const express = require('express')
const router = express.Router()
const User = require('../models/User')
const { protect, authorize } = require('../middleware/auth')
const { generateUserMatricule } = require('../utils/matricule')
const wallet = require('../services/walletService')
const { sendEmail } = require('../utils/emailService')

// Rôles administratifs du cycle Secondaire, créés par le principal (directeur)
const ADMIN_ROLES = ['vice_principal', 'surveillant_general', 'caissiere', 'secretaire', 'portier']

const ROLE_LABELS = {
  vice_principal: 'Vice-Principal',
  surveillant_general: 'Surveillant Général',
  caissiere: 'Caissière',
  secretaire: 'Secrétaire',
  portier: 'Portier',
}

function generatePassword() {
  return `katd${Math.floor(10000 + Math.random() * 90000)}`
}

// Email d'identifiants (best-effort)
async function sendCredentialsEmail({ email, name, roleLabel, rawPassword, matricule }) {
  const loginUrl = `${process.env.CLIENT_URL || 'https://katdschool.com'}/login`
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
      <h2 style="color:#4f46e5">KATD-SCHÜLE — Votre compte ${roleLabel}</h2>
      <p>Bonjour ${name},</p>
      <p>Un compte <strong>${roleLabel}</strong> a été créé pour vous sur la plateforme KATD-SCHÜLE.</p>
      <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0">
        <p style="margin:4px 0"><strong>Email :</strong> ${email}</p>
        <p style="margin:4px 0"><strong>Mot de passe :</strong> ${rawPassword}</p>
        <p style="margin:4px 0"><strong>Matricule :</strong> ${matricule}</p>
      </div>
      <p><a href="${loginUrl}" style="background:#4f46e5;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">Se connecter (onglet École)</a></p>
      <p style="color:#6b7280;font-size:13px">Pensez à changer votre mot de passe après la première connexion.</p>
    </div>`
  return sendEmail({ to: email, subject: `KATD-SCHÜLE — Votre compte ${roleLabel}`, html })
}

// GET /api/staff-accounts — liste des membres administratifs de l'école
router.get('/', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const schoolId = req.user.role === 'super_admin' ? (req.query.schoolId || req.user.school?._id) : (req.user.school?._id || req.user.school)
    if (!schoolId) return res.json({ success: true, data: [] })
    const members = await User.find({ school: schoolId, role: { $in: ADMIN_ROLES } })
      .select('name email phone role matricule isActive isOnline lastLogin createdAt')
      .sort({ role: 1, name: 1 })
    res.json({ success: true, data: members })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/staff-accounts — le principal crée un membre administratif (identifiants générés)
router.post('/', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const schoolId = req.user.school?._id || req.user.school
    if (!schoolId) return res.status(400).json({ message: 'Aucune école associée' })
    const { role, firstName, lastName, phone, gender, password } = req.body
    const email = (req.body.email || '').trim().toLowerCase()

    if (!ADMIN_ROLES.includes(role)) {
      return res.status(400).json({ message: `Rôle invalide. Rôles autorisés : ${ADMIN_ROLES.join(', ')}` })
    }
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ message: 'Nom, prénom et email sont requis' })
    }

    const existing = await User.findOne({ email })
    if (existing) return res.status(400).json({ message: 'Cet email est déjà utilisé' })

    const rawPassword = password || generatePassword()
    const matricule = await generateUserMatricule(role, schoolId)
    const user = await User.create({
      name: `${lastName} ${firstName}`,
      email,
      password: rawPassword,
      role,
      school: schoolId,
      phone,
      matricule,
    })

    // Portefeuille créé dès l'enregistrement (comme pour les enseignants)
    try { await wallet.getOrCreateWallet(user._id, { role, school: schoolId }) } catch (e) { console.error('wallet membre admin:', e.message) }

    // Email des identifiants (best-effort)
    let emailSent = false
    try {
      const r = await sendCredentialsEmail({ email, name: `${lastName} ${firstName}`, roleLabel: ROLE_LABELS[role] || role, rawPassword, matricule })
      emailSent = !!r?.success
    } catch (e) { console.error('email membre admin:', e.message) }

    // Lien WhatsApp pour transmettre les identifiants
    const phoneDigits = (phone || '').replace(/\D/g, '')
    const waText = [
      `*KATD-SCHÜLE — Compte ${ROLE_LABELS[role] || role}*`,
      ``,
      `Bonjour ${lastName} ${firstName},`,
      `Votre compte a été créé sur la plateforme KATD-SCHÜLE.`,
      ``,
      `🔐 Identifiants de connexion`,
      `• Email : ${email}`,
      `• Mot de passe : ${rawPassword}`,
      `• Matricule : ${matricule}`,
      ``,
      `🚀 Connectez-vous (onglet École) : ${(process.env.CLIENT_URL || 'https://katdschool.com')}/login`,
    ].join('\n')
    const whatsappLink = phoneDigits ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(waText)}` : null

    res.status(201).json({
      success: true,
      data: user,
      credentials: { email, password: rawPassword, matricule },
      emailSent,
      whatsappLink,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// Garde : le membre doit appartenir à l'école du principal
async function findMemberScoped(req) {
  const member = await User.findById(req.params.id)
  if (!member || !ADMIN_ROLES.includes(member.role)) return null
  if (req.user.role !== 'super_admin') {
    const schoolId = String(req.user.school?._id || req.user.school || '')
    if (String(member.school || '') !== schoolId) return null
  }
  return member
}

// PUT /api/staff-accounts/:id — modifier nom/téléphone/rôle
router.put('/:id', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const member = await findMemberScoped(req)
    if (!member) return res.status(404).json({ message: 'Membre non trouvé' })
    const { name, phone, role } = req.body
    if (role) {
      if (!ADMIN_ROLES.includes(role)) return res.status(400).json({ message: 'Rôle invalide' })
      member.role = role
    }
    if (name) member.name = name
    if (phone !== undefined) member.phone = phone
    await member.save()
    res.json({ success: true, data: member })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/staff-accounts/:id/toggle-active — bloquer/débloquer
router.put('/:id/toggle-active', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const member = await findMemberScoped(req)
    if (!member) return res.status(404).json({ message: 'Membre non trouvé' })
    member.isActive = member.isActive === false ? true : false
    await member.save()
    res.json({ success: true, data: { _id: member._id, isActive: member.isActive } })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/staff-accounts/:id/reset-password — regénère un mot de passe
router.post('/:id/reset-password', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const member = await findMemberScoped(req)
    if (!member) return res.status(404).json({ message: 'Membre non trouvé' })
    const rawPassword = req.body.password || generatePassword()
    member.password = rawPassword
    await member.save()
    let emailSent = false
    try {
      const r = await sendCredentialsEmail({
        email: member.email, name: member.name,
        roleLabel: ROLE_LABELS[member.role] || member.role,
        rawPassword, matricule: member.matricule || '',
      })
      emailSent = !!r?.success
    } catch (e) { console.error('email reset membre admin:', e.message) }
    res.json({ success: true, credentials: { email: member.email, password: rawPassword }, emailSent })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/staff-accounts/:id — suppression (User + Wallet)
router.delete('/:id', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const member = await findMemberScoped(req)
    if (!member) return res.status(404).json({ message: 'Membre non trouvé' })
    try {
      const Wallet = require('../models/Wallet')
      await Wallet.deleteOne({ user: member._id })
    } catch (e) { console.error('suppression wallet membre:', e.message) }
    await member.deleteOne()
    res.json({ success: true, message: 'Membre supprimé' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
