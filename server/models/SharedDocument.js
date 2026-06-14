const mongoose = require('mongoose')

// Documents partagés au niveau de l'école (épreuves, documentations…), uploadés
// par le directeur ou les enseignants, visibles par tous les membres de l'école.
const sharedDocumentSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    category: { type: String, default: 'Général' },
    fileUrl: { type: String, required: true },
    fileName: { type: String, default: '' },
    fileSize: { type: Number, default: 0 },
    fileType: { type: String, default: '' },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploaderRole: { type: String },
    // null = visible par toute l'école ; sinon ciblé sur une classe précise.
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null },
  },
  { timestamps: true }
)

sharedDocumentSchema.index({ school: 1, createdAt: -1 })

module.exports = mongoose.model('SharedDocument', sharedDocumentSchema)
