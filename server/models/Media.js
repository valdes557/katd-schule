const mongoose = require('mongoose')

const mediaSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String },
    type: { type: String, enum: ['video', 'photo', 'image', 'audio'], required: true },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    files: [
      {
        url: { type: String },
        filename: { type: String },
        size: { type: Number },
        duration: { type: String },
      },
    ],
    thumbnail: { type: String },
    category: {
      type: String,
      enum: [
        'Activités scolaires', 'Sports', 'Sciences', 'Arts & Culture',
        'Sorties pédagogiques', 'Cérémonies', 'Concours', 'Conférences',
      ],
    },
    cycle: { type: String, enum: ['Maternelle', 'Primaire', 'Secondaire', 'Tous'] },
    isPublic: { type: Boolean, default: true },
    stats: {
      likes: { type: Number, default: 0 },
      comments: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      downloads: { type: Number, default: 0 },
      views: { type: Number, default: 0 },
    },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
)

module.exports = mongoose.model('Media', mediaSchema)
