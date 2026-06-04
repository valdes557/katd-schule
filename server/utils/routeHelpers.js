const School = require('../models/School')
const Teacher = require('../models/Teacher')
const Student = require('../models/Student')

/**
 * Extract the resolved school ObjectId from req.user.
 * Handles both populated and unpopulated `school` field.
 */
function getSchoolId(req) {
  return req.user.school?._id || req.user.school
}

/**
 * For super_admin: use ?schoolId query param or fall back to own school.
 * For everyone else: always use own school.
 */
function resolveSchoolId(req) {
  const own = getSchoolId(req)
  return req.user.role === 'super_admin' ? (req.query.schoolId || own) : own
}

/**
 * Get the Teacher document for the currently authenticated user.
 * @param {string} userId
 * @param {string|object} [opts] - If a string, used as `.select(opts)`.
 *   If an object, may contain `select` and/or `populate` keys.
 *   If omitted, returns the teacher with classes populated.
 */
async function getTeacherProfile(userId, opts) {
  let q = Teacher.findOne({ user: userId })
  if (typeof opts === 'string') {
    q = q.select(opts)
  } else if (opts && typeof opts === 'object') {
    if (opts.select) q = q.select(opts.select)
    if (opts.populate) q = q.populate(opts.populate)
  } else {
    q = q.populate('classes', 'name level cycle room stats')
  }
  return q
}

/**
 * Get class IDs assigned to a teacher (by user id).
 * Returns an array of string IDs, or [] if no teacher profile.
 */
async function getTeacherClassIds(userId) {
  const t = await Teacher.findOne({ user: userId }).select('classes')
  return (t?.classes || []).map((c) => c.toString())
}

/**
 * Get child student IDs for a parent user.
 */
async function getParentChildIds(parentUserId) {
  const children = await Student.find({ parentUser: parentUserId }).select('_id')
  return children.map((s) => s._id)
}

/**
 * Get child student records for a parent user, with optional select fields.
 */
async function getParentChildren(parentUserId, selectFields) {
  const q = Student.find({ parentUser: parentUserId })
  return selectFields ? q.select(selectFields) : q
}

/**
 * Fetch the subscribed cycle for a school (by schoolId).
 * Returns the cycle string or null.
 */
async function getSubscribedCycle(schoolId) {
  const school = await School.findById(schoolId).select('subscription.cycle')
  return school?.subscription?.cycle || null
}

/**
 * Enforce cycle permission for directors: if the director's school has a
 * subscribed cycle and the request body contains a different cycle, respond 403.
 * Returns true if the request was blocked (caller should return early).
 */
async function enforceCyclePermission(req, res) {
  if (req.user.role !== 'directeur') return false
  const schoolId = getSchoolId(req)
  const subscribedCycle = await getSubscribedCycle(schoolId)
  if (subscribedCycle && req.body.cycle && req.body.cycle !== subscribedCycle) {
    res.status(403).json({
      message: `Cycle non autoris\u00e9. Votre abonnement est \u00ab ${subscribedCycle} \u00bb. `,
    })
    return true
  }
  return false
}

/**
 * Apply cycle scope to a query for non-super_admin users.
 * Mutates the query object in place.
 */
async function applyCycleScope(query, schoolId, userRole) {
  if (userRole === 'super_admin') return
  const cycle = await getSubscribedCycle(schoolId)
  if (cycle) query.cycle = cycle
}

/**
 * Wrap an async route handler to catch errors and send 500 responses.
 * Eliminates repetitive try/catch + res.status(500) in every route.
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      res.status(500).json({ message: err.message })
    })
  }
}

module.exports = {
  getSchoolId,
  resolveSchoolId,
  getTeacherProfile,
  getTeacherClassIds,
  getParentChildIds,
  getParentChildren,
  getSubscribedCycle,
  enforceCyclePermission,
  applyCycleScope,
  asyncHandler,
}
