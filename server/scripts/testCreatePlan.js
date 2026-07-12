// scripts/testCreatePlan.js — teste la création d'un plan comme le fait l'admin.
// Usage (server/): node scripts/testCreatePlan.js
require('dotenv').config()
const mongoose = require('mongoose')
const SubscriptionPlan = require('../models/SubscriptionPlan')

;(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI)
    const payload = {
      cycle: 'Primaire',
      name: 'TEST-500 (diagnostic)',
      quarterlyPrice: 500,
      annualPrice: 500,
      features: ['Test'],
      isActive: true,
    }
    console.log('Tentative de création:', JSON.stringify(payload))
    const plan = await SubscriptionPlan.create(payload)
    console.log('✅ Créé avec _id =', String(plan._id), '| annuel =', plan.annualPrice, '| actif =', plan.isActive)
    // Nettoyage immédiat pour ne pas polluer la base
    await SubscriptionPlan.findByIdAndDelete(plan._id)
    console.log('🧹 Plan de test supprimé. La CRÉATION fonctionne côté base.')
  } catch (e) {
    console.error('❌ ÉCHEC création:', e.message)
    if (e.errors) for (const k in e.errors) console.error('   champ', k, ':', e.errors[k].message)
  } finally {
    await mongoose.disconnect()
  }
})()
