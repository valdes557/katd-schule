// routes/mails.js — Registre du courrier (cycle Secondaire).
// La secrétaire enregistre, classe, archive et recherche le courrier entrant/sortant ;
// le principal et le VP consultent.
const express = require('express')
const router = express.Router()
const Mail = require('../models/Mail')
const { protect, authorize } = require('../middleware/auth')
const { upload } = require('../config/cloudinary')

function schoolId(req) { return req.user.school?._id || req.user.school }

const WRITERS = ['secretaire', 'directeur', 'super_admin']
const READERS = [...WRITERS, 'vice_principal']

// POST /api/mails — enregistrer un courrier (pièce scannée facultative)
router.post('/', protect, authorize(...WRITERS), upload.single('file'), async (req, res) => {
  try {
    const sid = schoolId(req)
    if (!sid) return res.status(400).json({ message: 'Aucune école associée' })
    const { direction, reference, subject, correspondent, category, mailDate, note } = req.body
    if (!subject?.trim() || !correspondent?.trim()) {
      return res.status(400).json({ message: 'Objet et correspondant requis' })
    }

    const mail = await Mail.create({
      school: sid,
      direction: direction === 'sortant' ? 'sortant' : 'entrant',
      reference: reference?.trim() || '',
      subject: subject.trim(),
      correspondent: correspondent.trim(),
      category: category?.trim() || 'Général',
      mailDate: mailDate ? new Date(mailDate) : new Date(),
      scanUrl: req.file?.path || '',
      scanName: req.file?.originalname || '',
      note: note || '',
      registeredBy: req.user._id,
    })
    res.status(201).json({ success: true, data: mail })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/mails/:id — modifier (classement, note, référence…)
router.put('/:id', protect, authorize(...WRITERS), async (req, res) => {
  try {
    const mail = await Mail.findOne({ _id: req.params.id, school: schoolId(req) })
    if (!mail) return res.status(404).json({ message: 'Courrier non trouvé' })
    const { reference, subject, correspondent, category, mailDate, note } = req.body
    if (reference !== undefined) mail.reference = reference.trim()
    if (subject !== undefined && subject.trim()) mail.subject = subject.trim()
    if (correspondent !== undefined && correspondent.trim()) mail.correspondent = correspondent.trim()
    if (category !== undefined) mail.category = category.trim() || 'Général'
    if (mailDate !== undefined && mailDate) mail.mailDate = new Date(mailDate)
    if (note !== undefined) mail.note = note
    await mail.save()
    res.json({ success: true, data: mail })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/mails/:id/archive — archiver / désarchiver
router.put('/:id/archive', protect, authorize(...WRITERS), async (req, res) => {
  try {
    const mail = await Mail.findOne({ _id: req.params.id, school: schoolId(req) })
    if (!mail) return res.status(404).json({ message: 'Courrier non trouvé' })
    mail.archived = !!req.body.archived
    await mail.save()
    res.json({ success: true, data: mail })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/mails?direction=&category=&archived=&q=&from=&to= — journal + recherche
router.get('/', protect, authorize(...READERS), async (req, res) => {
  try {
    const { direction, category, archived, q, from, to } = req.query
    const query = { school: schoolId(req) }
    if (direction === 'entrant' || direction === 'sortant') query.direction = direction
    if (category) query.category = category
    if (archived === 'true') query.archived = true
    else if (archived === 'false') query.archived = false
    if (from || to) {
      query.mailDate = {}
      if (from) query.mailDate.$gte = new Date(from)
      if (to) query.mailDate.$lte = new Date(to)
    }
    if (q) {
      const rx = { $regex: q.trim(), $options: 'i' }
      query.$or = [{ subject: rx }, { correspondent: rx }, { reference: rx }]
    }
    const mails = await Mail.find(query)
      .populate('registeredBy', 'name role')
      .sort({ mailDate: -1 })
      .limit(1000)
    // Catégories existantes pour le classement côté client
    const categories = await Mail.distinct('category', { school: schoolId(req) })
    res.json({ success: true, data: mails, categories })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// DELETE /api/mails/:id
router.delete('/:id', protect, authorize(...WRITERS), async (req, res) => {
  try {
    const mail = await Mail.findOne({ _id: req.params.id, school: schoolId(req) })
    if (!mail) return res.status(404).json({ message: 'Courrier non trouvé' })
    await mail.deleteOne()
    res.json({ success: true })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
