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

    let rawModel = (config?.model || process.env.GEMINI_MODEL || 'gemini-3.8-flash').trim()
    // Si un ancien modèle n'est plus supporté par Google (ex: gemini-2.0-flash ou gemini-1.5-flash), basculer vers gemini-3.8-flash
    if (rawModel.includes('gemini-2.0') || rawModel.includes('gemini-1.5') || !rawModel) {
      rawModel = 'gemini-3.8-flash'
    }
    const cleanModel = rawModel.replace(/^models\//, '')
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      cleanModel
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

    let data = await res.json().catch(() => ({}))

    // Secours automatique si le modèle demandé est désactivé par Google
    if (!res.ok && data?.error?.message && /no longer available/i.test(data.error.message) && cleanModel !== 'gemini-3.8-flash') {
      try {
        const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`
        const fbRes = await fetch(fallbackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (fbRes.ok) {
          res = fbRes
          data = await fbRes.json().catch(() => ({}))
          rawModel = 'gemini-3.8-flash'
        }
      } catch (_) {}
    }

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
      model: rawModel,
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

    let model = (config?.model || 'claude-opus-5-5').trim()
    // Tolérance et normalisation des saisies (ex: opus5 -> claude-opus-5-5, opus4.8 -> claude-opus-4-8)
    if (/^opus[- ]?5(\.5)?$/i.test(model) || model.toLowerCase() === 'opus5') {
      model = 'claude-opus-5-5'
    } else if (/^opus[- ]?4(\.8)?$/i.test(model) || model.toLowerCase() === 'opus4.8') {
      model = 'claude-opus-4-8'
    } else if (/^sonnet[- ]?5(\.5)?$/i.test(model)) {
      model = 'claude-sonnet-5-5'
    }

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
  let model = (config?.model || defaultModel).trim()
  if (/^gpt[- ]?5$/i.test(model)) model = 'gpt-5'
  else if (/^gpt[- ]?5\.6$/i.test(model)) model = 'gpt-5.6'
  else if (/^gpt[- ]?6/i.test(model)) model = 'gpt-6-astra'

  // Modèles de raisonnement (OpenAI séries o1, o3, o4)
  const isReasoningModel = !isGroq && (model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4'))

  const payload = {
    model,
    messages: [
      ...(systemPrompt
        ? [{ role: isReasoningModel ? 'developer' : 'system', content: systemPrompt }]
        : []),
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  }

  if (isReasoningModel) {
    payload.max_completion_tokens = maxTokens
  } else {
    payload.temperature = temperature
    payload.max_tokens = maxTokens
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

  let data = await res.json().catch(() => ({}))

  // Secours automatique si OpenAI rejette max_tokens ou temperature sur des modèles récents (ex: gpt-5, o-series)
  if (!res.ok && data?.error?.message && !isGroq) {
    const errLower = data.error.message.toLowerCase()
    let modified = false

    if (errLower.includes('max_completion_tokens') || errLower.includes('max_tokens')) {
      delete payload.max_tokens
      payload.max_completion_tokens = maxTokens
      modified = true
    }
    if (errLower.includes('temperature')) {
      delete payload.temperature
      modified = true
    }

    if (modified) {
      try {
        const retryRes = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
        })
        if (retryRes.ok) {
          res = retryRes
          data = await retryRes.json().catch(() => ({}))
        }
      } catch (_) {}
    }
  }
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
