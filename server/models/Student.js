const mongoose = require('mongoose')
const { generateMatricule } = require('../utils/matricule')

const studentSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    matricule: { type: String, unique: true },
    // Identifiant du QR de présence individuel (Secondaire) — scanné par le portier à l'entrée.
    attendanceQrId: { type: String, unique: true, sparse: true, index: true },
    dateOfBirth: { type: Date },
    placeOfBirth: { type: String, trim: true },
    gender: { type: String, enum: ['M', 'F'], required: true },
    photo: { type: String },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
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
    academicYear: { type: String },
    studentType: { type: String, enum: ['nouveau', 'ancien'], default: 'nouveau' },
    status: { type: String, enum: ['active', 'inactive', 'transferred'], default: 'active' },
    enrollmentDate: { type: Date, default: Date.now },
    // Historique académique et preuve de scolarité dans les classes précédentes
    academicHistory: [
      {
        class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
        className: { type: String, required: true },
        level: { type: String },
        cycle: { type: String },
        academicYear: { type: String, required: true },
        decision: { type: String, default: 'admis_classe_superieure' },
        decisionLabel: { type: String, default: 'Admis en classe supérieure' },
        targetClassName: { type: String },
        generalAverage: { type: Number },
        rank: { type: String },
        remarks: { type: String },
        promotedAt: { type: Date, default: Date.now },
        promotedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        promotedByName: { type: String },
      },
    ],
    lastPromotion: {
      promotedAt: { type: Date },
      fromClass: { type: String },
      toClass: { type: String },
      decision: { type: String },
    },
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
