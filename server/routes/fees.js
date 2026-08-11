const express = require('express')
const router = express.Router()
const Fee = require('../models/Fee')
const Student = require('../models/Student')
const School = require('../models/School')
const User = require('../models/User')
const { protect, authorize } = require('../middleware/auth')
const { sendEmail } = require('../utils/emailService')
const wallet = require('../services/walletService')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const PDFDocument = require('pdfkit')

// Helper: ensure school match
function schoolId(req) { return req.user.school?._id || req.user.school }

// Helper: montant net d'un frais après remise
const netOf = (f) => Math.max(0, (f.amount || 0) - (f.discount?.amount || 0))

// GET /api/fees — List all fees for the school (director)
router.get('/', protect, authorize('directeur', 'super_admin', 'caissiere'), async (req, res) => {
  try {
    const { classId, studentId, status, page = 1, limit = 50 } = req.query
    const query = { school: schoolId(req) }
    if (studentId) query.student = studentId
    if (status) query.status = status

    let studentFilter = null
    if (classId) {
      const students = await Student.find({ class: classId, school: schoolId(req) }).select('_id')
      studentFilter = students.map((s) => s._id)
      query.student = { $in: studentFilter }
    }

    const total = await Fee.countDocuments(query)
    const fees = await Fee.find(query)
      .populate('student', 'firstName lastName matricule class')
      .populate({ path: 'student', populate: { path: 'class', select: 'name level' } })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
    res.json({ success: true, total, data: fees })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/fees/payment-status — Summary by class: who paid/not paid
router.get('/payment-status', protect, authorize('directeur', 'super_admin', 'caissiere'), async (req, res) => {
  try {
    const { classId } = req.query
    if (!classId) return res.status(400).json({ message: 'classId requis' })

    const students = await Student.find({ class: classId, school: schoolId(req), status: 'active' })
      .populate('class', 'name')
    const studentIds = students.map((s) => s._id)
    const fees = await Fee.find({ student: { $in: studentIds }, school: schoolId(req) })

    const result = students.map((s) => {
      const studentFees = fees.filter((f) => f.student.toString() === s._id.toString())
      const totalDue = studentFees.reduce((sum, f) => sum + netOf(f), 0)
      const totalPaid = studentFees.reduce((sum, f) => sum + f.paid, 0)
      const totalDiscount = studentFees.reduce((sum, f) => sum + (f.discount?.amount || 0), 0)
      const allInstallmentsPaid = studentFees.every((f) =>
        f.paymentMode === 'complet'
          ? f.status === 'paid'
          : f.installments.every((i) => i.paid)
      )
      return {
        studentId: s._id,
        name: `${s.lastName} ${s.firstName}`,
        matricule: s.matricule,
        totalDue,
        totalPaid,
        totalDiscount,
        remaining: Math.max(0, totalDue - totalPaid),
        fullyPaid: totalDue > 0 && totalPaid >= totalDue,
        allInstallmentsPaid,
        fees: studentFees.map((f) => ({
          _id: f._id,
          label: f.label,
          type: f.type,
          amount: f.amount,
          netAmount: netOf(f),
          discount: f.discount?.amount > 0 ? f.discount : null,
          paid: f.paid,
          status: f.status,
          dueDate: f.dueDate,
          term: f.term,
          academicYear: f.academicYear,
          paymentMode: f.paymentMode,
          installments: f.installments,
        })),
      }
    })
    res.json({ success: true, data: result })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/fees/payment-history — Directeur: tous les paiements par élève/parent + reste
router.get('/payment-history', protect, authorize('directeur', 'super_admin', 'caissiere'), async (req, res) => {
  try {
    const { classId } = req.query
    const query = { school: schoolId(req) }
    if (classId) {
      const students = await Student.find({ class: classId, school: schoolId(req) }).select('_id')
      query.student = { $in: students.map((s) => s._id) }
    }

    const fees = await Fee.find(query)
      .populate('student', 'firstName lastName matricule class parent')
      .populate({ path: 'student', populate: { path: 'class', select: 'name level' } })
      .sort({ createdAt: -1 })

    // Regrouper par élève
    const byStudent = new Map()
    for (const f of fees) {
      const s = f.student
      if (!s) continue
      const key = s._id.toString()
      if (!byStudent.has(key)) {
        byStudent.set(key, {
          studentId: s._id,
          studentName: `${s.lastName} ${s.firstName}`,
          matricule: s.matricule,
          className: s.class?.name || '—',
          parentName: s.parent?.name || '—',
          parentPhone: s.parent?.phone || '',
          totalDue: 0,
          totalPaid: 0,
          totalDiscount: 0,
          remaining: 0,
          payments: [],
          discounts: [],
        })
      }
      const entry = byStudent.get(key)
      entry.totalDue += netOf(f)
      entry.totalPaid += f.paid || 0
      if (f.discount?.amount > 0) {
        entry.totalDiscount += f.discount.amount
        entry.discounts.push({
          feeId: f._id,
          label: f.label,
          amount: f.discount.amount,
          type: f.discount.type,
          value: f.discount.value,
          reason: f.discount.reason,
          date: f.discount.date,
        })
      }
      ;(f.payments || []).forEach((p, idx) => {
        entry.payments.push({
          feeId: f._id,
          paymentIndex: idx,
          label: f.label,
          amount: p.amount,
          method: p.method,
          reference: p.reference,
          date: p.date,
          note: p.note,
        })
      })
    }

    const data = Array.from(byStudent.values()).map((e) => {
      e.remaining = Math.max(0, e.totalDue - e.totalPaid)
      e.payments.sort((a, b) => new Date(b.date) - new Date(a.date))
      return e
    }).sort((a, b) => a.studentName.localeCompare(b.studentName))

    const summary = {
      totalDue: data.reduce((s, e) => s + e.totalDue, 0),
      totalPaid: data.reduce((s, e) => s + e.totalPaid, 0),
      totalDiscount: data.reduce((s, e) => s + e.totalDiscount, 0),
      remaining: data.reduce((s, e) => s + e.remaining, 0),
      studentCount: data.length,
    }

    res.json({ success: true, data, summary })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/fees/period-report?period=day|week|month|year&from=&to= — encaissements
// agrégés par période (rapport journalier / hebdomadaire / mensuel / annuel de la caissière, G5).
// Parcourt chaque paiement individuel (sous-tableau payments) et le range dans son seau.
router.get('/period-report', protect, authorize('directeur', 'super_admin', 'caissiere'), async (req, res) => {
  try {
    const Expense = require('../models/Expense')
    const period = ['day', 'week', 'month', 'year'].includes(req.query.period) ? req.query.period : 'day'
    // Plage par défaut selon la granularité (jour → 30 derniers jours, etc.).
    const now = new Date()
    let from = req.query.from ? new Date(req.query.from) : null
    let to = req.query.to ? new Date(req.query.to) : null
    if (!from) {
      from = new Date(now)
      if (period === 'day') from.setDate(from.getDate() - 30)
      else if (period === 'week') from.setDate(from.getDate() - 7 * 12)
      else if (period === 'month') from.setMonth(from.getMonth() - 12)
      else from.setFullYear(from.getFullYear() - 5)
    }
    if (!to) to = now
    from.setHours(0, 0, 0, 0)
    to.setHours(23, 59, 59, 999)

    // Clé de seau + libellé lisible pour une date donnée.
    const bucketKey = (d) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      if (period === 'day') return `${y}-${m}-${day}`
      if (period === 'month') return `${y}-${m}`
      if (period === 'year') return `${y}`
      // Semaine ISO : année-Wnn
      const tmp = new Date(Date.UTC(y, d.getMonth(), d.getDate()))
      const dayNum = (tmp.getUTCDay() + 6) % 7
      tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3)
      const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4))
      const week = 1 + Math.round(((tmp - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
      return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
    }

    const fees = await Fee.find({ school: schoolId(req) }).select('payments').lean()
    const buckets = new Map()
    let totalCollected = 0
    let paymentCount = 0
    for (const f of fees) {
      for (const p of f.payments || []) {
        if (!p.date) continue
        const d = new Date(p.date)
        if (d < from || d > to) continue
        const key = bucketKey(d)
        if (!buckets.has(key)) buckets.set(key, { period: key, collected: 0, count: 0 })
        const b = buckets.get(key)
        b.collected += p.amount || 0
        b.count += 1
        totalCollected += p.amount || 0
        paymentCount += 1
      }
    }

    // Dépenses de la même plage, agrégées par seau.
    const expenses = await Expense.find({ school: schoolId(req), date: { $gte: from, $lte: to } }).select('amount date').lean()
    let totalExpenses = 0
    for (const e of expenses) {
      const d = new Date(e.date)
      const key = bucketKey(d)
      if (!buckets.has(key)) buckets.set(key, { period: key, collected: 0, count: 0 })
      const b = buckets.get(key)
      b.expenses = (b.expenses || 0) + (e.amount || 0)
      totalExpenses += e.amount || 0
    }

    const rows = Array.from(buckets.values())
      .map((b) => ({ ...b, expenses: b.expenses || 0, net: (b.collected || 0) - (b.expenses || 0) }))
      .sort((a, b) => b.period.localeCompare(a.period))

    res.json({
      success: true,
      period,
      from: from.toISOString(),
      to: to.toISOString(),
      data: rows,
      summary: {
        totalCollected,
        totalExpenses,
        net: totalCollected - totalExpenses,
        paymentCount,
      },
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/fees — Create fee for a student
router.post('/', protect, authorize('directeur', 'super_admin', 'caissiere'), async (req, res) => {
  try {
    const { studentId, label, type, amount, dueDate, term, academicYear, paymentMode, installments } = req.body
    const student = await Student.findOne({ _id: studentId, school: schoolId(req) })
    if (!student) return res.status(404).json({ message: 'Élève non trouvé' })

    const fee = await Fee.create({
      student: studentId,
      school: schoolId(req),
      label: label || 'Frais de scolarité',
      type: type || 'scolarite',
      amount: Number(amount),
      dueDate,
      term,
      academicYear: academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      status: 'pending',
      paymentMode: paymentMode || 'complet',
      installments: paymentMode === 'tranches' ? (installments || []) : [],
    })

    await fee.populate('student', 'firstName lastName matricule')
    res.status(201).json({ success: true, data: fee })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/fees/bulk-assign — Associer des frais à TOUS les élèves (classe ou école entière)
// source 'manual' : même montant/tranches pour tous.
// source 'modality' : montant/tranches récupérés depuis PaymentModality selon la classe.
router.post('/bulk-assign', protect, authorize('directeur', 'super_admin', 'caissiere'), async (req, res) => {
  try {
    const sid = schoolId(req)
    if (!sid) return res.status(400).json({ message: 'Aucune école associée à votre compte' })

    const {
      scope = 'all', source = 'manual', label, type, dueDate, term,
      academicYear, paymentMode = 'complet', amount, installments,
    } = req.body

    const feeLabel = label || 'Frais de scolarité'
    const year = academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`

    // Élèves concernés (actifs)
    const studentQuery = { school: sid, status: 'active' }
    if (scope && scope !== 'all') studentQuery.class = scope
    const students = await Student.find(studentQuery).populate('class', 'name level')
    if (students.length === 0) {
      return res.status(400).json({ message: 'Aucun élève actif trouvé pour cette sélection' })
    }

    // Modalités par classe (pour source 'modality')
    let modalitiesByClass = {}
    if (source === 'modality') {
      const PaymentModality = require('../models/PaymentModality')
      const modalities = await PaymentModality.find({ school: sid })
      modalitiesByClass = Object.fromEntries(modalities.map((m) => [m.className, m]))
    }

    // Frais déjà existants (anti-doublon) pour ce label + année
    const existing = await Fee.find({ school: sid, label: feeLabel, academicYear: year }).select('student')
    const alreadyHas = new Set(existing.map((f) => f.student.toString()))

    const docs = []
    let skipped = 0
    let noModality = 0

    for (const s of students) {
      if (alreadyHas.has(s._id.toString())) { skipped++; continue }

      let feeAmount = Number(amount) || 0
      let feeInstallments = paymentMode === 'tranches' ? (installments || []) : []
      let feeMode = paymentMode

      if (source === 'modality') {
        const modality = s.class?.name ? modalitiesByClass[s.class.name] : null
        if (!modality) { noModality++; continue }
        feeAmount = modality.totalAmount
        if (Array.isArray(modality.installments) && modality.installments.length > 0) {
          feeMode = 'tranches'
          feeInstallments = modality.installments.map((inst) => ({
            label: inst.label,
            amount: inst.amount,
            dueDate: inst.deadline || undefined,
          }))
        } else {
          feeMode = 'complet'
          feeInstallments = []
        }
      }

      if (!feeAmount || feeAmount <= 0) { skipped++; continue }

      docs.push({
        student: s._id,
        school: sid,
        label: feeLabel,
        type: type || 'scolarite',
        amount: feeAmount,
        dueDate: dueDate || undefined,
        term,
        academicYear: year,
        status: 'pending',
        paymentMode: feeMode,
        installments: feeInstallments,
      })
    }

    if (docs.length > 0) await Fee.insertMany(docs)

    res.status(201).json({
      success: true,
      data: { created: docs.length, skipped, noModality, totalStudents: students.length },
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ───────────── Barèmes de pension par classe (PaymentModality) ─────────────
// Le directeur / la caissière définit LA PENSION D'UNE CLASSE : prix total + tranches.
// Ces barèmes sont ensuite assignés aux élèves (création d'un Fee par élève).
const PaymentModality = require('../models/PaymentModality')

function cleanInstallments(installments) {
  return Array.isArray(installments)
    ? installments
        .filter((i) => i && i.label && Number(i.amount) > 0)
        .map((i) => ({ label: String(i.label).trim(), amount: Number(i.amount), deadline: i.deadline ? String(i.deadline) : '' }))
    : []
}

// GET /api/fees/modalities — liste des barèmes de pension de l'école
router.get('/modalities', protect, authorize('directeur', 'super_admin', 'caissiere'), async (req, res) => {
  try {
    const list = await PaymentModality.find({ school: schoolId(req) }).sort({ order: 1, className: 1 })
    res.json({ success: true, data: list })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/fees/modalities — crée un barème de pension pour une classe
router.post('/modalities', protect, authorize('directeur', 'super_admin', 'caissiere'), async (req, res) => {
  try {
    const sid = schoolId(req)
    if (!sid) return res.status(400).json({ message: 'Aucune école associée à votre compte' })
    const { className, totalAmount, installments, order } = req.body
    if (!className || !String(className).trim()) return res.status(400).json({ message: 'Classe requise' })
    const total = Number(totalAmount)
    if (!(total > 0)) return res.status(400).json({ message: 'Montant total invalide' })
    const m = await PaymentModality.create({
      school: sid, className: String(className).trim(), totalAmount: total,
      installments: cleanInstallments(installments), order: Number(order) || 0,
    })
    res.status(201).json({ success: true, data: m })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/fees/modalities/:id — modifie un barème
router.put('/modalities/:id', protect, authorize('directeur', 'super_admin', 'caissiere'), async (req, res) => {
  try {
    const m = await PaymentModality.findOne({ _id: req.params.id, school: schoolId(req) })
    if (!m) return res.status(404).json({ message: 'Barème introuvable' })
    const { className, totalAmount, installments, order } = req.body
    if (className !== undefined) m.className = String(className).trim()
    if (totalAmount !== undefined) { const t = Number(totalAmount); if (!(t > 0)) return res.status(400).json({ message: 'Montant total invalide' }); m.totalAmount = t }
    if (installments !== undefined) m.installments = cleanInstallments(installments)
    if (order !== undefined) m.order = Number(order) || 0
    await m.save()
    res.json({ success: true, data: m })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// DELETE /api/fees/modalities/:id — supprime un barème
router.delete('/modalities/:id', protect, authorize('directeur', 'super_admin', 'caissiere'), async (req, res) => {
  try {
    const m = await PaymentModality.findOneAndDelete({ _id: req.params.id, school: schoolId(req) })
    if (!m) return res.status(404).json({ message: 'Barème introuvable' })
    res.json({ success: true })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/fees/modalities/:id/assign — assigne le barème à tous les élèves actifs de la classe
// (crée un Fee de type 'pension' par élève, anti-doublon par label + année scolaire)
router.post('/modalities/:id/assign', protect, authorize('directeur', 'super_admin', 'caissiere'), async (req, res) => {
  try {
    const sid = schoolId(req)
    const m = await PaymentModality.findOne({ _id: req.params.id, school: sid })
    if (!m) return res.status(404).json({ message: 'Barème introuvable' })

    const year = req.body.academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
    const feeLabel = req.body.label || `Pension ${m.className} ${year}`

    // Élèves actifs de la classe (match par nom de classe)
    const students = await Student.find({ school: sid, status: 'active' }).populate('class', 'name')
    const target = students.filter((s) => s.class?.name === m.className)
    if (target.length === 0) return res.status(400).json({ message: `Aucun élève actif dans la classe ${m.className}` })

    // Anti-doublon
    const existing = await Fee.find({ school: sid, label: feeLabel, academicYear: year }).select('student')
    const alreadyHas = new Set(existing.map((f) => f.student.toString()))

    const hasTranches = Array.isArray(m.installments) && m.installments.length > 0
    // dueDate est obligatoire sur Fee.installments -> fallback si deadline absente/invalide
    const fallbackDue = req.body.dueDate ? new Date(req.body.dueDate) : new Date()
    const mkInstallments = () => m.installments.map((inst) => {
      const d = inst.deadline ? new Date(inst.deadline) : null
      return { label: inst.label, amount: inst.amount, dueDate: (d && !isNaN(d)) ? d : fallbackDue }
    })

    const docs = []
    let skipped = 0
    for (const s of target) {
      if (alreadyHas.has(s._id.toString())) { skipped++; continue }
      docs.push({
        student: s._id, school: sid, label: feeLabel, type: 'pension',
        amount: m.totalAmount, academicYear: year, status: 'pending',
        dueDate: hasTranches ? undefined : fallbackDue,
        paymentMode: hasTranches ? 'tranches' : 'complet',
        installments: hasTranches ? mkInstallments() : [],
      })
    }
    if (docs.length > 0) await Fee.insertMany(docs)
    res.json({ success: true, data: { created: docs.length, skipped, totalStudents: target.length, className: m.className } })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/fees/:id — Update fee (champs autorisés uniquement)
router.put('/:id', protect, authorize('directeur', 'super_admin', 'caissiere'), async (req, res) => {
  try {
    const fee = await Fee.findOne({ _id: req.params.id, school: schoolId(req) })
    if (!fee) return res.status(404).json({ message: 'Frais non trouvé' })

    const ALLOWED = ['label', 'type', 'amount', 'dueDate', 'term', 'academicYear', 'paymentMode', 'installments']
    for (const k of ALLOWED) {
      if (req.body[k] !== undefined) fee[k] = req.body[k]
    }
    if (req.body.amount !== undefined) {
      const amt = Number(req.body.amount)
      if (!(amt > 0)) return res.status(400).json({ message: 'Montant invalide' })
      if (amt < (fee.paid || 0)) {
        return res.status(400).json({ message: `Le montant ne peut être inférieur au total déjà payé (${(fee.paid || 0).toLocaleString('fr-FR')} F CFA)` })
      }
      fee.amount = amt
      // La remise en pourcentage est recalculée sur le nouveau montant
      if (fee.discount?.amount > 0 && fee.discount.type === 'percentage') {
        fee.discount.amount = Math.round((amt * fee.discount.value) / 100)
        fee.markModified('discount')
      }
    }
    if (fee.paymentMode === 'complet') fee.installments = []
    await fee.save()
    await fee.populate('student', 'firstName lastName matricule')
    res.json({ success: true, data: fee })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/fees/:id/discount — Attribuer une remise/réduction sur un frais (motif obligatoire)
router.post('/:id/discount', protect, authorize('directeur', 'super_admin', 'caissiere'), async (req, res) => {
  try {
    const fee = await Fee.findOne({ _id: req.params.id, school: schoolId(req) })
      .populate({ path: 'student', select: 'firstName lastName parentUser', populate: { path: 'parentUser', select: 'email name' } })
    if (!fee) return res.status(404).json({ message: 'Frais non trouvé' })

    const { type, value, reason } = req.body
    if (!['fixed', 'percentage'].includes(type)) return res.status(400).json({ message: 'Type de remise invalide' })
    const v = Number(value)
    if (!(v > 0)) return res.status(400).json({ message: 'Valeur de remise invalide' })
    if (type === 'percentage' && v > 100) return res.status(400).json({ message: 'Le pourcentage ne peut dépasser 100%' })
    if (!reason || !String(reason).trim()) return res.status(400).json({ message: 'Le motif de la remise est obligatoire' })

    const amount = type === 'percentage' ? Math.round((fee.amount * v) / 100) : v
    if (amount > fee.amount) return res.status(400).json({ message: 'La remise dépasse le montant du frais' })

    fee.discount = { type, value: v, amount, reason: String(reason).trim(), date: new Date(), grantedBy: req.user._id }
    await fee.save() // le pre-save recalcule le status

    // Notifie le parent (best-effort)
    const fullName = `${fee.student?.lastName || ''} ${fee.student?.firstName || ''}`.trim()
    if (fee.student?.parentUser?._id) {
      try {
        const push = require('../services/pushService')
        push.sendToUser(fee.student.parentUser._id, {
          title: '🎁 Réduction accordée',
          body: `Une réduction de ${amount.toLocaleString('fr-FR')} F a été accordée pour ${fullName} (${fee.label}). Motif : ${fee.discount.reason}`,
          url: '/dashboard/parent/finances',
        }).catch(() => {})
      } catch (e) { /* push best-effort */ }
    }
    if (fee.student?.parentUser?.email) {
      sendEmail({
        to: fee.student.parentUser.email,
        subject: `🎁 Réduction accordée — ${fee.label}`,
        html: `<p>Bonjour,</p><p>Une réduction de <strong>${amount.toLocaleString('fr-FR')} F CFA</strong> a été accordée pour <strong>${fullName}</strong> concernant : ${fee.label}.</p><p>Motif : <strong>${fee.discount.reason}</strong></p><p>Nouveau montant à payer : <strong>${netOf(fee).toLocaleString('fr-FR')} F CFA</strong>.</p>`,
      }).catch(() => {})
    }

    res.json({ success: true, message: 'Remise appliquée', data: fee })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// DELETE /api/fees/:id/discount — Retirer la remise d'un frais
router.delete('/:id/discount', protect, authorize('directeur', 'super_admin', 'caissiere'), async (req, res) => {
  try {
    const fee = await Fee.findOne({ _id: req.params.id, school: schoolId(req) })
    if (!fee) return res.status(404).json({ message: 'Frais non trouvé' })
    if (!fee.discount?.amount) return res.status(400).json({ message: 'Aucune remise sur ce frais' })
    fee.discount = undefined
    fee.markModified('discount')
    await fee.save() // le pre-save recalcule le status (peut repasser partial)
    res.json({ success: true, message: 'Remise retirée', data: fee })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/fees/:id/record-payment — Record a payment (full or installment)
router.post('/:id/record-payment', protect, authorize('directeur', 'super_admin', 'caissiere'), async (req, res) => {
  try {
    const fee = await Fee.findOne({ _id: req.params.id, school: schoolId(req) })
      .populate('student', 'firstName lastName parentUser')
      .populate({ path: 'student', populate: { path: 'parentUser', select: 'email name' } })
    if (!fee) return res.status(404).json({ message: 'Frais non trouvé' })

    const { amount, method = 'cash', reference = '', note = '', installmentIndex } = req.body

    // If paying an installment tranche
    if (installmentIndex !== undefined && fee.installments[installmentIndex]) {
      const inst = fee.installments[installmentIndex]
      inst.paid = true
      inst.paidAt = new Date()
      inst.paidAmount = amount
      inst.method = method
      inst.reference = reference
    }

    // Add to payments history
    fee.payments.push({ amount, method, reference, note })
    fee.paid = (fee.paid || 0) + Number(amount)
    await fee.save() // le pre-save recalcule le status (tient compte de la remise)

    // Notify parent by email + push
    const parentEmail = fee.student?.parentUser?.email
    if (fee.student?.parentUser?._id) {
      try {
        const push = require('../services/pushService')
        push.sendToUser(fee.student.parentUser._id, {
          title: '✅ Paiement enregistré',
          body: `${Number(amount).toLocaleString('fr-FR')} F reçus pour ${fee.student?.lastName} ${fee.student?.firstName} (${fee.label}). Reste : ${Math.max(0, netOf(fee) - fee.paid).toLocaleString('fr-FR')} F`,
          url: '/dashboard/parent/finances',
        }).catch(() => {})
      } catch (e) { /* push best-effort */ }
    }
    if (parentEmail) {
      sendEmail({
        to: parentEmail,
        subject: `✅ Paiement enregistré — ${fee.label}`,
        html: `<p>Bonjour,</p><p>Un paiement de <strong>${Number(amount).toLocaleString()} F CFA</strong> a été enregistré pour <strong>${fee.student?.lastName} ${fee.student?.firstName}</strong> concernant : ${fee.label}.</p><p>Solde restant : <strong>${Math.max(0, netOf(fee) - fee.paid).toLocaleString()} F CFA</strong>.</p>`,
      }).catch(() => {})
    }

    res.json({ success: true, data: fee })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/fees/:id/pay-wallet — Le parent paie un frais depuis son portefeuille (PIN requis)
// Débite le parent, crédite le portefeuille du directeur de l'école, enregistre le paiement
// (method 'wallet') et renvoie l'index du paiement pour télécharger le reçu PDF.
router.post('/:id/pay-wallet', protect, authorize('parent'), async (req, res) => {
  try {
    const { pin, installmentIndex } = req.body
    if (!pin) return res.status(400).json({ message: 'Code PIN requis' })

    const fee = await Fee.findById(req.params.id)
      .populate('student', 'firstName lastName parentUser school')
    if (!fee) return res.status(404).json({ message: 'Frais non trouvé' })

    // Le parent doit être le parent de l'élève concerné
    const student = fee.student
    if (!student || String(student.parentUser || '') !== String(req.user._id)) {
      return res.status(403).json({ message: 'Accès refusé : cet élève ne vous est pas rattaché' })
    }

    // Paiement d'une TRANCHE précise (installmentIndex) : le montant = celui de la tranche.
    let instIdx = null
    let amt
    if (installmentIndex !== undefined && installmentIndex !== null && installmentIndex !== '') {
      instIdx = Number(installmentIndex)
      const inst = fee.installments?.[instIdx]
      if (!inst) return res.status(400).json({ message: 'Tranche introuvable' })
      if (inst.paid) return res.status(400).json({ message: 'Cette tranche est déjà payée' })
      amt = Number(inst.amount)
    } else {
      amt = Number(req.body.amount)
    }
    if (!amt || amt <= 0) return res.status(400).json({ message: 'Montant invalide' })

    // Ne pas payer plus que le reste dû (après remise éventuelle)
    const remaining = Math.max(0, netOf(fee) - (fee.paid || 0))
    if (remaining <= 0) return res.status(400).json({ message: 'Ce frais est déjà entièrement payé' })
    if (instIdx !== null) {
      // La remise peut rendre la somme des tranches supérieure au reste net : on cappe la tranche
      amt = Math.min(amt, remaining)
    } else if (amt > remaining) {
      return res.status(400).json({ message: `Le montant dépasse le reste à payer (${remaining.toLocaleString('fr-FR')} F CFA)` })
    }

    // Vérifie le PIN du parent
    const u = await User.findById(req.user._id).select('+walletPin')
    if (!u.walletPin) return res.status(400).json({ message: "Veuillez d'abord créer votre code PIN dans votre portefeuille" })
    const pinOk = await bcrypt.compare(String(pin), u.walletPin)
    if (!pinOk) return res.status(401).json({ message: 'Code PIN incorrect' })

    // Vérifie le solde
    const w = await wallet.getOrCreateWallet(req.user._id, { role: req.user.role, school: req.user.school?._id })
    if (w.balance < amt) return res.status(400).json({ message: 'Solde insuffisant sur votre portefeuille' })

    // Destinataire = directeur de l'école du frais
    const school = await School.findById(fee.school).select('director name')
    if (!school || !school.director) return res.status(400).json({ message: "L'école n'a pas de directeur associé pour recevoir le paiement" })

    const fullName = `${student.lastName || ''} ${student.firstName || ''}`.trim()
    const label = `${fee.label}${fullName ? ' - ' + fullName : ''}`

    // Débit parent
    await wallet.debit(req.user._id, {
      amount: amt, type: 'pension_payment', counterparty: school.director,
      description: 'Paiement pension : ' + label, meta: { feeId: String(fee._id), schoolId: String(fee.school) },
    })
    // Crédit directeur
    await wallet.credit(school.director, {
      amount: amt, type: 'pension_received', role: 'directeur', school: fee.school,
      counterparty: req.user._id, description: 'Pension reçue : ' + label,
      meta: { feeId: String(fee._id), studentName: fullName },
    })

    // Enregistre le paiement + met à jour l'état du frais
    fee.payments.push({ amount: amt, method: 'wallet', reference: 'WALLET-' + crypto.randomBytes(3).toString('hex').toUpperCase(), note: 'Payé depuis le portefeuille' })
    // Si paiement d'une tranche : la marquer payée
    if (instIdx !== null && fee.installments[instIdx]) {
      fee.installments[instIdx].paid = true
      fee.installments[instIdx].paidAt = new Date()
      fee.installments[instIdx].paidAmount = amt
      fee.installments[instIdx].method = 'wallet'
    }
    fee.paid = (fee.paid || 0) + amt
    await fee.save() // le pre-save recalcule le status (tient compte de la remise)
    const paymentIndex = fee.payments.length - 1

    // Notifie le directeur (best-effort)
    try {
      const dir = await User.findById(school.director).select('email name')
      if (dir?.email) await sendEmail({ to: dir.email, subject: 'Pension reçue — KATD-SCHÜLE',
        html: '<p>Bonjour ' + (dir.name || '') + ', un paiement de pension de <b>' + amt.toLocaleString('fr-FR') + ' F CFA</b> a été reçu sur votre portefeuille pour <b>' + label + '</b>.</p>' })
    } catch (e) {}

    res.json({ success: true, message: 'Paiement effectué depuis votre portefeuille', paymentIndex, balance: w.balance - amt, fee })
  } catch (err) { res.status(400).json({ message: err.message }) }
})

// POST /api/fees/:id/notify-installment — Send reminder to parent for overdue installment
router.post('/:id/notify-installment', protect, authorize('directeur', 'super_admin', 'caissiere'), async (req, res) => {
  try {
    const fee = await Fee.findOne({ _id: req.params.id, school: schoolId(req) })
      .populate({ path: 'student', populate: { path: 'parentUser', select: 'email name' } })
    if (!fee) return res.status(404).json({ message: 'Frais non trouvé' })

    const { installmentIndex } = req.body
    const inst = fee.installments[installmentIndex]
    if (!inst) return res.status(404).json({ message: 'Tranche non trouvée' })

    const parentEmail = fee.student?.parentUser?.email
    if (!parentEmail) return res.status(400).json({ message: 'Aucun email parent configuré' })

    await sendEmail({
      to: parentEmail,
      subject: `⚠️ Rappel de paiement — ${fee.label}`,
      html: `<p>Bonjour,</p><p>Nous vous rappelons que la tranche <strong>${inst.label}</strong> de <strong>${inst.amount.toLocaleString()} F CFA</strong> pour <strong>${fee.student?.lastName} ${fee.student?.firstName}</strong> était due le <strong>${new Date(inst.dueDate).toLocaleDateString('fr-FR')}</strong>.</p><p>Merci de régulariser votre situation dès que possible.</p>`,
    })

    inst.notified = true
    await fee.save()
    res.json({ success: true, message: 'Rappel envoyé' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

router.get('/:id/receipt/:paymentIndex', protect, async (req, res) => {
  try {
    const fee = await Fee.findById(req.params.id)
      .populate('student', 'firstName lastName matricule class school')
      .populate({ path: 'student', populate: [{ path: 'class', select: 'name level' }, { path: 'school', select: 'name address logo phone email' }] })
    if (!fee) return res.status(404).json({ message: 'Frais non trouvé' })

    const userRole = req.user.role
    if (userRole === 'parent') {
      const child = await Student.findOne({ _id: fee.student?._id || fee.student, parentUser: req.user._id })
      if (!child) return res.status(403).json({ message: 'Accès refusé' })
    } else if (userRole === 'directeur' || userRole === 'super_admin') {
      const reqSchool = (req.user.school?._id || req.user.school || '').toString()
      const feeSchool = (fee.school?._id || fee.school || '').toString()
      if (!reqSchool || !feeSchool || reqSchool !== feeSchool) return res.status(403).json({ message: 'Accès refusé' })
    } else {
      return res.status(403).json({ message: 'Accès refusé' })
    }

    const idx = Number(req.params.paymentIndex)
    if (Number.isNaN(idx) || idx < 0 || idx >= (fee.payments || []).length) {
      return res.status(400).json({ message: 'Paiement introuvable' })
    }
    const p = fee.payments[idx]

    // Logo de l'école (best-effort, jamais bloquant)
    const school = fee.student?.school || {}
    let logoBuf = null
    if (school.logo && /^https?:\/\//.test(school.logo)) {
      try {
        logoBuf = await new Promise((resolve) => {
          const https = school.logo.startsWith('https') ? require('https') : require('http')
          const request = https.get(school.logo, { timeout: 3000 }, (r) => {
            if (r.statusCode !== 200) { r.resume(); return resolve(null) }
            const chunks = []
            r.on('data', (c) => chunks.push(c))
            r.on('end', () => resolve(Buffer.concat(chunks)))
            r.on('error', () => resolve(null))
          })
          request.on('timeout', () => { request.destroy(); resolve(null) })
          request.on('error', () => resolve(null))
        })
      } catch (e) { logoBuf = null }
    }

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="recu-${fee._id}-${idx + 1}.pdf"`)

    const doc = new PDFDocument({ size: 'A4', margin: 0 })
    doc.pipe(res)
    renderReceiptPdf(doc, { fee, payment: p, idx, school, reqUser: req.user, logoBuf })
    doc.end()
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// ───────────── Rendu du reçu PDF (design facture) ─────────────
const METHOD_LABELS = { cash: 'Espèces', mobile_money: 'Mobile Money', bank: 'Banque', online: 'En ligne', wallet: 'Portefeuille' }
const FCFA = (n) => `${Number(n || 0).toLocaleString('fr-FR')} F CFA`

function renderReceiptPdf(doc, { fee, payment: p, idx, school, reqUser, logoBuf }) {
  const PAGE_W = 595
  const M = 50 // marge de contenu
  const CONTENT_W = PAGE_W - 2 * M

  const schoolName = school?.name || reqUser.school?.name || 'Établissement scolaire'
  const addr = school?.address || {}
  const addrStr = [addr.address, addr.neighborhood, addr.city, addr.country].filter(Boolean).join(', ')
  const net = Math.max(0, (fee.amount || 0) - (fee.discount?.amount || 0))
  const remaining = Math.max(0, net - (fee.paid || 0))
  const receiptNo = `REC-${String(fee._id).slice(-6).toUpperCase()}-${idx + 1}`

  // ── Bandeau d'en-tête bleu ──
  doc.rect(0, 0, PAGE_W, 110).fill('#1d4ed8')
  let headerTextX = M
  if (logoBuf) {
    try {
      doc.image(logoBuf, M, 25, { fit: [60, 60] })
      headerTextX = M + 75
    } catch (e) { /* logo illisible : on continue sans */ }
  }
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20)
    .text(schoolName, headerTextX, 30, { width: 330 })
  doc.font('Helvetica').fontSize(9).fillColor('#bfdbfe')
  if (addrStr) doc.text(addrStr, headerTextX, doc.y + 2, { width: 330 })
  const contactStr = [school?.phone, school?.email].filter(Boolean).join(' · ')
  if (contactStr) doc.text(contactStr, headerTextX, doc.y + 2, { width: 330 })

  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(14)
    .text('REÇU DE PAIEMENT', 375, 32, { width: 170, align: 'right' })
  doc.font('Helvetica').fontSize(9).fillColor('#bfdbfe')
    .text(`N° ${receiptNo}`, 375, 54, { width: 170, align: 'right' })
    .text(`Date : ${new Date(p.date || Date.now()).toLocaleDateString('fr-FR')}`, 375, 68, { width: 170, align: 'right' })

  // ── Encadrés Élève / Paiement ──
  const boxY = 135
  const boxH = 88
  const boxW = 240
  const fullName = `${fee.student?.lastName || ''} ${fee.student?.firstName || ''}`.trim()

  doc.roundedRect(M, boxY, boxW, boxH, 8).fill('#f3f4f6')
  doc.fillColor('#1d4ed8').font('Helvetica-Bold').fontSize(9).text('ÉLÈVE', M + 14, boxY + 12)
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(11).text(fullName || '—', M + 14, boxY + 28, { width: boxW - 28 })
  doc.font('Helvetica').fontSize(9).fillColor('#4b5563')
  if (fee.student?.matricule) doc.text(`Matricule : ${fee.student.matricule}`, M + 14, doc.y + 4)
  if (fee.student?.class?.name) doc.text(`Classe : ${fee.student.class.name}`, M + 14, doc.y + 2)

  const box2X = M + boxW + 15
  doc.roundedRect(box2X, boxY, boxW, boxH, 8).fill('#f3f4f6')
  doc.fillColor('#1d4ed8').font('Helvetica-Bold').fontSize(9).text('PAIEMENT', box2X + 14, boxY + 12)
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(11)
    .text(FCFA(p.amount), box2X + 14, boxY + 28, { width: boxW - 28 })
  doc.font('Helvetica').fontSize(9).fillColor('#4b5563')
  doc.text(`Méthode : ${METHOD_LABELS[p.method] || p.method || 'Espèces'}`, box2X + 14, doc.y + 4)
  if (p.reference) doc.text(`Référence : ${p.reference}`, box2X + 14, doc.y + 2)
  if (p.note) doc.text(`Note : ${p.note}`, box2X + 14, doc.y + 2, { width: boxW - 28 })

  // ── Tableau récapitulatif ──
  let y = boxY + boxH + 25
  const col2X = 400 // début colonne Montant
  const rowH = 26

  // En-tête du tableau
  doc.rect(M, y, CONTENT_W, rowH).fill('#1e40af')
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10)
    .text('DÉSIGNATION', M + 12, y + 8)
    .text('MONTANT', col2X, y + 8, { width: PAGE_W - M - col2X - 12, align: 'right' })
  y += rowH

  const detail = [fee.term, fee.academicYear].filter(Boolean).join(' — ')
  const rows = []
  rows.push({ label: `${fee.label}${detail ? ` (${detail})` : ''}`, value: FCFA(fee.amount), color: '#111827' })
  if (fee.discount?.amount > 0) {
    rows.push({ label: `Remise (${fee.discount.reason || 'réduction'})`, value: `−${FCFA(fee.discount.amount)}`, color: '#059669' })
    rows.push({ label: 'Net à payer', value: FCFA(net), color: '#111827', bold: true })
  }
  rows.push({ label: 'Montant de ce versement', value: FCFA(p.amount), color: '#111827', bold: true })
  rows.push({ label: 'Total déjà payé', value: FCFA(fee.paid), color: '#111827' })
  rows.push({ label: 'Reste à payer', value: FCFA(remaining), color: remaining > 0 ? '#dc2626' : '#059669', bold: true })

  rows.forEach((r, i) => {
    if (i % 2 === 1) doc.rect(M, y, CONTENT_W, rowH).fill('#f9fafb')
    doc.fillColor(r.color).font(r.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10)
      .text(r.label, M + 12, y + 8, { width: col2X - M - 24 })
      .text(r.value, col2X, y + 8, { width: PAGE_W - M - col2X - 12, align: 'right' })
    y += rowH
  })
  // Bordure du tableau
  doc.lineWidth(0.5).strokeColor('#e5e7eb').rect(M, y - rows.length * rowH - rowH, CONTENT_W, (rows.length + 1) * rowH).stroke()

  // ── Bandeau de statut ──
  y += 20
  const solded = (fee.paid || 0) >= net && net > 0
  doc.roundedRect(M, y, CONTENT_W, 36, 8).fill(solded ? '#dcfce7' : '#fef3c7')
  doc.fillColor(solded ? '#166534' : '#92400e').font('Helvetica-Bold').fontSize(11)
    .text(
      solded ? '✓ FRAIS ENTIÈREMENT SOLDÉ' : `PAIEMENT PARTIEL — Reste ${FCFA(remaining)}`,
      M, y + 12, { width: CONTENT_W, align: 'center' }
    )

  // ── Pied de page ──
  const footY = 720
  doc.lineWidth(0.5).strokeColor('#e5e7eb').moveTo(M, footY).lineTo(PAGE_W - M, footY).stroke()
  doc.font('Helvetica').fontSize(8).fillColor('#9ca3af')
    .text('Reçu généré électroniquement par KATD-SCHÜLE — fait foi de paiement.', M, footY + 10, { width: 280 })
  // Cadre signature
  doc.lineWidth(0.8).strokeColor('#d1d5db').dash(3, { space: 3 })
    .roundedRect(370, footY + 8, 175, 70, 6).stroke().undash()
  doc.fontSize(8).fillColor('#9ca3af')
    .text("Signature & cachet de l'établissement", 370, footY + 84, { width: 175, align: 'center' })
}

// DELETE /api/fees/:id
router.delete('/:id', protect, authorize('directeur', 'super_admin', 'caissiere'), async (req, res) => {
  try {
    await Fee.findOneAndDelete({ _id: req.params.id, school: schoolId(req) })
    res.json({ success: true, message: 'Frais supprimé' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
