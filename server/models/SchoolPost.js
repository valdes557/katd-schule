const mongoose = require('mongoose')

const commentSchema = new mongoose.Schema(
  {
    author: { type: String, required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    content: { type: String, required: true },
  },
  { timestamps: true }
)

const schoolPostSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', default: null },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    title: { type: String, default: '' },
    images: [{ type: String }],
    thumbnail: { type: String, default: '' },
    type: { type: String, enum: ['text', 'photo', 'video', 'audio'], default: 'text' },
    videoUrl: { type: String },
    audioUrl: { type: String },
    duration: { type: String, default: '' },
    category: { type: String, default: '' },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comments: [commentSchema],
    shares: { type: Number, default: 0 },
    downloads: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    isPublic: { type: Boolean, default: true },
    isPlatform: { type: Boolean, default: false },
  },
  { timestamps: true }
)

schoolPostSchema.index({ school: 1, createdAt: -1 })
schoolPostSchema.index({ isPlatform: 1, createdAt: -1 })

module.exports = mongoose.model('SchoolPost', schoolPostSchema)
