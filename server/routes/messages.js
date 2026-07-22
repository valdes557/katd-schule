const express = require('express')
const router = express.Router()
const Message = require('../models/Message')
const User = require('../models/User')
const Student = require('../models/Student')
const Teacher = require('../models/Teacher')
const MessageGroup = require('../models/MessageGroup')
const { protect, authorize } = require('../middleware/auth')
const { upload, cloudinary } = require('../config/cloudinary')
const pushService = require('../services/pushService')

// Aperçu court d'un message pour la notification push.
function messagePreview(type, body) {
  if (type === 'voice') return '🎤 Message vocal'
  if (type === 'image') return '📷 Photo'
  if (type === 'video') return '🎬 Vidéo'
  if (type === 'sticker') return 'Sticker'
  const t = (body || '').trim()
  return t.length > 80 ? t.slice(0, 80) + '…' : t || 'Nouveau message'
}

// Helper: compute allowed contacts for the current user based on role & school
async function getAllowedContacts(user) {
  const schoolId = user.school?._id || user.school
  if (!schoolId) return []

  const baseUserQuery = { school: schoolId, _id: { $ne: user._id }, isActive: true }
  // Membres administratifs du Secondaire — joignables par le principal et les professeurs
  const SECONDARY_ADMIN_ROLES = ['vice_principal', 'surveillant_general', 'caissiere', 'secretaire', 'portier']

  if (user.role === 'directeur') {
    const teachers = await User.find({ ...baseUserQuery, role: 'enseignant' })
    const adminMembers = await User.find({ ...baseUserQuery, role: { $in: SECONDARY_ADMIN_ROLES } })

    const students = await Student.find({ school: schoolId, parentUser: { $ne: null }, status: 'active' })
      .select('parentUser')
      .lean()
    const parentIds = [...new Set(students.map((s) => s.parentUser?.toString()).filter(Boolean))]
    const parents = parentIds.length
      ? await User.find({ _id: { $in: parentIds }, role: 'parent', isActive: true })
      : []

    const map = new Map()
    for (const u of [...teachers, ...adminMembers, ...parents]) {
      map.set(u._id.toString(), u)
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }

  if (user.role === 'enseignant') {
    const directors = await User.find({ ...baseUserQuery, role: { $in: ['directeur', ...SECONDARY_ADMIN_ROLES] } })

    const teacherProfile = await Teacher.findOne({ user: user._id }).select('_id school')
    let parents = []
    if (teacherProfile) {
      const students = await Student.find({
        school: schoolId,
        teacher: teacherProfile._id,
        parentUser: { $ne: null },
        status: 'active',
      })
        .select('parentUser')
        .lean()
      const parentIds = [...new Set(students.map((s) => s.parentUser?.toString()).filter(Boolean))]
      if (parentIds.length) {
        parents = await User.find({ _id: { $in: parentIds }, role: 'parent', isActive: true })
      }
    }

    const map = new Map()
    for (const u of [...directors, ...parents]) {
      map.set(u._id.toString(), u)
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }

  if (user.role === 'parent') {
    const children = await Student.find({ parentUser: user._id, status: 'active' })
      .select('school teacher')
      .populate({ path: 'teacher', select: 'user' })

    const schoolIds = [...new Set(children.map((c) => (c.school?._id || c.school)?.toString()).filter(Boolean))]
    const directors = schoolIds.length
      ? await User.find({ school: { $in: schoolIds }, role: 'directeur', isActive: true })
      : []

    const teacherUserIds = [...new Set(
      children
        .map((c) => (c.teacher && c.teacher.user ? c.teacher.user.toString() : null))
        .filter(Boolean)
    )]
    const teachers = teacherUserIds.length
      ? await User.find({ _id: { $in: teacherUserIds }, isActive: true })
      : []

    const map = new Map()
    for (const u of [...directors, ...teachers]) {
      map.set(u._id.toString(), u)
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }

  // Fallback: same school, all active users except self (for super_admin and others)
  return User.find(baseUserQuery).select('name email role').sort({ name: 1 })
}

// GET /api/messages/conversations — list conversations (grouped)
router.get('/conversations', protect, async (req, res) => {
  try {
    const userId = req.user._id
    const conversations = await Message.aggregate([
      // On ignore les messages que l'utilisateur a supprimés « pour moi ».
      { $match: { $or: [{ sender: userId }, { recipient: userId }], deletedFor: { $ne: userId } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$conversationId',
          lastMessage: { $first: '$$ROOT' },
          // Non lu = destiné à l'utilisateur et non encore lu (booléen legacy, rétro-compatible).
          unread: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$recipient', userId] }, { $eq: ['$read', false] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { 'lastMessage.createdAt': -1 } },
    ])

    const populated = await Promise.all(
      conversations.map(async (c) => {
        const msg = c.lastMessage
        let contact = null
        let groupId = null
        const isGroup = !!msg.isGroup

        if (isGroup && msg.group) {
          const group = await MessageGroup.findById(msg.group).select('name members image')
          if (group) {
            groupId = group._id
            contact = {
              _id: group._id,
              name: group.name,
              role: 'groupe',
              image: group.image || null,
              membersCount: group.members.length,
            }
          }
        }

        if (!isGroup) {
          const otherId = msg.sender.toString() === userId.toString() ? msg.recipient : msg.sender
          const other = await User.findById(otherId).select('name email role')
          contact = other
        }

        return {
          conversationId: c._id,
          lastMessage: msg,
          unread: c.unread,
          contact,
          isGroup,
          groupId,
        }
      })
    )

    res.json({ success: true, data: populated })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/messages/conversation/:conversationId
router.get('/conversation/:conversationId', protect, async (req, res) => {
  try {
    const userId = req.user._id
    const convId = req.params.conversationId
    const raw = await Message.find({
      conversationId: convId,
      $or: [{ sender: userId }, { recipient: userId }],
      // « Supprimé pour moi » : masqué uniquement pour cet utilisateur.
      deletedFor: { $ne: userId },
    })
      .populate('sender', 'name email role')
      .populate('recipient', 'name email role')
      .populate('readBy.user', 'name')
      .sort({ createdAt: 1, _id: 1 })

    const seen = new Set()
    const messages = []
    for (const m of raw) {
      const key = m.broadcastKey || m._id.toString()
      if (seen.has(key)) continue
      seen.add(key)
      messages.push(m)
    }

    // Marque « vu » : booléen legacy (1-1) + readBy par-utilisateur (1-1 ET groupe).
    // On pousse l'utilisateur dans readBy de TOUTES les copies de la conversation
    // (chaque membre a sa copie en groupe) → la copie affichée accumule tous les lecteurs.
    await Message.updateMany(
      { conversationId: convId, recipient: userId, read: false },
      { read: true, readAt: new Date() }
    )
    await Message.updateMany(
      { conversationId: convId, 'readBy.user': { $ne: userId } },
      { $push: { readBy: { user: userId, at: new Date() } } }
    )

    // Masque le contenu des messages supprimés « pour tout le monde ».
    const out = messages.map((m) => {
      const o = m.toObject()
      if (o.deletedForEveryone) {
        o.body = ''
        o.mediaUrl = ''
        o.type = 'text'
        o.deleted = true
      }
      return o
    })

    res.json({ success: true, data: out })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/messages — direct (1-1) messages only
router.post('/', protect, async (req, res) => {
  try {
    const { recipientId, subject, body, type, mediaUrl, mediaDuration } = req.body
    const senderId = req.user._id

    const msgType = type || 'text'
    if (!recipientId) {
      return res.status(400).json({ message: 'Destinataire requis' })
    }
    // Pour un message texte, le contenu est requis ; pour un média, mediaUrl suffit
    if (msgType === 'text' && !body) {
      return res.status(400).json({ message: 'Contenu requis' })
    }
    if (msgType !== 'text' && msgType !== 'sticker' && !mediaUrl) {
      return res.status(400).json({ message: 'Média requis' })
    }

    let isAllowed = false
    if (STAFF_ROLES.includes(req.user.role)) {
      const recipient = await User.findById(recipientId).select('role isActive')
      isAllowed = !!(recipient && recipient.isActive && STAFF_ROLES.includes(recipient.role))
    }
    if (!isAllowed) {
      const allowed = await getAllowedContacts(req.user)
      isAllowed = allowed.some((u) => u._id.toString() === String(recipientId))
    }
    if (!isAllowed) {
      // Espace utilisateur public : tous les utilisateurs KATD peuvent échanger
      const rcpt = await User.findById(recipientId).select('isActive role')
      if (rcpt && rcpt.isActive !== false && (req.user.role === 'utilisateur' || rcpt.role === 'utilisateur')) {
        isAllowed = true
      }
    }
    if (!isAllowed) {
      return res.status(403).json({ message: 'Vous ne pouvez pas envoyer de message à cet utilisateur' })
    }

    const ids = [senderId.toString(), recipientId].sort()
    const conversationId = `conv_${ids[0]}_${ids[1]}`

    // Upload du média si fourni en data URL (image, vidéo, vocal). Les stickers restent une URL/emoji directe.
    let finalMediaUrl = mediaUrl || ''
    if (mediaUrl && /^data:/.test(mediaUrl) && msgType !== 'sticker') {
      const resourceType = msgType === 'image' ? 'image' : 'video' // cloudinary traite l'audio comme 'video'
      const up = await cloudinary.uploader.upload(mediaUrl, { resource_type: resourceType, folder: 'katd/messages' })
      finalMediaUrl = up.secure_url
    }

    const message = await Message.create({
      conversationId,
      sender: senderId,
      recipient: recipientId,
      school: req.user.school,
      subject,
      body: body || '',
      type: msgType,
      mediaUrl: finalMediaUrl,
      mediaDuration: Number(mediaDuration) || 0,
    })

    const populated = await message.populate([
      { path: 'sender', select: 'name email role' },
      { path: 'recipient', select: 'name email role' },
    ])

    // Notification push au destinataire (best-effort, hors du site).
    const rcptRole = populated.recipient?.role
    const url = rcptRole === 'utilisateur' ? '/u/messages' : '/dashboard/messagerie'
    pushService.sendToUser(recipientId, {
      title: req.user.name || 'Nouveau message',
      body: messagePreview(msgType, body),
      url,
      tag: 'msg_' + conversationId,
    })

    res.status(201).json({ success: true, data: populated })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/messages/contacts — list users in same school
router.get('/contacts', protect, async (req, res) => {
  try {
    const users = await getAllowedContacts(req.user)
    res.json({ success: true, data: users })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ===== Messagerie inter-établissements : annuaire du personnel =====
const STAFF_ROLES = ['super_admin', 'directeur', 'enseignant', 'parent']
const ONLINE_WINDOW_MS = 3 * 60 * 1000

async function getAllStaff(user) {
  const staff = await User.find({
    role: { $in: STAFF_ROLES },
    _id: { $ne: user._id },
    isActive: true,
  })
    .select('name email role avatar isOnline lastActivity school')
    .populate('school', 'name')
    .sort({ name: 1 })
    .lean()

  return staff.map((u) => ({
    _id: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
    avatar: u.avatar || null,
    schoolName: (u.school && u.school.name) ? u.school.name : 'Plateforme',
    online: !!(u.isOnline && u.lastActivity && (Date.now() - new Date(u.lastActivity).getTime()) < ONLINE_WINDOW_MS),
    lastActivity: u.lastActivity || null,
  }))
}

// GET /api/messages/staff — tout le personnel de tous les établissements (réservé au personnel)
router.get('/staff', protect, async (req, res) => {
  try {
    if (!STAFF_ROLES.includes(req.user.role)) {
      return res.status(403).json({ message: 'Accès réservé au personnel' })
    }
    const staff = await getAllStaff(req.user)
    res.json({ success: true, data: staff })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/messages/unread-count
router.get('/unread-count', protect, async (req, res) => {
  try {
    const count = await Message.countDocuments({
      recipient: req.user._id,
      read: false,
      deletedFor: { $ne: req.user._id },
      deletedForEveryone: { $ne: true },
    })
    res.json({ success: true, data: { count } })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/messages/groups — list message groups where user is a member
router.get('/groups', protect, async (req, res) => {
  try {
    const userId = req.user._id
    const schoolId = req.user.school?._id || req.user.school
    if (!schoolId) return res.json({ success: true, data: [] })

    const groups = await MessageGroup.find({ school: schoolId, members: userId, isActive: true })
      .sort({ createdAt: -1 })

    const data = groups.map((g) => ({
      _id: g._id,
      name: g.name,
      image: g.image || null,
      membersCount: g.members.length,
      type: g.type,
    }))

    res.json({ success: true, data })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/messages/groups — director creates a teacher or parent group (avec image optionnelle)
router.post('/groups', protect, authorize('directeur', 'super_admin'), upload.single('image'), async (req, res) => {
  try {
    let { name, memberIds = [], memberRole = 'enseignant' } = req.body
    // En multipart, memberIds peut arriver en chaîne JSON ou en valeurs répétées
    if (typeof memberIds === 'string') {
      try { memberIds = JSON.parse(memberIds) } catch (_) { memberIds = memberIds ? [memberIds] : [] }
    }
    if (!Array.isArray(memberIds)) memberIds = [memberIds].filter(Boolean)

    if (!name || String(name).trim().length === 0) {
      return res.status(400).json({ message: 'Le nom du groupe est requis' })
    }

    const role = memberRole === 'parent' ? 'parent' : 'enseignant'
    const schoolId = req.user.school?._id || req.user.school
    if (!schoolId) return res.status(400).json({ message: 'Aucune école associée à votre compte' })

    // For parents, school is stored on the Student, not the parent User — so we
    // validate against the parent accounts linked to active students of this school.
    let validMemberIds = []
    if (role === 'parent') {
      const students = await Student.find({ school: schoolId, parentUser: { $in: memberIds }, status: 'active' })
        .select('parentUser')
        .lean()
      validMemberIds = [...new Set(students.map((s) => s.parentUser?.toString()).filter(Boolean))]
    } else {
      const teachers = await User.find({
        _id: { $in: memberIds },
        school: schoolId,
        role: 'enseignant',
        isActive: true,
      }).select('_id')
      validMemberIds = teachers.map((t) => t._id.toString())
    }

    const members = new Set(validMemberIds)
    members.add(req.user._id.toString())

    if (members.size <= 1) {
      const who = role === 'parent' ? 'parent' : 'enseignant'
      return res.status(400).json({ message: `Sélectionnez au moins un ${who} pour le groupe` })
    }

    const group = await MessageGroup.create({
      name: name.trim(),
      image: req.file?.path,
      school: schoolId,
      createdBy: req.user._id,
      members: Array.from(members),
      type: role === 'parent' ? 'parent_group' : 'teacher_group',
    })

    res.status(201).json({ success: true, data: group })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/messages/groups/:groupId — détail d'un groupe (membres) pour la gestion
router.get('/groups/:groupId', protect, async (req, res) => {
  try {
    const group = await MessageGroup.findById(req.params.groupId).populate('members', 'name role')
    if (!group || !group.isActive) return res.status(404).json({ message: 'Groupe introuvable' })
    const schoolId = req.user.school?._id || req.user.school
    if (!schoolId || group.school.toString() !== schoolId.toString()) return res.status(403).json({ message: 'Accès refusé à ce groupe' })
    res.json({ success: true, data: { _id: group._id, name: group.name, type: group.type, image: group.image || null, members: group.members } })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/messages/groups/:groupId/members — le directeur ajoute des membres
// (enseignants ou parents selon le type) à un groupe EXISTANT de son école.
router.post('/groups/:groupId/members', protect, authorize('directeur', 'super_admin'), async (req, res) => {
  try {
    let { memberIds = [] } = req.body
    if (!Array.isArray(memberIds)) memberIds = [memberIds].filter(Boolean)
    if (memberIds.length === 0) return res.status(400).json({ message: 'Aucun membre à ajouter' })

    const group = await MessageGroup.findById(req.params.groupId)
    if (!group || !group.isActive) return res.status(404).json({ message: 'Groupe introuvable' })
    const schoolId = req.user.school?._id || req.user.school
    if (!schoolId || group.school.toString() !== schoolId.toString()) return res.status(403).json({ message: 'Accès refusé à ce groupe' })

    // Valide les membres selon le type de groupe (même logique que la création).
    let validIds = []
    if (group.type === 'parent_group') {
      const students = await Student.find({ school: schoolId, parentUser: { $in: memberIds }, status: 'active' })
        .select('parentUser').lean()
      validIds = [...new Set(students.map((s) => s.parentUser?.toString()).filter(Boolean))]
    } else {
      const teachers = await User.find({ _id: { $in: memberIds }, school: schoolId, role: 'enseignant', isActive: true }).select('_id')
      validIds = teachers.map((t) => t._id.toString())
    }
    if (validIds.length === 0) return res.status(400).json({ message: 'Aucun membre valide à ajouter' })

    await MessageGroup.updateOne({ _id: group._id }, { $addToSet: { members: { $each: validIds } } })
    const updated = await MessageGroup.findById(group._id)
    res.json({ success: true, data: { _id: updated._id, membersCount: updated.members.length, added: validIds.length } })
  } catch (err) { res.status(500).json({ message: err.message }) }
})

// POST /api/messages/groups/:groupId — send a message in a group conversation
router.post('/groups/:groupId', protect, async (req, res) => {
  try {
    const { subject, body, type, mediaUrl, mediaDuration } = req.body
    const msgType = type || 'text'
    // Un message texte exige un contenu ; un média (vocal/image/vidéo) exige mediaUrl.
    if (msgType === 'text' && (!body || String(body).trim().length === 0)) {
      return res.status(400).json({ message: 'Le contenu du message est requis' })
    }
    if (msgType !== 'text' && msgType !== 'sticker' && !mediaUrl) {
      return res.status(400).json({ message: 'Média requis' })
    }

    const group = await MessageGroup.findById(req.params.groupId)
    if (!group || !group.isActive) {
      return res.status(404).json({ message: 'Groupe introuvable' })
    }

    const schoolId = req.user.school?._id || req.user.school
    if (!schoolId || group.school.toString() !== schoolId.toString()) {
      return res.status(403).json({ message: 'Accès refusé à ce groupe' })
    }

    const userId = req.user._id.toString()
    if (!group.members.map((m) => m.toString()).includes(userId)) {
      return res.status(403).json({ message: 'Vous ne faites pas partie de ce groupe' })
    }

    const conversationId = `group_${group._id.toString()}`
    const broadcastKey = new Message()._id.toString()

    // Upload du média si fourni en data URL (image, vidéo, vocal). Fait UNE
    // seule fois puis partagé par toutes les copies du message de groupe.
    // Les stickers restent un emoji direct (pas d'upload).
    let finalMediaUrl = mediaUrl || ''
    if (mediaUrl && /^data:/.test(mediaUrl) && msgType !== 'sticker') {
      const resourceType = msgType === 'image' ? 'image' : 'video' // cloudinary traite l'audio comme 'video'
      const up = await cloudinary.uploader.upload(mediaUrl, { resource_type: resourceType, folder: 'katd/messages' })
      finalMediaUrl = up.secure_url
    }

    const docs = []
    for (const memberId of group.members) {
      const memberStr = memberId.toString()
      docs.push({
        conversationId,
        sender: req.user._id,
        recipient: memberId,
        school: schoolId,
        subject,
        body: body || '',
        type: msgType,
        mediaUrl: finalMediaUrl,
        mediaDuration: Number(mediaDuration) || 0,
        isGroup: true,
        group: group._id,
        broadcastKey,
        read: memberStr === userId,
        readAt: memberStr === userId ? new Date() : undefined,
      })
    }

    const created = await Message.insertMany(docs)
    const first = created[0]
    const populated = await Message.findById(first._id)
      .populate('sender', 'name email role')
      .populate('recipient', 'name email role')

    // Notification push à chaque membre du groupe sauf l'expéditeur (best-effort).
    const otherMembers = group.members.map((m) => m.toString()).filter((m) => m !== userId)
    pushService.sendToUsers(otherMembers, {
      title: `${req.user.name || 'Groupe'} · ${group.name}`,
      body: messagePreview(msgType, body),
      url: '/dashboard/messagerie',
      tag: 'group_' + group._id.toString(),
    })

    res.status(201).json({ success: true, data: populated })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/messages/:id?scope=me|everyone — suppression façon WhatsApp.
//   scope=me       : « Supprimer pour moi » — le message est masqué uniquement pour
//                    l'utilisateur courant (ajout à deletedFor). Toujours autorisé.
//   scope=everyone : « Supprimer pour tout le monde » — contenu retiré, remplacé par
//                    « Ce message a été supprimé » chez tous. Autorisé à l'expéditeur
//                    (sans limite de temps) ou à un directeur/super_admin de l'école.
// Pour les messages de groupe, l'action s'applique à toutes les copies (broadcastKey).
router.delete('/:id', protect, async (req, res) => {
  try {
    const msg = await Message.findById(req.params.id)
    if (!msg) return res.status(404).json({ message: 'Message introuvable' })

    const userId = req.user._id.toString()
    const scope = req.query.scope === 'everyone' ? 'everyone' : 'me'

    if (scope === 'me') {
      // Masque le message pour cet utilisateur seulement (sa/ses copies).
      if (msg.broadcastKey) {
        await Message.updateMany(
          { broadcastKey: msg.broadcastKey, $or: [{ sender: req.user._id }, { recipient: req.user._id }] },
          { $addToSet: { deletedFor: req.user._id } }
        )
      } else {
        await Message.updateOne({ _id: msg._id }, { $addToSet: { deletedFor: req.user._id } })
      }
      return res.json({ success: true, scope: 'me' })
    }

    // scope === 'everyone'
    const isSender = msg.sender.toString() === userId
    const schoolId = (req.user.school?._id || req.user.school)?.toString()
    const isAdmin =
      ['directeur', 'super_admin'].includes(req.user.role) &&
      schoolId && msg.school?.toString() === schoolId

    if (!isSender && !isAdmin) {
      return res.status(403).json({ message: 'Vous ne pouvez pas supprimer ce message pour tout le monde' })
    }

    const patch = { deletedForEveryone: true, deletedAt: new Date(), body: '', mediaUrl: '', mediaDuration: 0 }
    if (msg.broadcastKey) {
      await Message.updateMany({ broadcastKey: msg.broadcastKey }, { $set: patch })
    } else {
      await Message.updateOne({ _id: msg._id }, { $set: patch })
    }

    res.json({ success: true, scope: 'everyone' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/messages/all-users — tous les utilisateurs KATD (espace utilisateur)
router.get('/all-users', protect, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id }, isActive: { $ne: false } })
      .select('name email role avatar isOnline lastActivity')
      .sort({ name: 1 })
    const now = Date.now()
    const data = users.map((u) => {
      const seen = u.lastActivity ? new Date(u.lastActivity).getTime() : 0
      const online = !!u.isOnline && now - seen < 3 * 60 * 1000
      return { _id: u._id, name: u.name, email: u.email, role: u.role, avatar: u.avatar || '', online, lastActivity: u.lastActivity }
    })
    res.json({ success: true, data })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router