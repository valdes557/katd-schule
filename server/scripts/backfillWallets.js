// scripts/backfillWallets.js — Crée le portefeuille manquant de TOUS les comptes existants.
// Le portefeuille doit être présent dans les comptes de tous les utilisateurs
// (parents, élèves, personnel de l'école...). Les nouveaux comptes l'obtiennent
// automatiquement (hook post-save de User.js) ; ce script rattrape l'existant.
// Usage (dans server/) :
//   node scripts/backfillWallets.js --dry   → simulation (aucune écriture)
//   node scripts/backfillWallets.js         → crée les wallets manquants
require('dotenv').config()
const mongoose = require('mongoose')
const User = require('../models/User')
const Wallet = require('../models/Wallet')

// Rôle User → rôle Wallet (le portefeuille n'a pas de rôle 'super_admin')
const WALLET_ROLE = (role) => (role === 'super_admin' ? 'admin' : role || 'autre')

;(async () => {
  const dry = process.argv.includes('--dry')
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 })
    console.log('Base :', mongoose.connection.name)
    console.log('Mode :', dry ? 'DRY-RUN (lecture seule)' : 'CRÉATION RÉELLE')

    // Utilisateurs sans wallet (comparaison des deux collections)
    const owners = new Set((await Wallet.find({}).select('owner').lean()).map((w) => String(w.owner)))
    const users = await User.find({}).select('name email role school').lean()
    const missing = users.filter((u) => !owners.has(String(u._id)))

    console.log(users.length + ' compte(s) au total, ' + owners.size + ' wallet(s) existants, ' + missing.length + ' manquant(s).')

    // Répartition par rôle (visibilité avant application)
    const byRole = {}
    for (const u of missing) byRole[u.role] = (byRole[u.role] || 0) + 1
    for (const [role, n] of Object.entries(byRole)) console.log('  - ' + role + ' : ' + n)

    let done = 0
    for (const u of missing) {
      if (!dry) {
        await Wallet.create({ owner: u._id, role: WALLET_ROLE(u.role), school: u.school || null, currency: 'XOF' })
      }
      done++
      console.log('  ' + (u.name || u.email || u._id) + ' (' + u.role + ') : wallet ' + (dry ? 'serait créé' : 'créé'))
    }
    console.log((dry ? '[DRY-RUN] ' : '') + 'Terminé : ' + done + ' wallet(s) ' + (dry ? 'seraient créés' : 'créés') + '.')
  } catch (e) {
    console.error('Erreur backfill wallets :', e.message)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
})()
