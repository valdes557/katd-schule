// Service d'appel à l'API OpenAI (Chat Completions).
// Utilise fetch natif (Node 18+) afin d'éviter une dépendance npm supplémentaire.
// La clé est lue dans process.env.OPENAI_API_KEY ; le modèle / la consigne système
// proviennent de la configuration globale (AiConfig) pilotée par l'administrateur.

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

class OpenAiError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'OpenAiError'
    this.status = status
  }
}

/**
 * Envoie une conversation à l'API OpenAI et renvoie la réponse de l'assistant.
 *
 * @param {Object} params
 * @param {Array<{role:string, content:string}>} params.messages - historique (sans le system prompt)
 * @param {Object} params.config - document AiConfig (model, systemPrompt, temperature, maxTokens)
 * @returns {Promise<{content:string, usage:Object}>}
 */
async function generateChatResponse({ messages, config }) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new OpenAiError(
      "L'assistant IA n'est pas encore configuré (clé API manquante). Contactez l'administrateur.",
      503
    )
  }

  const model = (config && config.model) || process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const systemPrompt = (config && config.systemPrompt) || ''

  const payload = {
    model,
    messages: [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
    temperature: config?.temperature ?? 0.5,
    max_tokens: config?.maxTokens ?? 800,
  }

  let res
  try {
    res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    throw new OpenAiError("Impossible de joindre le service IA. Réessayez plus tard.", 502)
  }

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const apiMsg = data?.error?.message || `Erreur OpenAI (${res.status})`
    // 401 = clé invalide, 429 = quota OpenAI / rate limit, 5xx = panne côté OpenAI
    const status = res.status === 429 ? 429 : res.status >= 500 ? 502 : 502
    throw new OpenAiError(apiMsg, status)
  }

  const content = data?.choices?.[0]?.message?.content?.trim()
  if (!content) {
    throw new OpenAiError("La réponse de l'IA est vide. Réessayez.", 502)
  }

  const usage = data?.usage || {}
  return {
    content,
    usage: {
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || 0,
    },
    model,
  }
}

module.exports = { generateChatResponse, OpenAiError }
