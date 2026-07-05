const mongoose = require('mongoose')

// Annonce de recrutement publiée par un directeur. Visible publiquement (job board)
// via les surfaces « News » (accueil, espace utilisateur, dashboards).
const recruitmentPostSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    poste: { type: String, trim: true }, // intitulé du poste (ex. Enseignant de maths)
    location: { type: String, trim: true },
    contractType: { type: String, trim: true }, // CDI, CDD, stage, vacation...
    deadline: { type: Date },
    status: { type: String, enum: ['published', 'closed'], default: 'published' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    applicantCount: { type: Number, default: 0 },
  },
  { timestamps: true }
)

recruitmentPostSchema.index({ status: 1, createdAt: -1 })

module.exports = mongoose.model('RecruitmentPost', recruitmentPostSchema)
