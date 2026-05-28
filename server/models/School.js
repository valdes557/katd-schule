const mongoose = require('mongoose')

const schoolSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true },
    description: { type: String },
    logo: { type: String },
    cycles: {
      type: [String],
      enum: ['Maternelle', 'Primaire', 'Secondaire'],
      default: [],
    },
    address: {
      city: { type: String },
      neighborhood: { type: String },
      country: { type: String, default: 'Cameroun' },
      address: { type: String },
    },
    phone: { type: String },
    email: { type: String },
    contact: {
      email: { type: String },
      phone: { type: String },
      website: { type: String },
    },
    // Social media handles (visible on public school detail page)
    socials: {
      facebook: { type: String, default: '' },
      instagram: { type: String, default: '' },
      twitter: { type: String, default: '' },
      tiktok: { type: String, default: '' },
      youtube: { type: String, default: '' },
      linkedin: { type: String, default: '' },
      whatsapp: { type: String, default: '' },
    },
    // School-level default inscription fee (used if class.enrollmentFee = 0)
    enrollmentFee: { type: Number, default: 0 },
    // Mobile money accounts for enrollment payments (displayed on enrollment form)
    mobileMoneyAccounts: [
      {
        operator: { type: String, trim: true }, // MTN MoMo, Orange Money, Wave, etc.
        accountName: { type: String, trim: true },
        accountNumber: { type: String, trim: true },
        instructions: { type: String, trim: true },
      },
    ],
    isValidated: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    subscription: {
      cycle: { type: String, enum: ['Maternelle', 'Primaire', 'Secondaire'] },
      plan: { type: String, enum: ['quarterly', 'annual', 'standard', 'premium', 'free'], default: 'annual' },
      status: { type: String, enum: ['active', 'expired', 'pending'], default: 'pending' },
      startDate: { type: Date },
      endDate: { type: Date },
      amount: { type: Number },
    },
    director: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    stats: {
      totalStudents: { type: Number, default: 0 },
      totalTeachers: { type: Number, default: 0 },
      totalClasses: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
)

schoolSchema.pre('save', function (next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  }
  next()
})

module.exports = mongoose.model('School', schoolSchema)
