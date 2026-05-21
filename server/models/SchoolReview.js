const mongoose = require('mongoose')

const schoolReviewSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    authorName: { type: String, required: true, trim: true },
    authorEmail: { type: String, trim: true },
    rating: { type: Number, min: 1, max: 5, default: 5 },
    content: { type: String, required: true },
    isApproved: { type: Boolean, default: false },
  },
  { timestamps: true }
)

schoolReviewSchema.index({ school: 1, isApproved: 1 })

module.exports = mongoose.model('SchoolReview', schoolReviewSchema)
