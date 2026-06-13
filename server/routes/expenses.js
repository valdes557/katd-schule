const express = require('express')
const router = express.Router()
const Expense = require('../models/Expense')
const { protect, authorize } = require('../middleware/auth')

function schoolId(req) { return req.user.school?._id || req.user.school }

// GET /api/expenses — Liste des dépenses de l'école (+ résumé)
router.get('/', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const { category, from, to, month } = req.query
    const query = { school: schoolId(req) }
    if (category) query.category = category
    if (month) {
      // month = "YYYY-MM"
      const start = new Date(`${month}-01T00:00:00.000Z`)
      const end = new Date(start)
      end.setMonth(end.getMonth() + 1)
      query.date = { $gte: start, $lt: end }
    } else if (from || to) {
      query.date = {}
      if (from) query.date.$gte = new Date(from)
      if (to) query.date.$lte = new Date(to)
    }

    const expenses = await Expense.find(query).sort({ date: -1, createdAt: -1 })
    const total = expenses.reduce((s, e) => s + (e.amount || 0), 0)

    // Total par catégorie
    const byCategory = {}
    expenses.forEach((e) => { byCategory[e.category] = (byCategory[e.category] || 0) + (e.amount || 0) })

    res.json({ success: true, data: expenses, summary: { total, count: expenses.length, byCategory } })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/expenses — Enregistrer une dépense
router.post('/', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const { label, category, amount, date, supplier, method, reference, note } = req.body
    if (!label || amount === undefined || amount === null) {
      return res.status(400).json({ message: 'Libellé et montant requis' })
    }
    const expense = await Expense.create({
      school: schoolId(req),
      label,
      category: category || 'autre',
      amount: Number(amount),
      date: date || new Date(),
      supplier,
      method: method || 'cash',
      reference,
      note,
      createdBy: req.user._id,
    })
    res.status(201).json({ success: true, data: expense })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/expenses/:id
router.put('/:id', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, school: schoolId(req) })
    if (!expense) return res.status(404).json({ message: 'Dépense non trouvée' })
    const fields = ['label', 'category', 'amount', 'date', 'supplier', 'method', 'reference', 'note']
    fields.forEach((f) => { if (req.body[f] !== undefined) expense[f] = f === 'amount' ? Number(req.body[f]) : req.body[f] })
    await expense.save()
    res.json({ success: true, data: expense })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// DELETE /api/expenses/:id
router.delete('/:id', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const r = await Expense.findOneAndDelete({ _id: req.params.id, school: schoolId(req) })
    if (!r) return res.status(404).json({ message: 'Dépense non trouvée' })
    res.json({ success: true, message: 'Dépense supprimée' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
