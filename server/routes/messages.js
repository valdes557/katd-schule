const express = require('express')
const router = express.Router()
const Message = require('../models/Message')
const User = require('../models/User')
const Student = require('../models/Student')
const Teacher = require('../models/Teacher')
const MessageGroup = require('../models/MessageGroup')
const { protect, authorize } = require('../middleware/auth')
const { upload } = require('../config/cloudinary')

// Helper: compute allowed contacts for the current user based on role & school
async function getAllowedContacts(user) {
  const schoolId = user.school?._id || user.school
  if (!schoolId) return []

  const baseUserQuery = { school: schoolId, _id: { $ne: user._id }, isActive: true }

  if (user.role === 'directeur') {
    const teachers = await User.find({ ...baseUserQuery, role: 'enseignant' })

    const students = await Student.find({ school: schoolId, parentUser: { $ne: null }, status: 'active' })
      .select('parentUser')
      .lean()
    const parentIds = [...new Set(students.map((s) => s.parentUser?.toString()).filter(Boolean))]
    const parents = parentIds.length
      ? await User.find({ _id: { $in: parentIds }, role: 'parent', isActive: true })
      : []

    const map = new Map()
    for (const u of [...teachers, ...parents]) {
      map.set(u._id.toString(), u)
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }

  if (user.role === 'enseignant') {
    const directors = await User.find({ ...baseUserQuery, role: 'directeur' })

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
      { $match: { $or: [{ sender: userId }, { recipient: userId }] } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$conversationId',
          lastMessage: { $first: '$$ROOT' },
          unread: {
            $sum: { $cond: [{ $and: [{ $eq: ['$recipient', userId] }, { $eq: ['$read', false] }] }, 1, 0] },
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
    const raw = await Message.find({
      conversationId: req.params.conversationId,
      $or: [{ sender: userId }, { recipient: userId }],
    })
      .populate('sender', 'name email role')
      .populate('recipient', 'name email role')
      .sort({ createdAt: 1, _id: 1 })

    const seen = new Set()
    const messages = []
    for (const m of raw) {
      const key = m.broadcastKey || m._id.toString()
      if (seen.has(key)) continue
      seen.add(key)
      messages.push(m)
    }

    await Message.updateMany(
      { conversationId: req.params.conversationId, recipient: req.user._id, read: false },
      { read: true, readAt: new Date() }
    )

    res.json({ success: true, data: messages })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/messages — direct (1-1) messages only
router.post('/', protect, async (req, res) => {
  try {
    const { recipientId, subject, body } = req.body
    const senderId = req.user._id

    if (!recipientId || !body) {
      return res.status(400).json({ message: 'Destinataire et contenu requis' })
    }

    const allowed = await getAllowedContacts(req.user)
    const isAllowed = allowed.some((u) => u._id.toString() === String(recipientId))
    if (!isAllowed) {
      return res.status(403).json({ message: 'Vous ne pouvez pas envoyer de message à cet utilisateur' })
    }

    const ids = [senderId.toString(), recipientId].sort()
    const conversationId = `conv_${ids[0]}_${ids[1]}`

    const message = await Message.create({
      conversationId,
      sender: senderId,
      recipient: recipientId,
      school: req.user.school,
      subject,
      body,
    })

    const populated = await message.populate([
      { path: 'sender', select: 'name email role' },
      { path: 'recipient', select: 'name email role' },
    ])

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

// GET /api/messages/unread-count
router.get('/unread-count', protect, async (req, res) => {
  try {
    const count = await Message.countDocuments({ recipient: req.user._id, read: false })
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

// POST /api/messages/groups/:groupId — send a message in a group conversation
router.post('/groups/:groupId', protect, async (req, res) => {
  try {
    const { subject, body } = req.body
    if (!body || String(body).trim().length === 0) {
      return res.status(400).json({ message: 'Le contenu du message est requis' })
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

    const docs = []
    for (const memberId of group.members) {
      const memberStr = memberId.toString()
      docs.push({
        conversationId,
        sender: req.user._id,
        recipient: memberId,
        school: schoolId,
        subject,
        body,
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

    res.status(201).json({ success: true, data: populated })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/messages/:id — supprimer un message (pour tout le monde)
// Règles : l'expéditeur peut supprimer son message ; un directeur/super_admin peut
// supprimer n'importe quel message de son école. Pour les messages de groupe, on
// supprime toutes les copies partageant le même broadcastKey.
router.delete('/:id', protect, async (req, res) => {
  try {
    const msg = await Message.findById(req.params.id)
    if (!msg) return res.status(404).json({ message: 'Message introuvable' })

    const userId = req.user._id.toString()
    const isSender = msg.sender.toString() === userId
    const schoolId = (req.user.school?._id || req.user.school)?.toString()
    const isAdmin =
      ['directeur', 'super_admin'].includes(req.user.role) &&
      schoolId && msg.school?.toString() === schoolId

    if (!isSender && !isAdmin) {
      return res.status(403).json({ message: 'Vous ne pouvez pas supprimer ce message' })
    }

    if (msg.broadcastKey) {
      await Message.deleteMany({ broadcastKey: msg.broadcastKey })
    } else {
      await Message.deleteOne({ _id: msg._id })
    }

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
