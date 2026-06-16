import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { messagesApi, notificationsApi } from '../lib/api'
import { useAuth } from './AuthContext'

const UnreadContext = createContext(null)

const POLL_MS = 30000 // rafraîchissement des compteurs toutes les 30s
const EMPTY_COUNTS = {}

// Fournit le nombre de messages non lus + les nouveautés par rubrique de
// l'utilisateur courant, rafraîchis par polling. Monté dans le DashboardLayout.
export function UnreadProvider({ children }) {
  const { user } = useAuth()
  const [unread, setUnread] = useState(0)
  const [counts, setCounts] = useState(EMPTY_COUNTS)
  const timerRef = useRef(null)

  const refresh = useCallback(async () => {
    if (!localStorage.getItem('token')) return
    try {
      const res = await messagesApi.unreadCount()
      setUnread(res?.data?.count || 0)
    } catch (_) {
      // silencieux : un échec ponctuel ne doit pas casser l'UI
    }
  }, [])

  const refreshCounts = useCallback(async () => {
    if (!localStorage.getItem('token')) return
    try {
      const res = await notificationsApi.counts()
      setCounts(res?.data || EMPTY_COUNTS)
    } catch (_) { /* silencieux */ }
  }, [])

  // Marque une rubrique comme lue : remet son badge à 0 localement + persiste.
  const markSeen = useCallback(async (rubric) => {
    if (!rubric) return
    setCounts((prev) => (prev[rubric] ? { ...prev, [rubric]: 0 } : prev))
    try { await notificationsApi.markSeen(rubric) } catch (_) { /* silencieux */ }
  }, [])

  useEffect(() => {
    if (!user) {
      setUnread(0)
      setCounts(EMPTY_COUNTS)
      return
    }
    refresh()
    refreshCounts()
    timerRef.current = setInterval(() => { refresh(); refreshCounts() }, POLL_MS)
    return () => clearInterval(timerRef.current)
  }, [user, refresh, refreshCounts])

  return (
    <UnreadContext.Provider value={{ unread, refresh, setUnread, counts, refreshCounts, markSeen }}>
      {children}
    </UnreadContext.Provider>
  )
}

export const useUnread = () => {
  const ctx = useContext(UnreadContext)
  // Tolérant : si un composant l'utilise hors provider, on renvoie un no-op.
  return ctx || { unread: 0, refresh: () => {}, setUnread: () => {}, counts: {}, refreshCounts: () => {}, markSeen: () => {} }
}
