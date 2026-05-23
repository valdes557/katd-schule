const mongoose = require('mongoose')

const submissionSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  submittedAt: { type: Date, default: Date.now },
  file: { type: String },
  text: { type: String },
  grade: { type: Number, min: 0, max: 20 },
  comment: { type: String },
  status: { type: String, enum: ['submitted', 'late', 'graded'], default: 'submitted' },
})

const homeworkSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String },
    subject: { type: String, required: true },
    subjectRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    assignedDate: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    type: { type: String, enum: ['devoir', 'exercice', 'projet', 'expose'], default: 'devoir' },
    attachments: [{ type: String }],
    submissions: [submissionSchema],
  },
  { timestamps: true }
)

homeworkSchema.index({ school: 1, class: 1, dueDate: -1 })

module.exports = mongoose.model('Homework', homeworkSchema)
