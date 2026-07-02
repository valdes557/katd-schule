const nodemailer = require('nodemailer')

const SMTP_USER = (process.env.SMTP_USER || '').trim()
const SMTP_PASS = (process.env.SMTP_PASS || '').replace(/\s/g, '') // supprime espaces (App Password Gmail)
const SMTP_HOST = (process.env.SMTP_HOST || 'smtp.gmail.com').trim()
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587

if (!SMTP_USER || !SMTP_PASS) {
  console.warn('⚠️  SMTP_USER / SMTP_PASS non configurés — les emails ne seront PAS envoyés.')
  console.warn('   → Sur le VPS : vérifiez /var/www/katd-schule/server/.env')
} else {
  console.log(`📧 SMTP configuré : ${SMTP_HOST}:${SMTP_PORT} — compte : ${SMTP_USER}`)
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
  tls: { rejectUnauthorized: false },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
})

// Vérification SMTP au démarrage
if (SMTP_USER && SMTP_PASS) {
  transporter.verify((err) => {
    if (err) {
      console.error('❌ SMTP connexion échouée:', err.message)
      console.error('   → Causes fréquentes :')
      console.error('     1. App Password Gmail invalide ou révoqué (générez-en un nouveau sur https://myaccount.google.com/apppasswords)')
      console.error('     2. La 2FA Gmail n\'est pas activée (obligatoire pour les App Passwords)')
      console.error('     3. Le port 587 est bloqué par le pare-feu du VPS (essayez le port 465)')
      console.error('     4. SMTP_PASS contient des espaces résiduels (valeur actuelle longueur:', SMTP_PASS.length, ')')
    } else {
      console.log('✅ SMTP prêt — emails activés pour:', SMTP_USER)
    }
  })
}

const sendEmail = async ({ to, subject, html }) => {
  if (!SMTP_USER || !SMTP_PASS) {
    console.error('❌ Email non envoyé — SMTP_USER ou SMTP_PASS manquant dans .env')
    return { success: false, error: 'SMTP non configuré' }
  }
  try {
    const info = await transporter.sendMail({
      from: `"KATD-SCHÜLE" <${SMTP_USER}>`,
      to,
      subject,
      html,
    })
    console.log(`📧 Email envoyé à ${to} — ID: ${info.messageId}`)
    return { success: true, messageId: info.messageId }
  } catch (err) {
    console.error(`❌ Email échoué vers ${to}:`, err.message)
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

// ─────────────────────────────────────────────────────────────────────────────
// Emails de l'assistant IA (souscriptions)
// ─────────────────────────────────────────────────────────────────────────────

const aiEmailLayout = ({ headerColor, badge, body }) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: ${headerColor}; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">KATD-SCHÜLE</h1>
      <p style="color: #E0E7FF; margin-top: 8px;">${badge}</p>
    </div>
    <div style="background: #F9FAFB; padding: 30px; border: 1px solid #E5E7EB; border-top: 0; border-radius: 0 0 12px 12px;">
      ${body}
    </div>
    <p style="text-align: center; color: #9CA3AF; font-size: 11px; margin-top: 20px;">
      © ${new Date().getFullYear()} KATD-SCHÜLE — Assistant IA
    </p>
  </div>
`

// → Administrateur : une nouvelle demande de souscription IA a été soumise.
const sendAiSubscriptionRequestEmail = async ({ to, schoolName, directorName, packageName, totalQuestions, price, currency }) => {
  const body = `
    <h2 style="color: #111827; font-size: 18px;">Nouvelle demande de souscription IA</h2>
    <p style="color: #4B5563; line-height: 1.6;">
      Une nouvelle demande d'activation de l'agent IA a été envoyée par une école.
    </p>
    <div style="background: white; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr><td style="padding: 8px 0; color: #6B7280;">École</td><td style="padding: 8px 0; color: #111827; font-weight: 600; text-align: right;">${schoolName}</td></tr>
        <tr><td style="padding: 8px 0; color: #6B7280;">Directeur</td><td style="padding: 8px 0; color: #111827; text-align: right;">${directorName}</td></tr>
        <tr><td style="padding: 8px 0; color: #6B7280;">Offre choisie</td><td style="padding: 8px 0; color: #111827; font-weight: 600; text-align: right;">${packageName}</td></tr>
        <tr><td style="padding: 8px 0; color: #6B7280;">Questions incluses</td><td style="padding: 8px 0; color: #111827; text-align: right;">${totalQuestions}</td></tr>
        <tr><td style="padding: 8px 0; color: #6B7280;">Prix</td><td style="padding: 8px 0; color: #059669; font-weight: 700; text-align: right;">${Number(price).toLocaleString()} ${currency || 'F CFA'}</td></tr>
      </table>
    </div>
    <p style="color: #6B7280; font-size: 13px;">Connectez-vous au tableau de bord administrateur pour examiner et traiter cette demande.</p>
    <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard/ia-admin" style="display: inline-block; background: #4F46E5; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; margin-top: 10px;">Voir la demande</a>
  `
  return sendEmail({
    to,
    subject: 'Nouvelle demande de souscription IA | KATD-SCHÜLE',
    html: aiEmailLayout({ headerColor: 'linear-gradient(135deg, #4F46E5, #7C3AED)', badge: '🤖 Demande de souscription IA', body }),
  })
}

// → Directeur : sa demande IA a été approuvée.
const sendAiSubscriptionApprovedEmail = async ({ to, directorName, packageName, totalQuestions }) => {
  const body = `
    <h2 style="color: #111827; font-size: 18px;">Bonjour ${directorName || ''},</h2>
    <p style="color: #4B5563; line-height: 1.6;">
      Votre demande d'accès à l'agent IA a été <strong style="color: #059669;">approuvée</strong>.
      Vous pouvez désormais utiliser l'assistant et attribuer l'accès aux membres de votre établissement.
    </p>
    <div style="background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <table style="width: 100%; font-size: 14px;">
        <tr><td style="padding: 6px 0; color: #4B5563;">Offre</td><td style="padding: 6px 0; color: #065F46; font-weight: 600; text-align: right;">${packageName}</td></tr>
        <tr><td style="padding: 6px 0; color: #4B5563;">Questions disponibles</td><td style="padding: 6px 0; color: #065F46; font-weight: 700; text-align: right;">${totalQuestions}</td></tr>
      </table>
    </div>
    <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard/ia-chat" style="display: inline-block; background: #059669; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; margin-top: 10px;">Utiliser l'assistant IA</a>
  `
  return sendEmail({
    to,
    subject: 'Votre demande IA a été approuvée | KATD-SCHÜLE',
    html: aiEmailLayout({ headerColor: 'linear-gradient(135deg, #059669, #10B981)', badge: '✅ Souscription IA approuvée', body }),
  })
}

// → Directeur : sa demande IA a été rejetée.
const sendAiSubscriptionRejectedEmail = async ({ to, directorName, packageName, reason }) => {
  const body = `
    <h2 style="color: #111827; font-size: 18px;">Bonjour ${directorName || ''},</h2>
    <p style="color: #4B5563; line-height: 1.6;">
      Nous sommes désolés de vous informer que votre demande d'accès à l'agent IA (${packageName}) n'a pas été approuvée.
    </p>
    ${reason ? `<div style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 15px; margin: 15px 0;"><p style="color: #991B1B; margin: 0; font-size: 14px;"><strong>Motif :</strong> ${reason}</p></div>` : ''}
    <p style="color: #6B7280; font-size: 13px;">Pour toute question, contactez l'administration de la plateforme.</p>
  `
  return sendEmail({
    to,
    subject: 'Votre demande IA n\'a pas été approuvée | KATD-SCHÜLE',
    html: aiEmailLayout({ headerColor: 'linear-gradient(135deg, #DC2626, #B91C1C)', badge: '❌ Souscription IA non approuvée', body }),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Emails de souscription de l'établissement (activation / désactivation par l'admin)
// ─────────────────────────────────────────────────────────────────────────────

// → Directeur : la souscription de son établissement a été désactivée par l'admin.
const sendSubscriptionSuspendedEmail = async ({ to, directorName, schoolName }) => {
  const body = `
    <h2 style="color: #111827; font-size: 18px;">Bonjour ${directorName || ''},</h2>
    <p style="color: #4B5563; line-height: 1.6;">
      Nous vous informons que la souscription de votre établissement
      <strong>${schoolName || ''}</strong> a été <strong style="color: #DC2626;">désactivée</strong> par l'administrateur de la plateforme.
    </p>
    <div style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="color: #991B1B; margin: 0; font-size: 14px;">
        Tant que la souscription reste désactivée, vous ainsi que les enseignants et parents de votre établissement
        n'auront plus accès au tableau de bord.
      </p>
    </div>
    <p style="color: #6B7280; font-size: 13px;">
      Pour réactiver votre accès, veuillez contacter l'administration de la plateforme.
    </p>
  `
  return sendEmail({
    to,
    subject: 'Souscription désactivée | KATD-SCHÜLE',
    html: aiEmailLayout({ headerColor: 'linear-gradient(135deg, #DC2626, #B91C1C)', badge: '🔒 Souscription désactivée', body }),
  })
}

// → Directeur : la souscription de son établissement a été réactivée par l'admin.
const sendSubscriptionReactivatedEmail = async ({ to, directorName, schoolName }) => {
  const body = `
    <h2 style="color: #111827; font-size: 18px;">Bonjour ${directorName || ''},</h2>
    <p style="color: #4B5563; line-height: 1.6;">
      Bonne nouvelle ! La souscription de votre établissement
      <strong>${schoolName || ''}</strong> a été <strong style="color: #059669;">réactivée</strong>.
      Vous et les membres de votre établissement (enseignants, parents) pouvez de nouveau accéder au tableau de bord.
    </p>
    <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/login" style="display: inline-block; background: #059669; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; margin-top: 10px;">Accéder à mon espace</a>
  `
  return sendEmail({
    to,
    subject: 'Souscription réactivée | KATD-SCHÜLE',
    html: aiEmailLayout({ headerColor: 'linear-gradient(135deg, #059669, #10B981)', badge: '✅ Souscription réactivée', body }),
  })
}

module.exports = {
  sendEmail,
  sendEnrollmentApprovalEmail,
  sendEnrollmentRejectionEmail,
  sendAiSubscriptionRequestEmail,
  sendAiSubscriptionApprovedEmail,
  sendAiSubscriptionRejectedEmail,
  sendSubscriptionSuspendedEmail,
  sendSubscriptionReactivatedEmail,
}
