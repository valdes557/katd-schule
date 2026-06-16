const mongoose = require('mongoose')

const activitySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    type: {
      type: String,
      enum: ['sortie', 'sport', 'culturel', 'scientifique', 'artistique', 'social', 'autre'],
      default: 'autre',
    },
    date: { type: Date, required: true },
    endDate: { type: Date },
    location: { type: String, default: '' },
    cost: { type: Number, default: 0 },
    requiresAuthorization: { type: Boolean, default: false },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    createdByUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    photos: [{ type: String }],
  },
  { timestamps: true }
)

module.exports = mongoose.model('Activity', activitySchema)
