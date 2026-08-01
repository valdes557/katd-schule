// services/schoolCascade.js — Suppression en cascade d'une école et de TOUTES ses données.
// Utilisé par DELETE /api/schools/:id et DELETE /api/school-registrations/:id/revoke.
// Sans ce cascade, les comptes User des enseignants/élèves (email UNIQUE) restaient
// orphelins et bloquaient la recréation de l'école avec les mêmes identifiants (duplicate key).
const mongoose = require('mongoose')

const School = require('../models/School')
const User = require('../models/User')
const SchoolRegistration = require('../models/SchoolRegistration')
const WalletTransaction = require('../models/WalletTransaction')
const PushSubscription = require('../models/PushSubscription')
const Comment = require('../models/Comment')
const Teacher = require('../models/Teacher')
const Student = require('../models/Student')
const Wallet = require('../models/Wallet')
const Media = require('../models/Media')

// Registre EXPLICITE des modèles ayant un champ `school` ref School.
// On n'utilise PAS mongoose.modelNames() : il ne voit que les modèles déjà require()
// (certains ne sont chargés que par leur route) → liste partielle silencieuse.
// Volontairement ABSENTS : User/School/SchoolRegistration (traitement dédié ci-dessous),
// Shareholding (patrimoine financier personnel, indépendant de l'école),
// Location/Banner/Plans/configs plateforme (aucun champ school).
const SCHOOL_SCOPED_MODELS = [
  ['Activity', require('../models/Activity')],
  ['AiConversation', require('../models/AiConversation')],
  ['AiSubscription', require('../models/AiSubscription')],
  ['AiUsageLog', require('../models/AiUsageLog')],
  ['Announcement', require('../models/Announcement')],
  ['Appointment', require('../models/Appointment')],
  ['Attendance', require('../models/Attendance')],
  ['Class', require('../models/Class')],
  ['Counter', require('../models/Counter')],
  ['DailyReport', require('../models/DailyReport')],
  ['Document', require('../models/Document')],
  ['Enrollment', require('../models/Enrollment')],
  ['EntryAttendance', require('../models/EntryAttendance')],
  ['Event', require('../models/Event')],
  ['Expense', require('../models/Expense')],
  ['Fee', require('../models/Fee')],
  ['Grade', require('../models/Grade')],
  ['Homework', require('../models/Homework')],
  ['Media', Media],
  ['Message', require('../models/Message')],
  ['MessageGroup', require('../models/MessageGroup')],
  ['ParentalControl', require('../models/ParentalControl')],
  ['PaymentIntent', require('../models/PaymentIntent')],
  ['PaymentModality', require('../models/PaymentModality')],
  ['PermissionRequest', require('../models/PermissionRequest')],
  ['RecruitmentApplication', require('../models/RecruitmentApplication')],
  ['RecruitmentPost', require('../models/RecruitmentPost')],
  ['Report', require('../models/Report')],
  ['Resource', require('../models/Resource')],
  ['Salary', require('../models/Salary')],
  ['SchoolPage', require('../models/SchoolPage')],
  ['SchoolPost', require('../models/SchoolPost')],
  ['SchoolReview', require('../models/SchoolReview')],
  ['SharedDocument', require('../models/SharedDocument')],
  ['Staff', require('../models/Staff')],
  ['Student', Student],
  ['Subject', require('../models/Subject')],
  ['Teacher', Teacher],
  ['TeacherAttendance', require('../models/TeacherAttendance')],
  ['TeamMember', require('../models/TeamMember')],
  ['Timetable', require('../models/Timetable')],
  ['TutoringPost', require('../models/TutoringPost')],
  ['Wallet', Wallet],
  ['WithdrawalRequest', require('../models/WithdrawalRequest')],
]

// Exécute une suppression sans jamais interrompre le cascade : l'erreur est
// collectée et on passe à la collection suivante.
const safeDelete = async (label, fn, deleted, errors) => {
  try {
    const r = await fn()
    const n = r?.deletedCount ?? 0
    if (n > 0) deleted[label] = (deleted[label] || 0) + n
  } catch (e) {
    errors.push(`${label}: ${e.message}`)
  }
}

/**
 * Supprime une école et TOUTES ses données liées (comptes, classes, notes, wallets...).
 * Règle parents multi-écoles : un User parent n'est supprimé que s'il n'a plus
 * d'enfant Student dans une AUTRE école ; sinon il est conservé et détaché.
 * Les super_admin ne sont JAMAIS supprimés.
 * @param {string|ObjectId} schoolId
 * @param {{ email?: string }} opts email directeur de secours (ex: depuis SchoolRegistration)
 * @returns {null | { school, deleted: Object, errors: string[], parentsKept: number }}
 */
async function deleteSchoolCascade(schoolId, opts = {}) {
  const deleted = {}
  const errors = []
  const sid = new mongoose.Types.ObjectId(String(schoolId))

  // L'école n'est supprimée qu'EN DERNIER : si le cascade échoue au milieu,
  // elle reste visible et la suppression est rejouable (idempotente).
  const school = await School.findById(sid)
  if (!school) return null

  // ---------- Phase 0 : collecte (avant toute suppression) ----------
  const schoolUsers = await User.find({ school: sid }).select('_id role email').lean()
  const teachers = await Teacher.find({ school: sid }).select('user email').lean()
  const students = await Student.find({ school: sid }).select('user parentUser').lean()

  const teacherUserIds = teachers.map((t) => t.user).filter(Boolean)
  const teacherEmails = teachers.map((t) => t.email).filter(Boolean).map((e) => String(e).toLowerCase())
  const studentUserIds = students.map((s) => s.user).filter(Boolean)

  const directorId = school.director || null
  const directorEmail = String(school.email || opts.email || '').toLowerCase() || null

  const walletIds = (await Wallet.find({ school: sid }).select('_id').lean()).map((w) => w._id)
  const mediaIds = (await Media.find({ school: sid }).select('_id').lean()).map((m) => m._id)

  // ---------- Règle parents multi-écoles ----------
  const parentIds = [...new Set([
    ...students.map((s) => s.parentUser).filter(Boolean).map(String),
    ...schoolUsers.filter((u) => u.role === 'parent').map((u) => String(u._id)),
  ])]
  const parentsToDelete = []
  const parentsKept = []
  for (const pid of parentIds) {
    const hasChildElsewhere = await Student.exists({ parentUser: pid, school: { $ne: sid } })
    if (hasChildElsewhere) parentsKept.push(pid)
    else parentsToDelete.push(pid)
  }
  if (parentsKept.length) {
    // Le parent survit (enfants dans d'autres écoles) mais ne doit plus pointer sur l'école supprimée
    await safeDelete('User.parentsDetaches', async () => {
      const r = await User.updateMany(
        { _id: { $in: parentsKept }, school: sid },
        { $unset: { school: '' } }
      )
      return { deletedCount: r.modifiedCount }
    }, deleted, errors)
  }

  // ---------- Ensemble final des Users à supprimer ----------
  const idSet = new Set([
    ...schoolUsers.filter((u) => u.role !== 'parent').map((u) => String(u._id)),
    ...teacherUserIds.map(String),
    ...studentUserIds.map(String),
    ...parentsToDelete,
  ])
  if (directorId) idSet.add(String(directorId))
  parentsKept.forEach((p) => idSet.delete(p)) // garde-fou explicite

  const userIds = [...idSet].map((id) => new mongoose.Types.ObjectId(id))
  // Garde-fou absolu : ne JAMAIS supprimer un super_admin
  const protectedIds = new Set(
    (await User.find({ _id: { $in: userIds }, role: 'super_admin' }).select('_id').lean())
      .map((u) => String(u._id))
  )
  const finalUserIds = userIds.filter((id) => !protectedIds.has(String(id)))

  const emails = [...new Set([...teacherEmails, ...(directorEmail ? [directorEmail] : [])])]

  // ---------- Phase 1 : dépendances indirectes ----------
  await Promise.allSettled([
    safeDelete('WalletTransaction', () => WalletTransaction.deleteMany({
      $or: [{ wallet: { $in: walletIds } }, { owner: { $in: finalUserIds } }],
    }), deleted, errors),
    safeDelete('PushSubscription', () => PushSubscription.deleteMany({
      user: { $in: finalUserIds },
    }), deleted, errors),
    safeDelete('Comment', () => Comment.deleteMany({
      $or: [{ media: { $in: mediaIds } }, { user: { $in: finalUserIds } }],
    }), deleted, errors),
  ])

  // ---------- Phase 2 : tous les modèles rattachés à l'école ----------
  await Promise.allSettled(SCHOOL_SCOPED_MODELS.map(([label, Model]) =>
    safeDelete(label, () => Model.deleteMany({ school: sid }), deleted, errors)
  ))

  // ---------- Phase 3 : comptes utilisateurs ----------
  if (finalUserIds.length) {
    await safeDelete('User', () => User.deleteMany({
      _id: { $in: finalUserIds },
      role: { $ne: 'super_admin' },
    }), deleted, errors)
  }
  if (emails.length) {
    // Par email : libère l'index unique même si User.school était désynchronisé
    await safeDelete('User.parEmail', () => User.deleteMany({
      email: { $in: emails },
      role: { $ne: 'super_admin' },
      _id: { $nin: parentsKept },
    }), deleted, errors)
  }
  // Filet : Users encore rattachés à l'école (rôles inattendus)
  await safeDelete('User.residuels', () => User.deleteMany({
    school: sid,
    role: { $ne: 'super_admin' },
  }), deleted, errors)

  // ---------- Phase 4 : racine ----------
  const regOr = [{ schoolCreated: sid }]
  if (directorEmail) regOr.push({ email: directorEmail })
  if (opts.email) regOr.push({ email: String(opts.email).toLowerCase() })
  await safeDelete('SchoolRegistration', () => SchoolRegistration.deleteMany({ $or: regOr }), deleted, errors)

  await safeDelete('School', () => School.deleteOne({ _id: sid }), deleted, errors)

  return { school, deleted, errors, parentsKept: parentsKept.length }
}

module.exports = { deleteSchoolCascade, SCHOOL_SCOPED_MODELS }
