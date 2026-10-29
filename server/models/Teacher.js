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
    contractType: { type: String, enum: ['permanent', 'vacataire'], default: 'permanent' },
    monthlySalary: { type: Number, default: 0 },
    hourlyRate: { type: Number, default: 0 },
    weeklyHours: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'inactive', 'on_leave'], default: 'active' },
    address: { city: { type: String }, neighborhood: { type: String } },
    // Zone géographique rattachée (par défaut: héritée de l'établissement)
    geographicZone: {
      zoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'GeographicZone', default: null, index: true },
      zoneType: { type: String, enum: ['arrondissement', 'regional', 'national', 'international', 'mondial', null], default: null },
      zoneName: { type: String, default: '', trim: true },
      arrondissementId: { type: mongoose.Schema.Types.ObjectId, ref: 'GeographicZone', default: null, index: true },
      arrondissementName: { type: String, default: '', trim: true },
      regionId: { type: mongoose.Schema.Types.ObjectId, ref: 'GeographicZone', default: null, index: true },
      regionName: { type: String, default: '', trim: true },
      countryId: { type: mongoose.Schema.Types.ObjectId, ref: 'GeographicZone', default: null },
      countryName: { type: String, default: 'Cameroun', trim: true },
      mondialId: { type: mongoose.Schema.Types.ObjectId, ref: 'GeographicZone', default: null },
      mondialName: { type: String, default: '', trim: true },
      allZoneIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'GeographicZone' }],
    },
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
