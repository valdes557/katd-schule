// services/webSearchService.js — Moteur de recherche web en direct pour l'assistant IA
// Permet à l'assistant de chercher sur le web (navigateur) pour répondre avec exactitude et sans faute.

function decodeHtmlEntities(str) {
  if (!str) return ''
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&eacute;/g, 'é')
    .replace(/&egrave;/g, 'è')
    .replace(/&ecirc;/g, 'ê')
    .replace(/&agrave;/g, 'à')
    .replace(/&icirc;/g, 'î')
    .replace(/&ocirc;/g, 'ô')
    .replace(/&ugrave;/g, 'ù')
    .replace(/&ccedil;/g, 'ç')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code))
    .replace(/&nbsp;/g, ' ')
}

function stripHtml(html) {
  if (!html) return ''
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

/**
 * Recherche sur DuckDuckGo Lite
 * @param {string} query
 * @param {number} maxResults
 * @returns {Promise<Array<{title: string, snippet: string, link: string}>>}
 */
async function searchDuckDuckGo(query, maxResults = 5) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 4500)

  try {
    const res = await fetch('https://lite.duckduckgo.com/lite/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
      body: 'q=' + encodeURIComponent(query),
      signal: controller.signal,
    })

    if (!res.ok) return []
    const html = await res.text()

    const results = []

    // Extraction robuste des liens et snippets dans le tableau DDG Lite
    // Les liens portent class='result-link' et les snippets class='result-snippet'
    const linkMatches = []
    const snippetMatches = []

    const linkRegex = /<a\s+[^>]*class=['"]result-link['"][^>]*>([\s\S]*?)<\/a>|<a\s+[^>]*href=['"]([^'"]+)['"][^>]*class=['"]result-link['"][^>]*>([\s\S]*?)<\/a>/gi
    const allLinksRegex = /<a\s+[^>]*href=['"]([^'"]+)['"][^>]*class=['"]result-link['"][^>]*>([\s\S]*?)<\/a>|<a\s+[^>]*class=['"]result-link['"][^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/gi
    const snippetRegex = /<td\s+[^>]*class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/gi

    let match
    while ((match = allLinksRegex.exec(html)) !== null) {
      const link = match[1] || match[3]
      const rawText = match[2] || match[4]
      linkMatches.push({ link, title: stripHtml(rawText) })
    }

    while ((match = snippetRegex.exec(html)) !== null) {
      snippetMatches.push(stripHtml(match[1]))
    }

    for (let i = 0; i < Math.min(linkMatches.length, maxResults); i++) {
      let { link, title } = linkMatches[i]
      if (!title || !link) continue

      // Décode le lien externe s'il est enveloppé par DuckDuckGo
      const uddgMatch = link.match(/uddg=([^&]+)/)
      if (uddgMatch) {
        try { link = decodeURIComponent(uddgMatch[1]) } catch (_) {}
      }

      const snippet = snippetMatches[i] || ''
      results.push({ title, snippet, link, source: 'Web' })
    }

    return results
  } catch (err) {
    return []
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Recherche encyclopédique sur Wikipédia (FR) en complément/secours
 * @param {string} query
 * @param {number} maxResults
 */
async function searchWikipedia(query, maxResults = 3) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 3500)

  try {
    const url = `https://fr.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(
      query
    )}&limit=${maxResults}&namespace=0&format=json`

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'KATD-Schule-Assistant/1.0 (https://katdschule.com)',
        Accept: 'application/json',
      },
      signal: controller.signal,
    })

    if (!res.ok) return []
    const data = await res.json()
    const titles = data[1] || []
    const snippets = data[2] || []
    const links = data[3] || []

    const results = []
    for (let i = 0; i < titles.length; i++) {
      if (titles[i] && (snippets[i] || links[i])) {
        results.push({
          title: titles[i],
          snippet: snippets[i] || '',
          link: links[i] || '',
          source: 'Wikipédia',
        })
      }
    }
    return results
  } catch (_) {
    return []
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Exécute une recherche web globale pour une question posée.
 * Combine recherche web et encyclopédique pour un maximum de précision.
 *
 * @param {string} userQuestion
 * @returns {Promise<{results: Array<{title: string, snippet: string, link: string}>, query: string}>}
 */
async function performWebSearch(userQuestion) {
  if (!userQuestion || typeof userQuestion !== 'string') {
    return { results: [], query: '' }
  }

  // Nettoyage de la question pour en faire une requête web ciblée
  const cleanQuery = userQuestion
    .replace(/[?!:;.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150)

  if (!cleanQuery) return { results: [], query: '' }

  try {
    const [ddgResults, wikiResults] = await Promise.all([
      searchDuckDuckGo(cleanQuery, 4),
      searchWikipedia(cleanQuery, 2),
    ])

    const combined = [...ddgResults]
    for (const w of wikiResults) {
      if (!combined.some((r) => r.title.toLowerCase() === w.title.toLowerCase())) {
        combined.push(w)
      }
    }

    return {
      results: combined.slice(0, 5),
      query: cleanQuery,
    }
  } catch (err) {
    console.error('[WebSearchService error]:', err.message)
    return { results: [], query: cleanQuery }
  }
}

/**
 * Formate les résultats de recherche web sous forme de bloc de contexte rigoureux
 * à injecter dans le prompt de l'IA.
 *
 * @param {Array<{title: string, snippet: string, link: string}>} results
 * @param {string} query
 * @returns {string}
 */
function buildSearchContext(results, query) {
  if (!results || results.length === 0) return ''

  const itemsText = results
    .map(
      (r, i) =>
        `[Source ${i + 1}] : ${r.title}\nURL : ${r.link}\nExtrait : ${r.snippet || '(Information vérifiée)'}`
    )
    .join('\n\n')

  return `
--- RÉSULTATS DE RECHERCHE DU NAVIGATEUR EN DIRECT ---
Recherche web effectuée : "${query}"

${itemsText}
-------------------------------------------------------
CONSIGNES STRICTES POUR LA RÉPONSE DE L'ASSISTANT :
1. Tu disposes de résultats en direct du navigateur web ci-dessus. Utilise-les pour formuler une réponse parfaitement exacte, actuelle et rigoureuse.
2. Réponds dans un français impeccable, sans la moindre faute d'orthographe ou de grammaire.
3. Sois structuré, clair et pédagogique. Si la question est posée par un enseignant, apporte des explications de niveau professionnel (concepts, démarches, données officielles, exemples concrets).
4. Réponds directement avec autorité et bienveillance, sans formules superflues.
`
}

module.exports = {
  performWebSearch,
  buildSearchContext,
}
