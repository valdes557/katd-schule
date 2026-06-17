const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const TeacherAttendance = require('../models/TeacherAttendance')
const Teacher = require('../models/Teacher')
const School = require('../models/School')
const User = require('../models/User')
const { protect, authorize } = require('../middleware/auth')
const { sendEmail } = require('../utils/emailService')

function schoolId(req) { return req.user.school?._id || req.user.school }

// Jour courant au format YYYY-MM-DD (fuseau serveur)
function todayKey(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Convertit "HH:MM" → minutes depuis minuit
function hhmmToMinutes(s) {
  if (!s || typeof s !== 'string') return null
  const [h, m] = s.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

function minutesOfDay(date) {
  return date.getHours() * 60 + date.getMinutes()
}

function fmtTime(date) {
  return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

// S'assure que l'école a un token QR ; le génère si absent.
async function ensureToken(school) {
  if (!school.attendanceQrToken) {
    school.attendanceQrToken = crypto.randomBytes(24).toString('hex')
    await school.save()
  }
  return school.attendanceQrToken
}

// GET /api/teacher-attendance/qr — le directeur récupère le token/QR de l'école
router.get('/qr', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const school = await School.findById(schoolId(req))
    if (!school) return res.status(404).json({ message: 'École introuvable' })
    const token = await ensureToken(school)
    res.json({
      success: true,
      data: {
        token,
        schoolName: school.name,
        config: school.attendanceConfig || { lateAfter: '08:00', earliestDeparture: '16:00' },
      },
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/teacher-attendance/qr/regenerate — régénère le token (invalide l'ancien QR)
router.post('/qr/regenerate', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const school = await School.findById(schoolId(req))
    if (!school) return res.status(404).json({ message: 'École introuvable' })
    school.attendanceQrToken = crypto.randomBytes(24).toString('hex')
    await school.save()
    res.json({ success: true, data: { token: school.attendanceQrToken } })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/teacher-attendance/config — configure heure de retard / sortie minimale
router.put('/config', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const { lateAfter, earliestDeparture } = req.body
    const school = await School.findById(schoolId(req))
    if (!school) return res.status(404).json({ message: 'École introuvable' })
    school.attendanceConfig = {
      lateAfter: lateAfter || school.attendanceConfig?.lateAfter || '08:00',
      earliestDeparture: earliestDeparture || school.attendanceConfig?.earliestDeparture || '16:00',
    }
    await school.save()
    res.json({ success: true, data: school.attendanceConfig })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/teacher-attendance/today — état du jour pour tous les enseignants (directeur)
router.get('/today', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const sid = schoolId(req)
    const day = req.query.day || todayKey()

    const teachers = await Teacher.find({ school: sid, status: 'active' })
      .select('firstName lastName user')
      .sort({ lastName: 1 })

    const records = await TeacherAttendance.find({ school: sid, day })
    const byTeacher = Object.fromEntries(records.map((r) => [r.teacher.toString(), r]))

    const data = teachers.map((t) => {
      const r = byTeacher[t._id.toString()]
      return {
        teacherId: t._id,
        name: `${t.lastName} ${t.firstName}`,
        checkInAt: r?.checkInAt || null,
        checkOutAt: r?.checkOutAt || null,
        status: r ? r.status : 'absent',
        lateMinutes: r?.lateMinutes || 0,
        earlyDeparture: r?.earlyDeparture || false,
        earlyMinutes: r?.earlyMinutes || 0,
      }
    })

    res.json({ success: true, data, day })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// Dernier jour d'un mois "YYYY-MM"
function lastDayOfMonth(month) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m, 0).getDate()
  return `${month}-${String(d).padStart(2, '0')}`
}

// Résout la période demandée → { from, to } au format YYYY-MM-DD
function resolvePeriod(query) {
  if (query.month && /^\d{4}-\d{2}$/.test(query.month)) {
    return { from: `${query.month}-01`, to: lastDayOfMonth(query.month) }
  }
  const to = query.to && /^\d{4}-\d{2}-\d{2}$/.test(query.to) ? query.to : todayKey()
  let from = query.from && /^\d{4}-\d{2}-\d{2}$/.test(query.from) ? query.from : null
  if (!from) {
    const d = new Date(to)
    d.setDate(d.getDate() - 29)
    from = todayKey(d)
  }
  return { from, to }
}

// GET /api/teacher-attendance/history — historique des pointages (directeur)
// Query: from, to (YYYY-MM-DD), teacherId (optionnel)
router.get('/history', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const sid = schoolId(req)
    const { from, to } = resolvePeriod(req.query)

    const filter = { school: sid, day: { $gte: from, $lte: to } }
    if (req.query.teacherId) filter.teacher = req.query.teacherId

    const records = await TeacherAttendance.find(filter)
      .populate('teacher', 'firstName lastName')
      .sort({ day: -1, checkInAt: -1 })
      .limit(1000)

    const data = records.map((r) => ({
      id: r._id,
      teacherId: r.teacher?._id || r.teacher,
      name: r.teacher ? `${r.teacher.lastName} ${r.teacher.firstName}` : '—',
      day: r.day,
      checkInAt: r.checkInAt || null,
      checkOutAt: r.checkOutAt || null,
      status: r.status,
      lateMinutes: r.lateMinutes || 0,
      earlyDeparture: r.earlyDeparture || false,
      earlyMinutes: r.earlyMinutes || 0,
    }))

    res.json({ success: true, data, period: { from, to } })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/teacher-attendance/stats — synthèse mensuelle par enseignant (directeur)
// Query: month=YYYY-MM OU from/to
router.get('/stats', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const sid = schoolId(req)
    const { from, to } = resolvePeriod(req.query)

    const teachers = await Teacher.find({ school: sid, status: 'active' })
      .select('firstName lastName')
      .sort({ lastName: 1 })

    const records = await TeacherAttendance.find({ school: sid, day: { $gte: from, $lte: to } })

    // Jours d'ouverture (proxy) = jours distincts où au moins un enseignant a pointé
    const openDays = new Set(records.map((r) => r.day))
    const workingDays = openDays.size

    const byTeacher = {}
    for (const r of records) {
      const key = r.teacher.toString()
      if (!byTeacher[key]) {
        byTeacher[key] = { daysPresent: 0, daysLate: 0, lateMinutes: 0, earlyDepartures: 0, earlyMinutes: 0 }
      }
      const s = byTeacher[key]
      s.daysPresent += 1
      if (r.status === 'late') { s.daysLate += 1; s.lateMinutes += r.lateMinutes || 0 }
      if (r.earlyDeparture) { s.earlyDepartures += 1; s.earlyMinutes += r.earlyMinutes || 0 }
    }

    const perTeacher = teachers.map((t) => {
      const s = byTeacher[t._id.toString()] || { daysPresent: 0, daysLate: 0, lateMinutes: 0, earlyDepartures: 0, earlyMinutes: 0 }
      const onTime = s.daysPresent - s.daysLate
      return {
        teacherId: t._id,
        name: `${t.lastName} ${t.firstName}`,
        daysPresent: s.daysPresent,
        daysLate: s.daysLate,
        lateMinutes: s.lateMinutes,
        earlyDepartures: s.earlyDepartures,
        earlyMinutes: s.earlyMinutes,
        daysAbsent: Math.max(0, workingDays - s.daysPresent),
        punctualityRate: s.daysPresent ? Math.round((onTime / s.daysPresent) * 100) : null,
      }
    })

    const totals = perTeacher.reduce((acc, t) => ({
      daysPresent: acc.daysPresent + t.daysPresent,
      daysLate: acc.daysLate + t.daysLate,
      lateMinutes: acc.lateMinutes + t.lateMinutes,
      earlyDepartures: acc.earlyDepartures + t.earlyDepartures,
      earlyMinutes: acc.earlyMinutes + t.earlyMinutes,
    }), { daysPresent: 0, daysLate: 0, lateMinutes: 0, earlyDepartures: 0, earlyMinutes: 0 })

    res.json({
      success: true,
      data: {
        period: { from, to },
        workingDays,
        teacherCount: teachers.length,
        totals,
        teachers: perTeacher,
      },
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/teacher-attendance/me — état du jour de l'enseignant connecté
router.get('/me', protect, async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ user: req.user._id })
    if (!teacher) return res.json({ success: true, data: null })
    const day = todayKey()
    const r = await TeacherAttendance.findOne({ teacher: teacher._id, day })
    res.json({ success: true, data: r || null })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/teacher-attendance/scan — l'enseignant scanne le QR (arrivée puis départ)
router.post('/scan', protect, authorize('enseignant'), async (req, res) => {
  try {
    const { token } = req.body
    if (!token) return res.status(400).json({ message: 'QR code invalide' })

    const sid = schoolId(req)
    const school = await School.findById(sid)
    if (!school) return res.status(404).json({ message: 'École introuvable' })

    // Le QR scanné doit correspondre au token de l'école de l'enseignant
    if (!school.attendanceQrToken || school.attendanceQrToken !== token) {
      return res.status(400).json({ message: "Ce QR code ne correspond pas à votre école" })
    }

    const teacher = await Teacher.findOne({ user: req.user._id, school: sid })
    if (!teacher) return res.status(404).json({ message: 'Profil enseignant introuvable' })

    const now = new Date()
    const day = todayKey(now)
    const cfg = school.attendanceConfig || { lateAfter: '08:00', earliestDeparture: '16:00' }

    let record = await TeacherAttendance.findOne({ teacher: teacher._id, day })

    // Premier scan du jour → ARRIVÉE
    if (!record) {
      const lateLimit = hhmmToMinutes(cfg.lateAfter)
      const nowMin = minutesOfDay(now)
      let status = 'present'
      let lateMinutes = 0
      if (lateLimit !== null && nowMin > lateLimit) {
        status = 'late'
        lateMinutes = nowMin - lateLimit
      }

      record = await TeacherAttendance.create({
        teacher: teacher._id,
        user: req.user._id,
        school: sid,
        day,
        checkInAt: now,
        status,
        lateMinutes,
      })

      notifyDirector(school, teacher, {
        kind: 'arrivee', time: now, status, lateMinutes,
      }).catch(() => {})

      return res.json({
        success: true,
        data: { type: 'checkin', status, lateMinutes, time: now },
        message: status === 'late'
          ? `Arrivée enregistrée à ${fmtTime(now)} — en retard de ${lateMinutes} min`
          : `Arrivée enregistrée à ${fmtTime(now)}`,
      })
    }

    // Déjà arrivé mais pas encore parti → DÉPART
    if (!record.checkOutAt) {
      const minLimit = hhmmToMinutes(cfg.earliestDeparture)
      const nowMin = minutesOfDay(now)
      let earlyDeparture = false
      let earlyMinutes = 0
      if (minLimit !== null && nowMin < minLimit) {
        earlyDeparture = true
        earlyMinutes = minLimit - nowMin
      }
      record.checkOutAt = now
      record.earlyDeparture = earlyDeparture
      record.earlyMinutes = earlyMinutes
      await record.save()

      notifyDirector(school, teacher, {
        kind: 'depart', time: now, earlyDeparture, earlyMinutes,
      }).catch(() => {})

      return res.json({
        success: true,
        data: { type: 'checkout', earlyDeparture, earlyMinutes, time: now },
        message: earlyDeparture
          ? `Départ enregistré à ${fmtTime(now)} — départ anticipé de ${earlyMinutes} min`
          : `Départ enregistré à ${fmtTime(now)}`,
      })
    }

    // Déjà arrivé ET parti
    return res.status(400).json({ message: 'Vous avez déjà pointé votre arrivée et votre départ aujourd\'hui' })
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Pointage déjà enregistré' })
    res.status(500).json({ message: err.message })
  }
})

// Envoie un email au directeur (best-effort)
async function notifyDirector(school, teacher, info) {
  try {
    const director = school.director
      ? await User.findById(school.director).select('email name')
      : await User.findOne({ school: school._id, role: 'directeur', isActive: true }).select('email name')
    if (!director?.email) return

    const teacherName = `${teacher.lastName} ${teacher.firstName}`
    const t = fmtTime(info.time)
    let title, detail
    if (info.kind === 'arrivee') {
      title = `🟢 Arrivée — ${teacherName}`
      detail = info.status === 'late'
        ? `<p style="color:#DC2626;font-weight:700">En retard de ${info.lateMinutes} min</p>`
        : `<p style="color:#16A34A;font-weight:700">À l'heure</p>`
      detail = `<p>Heure d'arrivée : <strong>${t}</strong></p>${detail}`
    } else {
      title = `🔴 Départ — ${teacherName}`
      detail = info.earlyDeparture
        ? `<p style="color:#DC2626;font-weight:700">Départ anticipé de ${info.earlyMinutes} min</p>`
        : ''
      detail = `<p>Heure de départ : <strong>${t}</strong></p>${detail}`
    }

    await sendEmail({
      to: director.email,
      subject: `${title} — ${school.name}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:20px">
          <h2 style="color:#111827;margin-bottom:4px">${title}</h2>
          <p style="color:#6B7280;margin-top:0">Pointage du personnel — ${school.name}</p>
          <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:14px 16px;margin-top:12px">
            <p style="margin:0 0 6px">Enseignant : <strong>${teacherName}</strong></p>
            ${detail}
          </div>
        </div>
      `,
    })
  } catch (_) { /* silencieux */ }
}

module.exports = router
