const mongoose = require('mongoose')

// Offre de souscription IA définie par l'administrateur principal : un nombre de
// questions/réponses autorisées pour un prix donné. Les directeurs choisissent
// une offre lorsqu'ils soumettent une demande d'activation de l'agent IA.
const aiPackageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    totalQuestions: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'F CFA', trim: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
)

module.exports = mongoose.model('AiPackage', aiPackageSchema)
