const mongoose = require('mongoose')

const commentSchema = new mongoose.Schema(
  {
    media: { type: mongoose.Schema.Types.ObjectId, ref: 'Media', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    likes: { type: Number, default: 0 },
  },
  { timestamps: true }
)

commentSchema.index({ media: 1, createdAt: -1 })

module.exports = mongoose.model('Comment', commentSchema)
