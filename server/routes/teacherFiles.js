// routes/teacherFiles.js — Dossiers administratifs des enseignants (cycle Secondaire).
// Workflow : la secrétaire crée le dossier (recu), vérifie les pièces (verifie),
// le transmet au Principal (transmis) ; le principal valide ou rejette.
const express = require('express')
const router = express.Router()
const TeacherFile = require('../models/TeacherFile')
const User = require('../models/User')
const { protect, authorize } = require('../middleware/auth')
const { upload } = require('../config/cloudinary')

function schoolId(req) { return req.user.school?._id || req.user.school }

const MANAGERS = ['secretaire', 'directeur', 'super_admin']

// Push best-effort
function pushTo(userIds, payload) {
  try {
    const push = require('../services/pushService')
    if (userIds.length) push.sendToUsers(userIds, payload).catch(() => {})
  } catch (e) { /* best-effort */ }
}

// POST /api/teacher-files — créer un dossier (secrétaire)
router.post('/', protect, authorize(...MANAGERS), async (req, res) => {
  try {
    const sid = schoolId(req)
    if (!sid) return res.status(400).json({ message: 'Aucune école associée' })
    const { teacherId, teacherName, subjectTaught, note } = req.body
    if (!teacherName?.trim()) return res.status(400).json({ message: 'Nom de l\'enseignant requis' })

    const file = await TeacherFile.create({
      school: sid,
      teacher: teacherId || null,
      teacherName: teacherName.trim(),
      subjectTaught: subjectTaught || '',
      note: note || '',
      status: 'recu',
      statusHistory: [{ status: 'recu', by: req.user._id }],
      createdBy: req.user._id,
    })
    res.status(201).json({ success: true, data: file })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/teacher-files/:id/attachments — ajouter une pièce (upload Cloudinary)
router.post('/:id/attachments', protect, authorize(...MANAGERS), upload.single('file'), async (req, res) => {
  try {
    const file = await TeacherFile.findOne({ _id: req.params.id, school: schoolId(req) })
    if (!file) return res.status(404).json({ message: 'Dossier non trouvé' })
    if (['valide', 'rejete'].includes(file.status)) return res.status(400).json({ message: 'Dossier déjà clôturé' })
    if (!req.file?.path) return res.status(400).json({ message: 'Aucun fichier reçu' })

    file.attachments.push({
      label: req.body.label?.trim() || req.file.originalname || 'Pièce',
      fileUrl: req.file.path,
      fileName: req.file.originalname || '',
      fileType: req.file.mimetype || '',
    })
    await file.save()
    res.json({ success: true, data: file })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/teacher-files/:id/attachments/:attId/check — cocher/décocher une pièce vérifiée
router.put('/:id/attachments/:attId/check', protect, authorize(...MANAGERS), async (req, res) => {
  try {
    const file = await TeacherFile.findOne({ _id: req.params.id, school: schoolId(req) })
    if (!file) return res.status(404).json({ message: 'Dossier non trouvé' })
    const att = file.attachments.id(req.params.attId)
    if (!att) return res.status(404).json({ message: 'Pièce non trouvée' })
    att.checked = !!req.body.checked
    await file.save()
    res.json({ success: true, data: file })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/teacher-files/:id/status — avancer le workflow
// secrétaire : recu → verifie → transmis ; principal : transmis → valide | rejete
router.put('/:id/status', protect, authorize(...MANAGERS), async (req, res) => {
  try {
    const sid = schoolId(req)
    const file = await TeacherFile.findOne({ _id: req.params.id, school: sid })
    if (!file) return res.status(404).json({ message: 'Dossier non trouvé' })
    const { status, note } = req.body

    const isPrincipal = ['directeur', 'super_admin'].includes(req.user.role)
    const allowed = isPrincipal
      ? ['verifie', 'transmis', 'valide', 'rejete'] // le principal peut tout faire
      : ['verifie', 'transmis'] // la secrétaire ne décide pas
    if (!allowed.includes(status)) return res.status(403).json({ message: 'Transition non autorisée pour votre rôle' })
    if (['valide', 'rejete'].includes(file.status)) return res.status(400).json({ message: 'Dossier déjà clôturé' })
    if (status === 'transmis' && !file.attachments.length) {
      return res.status(400).json({ message: 'Ajoutez au moins une pièce avant de transmettre' })
    }

    file.status = status
    file.statusHistory.push({ status, by: req.user._id, note: note || '' })
    if (['valide', 'rejete'].includes(status)) file.decisionNote = note || ''
    await file.save()

    // Notifications : transmission → principal ; décision → secrétaire ayant créé le dossier
    if (status === 'transmis') {
      const principals = await User.find({ school: sid, role: 'directeur', isActive: { $ne: false } }).select('_id')
      pushTo(principals.map((u) => u._id), {
        title: '📁 Dossier enseignant transmis',
        body: `Dossier de ${file.teacherName} en attente de validation`,
        url: '/dashboard/secretariat/dossiers',
      })
    } else if (['valide', 'rejete'].includes(status) && file.createdBy) {
      pushTo([file.createdBy], {
        title: status === 'valide' ? '✅ Dossier validé' : '❌ Dossier rejeté',
        body: `Dossier de ${file.teacherName}${note ? ` — ${note.slice(0, 80)}` : ''}`,
        url: '/dashboard/secretariat/dossiers',
      })
    }

    res.json({ success: true, data: file })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/teacher-files?status=&q= — liste des dossiers de l'école
router.get('/', protect, authorize(...MANAGERS), async (req, res) => {
  try {
    const query = { school: schoolId(req) }
    if (req.query.status) query.status = req.query.status
    if (req.query.q) query.teacherName = { $regex: req.query.q.trim(), $options: 'i' }
    const files = await TeacherFile.find(query)
      .populate('teacher', 'name email')
      .populate('createdBy', 'name role')
      .populate('statusHistory.by', 'name role')
      .sort({ createdAt: -1 })
      .limit(500)
    res.json({ success: true, data: files })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// DELETE /api/teacher-files/:id — supprimer un dossier (non clôturé)
router.delete('/:id', protect, authorize(...MANAGERS), async (req, res) => {
  try {
    const file = await TeacherFile.findOne({ _id: req.params.id, school: schoolId(req) })
    if (!file) return res.status(404).json({ message: 'Dossier non trouvé' })
    if (file.status === 'valide' && req.user.role === 'secretaire') {
      return res.status(403).json({ message: 'Un dossier validé ne peut être supprimé que par le principal' })
    }
    await file.deleteOne()
    res.json({ success: true })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

module.exports = router
