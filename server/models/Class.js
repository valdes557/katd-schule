const mongoose = require('mongoose')

const classSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    level: { type: String, required: true },
    cycle: { type: String, enum: ['Maternelle', 'Primaire', 'Secondaire'], required: true },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    mainTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    capacity: { type: Number, default: 40 },
    enrollmentFee: { type: Number, default: 0 },
    academicYear: { type: String },
    stats: {
      totalStudents: { type: Number, default: 0 },
      averageGrade: { type: Number, default: 0 },
      attendanceRate: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Class', classSchema)
