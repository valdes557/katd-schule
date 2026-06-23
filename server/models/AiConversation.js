const mongoose = require('mongoose')

// Historique des conversations avec l'agent IA. Chaque document regroupe les
// échanges (questions/réponses) d'un utilisateur dans une même conversation.
const aiMessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

const aiConversationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
    title: { type: String, default: 'Nouvelle conversation' },
    messages: { type: [aiMessageSchema], default: [] },
  },
  { timestamps: true }
)

aiConversationSchema.index({ user: 1, updatedAt: -1 })

module.exports = mongoose.model('AiConversation', aiConversationSchema)
