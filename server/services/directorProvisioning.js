// services/directorProvisioning.js — Création automatique École + Directeur + Portefeuille
const School = require('../models/School')
const User = require('../models/User')
const Wallet = require('../models/Wallet')
const { generateUserMatricule } = require('../utils/matricule')
const { sendEmail } = require('../utils/emailService')

// data: { schoolName, directorName, email, whatsapp, cycle, plan, amount,
//         cityName, neighborhoodName, countryName }
async function provisionDirector(data) {
  // 1) École
  // Abonnement: essai gratuit de 1 mois par défaut, ou actif (1 an) si déjà payé
  const _now = new Date()
  const _isPaid = data.paid === true
  const _endDate = new Date(_now)
  if (_isPaid) _endDate.setFullYear(_endDate.getFullYear() + 1)
  else _endDate.setMonth(_endDate.getMonth() + 1) // essai = 1 mois
  const school = await School.create({
    name: data.schoolName,
    cycles: [data.cycle || 'primaire'],
    address: {
      city: data.cityName || '',
      neighborhood: data.neighborhoodName || '',
      country: data.countryName || 'Bénin',
    },
    contactEmail: data.email,
    contactPhone: data.whatsapp || '',
    isActive: true,
    subscription: {
      plan: data.plan || 'annual',
      cycle: data.cycle || undefined,
      status: _isPaid ? 'active' : 'trial',
      startDate: _now,
      endDate: _endDate,
      amount: _isPaid ? (data.amount || 0) : 0,
    },
  })

  // 2) Compte directeur (mot de passe aléatoire, hashé par le hook pre-save)
  const rawPassword = 'katd' + Math.floor(10000 + Math.random() * 90000)
  const matricule = await generateUserMatricule('directeur', school._id)
  // sécurité: supprime un éventuel compte résiduel avec le même email
  await User.findOneAndDelete({ email: data.email })
  const user = await User.create({
    name: data.directorName,
    email: data.email,
    password: rawPassword,
    role: 'directeur',
    school: school._id,
    phone: data.whatsapp || '',
    isActive: true,
    matricule,
  })

  school.director = user._id
  await school.save()

  // 3) Portefeuille du directeur
  await Wallet.findOneAndUpdate(
    { owner: user._id },
    { owner: user._id, role: 'directeur', school: school._id, currency: 'XOF' },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )

  // 4) Email avec les identifiants
  const planLabel = data.plan === 'annual' ? 'Annuel' : (data.plan === 'trimestriel' ? 'Trimestriel' : 'Annuel')
  const html = [
    '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">',
    '<h2 style="color:#1d4ed8">✅ Paiement confirmé — Bienvenue sur KATD-SCHÜLE</h2>',
    '<p>Bonjour <b>' + data.directorName + '</b>,</p>',
    '<p>Votre souscription <b>' + planLabel + '</b> pour l\'école <b>' + data.schoolName + '</b> a été réglée avec succès (' + (data.amount || 0) + ' FCFA).</p>',
    '<p>Votre compte <b>Directeur</b> a été créé automatiquement. Voici vos identifiants de connexion :</p>',
    '<div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:16px 0">',
    '<p>📧 Email : <b>' + data.email + '</b></p>',
    '<p>🔑 Mot de passe : <b>' + rawPassword + '</b></p>',
    '<p>🆔 Matricule : <b>' + matricule + '</b></p>',
    '</div>',
    '<p style="color:#b91c1c">⚠️ Pour votre sécurité, changez ce mot de passe dès votre première connexion.</p>',
    '<p><a href="' + (process.env.CLIENT_URL || '') + '" style="background:#1d4ed8;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Se connecter</a></p>',
    '<hr><p style="color:#6b7280;font-size:12px">KATD-SCHÜLE — Apprendre, Partager, Grandir</p>',
    '</div>',
  ].join('')

  let emailSent = false
  try {
    const r = await sendEmail({ to: data.email, subject: '✅ Vos identifiants Directeur — KATD-SCHÜLE', html })
    emailSent = !!(r && (r.success !== false))
  } catch (e) { console.error('Email identifiants directeur échoué:', e.message) }

  return { school, user, rawPassword, matricule, emailSent }
}

module.exports = { provisionDirector }