const mongoose = require('mongoose')

const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    cycle: { type: String, enum: ['Maternelle', 'Primaire', 'Secondaire'], required: true },
    level: { type: String },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    classes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
    coefficient: { type: Number, default: 1 },
    hoursPerWeek: { type: Number, default: 2 },
    description: { type: String },
    program: { type: String },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Subject', subjectSchema)
