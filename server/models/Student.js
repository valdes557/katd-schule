const mongoose = require('mongoose')
const { generateMatricule } = require('../utils/matricule')

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
    parentUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
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
  try {
    if (!this.matricule) {
      this.matricule = await generateMatricule(this.school)
    }
    next()
  } catch (e) {
    next(e)
  }
})

studentSchema.virtual('fullName').get(function () {
  return `${this.lastName} ${this.firstName}`
})

module.exports = mongoose.model('Student', studentSchema)
