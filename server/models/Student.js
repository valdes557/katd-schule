const mongoose = require('mongoose')

const studentSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    matricule: { type: String, unique: true },
    dateOfBirth: { type: Date },
    placeOfBirth: { type: String, trim: true },
    gender: { type: String, enum: ['M', 'F'], required: true },
    photo: { type: String },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cycle: { type: String, enum: ['Maternelle', 'Primaire', 'Secondaire'] },
    parent: {
      name: { type: String },
      phone: { type: String },
      email: { type: String },
      relation: { type: String, enum: ['pere', 'mere', 'tuteur'] },
    },
    address: {
      city: { type: String },
      neighborhood: { type: String },
    },
    academicYear: { type: String },
    status: { type: String, enum: ['active', 'inactive', 'transferred'], default: 'active' },
    enrollmentDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

studentSchema.pre('save', async function (next) {
  if (!this.matricule) {
    const count = await mongoose.model('Student').countDocuments({ school: this.school })
    const year = new Date().getFullYear()
    this.matricule = `STU-${year}-${String(count + 1).padStart(4, '0')}`
  }
  next()
})

studentSchema.virtual('fullName').get(function () {
  return `${this.lastName} ${this.firstName}`
})

module.exports = mongoose.model('Student', studentSchema)
