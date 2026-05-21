const express = require('express')
const router = express.Router()
const Message = require('../models/Message')
const User = require('../models/User')
const { protect } = require('../middleware/auth')

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
        const otherId = msg.sender.toString() === userId.toString() ? msg.recipient : msg.sender
        const other = await User.findById(otherId).select('name email role')
        return { conversationId: c._id, lastMessage: msg, unread: c.unread, contact: other }
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
    const messages = await Message.find({ conversationId: req.params.conversationId })
      .populate('sender', 'name email role')
      .populate('recipient', 'name email role')
      .sort({ createdAt: 1 })

    await Message.updateMany(
      { conversationId: req.params.conversationId, recipient: req.user._id, read: false },
      { read: true, readAt: new Date() }
    )

    res.json({ success: true, data: messages })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/messages
router.post('/', protect, async (req, res) => {
  try {
    const { recipientId, subject, body } = req.body
    const senderId = req.user._id

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
    const schoolId = req.user.school._id || req.user.school
    const users = await User.find({ school: schoolId, _id: { $ne: req.user._id }, isActive: true })
      .select('name email role')
      .sort({ name: 1 })
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

module.exports = router
