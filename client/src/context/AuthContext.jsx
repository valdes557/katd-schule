import { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [school, setSchool] = useState(null)
  const [cycle, setCycle] = useState('Primaire')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedUser = localStorage.getItem('katd_user')
    const storedSchool = localStorage.getItem('katd_school')
    const storedCycle = localStorage.getItem('katd_cycle')
    if (storedUser) {
      setUser(JSON.parse(storedUser))
      if (storedSchool) setSchool(JSON.parse(storedSchool))
      if (storedCycle) setCycle(storedCycle)
    }
    setLoading(false)
  }, [])

  // Real backend login (with demo fallback if API unreachable)
  const login = async (email, password) => {
    try {
      const res = await authApi.login(email, password)
      const u = res.user
      const s = res.school || mockSchool
      localStorage.setItem('token', res.token)
      localStorage.setItem('katd_user', JSON.stringify(u))
      localStorage.setItem('katd_school', JSON.stringify(s))
      setUser(u)
      setSchool(s)
      return { success: true, user: u }
    } catch (err) {
      // Fallback : autoriser les comptes démo en mode offline
      if (DEMO_USERS[email] && DEMO_USERS[email].password === password) {
        const demo = { ...DEMO_USERS[email], email }
        delete demo.password
        localStorage.setItem('katd_user', JSON.stringify(demo))
        localStorage.setItem('katd_school', JSON.stringify(mockSchool))
        setUser(demo)
        setSchool(mockSchool)
        return { success: true, user: demo, offline: true }
      }
      return { success: false, message: err.message || 'Identifiants invalides' }
    }
  }

  const logout = () => {
    setUser(null)
    setSchool(null)
    localStorage.removeItem('token')
    localStorage.removeItem('katd_user')
    localStorage.removeItem('katd_school')
  }

  const changeCycle = (newCycle) => {
    setCycle(newCycle)
    localStorage.setItem('katd_cycle', newCycle)
  }

  return (
    <AuthContext.Provider value={{ user, school, cycle, login, logout, loading, changeCycle }}>
      {children}
    </AuthContext.Provider>
  )
}

const mockSchool = {
  id: 1,
  name: 'École Les Petits Génies',
  type: 'Primaire',
  city: 'Abidjan',
  country: "Côte d'Ivoire",
}

export const DEMO_USERS = {
  'admin@katdschule.com':    { name: 'Super Admin KATD',          role: 'super_admin', password: 'admin123' },
  'directeur@ecole.ci':      { name: 'Mme Diop Aïcha (Directrice)', role: 'directeur',   password: 'demo123' },
  'enseignant@ecole.ci':     { name: 'M. Diop Ousmane',           role: 'enseignant',  password: 'demo123' },
  'parent@ecole.ci':         { name: 'Mme Kouassi Fatou',         role: 'parent',      password: 'demo123' },
  'eleve@ecole.ci':          { name: 'Yao Amani',                 role: 'eleve',       password: 'demo123' },
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
