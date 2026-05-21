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
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    images: [{ type: String }],
    type: { type: String, enum: ['text', 'photo', 'video'], default: 'text' },
    videoUrl: { type: String },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comments: [commentSchema],
    shares: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    isPublic: { type: Boolean, default: true },
  },
  { timestamps: true }
)

schoolPostSchema.index({ school: 1, createdAt: -1 })

module.exports = mongoose.model('SchoolPost', schoolPostSchema)
