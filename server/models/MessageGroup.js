const mongoose = require('mongoose')

const messageGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    image: { type: String },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isActive: { type: Boolean, default: true },
    type: { type: String, default: 'teacher_group' },
  },
  { timestamps: true }
)

messageGroupSchema.index({ school: 1 })
messageGroupSchema.index({ members: 1 })

module.exports = mongoose.model('MessageGroup', messageGroupSchema)
