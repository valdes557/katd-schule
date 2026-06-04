const express = require('express')
const router = express.Router()
const SchoolRegistration = require('../models/SchoolRegistration')
const School = require('../models/School')
const User = require('../models/User')
const Location = require('../models/Location')
const { protect, authorize } = require('../middleware/auth')
const { sendEmail } = require('../utils/emailService')
const { upload } = require('../config/cloudinary')

// POST /api/school-registrations — Public: submit school registration
router.post('/', upload.single('paymentProof'), async (req, res) => {
  try {
    const { cycle, plan, amount, schoolName, directorName, country, city, neighborhood, whatsapp, email } = req.body

    if (!cycle || !plan || !amount || !schoolName || !directorName || !country || !city || !whatsapp || !email) {
      return res.status(400).json({ message: 'Tous les champs obligatoires doivent être remplis' })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Veuillez fournir un email valide' })
    }

    const existing = await SchoolRegistration.findOne({ email, status: 'pending' })
    if (existing) {
      return res.status(400).json({ message: 'Vous avez déjà une demande en attente' })
    }

    const countryDoc = await Location.findById(country)
    const cityDoc = await Location.findById(city)
    const neighborhoodDoc = neighborhood ? await Location.findById(neighborhood) : null

    const paymentProof = req.file?.path || ''

    const registration = await SchoolRegistration.create({
      cycle, plan, amount: Number(amount), schoolName, directorName,
      country, city,
      neighborhood: neighborhood || undefined,
      countryName: countryDoc?.name || '',
      cityName: cityDoc?.name || '',
      neighborhoodName: neighborhoodDoc?.name || '',
      paymentProof,
      whatsapp, email,
    })

    // Notify super_admin by email
    try {
      const admin = await User.findOne({ role: 'super_admin' })
      if (admin?.email) {
        const planLabel = plan === 'annual' ? 'Annuel' : 'Trimestriel'
        const dashboardUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard/demandes-ecoles`
        await sendEmail({
          to: admin.email,
          subject: `📋 Nouvelle demande de souscription — ${schoolName} | KATD-SCHÜLE`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
              <div style="background:linear-gradient(135deg,#2563EB,#4F46E5);padding:28px;border-radius:12px 12px 0 0;text-align:center">
                <h1 style="color:white;margin:0;font-size:22px">KATD-SCHÜLE</h1>
                <p style="color:#BFDBFE;margin-top:6px;font-size:14px">Nouvelle demande de souscription</p>
              </div>
              <div style="background:#F9FAFB;padding:28px;border:1px solid #E5E7EB;border-top:0;border-radius:0 0 12px 12px">
                <p style="color:#374151;font-size:15px">Une nouvelle demande vient d'être soumise :</p>
                <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
                  <tr><td style="padding:8px 0;color:#6B7280">École</td><td style="padding:8px 0;color:#111827;font-weight:600;text-align:right">${schoolName}</td></tr>
                  <tr><td style="padding:8px 0;color:#6B7280">Directeur</td><td style="padding:8px 0;color:#111827;text-align:right">${directorName}</td></tr>
                  <tr><td style="padding:8px 0;color:#6B7280">Cycle</td><td style="padding:8px 0;color:#111827;text-align:right">${cycle}</td></tr>
                  <tr><td style="padding:8px 0;color:#6B7280">Plan</td><td style="padding:8px 0;color:#111827;font-weight:600;text-align:right">${planLabel}</td></tr>
                  <tr><td style="padding:8px 0;color:#6B7280">Montant</td><td style="padding:8px 0;color:#059669;font-weight:700;text-align:right">${Number(amount).toLocaleString()} F CFA</td></tr>
                  <tr><td style="padding:8px 0;color:#6B7280">Contact</td><td style="padding:8px 0;color:#111827;text-align:right">${whatsapp} · ${email}</td></tr>
                  <tr><td style="padding:8px 0;color:#6B7280">Preuve de paiement</td><td style="padding:8px 0;text-align:right">${paymentProof ? '<span style="color:#059669">✅ Jointe</span>' : '<span style="color:#DC2626">❌ Non fournie</span>'}</td></tr>
                </table>
                <a href="${dashboardUrl}" style="display:inline-block;background:#2563EB;color:white;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;margin-top:8px">
                  📂 Voir dans le dashboard →
                </a>
              </div>
            </div>
          `,
        })
      }
    } catch (_) {}

    res.status(201).json({
      success: true,
      message: 'Votre demande a été envoyée avec succès ! Vous serez contacté via WhatsApp et email.',
      data: registration,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: err.message })
  }
})

// GET /api/school-registrations — Super admin: list all
router.get('/', protect, authorize('super_admin'), async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query
    const query = status ? { status } : {}

    const total = await SchoolRegistration.countDocuments(query)
    const registrations = await SchoolRegistration.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))

    res.json({ success: true, total, data: registrations })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/school-registrations/:id/approve — Super admin approves
router.put('/:id/approve', protect, authorize('super_admin'), async (req, res) => {
  try {
    const reg = await SchoolRegistration.findById(req.params.id)
    if (!reg) return res.status(404).json({ message: 'Demande non trouvée' })
    if (reg.status !== 'pending') return res.status(400).json({ message: 'Demande déjà traitée' })

    // Create school
    const school = await School.create({
      name: reg.schoolName,
      cycles: [reg.cycle],
      address: { city: reg.cityName, neighborhood: reg.neighborhoodName, country: reg.countryName },
      phone: reg.whatsapp,
      email: reg.email,
      isValidated: true,
      isActive: true,
      subscription: {
        cycle: reg.cycle,
        plan: reg.plan === 'annual' ? 'annual' : 'quarterly',
        status: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + (reg.plan === 'annual' ? 365 : 90) * 24 * 60 * 60 * 1000),
        amount: reg.amount,
      },
    })

    // Clean up any leftover User with this email (e.g. from a failed previous revoke)
    await User.findOneAndDelete({ email: reg.email })

    // Create director user account (pre-save hook in User model handles hashing)
    const rawPassword = `katd${Math.floor(10000 + Math.random() * 90000)}`

    const user = await User.create({
      name: reg.directorName,
      email: reg.email,
      password: rawPassword,
      role: 'directeur',
      school: school._id,
      phone: reg.whatsapp,
      isActive: true,
    })

    // Update school with director
    school.director = user._id
    await school.save()

    // Update registration
    reg.status = 'approved'
    reg.approvedAt = new Date()
    reg.approvedBy = req.user._id
    reg.schoolCreated = school._id
    reg.userCreated = user._id
    await reg.save()

    // Send email with receipt + credentials IMMEDIATELY
    const planLabel = reg.plan === 'annual' ? 'Annuel' : 'Trimestriel'
    const receiptNumber = `KATD-${Date.now().toString(36).toUpperCase()}`
    const approvalDate = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const endDate = new Date(Date.now() + (reg.plan === 'annual' ? 365 : 90) * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR')

    const emailResult = await sendEmail({
      to: reg.email,
      subject: `✅ Souscription approuvée — ${reg.schoolName} | KATD-SCHÜLE`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #2563EB, #4F46E5); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">KATD-SCHÜLE</h1>
            <p style="color: #BFDBFE; margin-top: 8px;">Souscription Approuvée ✓</p>
          </div>
          <div style="background: #F9FAFB; padding: 30px; border: 1px solid #E5E7EB; border-top: 0; border-radius: 0 0 12px 12px;">
            <h2 style="color: #111827; font-size: 18px; margin-bottom: 20px;">Félicitations ${reg.directorName} !</h2>
            <p style="color: #4B5563;">Votre école <strong>${reg.schoolName}</strong> a été enregistrée avec succès sur la plateforme KATD-SCHÜLE.</p>
            
            <div style="background: white; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 2px solid #2563EB; padding-bottom: 10px;">
                <h3 style="color: #374151; margin: 0; font-size: 14px; text-transform: uppercase;">📋 REÇU DE SOUSCRIPTION</h3>
                <span style="color: #6B7280; font-size: 11px;">N° ${receiptNumber}</span>
              </div>
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr><td style="padding: 8px 0; color: #6B7280;">Date d'approbation</td><td style="padding: 8px 0; color: #111827; text-align: right;">${approvalDate}</td></tr>
                <tr><td style="padding: 8px 0; color: #6B7280;">Établissement</td><td style="padding: 8px 0; color: #111827; font-weight: 600; text-align: right;">${reg.schoolName}</td></tr>
                <tr><td style="padding: 8px 0; color: #6B7280;">Directeur</td><td style="padding: 8px 0; color: #111827; text-align: right;">${reg.directorName}</td></tr>
                <tr><td style="padding: 8px 0; color: #6B7280;">Cycle</td><td style="padding: 8px 0; color: #111827; text-align: right;">${reg.cycle}</td></tr>
                <tr><td style="padding: 8px 0; color: #6B7280;">Plan choisi</td><td style="padding: 8px 0; color: #2563EB; font-weight: 600; text-align: right;">${planLabel}</td></tr>
                <tr><td style="padding: 8px 0; color: #6B7280;">Validité</td><td style="padding: 8px 0; color: #111827; text-align: right;">Jusqu'au ${endDate}</td></tr>
                <tr><td style="padding: 8px 0; color: #6B7280;">Localisation</td><td style="padding: 8px 0; color: #111827; text-align: right;">${reg.neighborhoodName ? reg.neighborhoodName + ', ' : ''}${reg.cityName}, ${reg.countryName}</td></tr>
                <tr style="border-top: 2px solid #E5E7EB;"><td style="padding: 12px 0; color: #6B7280; font-weight: 600;">MONTANT PAYÉ</td><td style="padding: 12px 0; color: #059669; font-weight: 700; font-size: 18px; text-align: right;">${reg.amount.toLocaleString()} F CFA</td></tr>
              </table>
            </div>

            <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #1E40AF; margin-top: 0; font-size: 14px;">🔐 Vos identifiants de connexion</h3>
              <p style="color: #4B5563; font-size: 13px; margin-bottom: 15px;">Utilisez ces identifiants pour vous connecter à votre tableau de bord directeur :</p>
              <table style="width: 100%; font-size: 14px; background: white; border-radius: 6px; padding: 12px;">
                <tr><td style="padding: 8px 12px; color: #4B5563;">Email</td><td style="padding: 8px 12px; color: #111827; font-weight: 700; font-size: 15px;">${reg.email}</td></tr>
                <tr><td style="padding: 8px 12px; color: #4B5563;">Mot de passe</td><td style="padding: 8px 12px; color: #111827; font-weight: 700; font-size: 15px; letter-spacing: 1px;">${rawPassword}</td></tr>
              </table>
              <p style="color: #DC2626; font-size: 12px; margin-bottom: 0; margin-top: 12px; font-weight: 600;">⚠️ Important : Changez votre mot de passe après votre première connexion pour sécuriser votre compte.</p>
            </div>

            <div style="text-align: center; margin-top: 25px;">
              <a href="${process.env.CLIENT_URL || 'https://katd-schule.vercel.app'}/login" style="display: inline-block; background: linear-gradient(135deg, #2563EB, #4F46E5); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600;">
                🚀 Accéder à mon espace directeur
              </a>
            </div>

            <p style="color: #9CA3AF; font-size: 12px; margin-top: 25px; text-align: center; border-top: 1px solid #E5E7EB; padding-top: 15px;">
              Conservez cet email comme preuve de paiement.<br/>
              Pour toute question, contactez-nous à <a href="mailto:${process.env.SMTP_USER || 'support@katd-schule.com'}" style="color: #2563EB;">${process.env.SMTP_USER || 'support@katd-schule.com'}</a>
            </p>
          </div>
          <p style="text-align: center; color: #9CA3AF; font-size: 11px; margin-top: 20px;">© ${new Date().getFullYear()} KATD-SCHÜLE — Plateforme de gestion scolaire</p>
        </div>
      `,
    })

    // ─── Send admin confirmation email (async, non-blocking) ───
    try {
      const adminEmail = req.user.email
      const dashboardUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard/demandes-ecoles`
      sendEmail({
        to: adminEmail,
        subject: `✅ Souscription approuvée — ${reg.schoolName} | KATD-SCHÜLE`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <div style="background:linear-gradient(135deg,#059669,#10B981);padding:24px;border-radius:12px 12px 0 0;text-align:center">
              <h1 style="color:white;margin:0;font-size:22px">✅ Approbation effectuée</h1>
              <p style="color:#D1FAE5;margin-top:6px;font-size:13px">KATD-SCHÜLE — Confirmation administrateur</p>
            </div>
            <div style="background:#F9FAFB;padding:24px;border:1px solid #E5E7EB;border-top:0;border-radius:0 0 12px 12px">
              <p style="color:#374151;font-size:15px">Bonjour <strong>${req.user.name || 'Administrateur'}</strong>,</p>
              <p style="color:#4B5563;font-size:14px">La demande de souscription envoyée par <strong>${reg.directorName}</strong> pour l'école <strong>${reg.schoolName}</strong> a été approuvée avec succès.</p>
              <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:8px;padding:14px;margin:16px 0;font-size:13px">
                <strong style="color:#065F46">📧 Email envoyé au directeur :</strong> ${emailResult.success ? '<span style="color:#059669">✓ Identifiants et reçu transmis</span>' : '<span style="color:#DC2626">✗ Échec — voir détails ci-dessous</span>'}
              </div>
              <table style="width:100%;border-collapse:collapse;font-size:13px;margin:12px 0">
                <tr><td style="padding:6px 0;color:#6B7280">N° Reçu</td><td style="padding:6px 0;color:#111827;text-align:right;font-family:monospace">${receiptNumber}</td></tr>
                <tr><td style="padding:6px 0;color:#6B7280">École</td><td style="padding:6px 0;color:#111827;font-weight:600;text-align:right">${reg.schoolName}</td></tr>
                <tr><td style="padding:6px 0;color:#6B7280">Directeur</td><td style="padding:6px 0;color:#111827;text-align:right">${reg.directorName}</td></tr>
                <tr><td style="padding:6px 0;color:#6B7280">Email directeur</td><td style="padding:6px 0;color:#2563EB;text-align:right">${reg.email}</td></tr>
                <tr><td style="padding:6px 0;color:#6B7280">Cycle</td><td style="padding:6px 0;color:#111827;text-align:right">${reg.cycle}</td></tr>
                <tr><td style="padding:6px 0;color:#6B7280">Plan</td><td style="padding:6px 0;color:#7C3AED;font-weight:600;text-align:right">${planLabel}</td></tr>
                <tr><td style="padding:6px 0;color:#6B7280">Validité</td><td style="padding:6px 0;color:#111827;text-align:right">Jusqu'au ${endDate}</td></tr>
                <tr style="border-top:2px solid #E5E7EB"><td style="padding:10px 0;color:#6B7280;font-weight:600">MONTANT</td><td style="padding:10px 0;color:#059669;font-weight:700;font-size:16px;text-align:right">${reg.amount.toLocaleString()} F CFA</td></tr>
              </table>
              <div style="text-align:center;margin-top:18px">
                <a href="${dashboardUrl}" style="display:inline-block;background:#2563EB;color:white;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:13px;font-weight:600">📂 Voir dans le dashboard</a>
              </div>
            </div>
          </div>
        `,
      }).catch(() => {})
    } catch (_) {}

    // Build WhatsApp link with receipt + credentials
    const phoneDigits = (reg.whatsapp || '').replace(/\D/g, '')
    const waText = [
      `*KATD-SCHÜLE — Souscription approuvée ✅*`,
      ``,
      `Bonjour *${reg.directorName}*,`,
      `Votre école *${reg.schoolName}* a été enregistrée avec succès.`,
      ``,
      `📋 *Reçu N° ${receiptNumber}*`,
      `• Cycle : ${reg.cycle}`,
      `• Plan : ${planLabel}`,
      `• Validité : jusqu'au ${endDate}`,
      `• Montant payé : ${reg.amount.toLocaleString()} F CFA`,
      ``,
      `🔐 *Identifiants de connexion*`,
      `• Email : ${reg.email}`,
      `• Mot de passe : ${rawPassword}`,
      ``,
      `🚀 Connectez-vous : ${process.env.CLIENT_URL || 'https://katd-schule.vercel.app'}/login`,
      ``,
      `⚠️ Changez votre mot de passe après votre première connexion.`,
    ].join('\n')
    const whatsappLink = phoneDigits ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(waText)}` : null

    res.json({
      success: true,
      message: emailResult.success
        ? '✅ Souscription approuvée. Email avec reçu et identifiants envoyé au directeur.'
        : 'Souscription approuvée. Compte créé mais l\'email n\'a pas pu être envoyé : ' + (emailResult.error || 'erreur inconnue'),
      emailSent: emailResult.success,
      whatsappLink,
      data: { registration: reg, school, user: { ...user.toObject(), rawPassword }, whatsappLink },
    })
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Un compte avec cet email existe déjà' })
    console.error(err)
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/school-registrations/:id/reject — Super admin rejects
router.put('/:id/reject', protect, authorize('super_admin'), async (req, res) => {
  try {
    const reg = await SchoolRegistration.findById(req.params.id)
    if (!reg) return res.status(404).json({ message: 'Demande non trouvée' })
    if (reg.status !== 'pending') return res.status(400).json({ message: 'Demande déjà traitée' })

    reg.status = 'rejected'
    reg.rejectionReason = req.body.reason || ''
    await reg.save()

    await sendEmail({
      to: reg.email,
      subject: `❌ Souscription non approuvée | KATD-SCHÜLE`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #DC2626; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">KATD-SCHÜLE</h1>
          </div>
          <div style="background: #F9FAFB; padding: 24px; border: 1px solid #E5E7EB; border-radius: 0 0 12px 12px;">
            <p>Bonjour ${reg.directorName},</p>
            <p>Votre demande de souscription pour <strong>${reg.schoolName}</strong> n'a pas été approuvée.</p>
            ${req.body.reason ? `<p style="background: #FEF2F2; padding: 12px; border-radius: 8px; color: #991B1B;"><strong>Motif :</strong> ${req.body.reason}</p>` : ''}
            <p style="color: #6B7280; font-size: 13px;">Contactez-nous pour plus d'informations.</p>
          </div>
        </div>
      `,
    })

    res.json({ success: true, message: 'Demande rejetée', data: reg })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: err.message })
  }
})

// POST /api/school-registrations/:id/resend-credentials — Resend email with new password
router.post('/:id/resend-credentials', protect, authorize('super_admin'), async (req, res) => {
  try {
    const reg = await SchoolRegistration.findById(req.params.id)
    if (!reg) return res.status(404).json({ message: 'Demande non trouvée' })
    if (reg.status !== 'approved') return res.status(400).json({ message: 'La demande n\'est pas approuvée' })

    const user = await User.findById(reg.userCreated)
    if (!user) return res.status(404).json({ message: 'Compte directeur introuvable' })

    // Generate a new password
    const rawPassword = `katd${Math.floor(10000 + Math.random() * 90000)}`
    user.password = rawPassword
    await user.save()

    const planLabel = reg.plan === 'annual' ? 'Annuel' : 'Trimestriel'
    const emailResult = await sendEmail({
      to: reg.email,
      subject: `🔑 Nouveaux identifiants de connexion — ${reg.schoolName} | KATD-SCHÜLE`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <div style="background:linear-gradient(135deg,#2563EB,#4F46E5);padding:28px;border-radius:12px 12px 0 0;text-align:center">
            <h1 style="color:white;margin:0">KATD-SCHÜLE</h1>
            <p style="color:#BFDBFE;margin-top:6px;font-size:14px">Réinitialisation des identifiants</p>
          </div>
          <div style="background:#F9FAFB;padding:28px;border:1px solid #E5E7EB;border-top:0;border-radius:0 0 12px 12px">
            <p style="color:#374151">Bonjour <strong>${reg.directorName}</strong>,</p>
            <p style="color:#4B5563;font-size:14px">Vos identifiants de connexion pour <strong>${reg.schoolName}</strong> ont été réinitialisés :</p>
            <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:20px;margin:16px 0">
              <h3 style="color:#1E40AF;margin-top:0;font-size:14px">🔐 Nouveaux identifiants</h3>
              <table style="width:100%;font-size:14px">
                <tr><td style="padding:8px 0;color:#4B5563">Email</td><td style="padding:8px 0;color:#111827;font-weight:700">${reg.email}</td></tr>
                <tr><td style="padding:8px 0;color:#4B5563">Nouveau mot de passe</td><td style="padding:8px 0;color:#111827;font-weight:700;letter-spacing:1px">${rawPassword}</td></tr>
              </table>
              <p style="color:#DC2626;font-size:12px;margin:12px 0 0;font-weight:600">⚠️ Changez ce mot de passe après connexion.</p>
            </div>
            <div style="text-align:center;margin-top:20px">
              <a href="${process.env.CLIENT_URL || 'https://katd-schule.vercel.app'}/login" style="display:inline-block;background:linear-gradient(135deg,#2563EB,#4F46E5);color:white;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600">🚀 Accéder à mon espace</a>
            </div>
          </div>
        </div>
      `,
    })

    // Build WhatsApp link with new credentials
    const phoneDigits = (reg.whatsapp || '').replace(/\D/g, '')
    const waText = [
      `*KATD-SCHÜLE — Réinitialisation des identifiants 🔑*`,
      ``,
      `Bonjour *${reg.directorName}*,`,
      `Vos identifiants pour *${reg.schoolName}* ont été réinitialisés :`,
      ``,
      `🔐 *Nouveaux identifiants*`,
      `• Email : ${reg.email}`,
      `• Mot de passe : ${rawPassword}`,
      ``,
      `🚀 Connectez-vous : ${process.env.CLIENT_URL || 'https://katd-schule.vercel.app'}/login`,
      ``,
      `⚠️ Changez ce mot de passe après connexion.`,
    ].join('\n')
    const whatsappLink = phoneDigits ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(waText)}` : null

    res.json({
      success: true,
      emailSent: emailResult.success,
      rawPassword,
      whatsappLink,
      message: emailResult.success
        ? 'Nouveaux identifiants envoyés par email.'
        : 'Mot de passe réinitialisé mais email non envoyé : ' + (emailResult.error || 'erreur'),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/school-registrations/:id/revoke — Revoke: delete User + School + Registration
router.delete('/:id/revoke', protect, authorize('super_admin'), async (req, res) => {
  try {
    const reg = await SchoolRegistration.findById(req.params.id)
    if (!reg) return res.status(404).json({ message: 'Demande non trouvée' })

    // Delete user by email (primary — guarantees removal even if userCreated ref is missing)
    await User.findOneAndDelete({ email: reg.email })
    // Also delete by ID just in case email changed
    if (reg.userCreated) await User.findByIdAndDelete(reg.userCreated)

    // Delete school
    if (reg.schoolCreated) {
      const School = require('../models/School')
      await School.findByIdAndDelete(reg.schoolCreated)
    }

    // Delete ALL registrations with this email (approved or otherwise) to allow clean resubmission
    await SchoolRegistration.deleteMany({ email: reg.email })

    res.json({ success: true, message: 'Compte directeur, école et tous les dossiers liés à cet email ont été supprimés. Une nouvelle souscription peut être soumise.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/school-registrations/:id — Super admin deletes pending/rejected record only
router.delete('/:id', protect, authorize('super_admin'), async (req, res) => {
  try {
    const reg = await SchoolRegistration.findByIdAndDelete(req.params.id)
    if (!reg) return res.status(404).json({ message: 'Demande non trouvée' })
    res.json({ success: true, message: 'Demande supprimée' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
