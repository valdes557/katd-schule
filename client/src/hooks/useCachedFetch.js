import { useState, useEffect, useRef, useCallback } from 'react'
import { cache } from '../lib/cache'

/**
 * Stale-While-Revalidate fetch.
 *
 * @param {string|null} key   Clé de cache (le path de la requête). Si null, le hook
 *                            est désactivé (aucun fetch) — utile pour « attendre un filtre ».
 * @param {Function} fetcher  async () => valeur  — DOIT retourner la valeur à mettre
 *                            en cache et à afficher (déballer `.data` ici).
 * @param {Array} deps        Relance le fetcher quand ces valeurs changent.
 *
 * @returns {{ data, loading, error, refetch, setData }}
 *
 * Clé du comportement : l'état est INITIALISÉ SYNCHRONEMENT depuis le cache, donc
 * sur un hit `loading` est false et `data` présent dès le 1er render => pas de flash.
 */
export function useCachedFetch(key, fetcher, deps = []) {
  // Init synchrone depuis le cache => pas de flash sur un hit.
  const cached = key ? cache.get(key) : null
  const [data, setData] = useState(cached ? cached.data : null)
  const [loading, setLoading] = useState(!cached) // on ne spinne que sur un vrai miss
  const [error, setError] = useState(null)

  // Garde la dernière version du fetcher sans en faire une dépendance.
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const keyRef = useRef(key)
  keyRef.current = key

  const revalidate = useCallback(async () => {
    const k = keyRef.current
    if (!k) return
    // Miss => loading déjà true via l'init ; hit => revalidation silencieuse.
    if (!cache.has(k)) setLoading(true)
    try {
      const result = await fetcherRef.current()
      // Une réponse en retard pour une clé périmée ne doit pas écraser la nouvelle.
      if (keyRef.current !== k) return
      cache.set(k, result)
      setData(result)
      setError(null)
    } catch (e) {
      if (keyRef.current !== k) return
      setError(e)
      // Ne PAS vider les données déjà affichées sur une erreur de revalidation.
    } finally {
      if (keyRef.current === k) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!key) {
      setData(null)
      setLoading(false)
      return
    }
    // Re-seed synchrone au changement de clé (ex : filtre déjà visité) pour
    // afficher sa donnée immédiatement, puis revalider.
    const hit = cache.get(key)
    if (hit) {
      setData(hit.data)
      setLoading(false)
    } else {
      setData(null)
      setLoading(true)
    }
    revalidate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ...deps])

  // setData public : écrit aussi dans le cache pour rester cohérent avec les
  // revalidations en arrière-plan et les mises à jour optimistes.
  const writeData = useCallback((updater) => {
    setData((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      if (keyRef.current) cache.set(keyRef.current, next)
      return next
    })
  }, [])

  return { data, loading, error, refetch: revalidate, setData: writeData }
}

export default useCachedFetch
