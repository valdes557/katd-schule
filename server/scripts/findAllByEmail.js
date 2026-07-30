// Diagnostic LECTURE SEULE : liste TOUS les comptes users pour un email
// (insensible à la casse + espaces), pour détecter les doublons de rôle.
require('dotenv').config()
const mongoose = require('mongoose')

async function main() {
  const raw = process.argv[2]
  if (!raw) { console.error('Usage: node scripts/findAllByEmail.js <email>'); process.exit(1) }
  const needle = raw.trim().toLowerCase()
  await mongoose.connect(process.env.MONGO_URI)
  const col = mongoose.connection.db.collection('users')

  // Recherche large : regex insensible à la casse sur le champ email.
  const rx = new RegExp('^\\s*' + needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'i')
  const docs = await col.find({ email: rx }).toArray()

  console.log('Base :', mongoose.connection.name)
  console.log('Email cherché :', needle)
  console.log('Comptes trouvés :', docs.length, '\n')
  docs.forEach((u, i) => {
    console.log(`--- #${i + 1} ---`)
    console.log('  _id           :', String(u._id))
    console.log('  email (brut)  :', JSON.stringify(u.email))
    console.log('  nom           :', u.name)
    console.log('  rôle          :', u.role)
    console.log('  emailVerified :', u.emailVerified)
    console.log('  isActive      :', u.isActive)
    console.log('  a un password :', !!u.password)
    console.log('  créé le       :', u.createdAt)
  })
  await mongoose.disconnect()
}
main().catch((e) => { console.error('Erreur:', e.message); process.exit(1) })
