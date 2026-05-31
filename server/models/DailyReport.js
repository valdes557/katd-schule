const mongoose = require('mongoose')

const dailyReportSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
    classes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
    date: { type: Date, default: Date.now },
    title: { type: String, trim: true },
    content: { type: String, required: true, trim: true },
    status: { type: String, enum: ['submitted', 'reviewed'], default: 'submitted' },
    reviewedAt: { type: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

dailyReportSchema.index({ school: 1, date: -1 })
dailyReportSchema.index({ school: 1, status: 1, date: -1 })

module.exports = mongoose.model('DailyReport', dailyReportSchema)
