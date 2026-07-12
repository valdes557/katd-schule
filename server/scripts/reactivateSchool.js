// scripts/reactivateSchool.js — Réactive/prolonge la souscription d'une école.
// Usage (dans server/) :
//   node scripts/reactivateSchool.js "La Medina" 3        → statut active + fin = aujourd'hui + 3 mois
//   node scripts/reactivateSchool.js "La Medina" 12       → +12 mois
// Le 1er argument est un motif de recherche (insensible à la casse) sur le nom de l'école ;
// le 2e (facultatif, défaut 3) est le nombre de MOIS d'accès à accorder à partir d'aujourd'hui.
require('dotenv').config()
const mongoose = require('mongoose')
const School = require('../models/School')

const fmtDate = (d) => d ? new Date(d).toISOString().slice(0, 10) : '—'

;(async () => {
  const pattern = process.argv[2]
  const months = Math.max(1, parseInt(process.argv[3]) || 3)
  if (!pattern) {
    console.error('Usage : node scripts/reactivateSchool.js "<nom école>" [mois=3]')
    process.exit(1)
  }
  try {
    await mongoose.connect(process.env.MONGO_URI)
    const rx = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    const matches = await School.find({ name: rx })
    if (matches.length === 0) { console.log('Aucune école ne correspond à « ' + pattern + ' ».'); return }
    if (matches.length > 1) {
      console.log(matches.length + ' écoles correspondent — précisez le nom :')
      matches.forEach((s) => console.log('  • ' + s.name))
      return
    }
    const school = matches[0]
    const now = new Date()
    const end = new Date(now)
    end.setMonth(end.getMonth() + months)

    console.log('École : ' + school.name)
    console.log('  AVANT : statut=' + (school.subscription?.status || '—') + '  fin=' + fmtDate(school.subscription?.endDate))

    school.subscription = {
      ...(school.subscription ? (school.subscription.toObject?.() || school.subscription) : {}),
      status: 'active',
      startDate: school.subscription?.startDate || now,
      endDate: end,
    }
    school.isActive = true
    await school.save()

    const access = typeof school.hasActiveAccess === 'function' ? school.hasActiveAccess() : null
    console.log('  APRÈS : statut=active  fin=' + fmtDate(end) + '  → ' + (access ? '✅ ACCÈS rétabli' : '⛔ toujours bloqué (vérifier)'))
  } catch (e) {
    console.error('Erreur :', e.message)
  } finally {
    await mongoose.disconnect()
  }
})()
