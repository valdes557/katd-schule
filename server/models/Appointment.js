const mongoose = require('mongoose')

const appointmentSchema = new mongoose.Schema(
  {
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    with: { type: String, enum: ['enseignant', 'directeur', 'conseiller'], required: true },
    withUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    date: { type: Date, required: true },
    time: { type: String, required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'completed'], default: 'pending' },
    directorApproval: { type: Boolean, default: false },
    notes: { type: String },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Appointment', appointmentSchema)
