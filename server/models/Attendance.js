const mongoose = require('mongoose')

const attendanceRecordSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  status: { type: String, enum: ['present', 'absent', 'late', 'excused'], required: true },
})

const attendanceSchema = new mongoose.Schema(
  {
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    date: { type: Date, required: true },
    records: [attendanceRecordSchema],
    summary: {
      total: { type: Number, default: 0 },
      present: { type: Number, default: 0 },
      absent: { type: Number, default: 0 },
      late: { type: Number, default: 0 },
      excused: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
)

attendanceSchema.index({ class: 1, date: 1 }, { unique: true })

module.exports = mongoose.model('Attendance', attendanceSchema)
