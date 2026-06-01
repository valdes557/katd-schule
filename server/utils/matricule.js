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

module.exports = { generateMatricule }
