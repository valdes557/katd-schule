const mongoose = require('mongoose')

// Personnel non-enseignant de l'école (nettoyeur, chauffeur, gardien, secrétaire,
// comptable, cuisinier, surveillant, infirmier…). Le corps enseignant reste géré
// par le modèle Teacher ; la page Personnel regroupe les deux pour une vue d'ensemble.
const staffSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String },
    gender: { type: String, enum: ['M', 'F'] },
    photo: { type: String },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    // Catégorie de poste (pour le regroupement et les statistiques)
    category: {
      type: String,
      enum: ['nettoyeur', 'chauffeur', 'gardien', 'secretaire', 'comptable', 'cuisinier', 'surveillant', 'infirmier', 'autre'],
      default: 'autre',
    },
    // Intitulé de poste libre (ex. « Agent d'entretien »)
    jobTitle: { type: String },
    salary: { type: Number },
    hireDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'inactive', 'on_leave'], default: 'active' },
    address: { city: { type: String }, neighborhood: { type: String } },
    notes: { type: String },
  },
  { timestamps: true }
)

staffSchema.index({ school: 1, category: 1 })

staffSchema.virtual('fullName').get(function () {
  return `${this.lastName} ${this.firstName}`
})
staffSchema.set('toJSON', { virtuals: true })

module.exports = mongoose.model('Staff', staffSchema)
