// services/openaiService.js — Moteur IA multi-fournisseurs (Gemini, OpenAI, Claude, Groq).
// Utilise fetch natif (Node 18+) sans dépendance supplémentaire.
// Priorité de clé : configurée en base (AiConfig) par l'administrateur, sinon variable d'environnement (.env).

class OpenAiError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'OpenAiError'
    this.status = status
  }
}

/**
 * Envoie une conversation au fournisseur configuré (Gemini, OpenAI, Anthropic, Groq)
 * et renvoie la réponse de l'assistant.
 *
 * @param {Object} params
 * @param {Array<{role:string, content:string}>} params.messages - historique (sans le system prompt)
 * @param {Object} params.config - document AiConfig ou objet de config (provider, model, keys, etc.)
 * @returns {Promise<{content:string, usage:Object, model:string}>}
 */
async function generateChatResponse({ messages, config }) {
  const provider = (config && config.provider) || 'gemini'
  const systemPrompt = (config && config.systemPrompt) || ''
  const temperature = config?.temperature ?? 0.5
  const maxTokens = config?.maxTokens ?? 1000

  // ───────────────────────────────────────────────────────────────────────────
  // 1. FOURNISSEUR GOOGLE GEMINI (RECOMMANDÉ)
  // ───────────────────────────────────────────────────────────────────────────
  if (provider === 'gemini') {
    const apiKey = (config?.geminiApiKey || process.env.GEMINI_API_KEY || '').trim()
    if (!apiKey) {
      throw new OpenAiError(
        "L'assistant Google Gemini n'est pas configuré : clé API Google AI Studio manquante. Veuillez l'ajouter dans la Gestion IA.",
        503
      )
    }

    const model = (config?.model || process.env.GEMINI_MODEL || 'gemini-1.5-flash').trim()
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${apiKey}`

    const formattedContents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const payload = {
      contents: formattedContents,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    }

    if (systemPrompt) {
      payload.systemInstruction = {
        parts: [{ text: systemPrompt }],
      }
    }

    let res
    try {
      res = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch (err) {
      throw new OpenAiError("Impossible de joindre l'API Google Gemini. Vérifiez votre connexion.", 502)
    }

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const errMsg = data?.error?.message || `Erreur Google Gemini (${res.status})`
      throw new OpenAiError(errMsg, res.status === 429 ? 429 : 502)
    }

    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (!content) {
      throw new OpenAiError("La réponse renvoyée par Google Gemini est vide. Réessayez.", 502)
    }

    const meta = data?.usageMetadata || {}
    return {
      content,
      usage: {
        promptTokens: meta.promptTokenCount || 0,
        completionTokens: meta.candidatesTokenCount || 0,
        totalTokens: meta.totalTokenCount || 0,
      },
      model,
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. FOURNISSEUR ANTHROPIC (CLAUDE)
  // ───────────────────────────────────────────────────────────────────────────
  if (provider === 'anthropic') {
    const apiKey = (config?.anthropicApiKey || process.env.ANTHROPIC_API_KEY || '').trim()
    if (!apiKey) {
      throw new OpenAiError(
        "L'assistant Claude n'est pas configuré : clé API Anthropic manquante. Veuillez l'ajouter dans la Gestion IA.",
        503
      )
    }

    const model = (config?.model || 'claude-3-5-sonnet-20241022').trim()
    const payload = {
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }

    let res
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
    } catch (err) {
      throw new OpenAiError("Impossible de joindre l'API Anthropic Claude.", 502)
    }

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const errMsg = data?.error?.message || `Erreur Anthropic (${res.status})`
      throw new OpenAiError(errMsg, res.status === 429 ? 429 : 502)
    }

    const content = data?.content?.[0]?.text?.trim()
    if (!content) {
      throw new OpenAiError("La réponse renvoyée par Claude est vide. Réessayez.", 502)
    }

    const usage = data?.usage || {}
    return {
      content,
      usage: {
        promptTokens: usage.input_tokens || 0,
        completionTokens: usage.output_tokens || 0,
        totalTokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
      },
      model,
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3. FOURNISSEURS OPENAI & GROQ (COMPATIBLES CHAT COMPLETIONS)
  // ───────────────────────────────────────────────────────────────────────────
  const isGroq = provider === 'groq'
  const endpoint = isGroq
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions'

  const apiKey = isGroq
    ? (config?.groqApiKey || process.env.GROQ_API_KEY || '').trim()
    : (config?.openaiApiKey || process.env.OPENAI_API_KEY || '').trim()

  if (!apiKey) {
    const providerName = isGroq ? 'Groq' : 'OpenAI'
    throw new OpenAiError(
      `L'assistant IA n'est pas configuré : clé API ${providerName} manquante. Veuillez l'ajouter dans la Gestion IA.`,
      503
    )
  }

  const defaultModel = isGroq ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini'
  const model = (config?.model || defaultModel).trim()

  const payload = {
    model,
    messages: [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
    temperature,
    max_tokens: maxTokens,
  }

  let res
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    throw new OpenAiError(`Impossible de joindre le service ${isGroq ? 'Groq' : 'OpenAI'}.`, 502)
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const apiMsg = data?.error?.message || `Erreur ${isGroq ? 'Groq' : 'OpenAI'} (${res.status})`
    const status = res.status === 429 ? 429 : 502
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
