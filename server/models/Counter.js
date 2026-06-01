const mongoose = require('mongoose')

const counterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    year: { type: Number, required: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true }
)

counterSchema.index({ name: 1, school: 1, year: 1 }, { unique: true })

module.exports = mongoose.model('Counter', counterSchema)
