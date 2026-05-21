const mongoose = require('mongoose')

const locationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['country', 'city', 'neighborhood'], required: true },
    name: { type: String, required: true, trim: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    code: { type: String, trim: true },
  },
  { timestamps: true }
)

locationSchema.index({ type: 1, parent: 1 })
locationSchema.index({ name: 1, type: 1, parent: 1 }, { unique: true })

module.exports = mongoose.model('Location', locationSchema)
