// server/models/GeographicZone.js — Zones géographiques pour les actionnaires et utilisateurs
const mongoose = require('mongoose')

const geographicZoneSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['arrondissement', 'regional', 'national', 'international'],
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    code: {
      type: String,
      default: '',
      trim: true,
    },
    country: {
      type: String,
      default: 'Cameroun',
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
)

// Index unique pour éviter les doublons sur un même type et nom
geographicZoneSchema.index({ type: 1, name: 1, country: 1 }, { unique: true })

module.exports = mongoose.model('GeographicZone', geographicZoneSchema)
