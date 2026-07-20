const express = require('express')
const router = express.Router()
const SharedDocument = require('../models/SharedDocument')
const User = require('../models/User')
const Student = require('../models/Student')
const { protect, authorize } = require('../middleware/auth')
const { upload } = require('../config/cloudinary')
const pushService = require('../services/pushService')

function schoolId(req) { return req.user.school?._id || req.user.school }

// Destinataires push d'un document : membres de l'école (staff + comptes parents).
// Si le document vise une classe précise, seuls les parents de cette classe (+ staff).
async function documentRecipients(sid, classId, excludeId) {
  const staff = await User.find({ school: sid, isActive: { $ne: false } }).select('_id').lean()
  const studentQuery = { school: sid, parentUser: { $ne: null }, status: 'active' }
  if (classId) studentQuery.class = classId
  const students = await Student.find(studentQuery).select('parentUser').lean()
  const ids = [
    ...staff.map((u) => u._id.toString()),
    ...students.map((s) => s.parentUser?.toString()).filter(Boolean),
  ]
  const ex = excludeId?.toString()
  return [...new Set(ids)].filter((id) => id !== ex)
}

// GET /api/documents — documents partagés de l'école de l'utilisateur courant
// Tous les membres de l'école (directeur, enseignant, parent) y ont accès.
router.get('/', protect, async (req, res) => {
  try {
    const sid = schoolId(req)
    if (!sid) return res.json({ success: true, data: [] })

    const query = { school: sid }
    if (req.query.classId) query.class = req.query.classId

    const items = await SharedDocument.find(query)
      .populate('uploadedBy', 'name role')
      .populate('class', 'name level')
      .sort({ createdAt: -1 })
      .limit(Number(req.query.limit) || 200)

    res.json({ success: true, data: items })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/documents — upload d'un document (directeur ou enseignant)
router.post(
  '/',
  protect,
  authorize('directeur', 'enseignant', 'super_admin'),
  upload.single('file'),
  async (req, res) => {
    try {
      const sid = schoolId(req)
      if (!sid) return res.status(400).json({ message: 'Aucune école associée à votre compte' })
      if (!req.file?.path) return res.status(400).json({ message: 'Aucun fichier reçu' })

      const { title, description, category, classId } = req.body
      if (!title || String(title).trim().length === 0) {
        return res.status(400).json({ message: 'Le titre du document est requis' })
      }

      const doc = await SharedDocument.create({
        school: sid,
        title: title.trim(),
        description: description?.trim() || '',
        category: category?.trim() || 'Général',
        fileUrl: req.file.path,
        fileName: req.file.originalname || '',
        fileSize: req.file.size || 0,
        fileType: req.file.mimetype || '',
        uploadedBy: req.user._id,
        uploaderRole: req.user.role,
        class: classId || null,
      })

      const populated = await doc.populate([
        { path: 'uploadedBy', select: 'name role' },
        { path: 'class', select: 'name level' },
      ])
      res.status(201).json({ success: true, data: populated })

      // Push aux membres concernés (best-effort).
      documentRecipients(sid, doc.class, req.user._id).then((ids) => {
        pushService.sendToUsers(ids, {
          title: '📄 Nouveau document partagé',
          body: doc.title,
          url: '/dashboard/documents',
          tag: 'doc_' + doc._id.toString(),
        })
      }).catch(() => {})
    } catch (err) { res.status(500).json({ message: err.message }) }
  }
)

// DELETE /api/documents/:id — l'uploader ou un directeur/super_admin de l'école
router.delete('/:id', protect, async (req, res) => {
  try {
    const doc = await SharedDocument.findById(req.params.id)
    if (!doc) return res.status(404).json({ message: 'Document introuvable' })

    const sid = schoolId(req)
    const sameSchool = sid && doc.school.toString() === sid.toString()
    const isUploader = doc.uploadedBy?.toString() === req.user._id.toString()
    const isAdmin = ['directeur', 'super_admin'].includes(req.user.role) && sameSchool

    if (!isUploader && !isAdmin) {
      return res.status(403).json({ message: 'Vous ne pouvez pas supprimer ce document' })
    }

    await doc.deleteOne()
    res.json({ success: true })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
