const Counter = require('../models/Counter')
const School = require('../models/School')

function buildSchoolPrefix(school) {
  const base = (school?.slug || school?.name || 'STU')
    .toString()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  const prefix = base.slice(0, 4) || 'STU'
  return prefix
}

async function generateMatricule(schoolId, date = new Date()) {
  const year = date.getFullYear()
  const counter = await Counter.findOneAndUpdate(
    { name: 'student_seq', school: schoolId, year },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  )

  const school = await School.findById(schoolId).select('slug name')
  const prefix = buildSchoolPrefix(school)
  const seqStr = String(counter.seq).padStart(4, '0')
  return `${prefix}-${year}-${seqStr}`
}

// Préfixes de matricule par rôle (utilisateurs non-élèves)
const ROLE_PREFIX = {
  directeur: 'DIR',
  enseignant: 'ENS',
  parent: 'PAR',
  super_admin: 'ADM',
}

// Génère un matricule unique pour un compte utilisateur (directeur/enseignant/parent).
// Format : ROLE-ECOLE-ANNEE-SEQ (ex: ENS-LYCE-2026-0001). Séquence par rôle/école/année.
async function generateUserMatricule(role, schoolId, date = new Date()) {
  const year = date.getFullYear()
  const rolePrefix = ROLE_PREFIX[role] || 'USR'
  const counter = await Counter.findOneAndUpdate(
    { name: `${role}_seq`, school: schoolId || null, year },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  )

  let schoolPrefix = 'STU'
  if (schoolId) {
    const school = await School.findById(schoolId).select('slug name')
    schoolPrefix = buildSchoolPrefix(school)
  }
  const seqStr = String(counter.seq).padStart(4, '0')
  return `${rolePrefix}-${schoolPrefix}-${year}-${seqStr}`
}

module.exports = { generateMatricule, generateUserMatricule }
