const mongoose = require('mongoose')

const documentSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, enum: ['certificat_scolarite', 'attestation_inscription', 'bulletin', 'attestation_reussite'], required: true },
  term: { type: String },
  status: { type: String, enum: ['pending', 'ready'], default: 'ready' },
  url: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true })

module.exports = mongoose.model('Document', documentSchema)
