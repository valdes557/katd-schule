const mongoose = require('mongoose')

// Candidature envoyée (sans compte requis) en réponse à une annonce de recrutement.
// Reçue sur le dashboard du directeur de l'école concernée.
const recruitmentApplicationSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'RecruitmentPost', required: true },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    whatsapp: { type: String, required: true, trim: true },
    cvUrl: { type: String }, // URL Cloudinary du CV
    message: { type: String, trim: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    decisionReason: { type: String, trim: true },
  },
  { timestamps: true }
)

recruitmentApplicationSchema.index({ school: 1, createdAt: -1 })

module.exports = mongoose.model('RecruitmentApplication', recruitmentApplicationSchema)
