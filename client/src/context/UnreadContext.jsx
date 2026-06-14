import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { messagesApi } from '../lib/api'
import { useAuth } from './AuthContext'

const UnreadContext = createContext(null)

const POLL_MS = 30000 // rafraîchissement du compteur global toutes les 30s

// Fournit le nombre de messages non lus de l'utilisateur courant, rafraîchi par
// polling. Monté dans le DashboardLayout (donc uniquement pour un compte connecté).
export function UnreadProvider({ children }) {
  const { user } = useAuth()
  const [unread, setUnread] = useState(0)
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

  useEffect(() => {
    if (!user) {
      setUnread(0)
      return
    }
    refresh()
    timerRef.current = setInterval(refresh, POLL_MS)
    return () => clearInterval(timerRef.current)
  }, [user, refresh])

  return (
    <UnreadContext.Provider value={{ unread, refresh, setUnread }}>
      {children}
    </UnreadContext.Provider>
  )
}

export const useUnread = () => {
  const ctx = useContext(UnreadContext)
  // Tolérant : si un composant l'utilise hors provider, on renvoie un no-op.
  return ctx || { unread: 0, refresh: () => {}, setUnread: () => {} }
}
