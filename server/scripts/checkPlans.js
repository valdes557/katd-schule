// scripts/checkPlans.js — diagnostic: liste les plans de souscription et leurs prix.
// Usage (dans server/): node scripts/checkPlans.js
require('dotenv').config()
const mongoose = require('mongoose')
const SubscriptionPlan = require('../models/SubscriptionPlan')

;(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI)
    const plans = await SubscriptionPlan.find().sort({ cycle: 1, sortOrder: 1 }).lean()
    console.log('\n=== ' + plans.length + ' plan(s) de souscription ===\n')
    for (const p of plans) {
      console.log('_id           : ' + p._id)
      console.log('  cycle       : ' + p.cycle)
      console.log('  name        : ' + p.name)
      console.log('  trimestriel : ' + p.quarterlyPrice)
      console.log('  ANNUEL      : ' + p.annualPrice)
      console.log('  actif       : ' + p.isActive + '   sortOrder=' + (p.sortOrder ?? 0))
      console.log('  ---')
    }
    console.log('\nRappel: une souscription "Annuel" facture le champ ANNUEL.\n')
  } catch (e) {
    console.error('Erreur:', e.message)
  } finally {
    await mongoose.disconnect()
  }
})()
