const mongoose = require('mongoose')

const blogCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    slug: { type: String, required: true, trim: true, unique: true, lowercase: true },
    description: { type: String, default: '', trim: true },
    color: { type: String, default: 'blue' }, // blue, emerald, purple, amber, rose, indigo
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

module.exports = mongoose.model('BlogCategory', blogCategorySchema)
