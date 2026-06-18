import { createContext, useContext, useState, useEffect } from 'react'
import { authApi, presenceApi } from '../lib/api'
import { cache } from '../lib/cache'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [school, setSchool] = useState(null)
  const [cycle, setCycle] = useState('Primaire')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const storedCycle = localStorage.getItem('katd_cycle')
    if (storedCycle) setCycle(storedCycle)

    if (token) {
      // Rehydrate from /me to get fresh user + school
      authApi.me()
        .then((res) => {
          const u = res.user
          const s = res.school || null
          setUser(u)
          setSchool(s)
          localStorage.setItem('katd_user', JSON.stringify(u))
          if (s) localStorage.setItem('katd_school', JSON.stringify(s))
        })
        .catch(() => {
          // Fallback to stored data if /me fails
          const storedUser = localStorage.getItem('katd_user')
          const storedSchool = localStorage.getItem('katd_school')
          if (storedUser) setUser(JSON.parse(storedUser))
          if (storedSchool) setSchool(JSON.parse(storedSchool))
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  // Heartbeat de présence : tant qu'un utilisateur est connecté, on signale son
  // activité toutes les 60 s (sert au statut « en ligne » vu par l'admin / le directeur).
  useEffect(() => {
    if (!user) return
    let alive = true
    const ping = () => { if (alive) presenceApi.heartbeat().catch(() => {}) }
    ping()
    const id = setInterval(ping, 60000)
    return () => { alive = false; clearInterval(id) }
  }, [user])

  // Real backend login (with demo fallback if API unreachable)
  const login = async (email, password) => {
    try {
      const res = await authApi.login(email, password)
      const u = res.user
      const s = res.school || null
      localStorage.setItem('token', res.token)
      localStorage.setItem('katd_user', JSON.stringify(u))
      localStorage.setItem('katd_school', JSON.stringify(s))
      setUser(u)
      setSchool(s)
      return { success: true, user: u }
    } catch (err) {
      return { success: false, message: err.message || 'Identifiants invalides' }
    }
  }

  const logout = () => {
    // Marque l'utilisateur hors ligne avant de purger le token (best-effort)
    presenceApi.logout().catch(() => {})
    setUser(null)
    setSchool(null)
    localStorage.removeItem('token')
    localStorage.removeItem('katd_user')
    localStorage.removeItem('katd_school')
    cache.clear() // vide le cache SWR pour éviter toute fuite entre comptes
  }

  const changeCycle = (newCycle) => {
    setCycle(newCycle)
    localStorage.setItem('katd_cycle', newCycle)
  }

  return (
    <AuthContext.Provider value={{ user, setUser, school, setSchool, cycle, login, logout, loading, changeCycle }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
