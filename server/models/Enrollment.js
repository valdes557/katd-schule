const mongoose = require('mongoose')

const enrollmentSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    dateOfBirth: { type: Date, required: true },
    placeOfBirth: { type: String, required: true, trim: true },
    gender: { type: String, enum: ['M', 'F'], required: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    className: { type: String },
    amount: { type: Number, required: true },
    paymentProof: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    rejectionReason: { type: String },
    approvedAt: { type: Date },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    studentCreated: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    userCreated: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

enrollmentSchema.index({ school: 1, status: 1 })
enrollmentSchema.index({ email: 1, school: 1 })

module.exports = mongoose.model('Enrollment', enrollmentSchema)
