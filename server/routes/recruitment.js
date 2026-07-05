const express = require('express')
const router = express.Router()
const RecruitmentPost = require('../models/RecruitmentPost')
const RecruitmentApplication = require('../models/RecruitmentApplication')
const User = require('../models/User')
const { protect, authorize } = require('../middleware/auth')
const { upload } = require('../config/cloudinary')
const { sendRecruitmentApplicationEmail, sendRecruitmentDecisionEmail } = require('../utils/emailService')

// Helper : école du directeur connecté
function schoolId(req) { return req.user.school?._id || req.user.school }

/* ─────────────── ROUTES PUBLIQUES (job board — sans authentification) ─────────────── */

// GET /api/recruitment/public — toutes les annonces publiées (toutes écoles)
router.get('/public', async (req, res) => {
  try {
    const posts = await RecruitmentPost.find({ status: 'published' })
      .populate('school', 'name logo')
      .sort({ createdAt: -1 })
      .limit(200)
    res.json({ success: true, data: posts })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/recruitment/public/count?since=<ISO> — nb d'annonces publiées depuis une date (badges News)
router.get('/public/count', async (req, res) => {
  try {
    const query = { status: 'published' }
    if (req.query.since) {
      const d = new Date(req.query.since)
      if (!Number.isNaN(d.getTime())) query.createdAt = { $gt: d }
    }
    const count = await RecruitmentPost.countDocuments(query)
    const total = await RecruitmentPost.countDocuments({ status: 'published' })
    res.json({ success: true, data: { count, total } })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/recruitment/public/:id — détail d'une annonce publiée
router.get('/public/:id', async (req, res) => {
  try {
    const post = await RecruitmentPost.findOne({ _id: req.params.id, status: 'published' })
      .populate('school', 'name logo')
    if (!post) return res.status(404).json({ message: 'Annonce non trouvée' })
    res.json({ success: true, data: post })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/recruitment/public/:id/apply — candidature (public, upload CV)
router.post('/public/:id/apply', upload.single('cv'), async (req, res) => {
  try {
    const post = await RecruitmentPost.findOne({ _id: req.params.id, status: 'published' })
      .populate('school', 'name')
      .populate('createdBy', 'email name')
    if (!post) return res.status(404).json({ message: 'Annonce non trouvée ou clôturée' })

    const { fullName, email, whatsapp, message } = req.body
    if (!fullName || !email || !whatsapp) {
      return res.status(400).json({ message: 'Nom, email et numéro WhatsApp sont requis' })
    }

    const application = await RecruitmentApplication.create({
      post: post._id,
      school: post.school?._id || post.school,
      fullName: fullName.trim(),
      email: String(email).trim().toLowerCase(),
      whatsapp: String(whatsapp).trim(),
      cvUrl: req.file?.path || '',
      message: message?.trim() || '',
    })

    await RecruitmentPost.updateOne({ _id: post._id }, { $inc: { applicantCount: 1 } })

    // Notifie le directeur (best-effort)
    const directorEmail = post.createdBy?.email
    if (directorEmail) {
      sendRecruitmentApplicationEmail({
        to: directorEmail,
        schoolName: post.school?.name,
        postTitle: post.title,
        fullName: application.fullName,
        email: application.email,
        whatsapp: application.whatsapp,
        message: application.message,
        cvUrl: application.cvUrl,
      }).catch(() => {})
    }

    res.status(201).json({ success: true, message: 'Candidature envoyée avec succès', data: { _id: application._id } })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

/* ─────────────── ROUTES DIRECTEUR (authentifiées) ─────────────── */

// GET /api/recruitment — annonces de mon école
router.get('/', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const sid = schoolId(req)
    if (!sid) return res.json({ success: true, data: [] })
    const posts = await RecruitmentPost.find({ school: sid }).sort({ createdAt: -1 })
    res.json({ success: true, data: posts })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/recruitment — créer une annonce
router.post('/', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const sid = schoolId(req)
    if (!sid) return res.status(400).json({ message: 'Aucune école associée à votre compte' })
    const { title, description, poste, location, contractType, deadline, status } = req.body
    if (!title || !description) return res.status(400).json({ message: 'Le titre et la description sont requis' })

    const post = await RecruitmentPost.create({
      school: sid,
      title: title.trim(),
      description: description.trim(),
      poste: poste?.trim() || '',
      location: location?.trim() || '',
      contractType: contractType?.trim() || '',
      deadline: deadline || undefined,
      status: ['published', 'closed'].includes(status) ? status : 'published',
      createdBy: req.user._id,
    })
    res.status(201).json({ success: true, data: post })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// PUT /api/recruitment/:id — modifier une annonce
router.put('/:id', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const post = await RecruitmentPost.findOne({ _id: req.params.id, school: schoolId(req) })
    if (!post) return res.status(404).json({ message: 'Annonce non trouvée' })
    const fields = ['title', 'description', 'poste', 'location', 'contractType', 'deadline', 'status']
    fields.forEach((f) => { if (req.body[f] !== undefined) post[f] = req.body[f] })
    await post.save()
    res.json({ success: true, data: post })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// DELETE /api/recruitment/:id — supprimer une annonce (+ ses candidatures)
router.delete('/:id', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const post = await RecruitmentPost.findOneAndDelete({ _id: req.params.id, school: schoolId(req) })
    if (!post) return res.status(404).json({ message: 'Annonce non trouvée' })
    await RecruitmentApplication.deleteMany({ post: post._id })
    res.json({ success: true, message: 'Annonce supprimée' })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// GET /api/recruitment/applications?postId=... — candidatures de mes annonces
router.get('/applications', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    const sid = schoolId(req)
    if (!sid) return res.json({ success: true, data: [] })
    const query = { school: sid }
    if (req.query.postId) query.post = req.query.postId
    const applications = await RecruitmentApplication.find(query)
      .populate('post', 'title poste')
      .sort({ createdAt: -1 })
    res.json({ success: true, data: applications })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/recruitment/applications/:id/approve|reject — décision + email au candidat
async function decide(req, res, approved) {
  try {
    const app = await RecruitmentApplication.findOne({ _id: req.params.id, school: schoolId(req) })
      .populate('post', 'title')
      .populate('school', 'name')
    if (!app) return res.status(404).json({ message: 'Candidature non trouvée' })

    app.status = approved ? 'approved' : 'rejected'
    app.decisionReason = req.body.reason?.trim() || ''
    await app.save()

    if (app.email) {
      sendRecruitmentDecisionEmail({
        to: app.email,
        fullName: app.fullName,
        postTitle: app.post?.title || 'le poste',
        schoolName: app.school?.name,
        approved,
        reason: app.decisionReason,
      }).catch(() => {})
    }

    res.json({ success: true, data: app })
  } catch (err) { res.status(500).json({ message: err.message }) }
}

router.post('/applications/:id/approve', protect, authorize('directeur', 'super_admin'), (req, res) => decide(req, res, true))
router.post('/applications/:id/reject', protect, authorize('directeur', 'super_admin'), (req, res) => decide(req, res, false))

module.exports = router
