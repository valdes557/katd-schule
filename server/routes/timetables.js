const express = require('express')
const router = express.Router()
const Timetable = require('../models/Timetable')
const { protect, authorize } = require('../middleware/auth')

// GET all timetables for the school
router.get('/', protect, async (req, res) => {
  try {
    const query = { school: req.user.school?._id || req.user.school }
    if (!query.school) return res.json({ success: true, data: [] })
    const timetables = await Timetable.find(query).populate('class', 'name level cycle room')
    res.json({ success: true, data: timetables })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET timetable for a specific class
router.get('/class/:classId', protect, async (req, res) => {
  try {
    const schoolId = req.user.school?._id || req.user.school
    let tt = await Timetable.findOne({ school: schoolId, class: req.params.classId }).populate('class', 'name level cycle room')
    if (!tt) {
      tt = await Timetable.create({ school: schoolId, class: req.params.classId, slots: [] })
      tt = await Timetable.findById(tt._id).populate('class', 'name level cycle room')
    }
    res.json({ success: true, data: tt })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PUT update timetable for a class (add/update slots)
router.put('/:id', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const tt = await Timetable.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).populate('class', 'name level cycle room')
    if (!tt) return res.status(404).json({ message: 'Emploi du temps non trouvé' })
    res.json({ success: true, data: tt })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST add a slot to a timetable
router.post('/:id/slots', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const tt = await Timetable.findById(req.params.id)
    if (!tt) return res.status(404).json({ message: 'Emploi du temps non trouvé' })
    tt.slots.push(req.body)
    await tt.save()
    res.json({ success: true, data: tt })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE a slot from a timetable
router.delete('/:id/slots/:slotId', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const tt = await Timetable.findById(req.params.id)
    if (!tt) return res.status(404).json({ message: 'Emploi du temps non trouvé' })
    tt.slots = tt.slots.filter((s) => s._id.toString() !== req.params.slotId)
    await tt.save()
    res.json({ success: true, data: tt })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
