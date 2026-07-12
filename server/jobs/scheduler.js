// jobs/scheduler.js — Tâches planifiées in-process (aucune dépendance externe).
// PM2 mono-instance : un setInterval + garde d'idempotence persistée (JobRun) suffit et
// gère le rattrapage après une coupure de courant (VPS Hostinger).
//
// - Intérêt quotidien directeur (0,01%/jour) : une fois par jour.
// - Frais de maintenance mensuels (100/500 F) : une fois par mois, à partir du 1er.
//
// Fonctions exportées (runDailyInterest / runMonthlyMaintenance / applyMaintenanceOnDeposit)
// pour un déclenchement manuel (scripts/runJobs.js) et le prélèvement au dépôt (payments.js).
const User = require('../models/User')
const Wallet = require('../models/Wallet')
const JobRun = require('../models/JobRun')
const wallet = require('../services/walletService')

// Taux d'intérêt quotidien sur le solde des comptes directeur.
const DAILY_INTEREST_RATE = 0.0001 // 0,01%/jour
// Barème mensuel de maintenance selon le rôle (super_admin exempté).
const MAINTENANCE_TIERS = { directeur: 500, enseignant: 500, parent: 500, utilisateur: 100, eleve: 100 }

// Clés locales (fuseau serveur) — cohérentes avec l'affichage francophone.
function dayKey(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}
function monthKey(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
}

// ───────────────────────── INTÉRÊT QUOTIDIEN (directeurs) ─────────────────────────
async function runDailyInterest() {
  const directors = await User.find({ role: 'directeur', isActive: { $ne: false } }).select('_id name role school')
  let credited = 0, totalInterest = 0
  for (const dir of directors) {
    try {
      const w = await Wallet.findOne({ owner: dir._id })
      if (!w || w.balance <= 0) continue
      const interest = Math.floor(w.balance * DAILY_INTEREST_RATE)
      if (interest <= 0) continue
      await wallet.credit(dir._id, {
        amount: interest, type: 'interest', role: 'directeur', school: dir.school || null,
        description: 'Intérêt quotidien directeur (0,01%)',
        meta: { rate: DAILY_INTEREST_RATE, base: w.balance },
      })
      credited++; totalInterest += interest
    } catch (e) { console.error('[job:interest] directeur ' + dir._id + ' :', e.message) }
  }
  const result = { directors: directors.length, credited, totalInterest }
  console.log('[job:interest] ' + JSON.stringify(result))
  return result
}

// ───────────────────────── MAINTENANCE MENSUELLE ─────────────────────────
function maintenanceBareme(role) { return MAINTENANCE_TIERS[role] || 0 }

// Prélève les frais de maintenance d'un utilisateur : ajoute l'arriéré, prélève ce que
// le solde permet, laisse le reste en arriéré. Best-effort (jamais de throw vers l'appelant global).
// Retourne { charged, due } (montant prélevé, arriéré restant).
async function chargeMaintenanceForUser(user, monthlyFee) {
  const arrears = Number(user.maintenanceDue || 0)
  const due = monthlyFee + arrears
  if (due <= 0) return { charged: 0, due: 0 }
  const w = await Wallet.findOne({ owner: user._id })
  const balance = w ? w.balance : 0
  const pay = Math.min(due, balance)
  if (pay > 0) {
    await wallet.debit(user._id, {
      amount: pay, type: 'maintenance_fee', role: user.role, school: user.school || null,
      description: 'Frais de maintenance mensuels',
      meta: { feeType: 'maintenance', tier: user.role, monthlyFee, arrears },
    })
    await wallet.collectFee({
      fee: pay, fromUserId: user._id,
      description: 'Frais de maintenance encaissés — ' + (user.name || user.role),
      meta: { feeType: 'maintenance', tier: user.role, from: String(user._id) },
    })
  }
  const remaining = due - pay
  await User.updateOne({ _id: user._id }, { $set: { maintenanceDue: remaining } })
  return { charged: pay, due: remaining }
}

async function runMonthlyMaintenance() {
  const roles = Object.keys(MAINTENANCE_TIERS)
  const users = await User.find({ role: { $in: roles }, isActive: { $ne: false } }).select('_id name role school maintenanceDue')
  let charged = 0, totalCharged = 0, withArrears = 0
  for (const u of users) {
    try {
      const fee = maintenanceBareme(u.role)
      const r = await chargeMaintenanceForUser(u, fee)
      if (r.charged > 0) { charged++; totalCharged += r.charged }
      if (r.due > 0) withArrears++
    } catch (e) { console.error('[job:maintenance] user ' + u._id + ' :', e.message) }
  }
  const result = { users: users.length, charged, totalCharged, withArrears }
  console.log('[job:maintenance] ' + JSON.stringify(result))
  return result
}

// Règle l'arriéré de maintenance au prochain dépôt (appelé depuis payments.js applyOutcome).
// N'ajoute PAS le frais du mois courant (déjà géré par le job mensuel) : ne solde que l'arriéré.
async function applyMaintenanceOnDeposit(userId) {
  try {
    const u = await User.findById(userId).select('_id name role school maintenanceDue')
    if (!u || !(u.maintenanceDue > 0)) return
    // Ici monthlyFee = 0 : on ne prélève que l'arriéré cumulé.
    await chargeMaintenanceForUser(u, 0)
  } catch (e) { console.error('[maintenance:onDeposit] ' + userId + ' :', e.message) }
}

// ───────────────────────── ORCHESTRATION (tick horaire + idempotence) ─────────────────────────
async function tick() {
  try {
    const today = dayKey()
    const month = monthKey()
    // Intérêt quotidien
    let jr = await JobRun.findOne({ key: 'daily_interest' })
    if (!jr) jr = await JobRun.create({ key: 'daily_interest' })
    if (jr.lastRunDate !== today) {
      const result = await runDailyInterest()
      jr.lastRunDate = today; jr.lastRunAt = new Date(); jr.lastResult = result
      await jr.save()
    }
    // Maintenance mensuelle (dès le mois changé, jour ≥ 1 toujours vrai)
    let mr = await JobRun.findOne({ key: 'monthly_maintenance' })
    if (!mr) mr = await JobRun.create({ key: 'monthly_maintenance' })
    if (mr.lastRunMonth !== month) {
      const result = await runMonthlyMaintenance()
      mr.lastRunMonth = month; mr.lastRunAt = new Date(); mr.lastResult = result
      await mr.save()
    }
  } catch (e) { console.error('[scheduler:tick]', e.message) }
}

let timer = null
function start() {
  if (timer) return
  // Premier passage peu après le démarrage (laisse la connexion Mongo s'établir), puis toutes les heures.
  setTimeout(tick, 30 * 1000)
  timer = setInterval(tick, 60 * 60 * 1000)
  console.log('⏰ Scheduler démarré (intérêt quotidien + maintenance mensuelle)')
}

module.exports = { start, tick, runDailyInterest, runMonthlyMaintenance, applyMaintenanceOnDeposit,
  DAILY_INTEREST_RATE, MAINTENANCE_TIERS }
