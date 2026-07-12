// scripts/checkSchoolsAccess.js — LECTURE SEULE : liste les écoles et leur accès réel.
// N'écrit rien. Usage (server/): node scripts/checkSchoolsAccess.js
require('dotenv').config()
const mongoose = require('mongoose')
const School = require('../models/School')

const fmtDate = (d) => d ? new Date(d).toISOString().slice(0, 10) : '—'

;(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI)
    const schools = await School.find().select('name subscription director').sort({ createdAt: 1 }).lean()
    // Recharge en documents pour appeler la méthode hasActiveAccess()
    const docs = await School.find().sort({ createdAt: 1 })

    console.log('\n=== ' + docs.length + ' école(s) — statut d\'accès (lecture seule) ===\n')
    let actives = 0, trials = 0, bloquees = 0
    for (const s of docs) {
      const sub = s.subscription || {}
      const access = typeof s.hasActiveAccess === 'function' ? s.hasActiveAccess() : null
      if (access && sub.status === 'active') actives++
      else if (access && sub.status === 'trial') trials++
      else bloquees++
      console.log((access ? '✅ ACCÈS   ' : '⛔ BLOQUÉ  ') + ' | ' + (s.name || '(sans nom)'))
      console.log('      statut=' + (sub.status || '—') +
                  '  plan=' + (sub.plan || '—') +
                  '  cycle=' + (sub.cycle || '—') +
                  '  fin=' + fmtDate(sub.endDate))
    }
    console.log('\n--- Résumé ---')
    console.log('Actives (payées) : ' + actives)
    console.log('En essai (trial) : ' + trials)
    console.log('Bloquées/expirées: ' + bloquees)
    console.log('\nNB: l\'accès dépend UNIQUEMENT de subscription.status/endDate de CHAQUE école,')
    console.log('    jamais du document plan supprimé. Un plan supprimé ne bloque aucun compte.\n')
  } catch (e) {
    console.error('Erreur:', e.message)
  } finally {
    await mongoose.disconnect()
  }
})()
