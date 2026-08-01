// Nettoie les documents ORPHELINS : ceux dont le champ `school` référence une
// école qui n'existe plus dans la collection schools (école supprimée avant que
// la suppression en cascade n'existe). Répare notamment les comptes User
// d'enseignants qui bloquent la recréation avec « Cet email est déjà utilisé ».
//
//   node scripts/purgeSchoolOrphans.js                     → DRY-RUN (lecture seule)
//   node scripts/purgeSchoolOrphans.js --email=xxx@yyy.com → dry-run + focus sur un email
//   node scripts/purgeSchoolOrphans.js --apply             → SUPPRESSION RÉELLE
//
// ⚠️ Toujours lancer scripts/atlas-backup.js avant --apply.
require('dotenv').config()
const mongoose = require('mongoose')
const { SCHOOL_SCOPED_MODELS } = require('../services/schoolCascade')
const School = require('../models/School')
const User = require('../models/User')
const Teacher = require('../models/Teacher')
const Student = require('../models/Student')
const WalletTransaction = require('../models/WalletTransaction')
const PushSubscription = require('../models/PushSubscription')
const Comment = require('../models/Comment')

const APPLY = process.argv.includes('--apply')
const emailArg = (process.argv.find((a) => a.startsWith('--email=')) || '').split('=')[1]

async function main() {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 })
  console.log('Base :', mongoose.connection.name)
  console.log('Mode :', APPLY ? '*** APPLY (suppression réelle) ***' : 'DRY-RUN (lecture seule)')

  const liveSet = new Set((await School.find({}).select('_id').lean()).map((s) => String(s._id)))
  console.log('Écoles existantes :', liveSet.size, '\n')

  // deadIdsByModel est calculé ICI et réutilisé TEL QUEL en phase apply avec $in.
  // ⚠️ JAMAIS de $nin : il matche aussi school:null/absent et détruirait toutes
  // les données plateforme (Media, Message, Wallet, User... ont school optionnel).
  const deadIdsByModel = {}
  const orphanUserIds = []
  const orphanWalletIds = []
  const orphanMediaIds = []

  console.log('--- Documents orphelins par collection ---')
  for (const [label, Model] of [...SCHOOL_SCOPED_MODELS, ['User', User]]) {
    try {
      const values = await Model.distinct('school', { school: { $ne: null } })
      const deadIds = values.filter((v) => v && !liveSet.has(String(v)))
      if (!deadIds.length) continue
      deadIdsByModel[label] = deadIds
      const filter = { school: { $in: deadIds } }
      const n = await Model.countDocuments(filter)
      console.log(String(n).padStart(6), label, '| écoles fantômes :', deadIds.map(String).join(', '))

      if (label === 'User') {
        const docs = await Model.find(filter).select('_id role email').lean()
        docs.filter((u) => u.role !== 'super_admin').forEach((u) => orphanUserIds.push(u._id))
      }
      if (label === 'Wallet') {
        const docs = await Model.find(filter).select('_id').lean()
        docs.forEach((w) => orphanWalletIds.push(w._id))
      }
      if (label === 'Media') {
        const docs = await Model.find(filter).select('_id').lean()
        docs.forEach((m) => orphanMediaIds.push(m._id))
      }
    } catch (e) {
      console.error('ERREUR', label, ':', e.message)
    }
  }
  if (!Object.keys(deadIdsByModel).length) console.log('  (aucun)')

  // Users désynchronisés : retrouvés via les Teachers orphelins (par id ET par
  // email, comme le fait DELETE /api/teachers/:id).
  const deadTeacherSchoolIds = deadIdsByModel['Teacher'] || []
  if (deadTeacherSchoolIds.length) {
    const deadTeachers = await Teacher.find({ school: { $in: deadTeacherSchoolIds } })
      .select('user email firstName lastName').lean()
    const extra = await User.find({
      $or: [
        { _id: { $in: deadTeachers.map((t) => t.user).filter(Boolean) } },
        { email: { $in: deadTeachers.map((t) => t.email).filter(Boolean).map((e) => String(e).toLowerCase()) } },
      ],
      role: { $ne: 'super_admin' },
    }).select('_id email role school').lean()
    if (extra.length) {
      console.log('\n--- Users liés à des enseignants orphelins :', extra.length, '---')
      extra.forEach((u) => console.log('   -', u.email, '|', u.role, '| school:', u.school || '(aucune)'))
      extra.forEach((u) => orphanUserIds.push(u._id))
    }
  }

  // Règle PARENTS : conserver tout User qui a un enfant dans une école VIVANTE.
  const liveObjIds = [...liveSet].map((id) => new mongoose.Types.ObjectId(id))
  const uniqueIds = [...new Map(orphanUserIds.map((id) => [String(id), id])).values()]
  const keep = new Set()
  for (const uid of uniqueIds) {
    if (await Student.exists({ parentUser: uid, school: { $in: liveObjIds } })) keep.add(String(uid))
  }
  const finalUserIds = uniqueIds.filter((id) => !keep.has(String(id)))
  if (keep.size) console.log('\nParents CONSERVÉS (enfant dans une école active) :', keep.size)
  console.log('\nUsers à supprimer au total :', finalUserIds.length)

  // Focus diagnostic sur un email précis
  if (emailArg) {
    const rx = new RegExp('^\\s*' + emailArg.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'i')
    const hits = await User.find({ email: rx }).select('_id name email role school createdAt').lean()
    console.log(`\n--- Comptes User pour ${emailArg} : ${hits.length} ---`)
    hits.forEach((u) => {
      const orphan = finalUserIds.some((id) => String(id) === String(u._id))
      console.log('   ', String(u._id), '|', u.role, '| school:', u.school || '(aucune)',
        '|', u.createdAt?.toISOString?.() || u.createdAt, orphan ? '→ SERA SUPPRIMÉ' : '→ conservé')
    })
  }

  if (!APPLY) {
    console.log('\nDRY-RUN terminé. Aucune donnée modifiée. Relancez avec --apply pour supprimer.')
    return
  }

  // ---------- Suppression réelle ----------
  const done = {}
  const run = async (label, fn) => {
    try {
      const r = await fn()
      done[label] = r?.deletedCount ?? 0
    } catch (e) {
      console.error('ERREUR suppression', label, ':', e.message)
    }
  }

  // 1) Dépendances indirectes
  await run('WalletTransaction', () => WalletTransaction.deleteMany({
    $or: [{ wallet: { $in: orphanWalletIds } }, { owner: { $in: finalUserIds } }],
  }))
  await run('PushSubscription', () => PushSubscription.deleteMany({ user: { $in: finalUserIds } }))
  await run('Comment', () => Comment.deleteMany({
    $or: [{ media: { $in: orphanMediaIds } }, { user: { $in: finalUserIds } }],
  }))

  // 2) Modèles rattachés aux écoles fantômes ($in sur les ids morts, JAMAIS $nin)
  for (const [label, Model] of SCHOOL_SCOPED_MODELS) {
    const dead = deadIdsByModel[label]
    if (!dead?.length) continue
    await run(label, () => Model.deleteMany({ school: { $in: dead } }))
  }

  // 3) Comptes utilisateurs (jamais de super_admin)
  await run('User', () => User.deleteMany({
    _id: { $in: finalUserIds },
    role: { $ne: 'super_admin' },
  }))

  console.log('\n=== Supprimé ===')
  const entries = Object.entries(done).filter(([, n]) => n > 0)
  if (!entries.length) console.log('  (rien)')
  entries.forEach(([k, n]) => console.log(String(n).padStart(6), k))
  console.log('\nTerminé. Relancez sans --apply pour vérifier qu\'il ne reste plus d\'orphelins.')
}

main()
  .catch((e) => { console.error('Erreur:', e.message); process.exitCode = 1 })
  .finally(() => mongoose.disconnect())
