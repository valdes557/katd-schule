const mongoose = require('mongoose')

const teacherSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String },
    gender: { type: String, enum: ['M', 'F'] },
    photo: { type: String },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    cycle: { type: String, enum: ['Maternelle', 'Primaire', 'Secondaire'] },
    subjects: [{ type: String }],
    classes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
    speciality: { type: String },
    dateOfBirth: { type: Date },
    hireDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'inactive', 'on_leave'], default: 'active' },
    address: { city: { type: String }, neighborhood: { type: String } },
    attendance: {
      rate: { type: Number, default: 100 },
      totalPresent: { type: Number, default: 0 },
      totalAbsent: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
)

teacherSchema.virtual('fullName').get(function () {
  return `${this.lastName} ${this.firstName}`
})

teacherSchema.set('toJSON', { virtuals: true })

module.exports = mongoose.model('Teacher', teacherSchema)
