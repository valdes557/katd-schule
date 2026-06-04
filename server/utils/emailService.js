const nodemailer = require('nodemailer')

if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
  console.warn('⚠️  SMTP_USER / SMTP_PASS non configurés. Les emails ne seront pas envoyés.')
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: (process.env.SMTP_PASS || '').replace(/\s/g, ''),
  },
  tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
})

// Verify SMTP connection at startup
if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter.verify((err) => {
    if (err) {
      console.error('❌ SMTP connexion échouée:', err.message)
      console.error('   → Vérifiez SMTP_USER, SMTP_PASS, et que Gmail autorise les apps tierces (2FA + App Password)')
    } else {
      console.log('✅ SMTP prêt — emails activés pour:', process.env.SMTP_USER)
    }
  })
}

const sendEmail = async ({ to, subject, html }) => {
  try {
    const info = await transporter.sendMail({
      from: `"KATD-SCHÜLE" <${process.env.SMTP_USER || 'noreply@katd-schule.com'}>`,
      to,
      subject,
      html,
    })
    console.log('📧 Email envoyé:', info.messageId)
    return { success: true, messageId: info.messageId }
  } catch (err) {
    console.error('❌ Email error:', err.message)
    return { success: false, error: err.message }
  }
}

const sendEnrollmentApprovalEmail = async ({ enrollment, student, credentials }) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #2563EB, #4F46E5); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">KATD-SCHÜLE</h1>
        <p style="color: #BFDBFE; margin-top: 8px;">Inscription Approuvée ✓</p>
      </div>
      <div style="background: #F9FAFB; padding: 30px; border: 1px solid #E5E7EB; border-top: 0; border-radius: 0 0 12px 12px;">
        <h2 style="color: #111827; font-size: 18px; margin-bottom: 20px;">
          Félicitations ${enrollment.firstName} ${enrollment.lastName} !
        </h2>
        <p style="color: #4B5563; line-height: 1.6;">
          Votre demande d'inscription a été <strong style="color: #059669;">approuvée</strong> par le directeur de l'établissement.
        </p>
        
        <div style="background: white; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #374151; margin-top: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">📋 Reçu d'inscription</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 8px 0; color: #6B7280;">Nom complet</td><td style="padding: 8px 0; color: #111827; font-weight: 600; text-align: right;">${enrollment.lastName} ${enrollment.firstName}</td></tr>
            <tr><td style="padding: 8px 0; color: #6B7280;">Date de naissance</td><td style="padding: 8px 0; color: #111827; text-align: right;">${new Date(enrollment.dateOfBirth).toLocaleDateString('fr-FR')}</td></tr>
            <tr><td style="padding: 8px 0; color: #6B7280;">Lieu de naissance</td><td style="padding: 8px 0; color: #111827; text-align: right;">${enrollment.placeOfBirth}</td></tr>
            <tr><td style="padding: 8px 0; color: #6B7280;">Sexe</td><td style="padding: 8px 0; color: #111827; text-align: right;">${enrollment.gender === 'M' ? 'Masculin' : 'Féminin'}</td></tr>
            <tr style="border-top: 1px solid #E5E7EB;"><td style="padding: 8px 0; color: #6B7280;">Classe</td><td style="padding: 8px 0; color: #111827; font-weight: 600; text-align: right;">${enrollment.className}</td></tr>
            <tr><td style="padding: 8px 0; color: #6B7280;">Montant payé</td><td style="padding: 8px 0; color: #059669; font-weight: 700; text-align: right;">${enrollment.amount.toLocaleString()} F CFA</td></tr>
            <tr style="border-top: 1px solid #E5E7EB;"><td style="padding: 8px 0; color: #6B7280;">Matricule</td><td style="padding: 8px 0; color: #2563EB; font-weight: 700; text-align: right;">${student.matricule}</td></tr>
          </table>
        </div>

        <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #1E40AF; margin-top: 0; font-size: 14px;">🔐 Vos identifiants de connexion</h3>
          <table style="width: 100%; font-size: 14px;">
            <tr><td style="padding: 6px 0; color: #4B5563;">Email</td><td style="padding: 6px 0; color: #111827; font-weight: 600;">${credentials.email}</td></tr>
            <tr><td style="padding: 6px 0; color: #4B5563;">Mot de passe</td><td style="padding: 6px 0; color: #111827; font-weight: 600;">${credentials.password}</td></tr>
          </table>
          <p style="color: #6B7280; font-size: 12px; margin-bottom: 0; margin-top: 12px;">
            ⚠️ Changez votre mot de passe après votre première connexion.
          </p>
        </div>

        <p style="color: #6B7280; font-size: 13px; line-height: 1.6;">
          Connectez-vous à votre espace élève pour consulter vos cours, notes et emploi du temps.
        </p>
        
        <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/login" style="display: inline-block; background: #2563EB; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; margin-top: 10px;">
          Accéder à mon espace
        </a>
      </div>
      <p style="text-align: center; color: #9CA3AF; font-size: 11px; margin-top: 20px;">
        © ${new Date().getFullYear()} KATD-SCHÜLE — Plateforme de gestion scolaire
      </p>
    </div>
  `

  return sendEmail({
    to: enrollment.email,
    subject: `✅ Inscription approuvée — ${enrollment.className} | KATD-SCHÜLE`,
    html,
  })
}

const sendEnrollmentRejectionEmail = async ({ enrollment, reason }) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #DC2626, #B91C1C); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">KATD-SCHÜLE</h1>
        <p style="color: #FECACA; margin-top: 8px;">Inscription non approuvée</p>
      </div>
      <div style="background: #F9FAFB; padding: 30px; border: 1px solid #E5E7EB; border-top: 0; border-radius: 0 0 12px 12px;">
        <h2 style="color: #111827; font-size: 18px;">Bonjour ${enrollment.firstName},</h2>
        <p style="color: #4B5563; line-height: 1.6;">
          Nous sommes désolés de vous informer que votre demande d'inscription en <strong>${enrollment.className}</strong> n'a pas été approuvée.
        </p>
        ${reason ? `<div style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 15px; margin: 15px 0;"><p style="color: #991B1B; margin: 0; font-size: 14px;"><strong>Motif :</strong> ${reason}</p></div>` : ''}
        <p style="color: #6B7280; font-size: 13px;">
          Si vous pensez qu'il s'agit d'une erreur, veuillez contacter l'administration de l'établissement.
        </p>
      </div>
    </div>
  `

  return sendEmail({
    to: enrollment.email,
    subject: `❌ Inscription non approuvée | KATD-SCHÜLE`,
    html,
  })
}

module.exports = { sendEmail, sendEnrollmentApprovalEmail, sendEnrollmentRejectionEmail }
