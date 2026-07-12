// scripts/migrateAccountNumbers.js — Convertit les anciens numéros de compte
// hexadécimaux (KS-A6BB0C9D / KS-XXXXXX) au nouveau format numérique KS###### (KS + 6 chiffres).
// À exécuter UNE FOIS sur la base prod après déploiement du chantier 18.
// Usage (dans server/) :
//   node scripts/migrateAccountNumbers.js         → applique la migration
//   node scripts/migrateAccountNumbers.js --dry   → simulation (aucune écriture)
require('dotenv').config()
const crypto = require('crypto')
const mongoose = require('mongoose')
const User = require('../models/User')

// Génère un KS###### unique en base (évite les collisions avec l'existant + le lot en cours).
async function genUniqueAccountNo(usedInRun) {
  for (let i = 0; i < 50; i++) {
    const n = crypto.randomInt(0, 1000000)
    const candidate = 'KS' + String(n).padStart(6, '0')
    if (usedInRun.has(candidate)) continue
    const exists = await User.exists({ walletAccountNo: candidate })
    if (!exists) { usedInRun.add(candidate); return candidate }
  }
  throw new Error('Impossible de générer un numéro de compte unique')
}

;(async () => {
  const dry = process.argv.includes('--dry')
  try {
    await mongoose.connect(process.env.MONGO_URI)
    // Tous les comptes dont le numéro n'est PAS déjà au format numérique KS######.
    const users = await User.find({
      walletAccountNo: { $exists: true, $ne: null, $not: /^KS[0-9]{6}$/ },
    }).select('name email walletAccountNo')

    console.log((dry ? '[DRY-RUN] ' : '') + users.length + ' compte(s) à convertir.')
    const usedInRun = new Set()
    let done = 0
    for (const u of users) {
      const oldNo = u.walletAccountNo
      const newNo = await genUniqueAccountNo(usedInRun)
      if (!dry) { u.walletAccountNo = newNo; await u.save() }
      done++
      console.log('  ' + (u.name || u.email || u._id) + ' : ' + oldNo + ' → ' + newNo)
    }
    console.log((dry ? '[DRY-RUN] ' : '') + 'Terminé : ' + done + ' compte(s) ' + (dry ? 'seraient convertis' : 'convertis') + '.')
  } catch (e) {
    console.error('Erreur migration :', e.message)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
})()
