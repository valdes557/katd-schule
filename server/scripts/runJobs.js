// scripts/runJobs.js — Déclenche manuellement les tâches planifiées (test / rattrapage).
// Usage (dans server/) :
//   node scripts/runJobs.js interest       → intérêt quotidien directeur (0,01%)
//   node scripts/runJobs.js maintenance    → frais de maintenance mensuels (100/500 F)
//   node scripts/runJobs.js all            → les deux
// N'écrit PAS le marqueur JobRun (le job automatique reste indépendant) : à réserver aux tests.
require('dotenv').config()
const mongoose = require('mongoose')
const { runDailyInterest, runMonthlyMaintenance } = require('../jobs/scheduler')

;(async () => {
  const what = (process.argv[2] || '').toLowerCase()
  if (!['interest', 'maintenance', 'all'].includes(what)) {
    console.error('Usage : node scripts/runJobs.js interest|maintenance|all')
    process.exit(1)
  }
  try {
    await mongoose.connect(process.env.MONGO_URI)
    if (what === 'interest' || what === 'all') await runDailyInterest()
    if (what === 'maintenance' || what === 'all') await runMonthlyMaintenance()
    console.log('Terminé.')
  } catch (e) {
    console.error('Erreur runJobs :', e.message)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
})()
