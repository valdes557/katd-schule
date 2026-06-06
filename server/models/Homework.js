const mongoose = require('mongoose')

const submissionSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  submittedAt: { type: Date, default: Date.now },
  file: { type: String },
  text: { type: String },
  grade: { type: Number, min: 0, max: 20 },
  comment: { type: String },
  status: { type: String, enum: ['submitted', 'late', 'graded'], default: 'submitted' },
  // Whether the homework was handed in on time or late (set by the teacher when validating)
  submissionType: { type: String, enum: ['on_time', 'late'], default: 'on_time' },
  // Teacher approval + parent notification tracking
  approved: { type: Boolean, default: false },
  approvedAt: { type: Date },
  parentNotifiedAt: { type: Date },
  // Justification sent by the parent (message + optional attached file)
  justification: {
    text: { type: String },
    file: { type: String },
    submittedAt: { type: Date },
  },
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
