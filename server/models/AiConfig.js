const mongoose = require('mongoose')

// Configuration globale de l'assistant IA (document unique / singleton).
// L'administrateur principal ajuste le modèle, la consigne système (sécurité +
// périmètre pédagogique/administratif) et l'interrupteur global.
const DEFAULT_SYSTEM_PROMPT = [
  "Tu es l'assistant IA de KATD-SCHÜLE, une plateforme de gestion scolaire.",
  "Tu aides les directeurs, enseignants et parents avec des questions pédagogiques,",
  "administratives, éducatives et liées à la vie de l'établissement.",
  "Réponds toujours en français, de manière claire, professionnelle et bienveillante.",
  "Tu ne fournis jamais de contenus dangereux, illégaux, violents, haineux ou inappropriés",
  "pour un contexte scolaire. Si une demande sort de ce cadre ou enfreint la sécurité,",
  "refuse poliment et propose une alternative pédagogique.",
].join(' ')

const aiConfigSchema = new mongoose.Schema(
  {
    // Clé unique garantissant un seul document de configuration
    key: { type: String, default: 'global', unique: true },
    enabled: { type: Boolean, default: true },
    model: { type: String, default: 'gpt-4o-mini', trim: true },
    systemPrompt: { type: String, default: DEFAULT_SYSTEM_PROMPT },
    temperature: { type: Number, default: 0.5, min: 0, max: 2 },
    maxTokens: { type: Number, default: 800, min: 50, max: 4000 },
  },
  { timestamps: true }
)

// Récupère (ou crée) le document de configuration global.
aiConfigSchema.statics.getConfig = async function () {
  let cfg = await this.findOne({ key: 'global' })
  if (!cfg) cfg = await this.create({ key: 'global' })
  return cfg
}

aiConfigSchema.statics.DEFAULT_SYSTEM_PROMPT = DEFAULT_SYSTEM_PROMPT

module.exports = mongoose.model('AiConfig', aiConfigSchema)
