const mongoose = require('mongoose')

const contactMessageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    phone: { type: String, default: '', trim: true },
    subject: { type: String, default: 'Message depuis le site KATD-SCHÜLE', trim: true },
    message: { type: String, required: true, trim: true },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    ip: { type: String, default: '' },
    replied: { type: Boolean, default: false },
  },
  { timestamps: true }
)

module.exports = mongoose.model('ContactMessage', contactMessageSchema)
