const mongoose = require('mongoose')

const blogPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    content: { type: String, required: true }, // Contenu HTML riche de l'éditeur
    excerpt: { type: String, default: '', trim: true }, // Résumé / amorce
    coverImage: { type: String, default: '' }, // Image principale / miniature
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'BlogCategory' },
    categoryName: { type: String, default: 'Général', trim: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    authorName: { type: String, default: '' },
    authorRole: { type: String, default: '' },
    authorAvatar: { type: String, default: '' },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
    schoolName: { type: String, default: '' },
    views: { type: Number, default: 0 },
    viewedIps: [{ type: String }],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comments: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        userName: { type: String, default: '' },
        userAvatar: { type: String, default: '' },
        content: { type: String, required: true, trim: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    sharesCount: { type: Number, default: 0 },
    status: { type: String, enum: ['published', 'draft'], default: 'published', index: true },
    isPublic: { type: Boolean, default: true },
  },
  { timestamps: true }
)

module.exports = mongoose.model('BlogPost', blogPostSchema)
