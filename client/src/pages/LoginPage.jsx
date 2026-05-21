import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, Mail, Lock, Eye, EyeOff, ArrowLeft, School } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const DEMO_USERS = [
  { role: 'Directeur',    name: 'Directeur KATD',      email: 'directeur@katd.com',  password: 'password123', color: 'bg-blue-600' },
  { role: 'Enseignant',   name: 'M. Nkoulou Pierre',   email: 'enseignant@katd.com', password: 'password123', color: 'bg-green-600' },
  { role: 'Parent',       name: 'Parent Mbarga',       email: 'parent@katd.com',     password: 'password123', color: 'bg-purple-600' },
  { role: 'Super Admin',  name: 'Super Admin',         email: 'admin@katd.com',      password: 'password123', color: 'bg-rose-600' },
]

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await login(email, password)
    setLoading(false)
    if (result.success) {
      navigate('/dashboard')
    } else {
      setError(result.message || 'Email ou mot de passe incorrect.')
    }
  }

  const handleDemoLogin = (user) => {
    setEmail(user.email)
    setPassword(user.password)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '30px 30px',
          }}
        />

        <div className="relative z-10 text-center text-white max-w-sm">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur-sm">
            <BookOpen size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-3">KATD-SCHÜLE</h1>
          <p className="text-blue-100 text-base leading-relaxed mb-8">
            La plateforme collaborative des écoles. Gérez votre établissement et partagez vos réussites avec le monde.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { value: '1 240+', label: 'Écoles' },
              { value: '45K+', label: 'Contenus' },
              { value: '12', label: 'Pays' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                <div className="text-xl font-bold">{stat.value}</div>
                <div className="text-xs text-blue-200">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Back link */}
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
            <ArrowLeft size={16} />
            Retour à l'accueil
          </Link>

          {/* Logo mobile */}
          <div className="flex items-center gap-2 mb-6 lg:hidden">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
              <BookOpen size={18} className="text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">KATD-SCHÜLE</span>
          </div>

          <div className="bg-white rounded-2xl shadow-card-lg border border-gray-100 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Connexion</h2>
            <p className="text-sm text-gray-500 mb-6">Accédez à votre espace école</p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Adresse email
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                    className="input pl-9"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-gray-700">Mot de passe</label>
                  <a href="#" className="text-xs text-blue-600 hover:underline">Mot de passe oublié ?</a>
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input pl-9 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center py-2.5 text-sm mt-2"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Connexion en cours...
                  </span>
                ) : (
                  'Se connecter'
                )}
              </button>
            </form>

            {/* Demo accounts */}
            <div className="mt-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400 font-medium">Comptes démo</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              <div className="space-y-2">
                {DEMO_USERS.map((user) => (
                  <button
                    key={user.role}
                    onClick={() => handleDemoLogin(user)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className={`w-8 h-8 ${user.color} rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                      {user.name.slice(0, 1)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-800">{user.name}</div>
                      <div className="text-xs text-gray-400">{user.role} · {user.email}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <p className="text-center text-xs text-gray-500 mt-5">
              Votre école n'est pas encore inscrite ?{' '}
              <Link to="/ecoles" className="text-blue-600 font-medium hover:underline">
                Inscrire mon école
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
