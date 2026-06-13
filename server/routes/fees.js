const express = require('express')
const router = express.Router()
const Fee = require('../models/Fee')
const Student = require('../models/Student')
const { protect, authorize } = require('../middleware/auth')
const { sendEmail } = require('../utils/emailService')
const PDFDocument = require('pdfkit')

// Helper: ensure school match
function schoolId(req) { return req.user.school?._id || req.user.school }

// GET /api/fees — List all fees for the school (director)
router.get('/', protect, authorize('directeur', 'super_admin'), async (req, res) => {
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
router.get('/payment-status', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const { classId } = req.query
    if (!classId) return res.status(400).json({ message: 'classId requis' })

    const students = await Student.find({ class: classId, school: schoolId(req), status: 'active' })
      .populate('class', 'name')
    const studentIds = students.map((s) => s._id)
    const fees = await Fee.find({ student: { $in: studentIds }, school: schoolId(req) })

    const result = students.map((s) => {
      const studentFees = fees.filter((f) => f.student.toString() === s._id.toString())
      const totalDue = studentFees.reduce((sum, f) => sum + f.amount, 0)
      const totalPaid = studentFees.reduce((sum, f) => sum + f.paid, 0)
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
        remaining: totalDue - totalPaid,
        fullyPaid: totalDue > 0 && totalDue === totalPaid,
        allInstallmentsPaid,
        fees: studentFees.map((f) => ({
          _id: f._id,
          label: f.label,
          amount: f.amount,
          paid: f.paid,
          status: f.status,
          paymentMode: f.paymentMode,
          installments: f.installments,
        })),
      }
    })
    res.json({ success: true, data: result })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/fees/payment-history — Directeur: tous les paiements par élève/parent + reste
router.get('/payment-history', protect, authorize('directeur', 'super_admin'), async (req, res) => {
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
          remaining: 0,
          payments: [],
        })
      }
      const entry = byStudent.get(key)
      entry.totalDue += f.amount || 0
      entry.totalPaid += f.paid || 0
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
      remaining: data.reduce((s, e) => s + e.remaining, 0),
      studentCount: data.length,
    }

    res.json({ success: true, data, summary })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/fees — Create fee for a student
router.post('/', protect, authorize('directeur', 'super_admin'), async (req, res) => {
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

// PUT /api/fees/:id — Update fee
router.put('/:id', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const fee = await Fee.findOne({ _id: req.params.id, school: schoolId(req) })
    if (!fee) return res.status(404).json({ message: 'Frais non trouvé' })
    Object.assign(fee, req.body)
    await fee.save()
    await fee.populate('student', 'firstName lastName matricule')
    res.json({ success: true, data: fee })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/fees/:id/record-payment — Record a payment (full or installment)
router.post('/:id/record-payment', protect, authorize('directeur', 'super_admin'), async (req, res) => {
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
    fee.status = fee.paid >= fee.amount ? 'paid' : fee.paid > 0 ? 'partial' : 'pending'
    await fee.save()

    // Notify parent by email
    const parentEmail = fee.student?.parentUser?.email
    if (parentEmail) {
      sendEmail({
        to: parentEmail,
        subject: `✅ Paiement enregistré — ${fee.label}`,
        html: `<p>Bonjour,</p><p>Un paiement de <strong>${Number(amount).toLocaleString()} F CFA</strong> a été enregistré pour <strong>${fee.student?.lastName} ${fee.student?.firstName}</strong> concernant : ${fee.label}.</p><p>Solde restant : <strong>${Math.max(0, fee.amount - fee.paid).toLocaleString()} F CFA</strong>.</p>`,
      }).catch(() => {})
    }

    res.json({ success: true, data: fee })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/fees/:id/notify-installment — Send reminder to parent for overdue installment
router.post('/:id/notify-installment', protect, authorize('directeur', 'super_admin'), async (req, res) => {
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
      .populate({ path: 'student', populate: [{ path: 'class', select: 'name level' }, { path: 'school', select: 'name address' }] })
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

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="recu-${fee._id}-${idx + 1}.pdf"`)

    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    doc.pipe(res)

    const schoolName = fee.student?.school?.name || req.user.school?.name || 'Établissement scolaire'
    const addr = fee.student?.school?.address || {}
    const addrStr = [addr.address, addr.neighborhood, addr.city, addr.country].filter(Boolean).join(', ')

    doc.fontSize(18).fillColor('#111827').text(schoolName)
    if (addrStr) doc.moveDown(0.2).fontSize(10).fillColor('#6b7280').text(addrStr)
    doc.moveDown()

    doc.fillColor('#111827').fontSize(16).text('Reçu de Paiement', { align: 'right' })
    doc.fontSize(10).fillColor('#6b7280').text(`Date: ${new Date(p.date || Date.now()).toLocaleDateString('fr-FR')}`, { align: 'right' })
    doc.moveDown()

    const fullName = `${fee.student?.lastName || ''} ${fee.student?.firstName || ''}`.trim()
    doc.fillColor('#111827').fontSize(12).text(`Élève: ${fullName || '—'}`)
    if (fee.student?.matricule) doc.fontSize(12).text(`Matricule: ${fee.student.matricule}`)
    if (fee.student?.class?.name) doc.fontSize(12).text(`Classe: ${fee.student.class.name}`)
    doc.moveDown()

    doc.fontSize(12).fillColor('#111827').text(`Libellé: ${fee.label}`)
    doc.text(`Montant payé: ${Number(p.amount || 0).toLocaleString('fr-FR')} F CFA`)
    doc.text(`Méthode: ${p.method || 'cash'}`)
    if (p.reference) doc.text(`Référence: ${p.reference}`)
    if (p.note) doc.text(`Note: ${p.note}`)
    const remaining = Math.max(0, (fee.amount || 0) - (fee.paid || 0))
    doc.moveDown(0.5)
    doc.text(`Total dû: ${Number(fee.amount || 0).toLocaleString('fr-FR')} F CFA`)
    doc.text(`Total déjà payé: ${Number(fee.paid || 0).toLocaleString('fr-FR')} F CFA`)
    doc.text(`Reste à payer: ${Number(remaining).toLocaleString('fr-FR')} F CFA`)

    doc.moveDown()
    doc.fontSize(10).fillColor('#6b7280').text('Merci pour votre paiement.', { align: 'center' })
    doc.end()
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// DELETE /api/fees/:id
router.delete('/:id', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    await Fee.findOneAndDelete({ _id: req.params.id, school: schoolId(req) })
    res.json({ success: true, message: 'Frais supprimé' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
