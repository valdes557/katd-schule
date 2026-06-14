const express = require('express')
const router = express.Router()
const Event = require('../models/Event')
const { protect, authorize } = require('../middleware/auth')

function schoolId(req) { return req.user.school?._id || req.user.school }

// Audiences visibles selon le rôle de l'utilisateur
function audiencesFor(role) {
  if (role === 'parent') return ['all', 'parents']
  if (role === 'enseignant') return ['all', 'teachers']
  return ['all', 'parents', 'teachers'] // directeur / super_admin : tout
}

// GET /api/events — évènements visibles par l'utilisateur courant
router.get('/', protect, async (req, res) => {
  try {
    const sid = schoolId(req)
    if (!sid) return res.json({ success: true, data: [] })

    const query = { school: sid }
    if (req.user.role !== 'directeur' && req.user.role !== 'super_admin') {
      query.audience = { $in: audiencesFor(req.user.role) }
    }

    const items = await Event.find(query)
      .sort({ startDate: 1 })
      .limit(Number(req.query.limit) || 200)
    res.json({ success: true, data: items })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/events — le directeur publie un évènement
router.post('/', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const { title, description, type, startDate, endDate, location, audience } = req.body
    if (!title || String(title).trim().length === 0) {
      return res.status(400).json({ message: "Le titre de l'évènement est requis" })
    }
    if (!startDate) {
      return res.status(400).json({ message: 'La date de début est requise' })
    }
    const sid = schoolId(req)
    if (!sid) return res.status(400).json({ message: 'Aucune école associée à votre compte' })

    const event = await Event.create({
      school: sid,
      title: title.trim(),
      description: description?.trim() || '',
      type: ['reunion', 'ceremonie', 'examen', 'sortie', 'autre'].includes(type) ? type : 'autre',
      startDate,
      endDate: endDate || undefined,
      location: location?.trim() || '',
      audience: ['all', 'parents', 'teachers'].includes(audience) ? audience : 'all',
      createdBy: req.user._id,
    })
    res.status(201).json({ success: true, data: event })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// DELETE /api/events/:id
router.delete('/:id', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const r = await Event.findOneAndDelete({ _id: req.params.id, school: schoolId(req) })
    if (!r) return res.status(404).json({ message: 'Évènement non trouvé' })
    res.json({ success: true, message: 'Évènement supprimé' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
