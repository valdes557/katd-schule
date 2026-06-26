const mongoose = require('mongoose')

const slotSchema = new mongoose.Schema({
  day: { type: String, enum: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'], required: true },
  date: { type: String, default: '' }, // date précise optionnelle (YYYY-MM-DD) pour un cours/événement ponctuel
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  subject: { type: String },
  subjectRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  teacher: { type: String },
  teacherRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  room: { type: String },
  color: { type: String, default: '#3B82F6' },
}, { _id: true })

const timetableSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    academicYear: { type: String },
    slots: [slotSchema],
  },
  { timestamps: true }
)

timetableSchema.index({ school: 1, class: 1 }, { unique: true })

module.exports = mongoose.model('Timetable', timetableSchema)