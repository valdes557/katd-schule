// models/AuditLog.js — Journal des actions sensibles (F3 Secondaire).
// Alimenté par le middleware `auditTrail` après chaque mutation réussie sur une
// route jugée sensible. Aucun corps de requête n'est stocké (pas de mots de
// passe / jetons) : uniquement qui, quoi, où, quand. Lecture réservée au
// directeur (sa propre école) et au super_admin (toute la plateforme).
const mongoose = require('mongoose')

const auditLogSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', default: null, index: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, default: '' }, // dénormalisé (l'acteur peut être supprimé)
    actorRole: { type: String, default: '' },

    action: { type: String, required: true, index: true }, // ex. 'fee.discount', 'user.block'
    label: { type: String, default: '' }, // libellé lisible pour le journal
    method: { type: String, default: '' }, // GET/POST/PUT/PATCH/DELETE
    path: { type: String, default: '' }, // req.originalUrl (sans query volumineuse)
    statusCode: { type: Number, default: 0 },

    entityType: { type: String, default: '' }, // ex. 'Fee', 'User'
    entityId: { type: String, default: '' }, // id de la ressource ciblée (req.params.id)
    ip: { type: String, default: '' },
  },
  { timestamps: true }
)

auditLogSchema.index({ school: 1, createdAt: -1 }) // liste directeur
auditLogSchema.index({ action: 1, createdAt: -1 }) // filtre par type d'action

module.exports = mongoose.model('AuditLog', auditLogSchema)
