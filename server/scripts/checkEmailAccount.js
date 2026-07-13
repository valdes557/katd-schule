// Diagnostic LECTURE SEULE : vérifie à quel(s) compte(s) une adresse email est
// associée (compte utilisateur/école + fiche établissement).
// Usage : node scripts/checkEmailAccount.js lamedinaschool@gmail.com
require('dotenv').config()
const mongoose = require('mongoose')
const User = require('../models/User')
const School = require('../models/School')

async function main() {
  const raw = process.argv[2]
  if (!raw) { console.error('Usage: node scripts/checkEmailAccount.js <email>'); process.exit(1) }
  const email = raw.trim().toLowerCase()
  await mongoose.connect(process.env.MONGO_URI)
  console.log('Base :', mongoose.connection.host, '/', mongoose.connection.name)
  console.log('Recherche pour :', email, '\n')

  const user = await User.findOne({ email }).populate('school', 'name email').lean()
  if (!user) {
    console.log('❌ Aucun compte utilisateur/école avec cet email.')
  } else {
    console.log('✅ Compte trouvé :')
    console.log('   nom      :', user.name)
    console.log('   rôle     :', user.role, user.role === 'utilisateur' ? '(compte grand public — PAS un compte école)' : '(compte espace École)')
    console.log('   école    :', user.school ? `${user.school.name} (${user.school._id})` : '—')
    console.log('   vérifié  :', user.emailVerified)
    console.log('   actif    :', user.isActive !== false)
  }

  const schools = await School.find({ $or: [{ email }, { 'contact.email': email }] }, 'name email director').lean()
  console.log('\nFiches établissement liées à cet email :', schools.length)
  schools.forEach((s) => console.log('   -', s.name, '| director:', s.director))

  await mongoose.disconnect()
}
main().catch((e) => { console.error('Erreur:', e.message); process.exit(1) })
