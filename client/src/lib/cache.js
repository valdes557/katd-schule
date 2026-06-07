// Cache mémoire SWR (stale-while-revalidate). Vit le temps de la session de
// l'onglet ; vidé à la déconnexion et sur une 401. Clé = path de la requête,
// qui encode déjà tous les filtres via sa query string.

const store = new Map() // key -> { data, time }

const DEFAULT_TTL = 30_000 // 30s : au-delà, l'entrée est « périmée » (mais reste affichée)

export const cache = {
  get(key) {
    return store.get(key)
  },

  has(key) {
    return store.has(key)
  },

  // Vrai si l'entrée est absente ou plus vieille que ttl. L'appelant revalide
  // alors, mais affiche quand même la donnée périmée d'abord (principe SWR).
  isStale(key, ttl = DEFAULT_TTL) {
    const e = store.get(key)
    return !e || Date.now() - e.time > ttl
  },

  set(key, data) {
    store.set(key, { data, time: Date.now() })
  },

  // Invalide toutes les entrées dont la clé COMMENCE PAR prefix.
  // Ex : invalidate('/grades') vide '/grades?...' ET '/grades/stats?...'.
  invalidate(prefix) {
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key)
    }
  },

  clear() {
    store.clear()
  },
}

export default cache
