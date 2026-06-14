const mongoose = require('mongoose')

// Évènements / informations générales de l'école (réunions, cérémonies…),
// publiés par le directeur, visibles par les membres selon l'audience.
const eventSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    type: {
      type: String,
      enum: ['reunion', 'ceremonie', 'examen', 'sortie', 'autre'],
      default: 'autre',
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    location: { type: String, default: '' },
    audience: { type: String, enum: ['all', 'parents', 'teachers'], default: 'all' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

eventSchema.index({ school: 1, startDate: 1 })

module.exports = mongoose.model('Event', eventSchema)
