const mongoose = require('mongoose')

const parentalControlSchema = new mongoose.Schema(
  {
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    screenTime: {
      enabled: { type: Boolean, default: false },
      maxHoursPerDay: { type: Number, default: 3 },
      allowedFrom: { type: String, default: '08:00' },
      allowedTo: { type: String, default: '20:00' },
    },
    blockedModules: [{ type: String }],
    alerts: {
      inactivityDays: { type: Number, default: 3 },
      gradeDropThreshold: { type: Number, default: 2 },
      notifyByEmail: { type: Boolean, default: true },
    },
    lastActivity: { type: Date },
    todayScreenMinutes: { type: Number, default: 0 },
  },
  { timestamps: true }
)

parentalControlSchema.index({ parent: 1, student: 1 }, { unique: true })

module.exports = mongoose.model('ParentalControl', parentalControlSchema)
