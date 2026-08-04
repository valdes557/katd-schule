// routes/entryAttendance.js — Présence par QR individuel (cycle Secondaire).
// Le principal télécharge les QR de tous les membres/élèves ; le portier les scanne
// à l'entrée/sortie ; le Surveillant Général consulte arrivées, retards et absents.
const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const EntryAttendance = require('../models/EntryAttendance')
const Student = require('../models/Student')
const School = require('../models/School')
const User = require('../models/User')
const { protect, authorize } = require('../middleware/auth')
const { todayKey, hhmmToMinutes, minutesOfDay, fmtTime } = require('../utils/timezone')

function schoolId(req) { return req.user.school?._id || req.user.school }

// Rôles du personnel concernés par le QR individuel
const STAFF_ROLES = ['directeur', 'enseignant', 'vice_principal', 'surveillant_general', 'caissiere', 'secretaire', 'portier']

// Génère l'identifiant QR s'il manque (paresseux, comme walletAccountNo)
async function ensureQrId(doc) {
  if (!doc.attendanceQrId) {
    doc.attendanceQrId = `KQ${crypto.randomBytes(12).toString('hex')}`
    await doc.save()
  }
  return doc.attendanceQrId
}

// GET /api/entry-attendance/qr-list — principal : tous les QR (personnel + élèves)
router.get('/qr-list', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const sid = schoolId(req)
    const [staff, students] = await Promise.all([
      User.find({ school: sid, role: { $in: STAFF_ROLES }, isActive: { $ne: false } }).select('name role matricule attendanceQrId'),
      Student.find({ school: sid, status: 'active' }).populate('class', 'name level').select('firstName lastName matricule attendanceQrId class'),
    ])
    // Génère les identifiants manquants (une fois pour toutes)
    for (const u of staff) if (!u.attendanceQrId) await ensureQrId(u)
    for (const s of students) if (!s.attendanceQrId) await ensureQrId(s)
    res.json({
      success: true,
      data: {
        staff: staff.map((u) => ({ id: u._id, name: u.name, role: u.role, matricule: u.matricule || '', qrId: u.attendanceQrId })),
        students: students.map((s) => ({
          id: s._id, name: `${s.lastName} ${s.firstName}`, matricule: s.matricule || '',
          className: s.class?.name || '', qrId: s.attendanceQrId,
        })),
      },
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/entry-attendance/my-qr — chacun peut afficher SON QR (élève via fiche liée)
router.get('/my-qr', protect, async (req, res) => {
  try {
    if (req.user.role === 'eleve') {
      const student = await Student.findOne({ user: req.user._id })
      if (!student) return res.status(404).json({ message: 'Aucune fiche élève liée à ce compte' })
      const qrId = await ensureQrId(student)
      return res.json({ success: true, data: { qrId, name: `${student.lastName} ${student.firstName}`, matricule: student.matricule || '' } })
    }
    const user = await User.findById(req.user._id)
    const qrId = await ensureQrId(user)
    res.json({ success: true, data: { qrId, name: user.name, matricule: user.matricule || '' } })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/entry-attendance/scan — le portier scanne un QR {qrId}
router.post('/scan', protect, authorize('portier', 'surveillant_general', 'directeur', 'super_admin'), async (req, res) => {
  try {
    const sid = schoolId(req)
    const qrId = (req.body.qrId || '').trim()
    if (!qrId) return res.status(400).json({ message: 'QR invalide' })

    // Résout la personne (personnel OU élève) — DOIT appartenir à la même école
    let person = null, personKind = null, role = '', name = '', className = ''
    const user = await User.findOne({ attendanceQrId: qrId })
    if (user) {
      if (String(user.school || '') !== String(sid)) return res.status(403).json({ message: 'QR d\'un autre établissement' })
      person = user; personKind = 'staff'; role = user.role; name = user.name
    } else {
      const student = await Student.findOne({ attendanceQrId: qrId }).populate('class', 'name')
      if (!student) return res.status(404).json({ message: 'QR inconnu' })
      if (String(student.school) !== String(sid)) return res.status(403).json({ message: 'QR d\'un autre établissement' })
      person = student; personKind = 'student'; role = 'eleve'
      name = `${student.lastName} ${student.firstName}`
      className = student.class?.name || ''
    }

    const school = await School.findById(sid).select('attendanceConfig')
    const lateAfterMin = hhmmToMinutes(school?.attendanceConfig?.lateAfter || '08:00')
    const now = new Date()
    const day = todayKey(now)
    const key = personKind === 'staff' ? { user: person._id } : { student: person._id }

    let record = await EntryAttendance.findOne({ school: sid, day, ...key })
    let direction
    if (!record) {
      // 1er scan du jour = ENTRÉE (retard si après lateAfter)
      const nowMin = minutesOfDay(now)
      const late = lateAfterMin !== null && nowMin > lateAfterMin
      record = await EntryAttendance.create({
        school: sid, day, personKind, role, className,
        user: personKind === 'staff' ? person._id : null,
        student: personKind === 'student' ? person._id : null,
        checkInAt: now,
        status: late ? 'late' : 'present',
        lateMinutes: late ? nowMin - lateAfterMin : 0,
        scannedBy: req.user._id,
      })
      direction = 'in'
    } else if (!record.checkOutAt) {
      // 2e scan = SORTIE
      record.checkOutAt = now
      await record.save()
      direction = 'out'
    } else {
      return res.json({
        success: true,
        data: { name, role, className, direction: 'done', status: record.status, time: fmtTime(record.checkInAt), message: 'Entrée et sortie déjà enregistrées aujourd\'hui' },
      })
    }

    // Push best-effort au(x) Surveillant(s) Général(aux) en cas de retard à l'entrée
    if (direction === 'in' && record.status === 'late') {
      try {
        const push = require('../services/pushService')
        const sgs = await User.find({ school: sid, role: 'surveillant_general', isActive: { $ne: false } }).select('_id')
        if (sgs.length) {
          push.sendToUsers(sgs.map((u) => u._id), {
            title: '⏰ Retard signalé',
            body: `${name}${className ? ` (${className})` : ''} est arrivé en retard de ${record.lateMinutes} min`,
            url: '/dashboard/surveillance',
          }).catch(() => {})
        }
      } catch (e) { /* push best-effort */ }
    }

    // Push best-effort au PARENT : entrée (retard ou à l'heure) et sortie de son enfant
    if (personKind === 'student' && person.parentUser) {
      try {
        const push = require('../services/pushService')
        const payload = direction === 'out'
          ? { title: '🏫 Sortie de l\'école', body: `${name} a quitté l'école à ${fmtTime(record.checkOutAt)}`, url: '/dashboard/parent/presence' }
          : record.status === 'late'
            ? { title: '⏰ Retard de votre enfant', body: `${name} est arrivé(e) en retard de ${record.lateMinutes} min (${fmtTime(record.checkInAt)})`, url: '/dashboard/parent/presence' }
            : { title: '✅ Arrivée à l\'école', body: `${name} est arrivé(e) à ${fmtTime(record.checkInAt)}`, url: '/dashboard/parent/presence' }
        push.sendToUser(person.parentUser, payload).catch(() => {})
      } catch (e) { /* push best-effort */ }
    }

    res.json({
      success: true,
      data: {
        name, role, className, direction,
        status: record.status,
        lateMinutes: record.lateMinutes || 0,
        time: fmtTime(direction === 'out' ? record.checkOutAt : record.checkInAt),
      },
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/entry-attendance/today?day= — SG/principal/portier : état du jour + absents
router.get('/today', protect, authorize('surveillant_general', 'portier', 'directeur', 'super_admin'), async (req, res) => {
  try {
    const sid = schoolId(req)
    const day = req.query.day || todayKey()
    const [records, staff, students] = await Promise.all([
      EntryAttendance.find({ school: sid, day }).populate('user', 'name role matricule').populate('student', 'firstName lastName matricule class'),
      User.find({ school: sid, role: { $in: STAFF_ROLES }, isActive: { $ne: false } }).select('name role matricule'),
      Student.find({ school: sid, status: 'active' }).populate('class', 'name').select('firstName lastName matricule class'),
    ])

    const scannedUserIds = new Set(records.filter((r) => r.user).map((r) => String(r.user._id)))
    const scannedStudentIds = new Set(records.filter((r) => r.student).map((r) => String(r.student._id)))

    const staffRecords = records.filter((r) => r.personKind === 'staff').map((r) => ({
      id: r._id, name: r.user?.name || '', role: r.role, matricule: r.user?.matricule || '',
      checkInAt: r.checkInAt, checkOutAt: r.checkOutAt, status: r.status, lateMinutes: r.lateMinutes,
      checkInTime: r.checkInAt ? fmtTime(r.checkInAt) : null, checkOutTime: r.checkOutAt ? fmtTime(r.checkOutAt) : null,
    }))
    const studentRecords = records.filter((r) => r.personKind === 'student').map((r) => ({
      id: r._id, name: r.student ? `${r.student.lastName} ${r.student.firstName}` : '', className: r.className || r.student?.class?.name || '',
      matricule: r.student?.matricule || '',
      checkInAt: r.checkInAt, checkOutAt: r.checkOutAt, status: r.status, lateMinutes: r.lateMinutes,
      checkInTime: r.checkInAt ? fmtTime(r.checkInAt) : null, checkOutTime: r.checkOutAt ? fmtTime(r.checkOutAt) : null,
    }))

    const absentStaff = staff.filter((u) => !scannedUserIds.has(String(u._id))).map((u) => ({ id: u._id, name: u.name, role: u.role, matricule: u.matricule || '' }))
    const absentStudents = students.filter((s) => !scannedStudentIds.has(String(s._id))).map((s) => ({
      id: s._id, name: `${s.lastName} ${s.firstName}`, className: s.class?.name || '', matricule: s.matricule || '',
    }))

    res.json({
      success: true,
      data: {
        day,
        staff: staffRecords,
        students: studentRecords,
        absentStaff,
        absentStudents,
        stats: {
          staffPresent: staffRecords.length,
          staffLate: staffRecords.filter((r) => r.status === 'late').length,
          staffAbsent: absentStaff.length,
          studentsPresent: studentRecords.length,
          studentsLate: studentRecords.filter((r) => r.status === 'late').length,
          studentsAbsent: absentStudents.length,
        },
      },
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/entry-attendance/history?from=&to=&kind= — SG/principal : historique
router.get('/history', protect, authorize('surveillant_general', 'directeur', 'super_admin'), async (req, res) => {
  try {
    const sid = schoolId(req)
    const { from, to, kind } = req.query
    const query = { school: sid }
    if (kind === 'staff' || kind === 'student') query.personKind = kind
    if (from || to) {
      query.day = {}
      if (from) query.day.$gte = from
      if (to) query.day.$lte = to
    }
    const records = await EntryAttendance.find(query)
      .populate('user', 'name role matricule')
      .populate('student', 'firstName lastName matricule class')
      .sort({ day: -1, checkInAt: -1 })
      .limit(2000)
    res.json({ success: true, data: records })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
