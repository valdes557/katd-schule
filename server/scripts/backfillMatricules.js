/**
 * Backfill des matricules pour les comptes existants (directeurs, enseignants, parents).
 * Les comptes créés AVANT l'ajout du matricule n'en ont pas ; ce script leur en attribue un.
 *
 * Lancement :  node server/scripts/backfillMatricules.js
 * (nécessite les variables d'environnement de connexion à la base — comme le serveur)
 */
require('dotenv').config()
const mongoose = require('mongoose')
const connectDB = require('../config/db')
const User = require('../models/User')
const { generateUserMatricule } = require('../utils/matricule')

async function run() {
  await connectDB()

  const roles = ['directeur', 'enseignant', 'parent']
  const users = await User.find({
    role: { $in: roles },
    $or: [{ matricule: { $exists: false } }, { matricule: null }, { matricule: '' }],
  }).select('_id role school matricule createdAt')

  console.log(`${users.length} compte(s) sans matricule à traiter…`)

  let done = 0
  for (const u of users) {
    // Conserve l'année de création pour un matricule cohérent.
    const date = u.createdAt || new Date()
    const matricule = await generateUserMatricule(u.role, u.school, date)
    u.matricule = matricule
    await u.save({ validateBeforeSave: false })
    done++
    console.log(`  ✓ ${u.role} ${u._id} → ${matricule}`)
  }

  console.log(`Terminé : ${done} matricule(s) attribué(s).`)
  await mongoose.connection.close()
  process.exit(0)
}

run().catch((err) => {
  console.error('Erreur backfill matricules :', err)
  process.exit(1)
})
