const express = require('express')
const router = express.Router()
const Salary = require('../models/Salary')
const Teacher = require('../models/Teacher')
const Expense = require('../models/Expense')
const { protect, authorize } = require('../middleware/auth')

function schoolId(req) { return req.user.school?._id || req.user.school }

// GET /api/salaries — Liste des salaires de l'école (filtrable par mois/enseignant) + résumé
router.get('/', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const { month, teacherId } = req.query
    const query = { school: schoolId(req) }
    if (month) query.month = month
    if (teacherId) query.teacher = teacherId

    const salaries = await Salary.find(query)
      .populate('teacher', 'firstName lastName photo speciality')
      .sort({ month: -1, createdAt: -1 })

    const total = salaries.reduce((s, x) => s + (x.amount || 0), 0)
    const totalPaid = salaries.filter((s) => s.status === 'paid').reduce((s, x) => s + (x.amount || 0), 0)
    const totalPending = total - totalPaid

    res.json({
      success: true,
      data: salaries,
      summary: { total, totalPaid, totalPending, count: salaries.length },
    })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/salaries — Créer/enregistrer un salaire pour un enseignant et un mois
router.post('/', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const { teacherId, month, amount, status, method, reference, note, paidAt } = req.body
    if (!teacherId || !month || amount === undefined || amount === null) {
      return res.status(400).json({ message: 'Enseignant, mois et montant requis' })
    }
    // Vérifier que l'enseignant appartient à l'école
    const teacher = await Teacher.findOne({ _id: teacherId, school: schoolId(req) })
    if (!teacher) return res.status(404).json({ message: 'Enseignant non trouvé' })

    const isPaid = status === 'paid'
    const salary = await Salary.create({
      school: schoolId(req),
      teacher: teacherId,
      month,
      amount: Number(amount),
      status: isPaid ? 'paid' : 'pending',
      paidAt: isPaid ? (paidAt || new Date()) : undefined,
      method: method || 'cash',
      reference,
      note,
      createdBy: req.user._id,
    })
    await salary.populate('teacher', 'firstName lastName photo speciality')

    // Si payé : enregistrer automatiquement une dépense correspondante (catégorie salaires)
    if (isPaid) {
      Expense.create({
        school: schoolId(req),
        label: `Salaire ${teacher.lastName} ${teacher.firstName} — ${month}`,
        category: 'salaires',
        amount: Number(amount),
        date: salary.paidAt,
        method: salary.method,
        reference,
        note: 'Généré automatiquement depuis la gestion des salaires',
        createdBy: req.user._id,
      }).catch(() => {})
    }

    res.status(201).json({ success: true, data: salary })
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Un salaire existe déjà pour cet enseignant et ce mois' })
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/salaries/:id — Modifier un salaire
router.put('/:id', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const salary = await Salary.findOne({ _id: req.params.id, school: schoolId(req) })
    if (!salary) return res.status(404).json({ message: 'Salaire non trouvé' })

    const fields = ['amount', 'month', 'method', 'reference', 'note']
    fields.forEach((f) => { if (req.body[f] !== undefined) salary[f] = f === 'amount' ? Number(req.body[f]) : req.body[f] })

    if (req.body.status !== undefined) {
      salary.status = req.body.status === 'paid' ? 'paid' : 'pending'
      salary.paidAt = salary.status === 'paid' ? (req.body.paidAt || salary.paidAt || new Date()) : undefined
    }

    await salary.save()
    await salary.populate('teacher', 'firstName lastName photo speciality')
    res.json({ success: true, data: salary })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/salaries/:id/pay — Marquer un salaire comme payé
router.put('/:id/pay', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const salary = await Salary.findOne({ _id: req.params.id, school: schoolId(req) }).populate('teacher', 'firstName lastName photo speciality')
    if (!salary) return res.status(404).json({ message: 'Salaire non trouvé' })

    salary.status = 'paid'
    salary.paidAt = req.body.paidAt || new Date()
    if (req.body.method) salary.method = req.body.method
    if (req.body.reference !== undefined) salary.reference = req.body.reference
    await salary.save()

    // Enregistrer la dépense correspondante
    Expense.create({
      school: schoolId(req),
      label: `Salaire ${salary.teacher?.lastName || ''} ${salary.teacher?.firstName || ''} — ${salary.month}`,
      category: 'salaires',
      amount: salary.amount,
      date: salary.paidAt,
      method: salary.method,
      reference: salary.reference,
      note: 'Généré automatiquement depuis la gestion des salaires',
      createdBy: req.user._id,
    }).catch(() => {})

    res.json({ success: true, data: salary })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// DELETE /api/salaries/:id
router.delete('/:id', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const r = await Salary.findOneAndDelete({ _id: req.params.id, school: schoolId(req) })
    if (!r) return res.status(404).json({ message: 'Salaire non trouvé' })
    res.json({ success: true, message: 'Salaire supprimé' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
