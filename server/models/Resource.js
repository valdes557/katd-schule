const mongoose = require('mongoose')

const resourceSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  type: { type: String, enum: ['pdf', 'video', 'audio', 'link', 'image', 'document'], default: 'document' },
  category: { type: String, default: 'Général' },
  url: { type: String, default: '' },
  fileSize: { type: String, default: '' },
  isPublic: { type: Boolean, default: true },
  downloads: { type: Number, default: 0 },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

module.exports = mongoose.model('Resource', resourceSchema)
