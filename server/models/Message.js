const mongoose = require('mongoose')

const messageSchema = new mongoose.Schema(
  {
    conversationId: { type: String, required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
    subject: { type: String, trim: true },
    body: { type: String, default: '' },
    // Type de message : texte, vocal, image, vidéo ou sticker
    type: { type: String, enum: ['text', 'voice', 'image', 'video', 'sticker'], default: 'text' },
    mediaUrl: { type: String, default: '' },
    mediaDuration: { type: Number, default: 0 }, // durée d'un vocal en secondes
    read: { type: Boolean, default: false },
    readAt: { type: Date },
    isGroup: { type: Boolean, default: false },
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'MessageGroup' },
    broadcastKey: { type: String, index: true },
    attachments: [
      {
        filename: { type: String },
        url: { type: String },
        size: { type: Number },
      },
    ],
  },
  { timestamps: true }
)

messageSchema.index({ sender: 1, recipient: 1 })
messageSchema.index({ recipient: 1, read: 1 })

module.exports = mongoose.model('Message', messageSchema)