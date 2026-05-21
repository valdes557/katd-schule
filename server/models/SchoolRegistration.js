const mongoose = require('mongoose')

const schoolRegistrationSchema = new mongoose.Schema(
  {
    // Plan info
    cycle: { type: String, enum: ['Maternelle', 'Primaire', 'Secondaire'], required: true },
    plan: { type: String, enum: ['trimestrial', 'annual'], required: true },
    amount: { type: Number, required: true },

    // School info
    schoolName: { type: String, required: true, trim: true },
    directorName: { type: String, required: true, trim: true },

    // Location
    country: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
    city: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
    neighborhood: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    countryName: { type: String },
    cityName: { type: String },
    neighborhoodName: { type: String },

    // Payment methods
    paymentMethods: [
      {
        accountName: { type: String, required: true },
        accountNumber: { type: String, required: true },
        provider: { type: String },
      },
    ],

    // Contact
    whatsapp: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },

    // Status
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    rejectionReason: { type: String },
    approvedAt: { type: Date },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    schoolCreated: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
    userCreated: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

schoolRegistrationSchema.index({ status: 1 })
schoolRegistrationSchema.index({ email: 1 })

module.exports = mongoose.model('SchoolRegistration', schoolRegistrationSchema)
