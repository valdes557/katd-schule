// models/Visitor.js — Registre des visiteurs à la loge (cycle Secondaire).
// Le portier enregistre chaque visiteur : identité, motif, personne visitée,
// heure d'entrée ; la sortie est pointée au départ. Le SG consulte le journal.
const mongoose = require('mongoose')

const visitorSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    day: { type: String, required: true, index: true }, // YYYY-MM-DD (fuseau APP_TZ)
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: '', trim: true },
    idType: { type: String, enum: ['cni', 'passeport', 'permis', 'autre', ''], default: '' },
    idNumber: { type: String, default: '', trim: true }, // n° de la pièce d'identité
    reason: { type: String, required: true, trim: true }, // motif de la visite
    visiting: { type: String, default: '', trim: true }, // personne/service visité(e)
    checkInAt: { type: Date, required: true },
    checkOutAt: { type: Date, default: null },
    registeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, default: '' },
  },
  { timestamps: true }
)

visitorSchema.index({ school: 1, day: 1, checkInAt: -1 })

module.exports = mongoose.model('Visitor', visitorSchema)
