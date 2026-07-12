// models/JobRun.js — Trace la dernière exécution des tâches planifiées (idempotence).
// Permet au scheduler in-process de n'exécuter chaque job qu'une fois par jour/mois,
// même après un redémarrage PM2 (résilient aux coupures).
const mongoose = require('mongoose')

const jobRunSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    lastRunDate: { type: String, default: '' },   // YYYY-MM-DD (jobs quotidiens)
    lastRunMonth: { type: String, default: '' },   // YYYY-MM   (jobs mensuels)
    lastRunAt: { type: Date, default: null },
    lastResult: { type: Object, default: {} },
  },
  { timestamps: true }
)

module.exports = mongoose.model('JobRun', jobRunSchema)
