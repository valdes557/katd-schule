const express = require('express')
const router = express.Router()
const Staff = require('../models/Staff')
const Teacher = require('../models/Teacher')
const { protect, authorize } = require('../middleware/auth')

function schoolId(req) { return req.user.school?._id || req.user.school }

const dirOnly = [protect, authorize('directeur', 'super_admin')]

// GET /api/staff — liste du personnel non-enseignant + résumé du corps enseignant
// Query: category (filtre optionnel)
router.get('/', ...dirOnly, async (req, res) => {
  try {
    const sid = schoolId(req)
    if (!sid) return res.status(400).json({ message: 'Aucune école associée' })

    const filter = { school: sid }
    if (req.query.category) filter.category = req.query.category

    const [staff, teachers] = await Promise.all([
      Staff.find(filter).sort({ lastName: 1, firstName: 1 }),
      Teacher.find({ school: sid }).select('firstName lastName email phone photo subjects speciality status').sort({ lastName: 1 }),
    ])

    res.json({ success: true, data: { staff, teachers } })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/staff — crée un membre du personnel non-enseignant
router.post('/', ...dirOnly, async (req, res) => {
  try {
    const sid = schoolId(req)
    if (!sid) return res.status(400).json({ message: 'Aucune école associée' })
    const { firstName, lastName } = req.body
    if (!firstName || !lastName) return res.status(400).json({ message: 'Nom et prénom requis' })

    const member = await Staff.create({ ...req.body, school: sid })
    res.status(201).json({ success: true, data: member })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/staff/:id — met à jour un membre du personnel
router.put('/:id', ...dirOnly, async (req, res) => {
  try {
    const sid = schoolId(req)
    const member = await Staff.findOne({ _id: req.params.id, school: sid })
    if (!member) return res.status(404).json({ message: 'Personnel introuvable' })

    const fields = ['firstName', 'lastName', 'email', 'phone', 'gender', 'photo', 'category', 'jobTitle', 'salary', 'hireDate', 'status', 'address', 'notes']
    for (const f of fields) {
      if (req.body[f] !== undefined) member[f] = req.body[f]
    }
    await member.save()
    res.json({ success: true, data: member })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// DELETE /api/staff/:id — supprime un membre du personnel
router.delete('/:id', ...dirOnly, async (req, res) => {
  try {
    const sid = schoolId(req)
    const member = await Staff.findOneAndDelete({ _id: req.params.id, school: sid })
    if (!member) return res.status(404).json({ message: 'Personnel introuvable' })
    res.json({ success: true, message: 'Personnel supprimé' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
