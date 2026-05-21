const mongoose = require('mongoose')

const teamMemberSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    photo: { type: String, default: '' },
    description: { type: String, default: '' },
    order: { type: Number, default: 0 },
    isPublic: { type: Boolean, default: true },
  },
  { timestamps: true }
)

teamMemberSchema.index({ school: 1, order: 1 })

module.exports = mongoose.model('TeamMember', teamMemberSchema)
