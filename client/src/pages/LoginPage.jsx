import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, Mail, Lock, Eye, EyeOff, ArrowLeft, KeyRound, CheckCircle2, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { authApi } from '../lib/api'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login, register } = useAuth()
  const navigate = useNavigate()

  // Mode d'authentification : 'ecole' (personnel) ou 'user' (grand public)
  const [mode, setMode] = useState('ecole')
  const [userMode, setUserMode] = useState('login') // 'login' | 'signup'
  const [name, setName] = useState('')

  // Mot de passe oublié (code par email, 2 étapes)
  const [showForgot, setShowForgot] = useState(false)
  const [forgotStep, setForgotStep] = useState(1) // 1: email -> code ; 2: code + nouveau mdp
  const [forgot, setForgot] = useState({ email: '', code: '', newPassword: '', confirm: '' })
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError] = useState('')
  const [forgotDone, setForgotDone] = useState(false)

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

  const handleUserSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result =
      userMode === 'signup'
        ? await register(name, email, password)
        : await login(email, password)
    setLoading(false)
    if (result.success) {
      navigate('/u')
    } else {
      setError(result.message || "Une erreur est survenue.")
    }
  }

  const openForgot = () => {
    setForgot({ email, code: '', newPassword: '', confirm: '' })
    setForgotStep(1)
    setForgotError('')
    setForgotDone(false)
    setShowForgot(true)
  }

  const handleSendCode = async (e) => {
    e.preventDefault()
    setForgotError('')
    if (!forgot.email) { setForgotError('Veuillez saisir votre email.'); return }
    setForgotLoading(true)
    try {
      await authApi.forgotPassword(forgot.email)
      setForgotStep(2)
    } catch (err) {
      setForgotError(err.message || "Impossible d'envoyer le code.")
    }
    setForgotLoading(false)
  }

  const handleResetWithCode = async (e) => {
    e.preventDefault()
    setForgotError('')
    if (!forgot.code.trim()) { setForgotError('Veuillez saisir le code reçu par email.'); return }
    if (forgot.newPassword.length < 6) {
      setForgotError('Le mot de passe doit contenir au moins 6 caractères.')
      return
    }
    if (forgot.newPassword !== forgot.confirm) {
      setForgotError('Les deux mots de passe ne correspondent pas.')
      return
    }
    setForgotLoading(true)
    try {
      await authApi.resetPassword(forgot.email, forgot.code.trim(), forgot.newPassword)
      setForgotDone(true)
      setEmail(forgot.email)
    } catch (err) {
      setForgotError(err.message || 'Impossible de réinitialiser le mot de passe.')
    }
    setForgotLoading(false)
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
            <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-xl">
              <button type="button" onClick={() => { setMode('ecole'); setError('') }} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'ecole' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
                <GraduationCap size={16} /> École
              </button>
              <button type="button" onClick={() => { setMode('user'); setError('') }} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'user' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
                <Users size={16} /> Utilisateur
              </button>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-1">{mode === 'user' && userMode === 'signup' ? 'Créer un compte' : 'Connexion'}</h2>
            <p className="text-sm text-gray-500 mb-6">{mode === 'user' ? 'Espace utilisateur KATD-SCHÜLE' : 'Accédez à votre espace école'}</p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
                {error}
              </div>
            )}

            {mode === 'ecole' && (
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
                  <button type="button" onClick={openForgot} className="text-xs text-blue-600 hover:underline">Mot de passe oublié ?</button>
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
            )}

            {mode === 'user' && (
            <form onSubmit={handleUserSubmit} className="space-y-4">
              {userMode === 'signup' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom complet</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Votre nom" className="input pl-9" required />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Adresse email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.com" className="input pl-9" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="input pl-9 pr-10" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                {userMode === 'signup' ? <UserPlus size={16} /> : null}
                {loading ? 'Veuillez patienter...' : userMode === 'signup' ? 'Créer mon compte' : 'Se connecter'}
              </button>
              <p className="text-center text-xs text-gray-500">
                {userMode === 'signup' ? 'Déjà un compte ?' : 'Pas encore de compte ?'}{' '}
                <button type="button" onClick={() => { setUserMode(userMode === 'signup' ? 'login' : 'signup'); setError('') }} className="text-blue-600 font-medium hover:underline">
                  {userMode === 'signup' ? 'Se connecter' : 'Créer un compte'}
                </button>
              </p>
            </form>
            )}

            {mode === 'ecole' && (
            <p className="text-center text-xs text-gray-500 mt-5">
              Votre école n'est pas encore inscrite ?{' '}
              <Link to="/ecoles" className="text-blue-600 font-medium hover:underline">
                Inscrire mon école
              </Link>
            </p>
            )}
          </div>
        </div>
      </div>

      {/* Modal mot de passe oublié */}
      {showForgot && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <KeyRound size={18} className="text-blue-600" /> Réinitialiser le mot de passe
              </h3>
              <button onClick={() => setShowForgot(false)} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
            </div>

            {forgotDone ? (
              <div className="text-center py-4">
                <CheckCircle2 size={44} className="text-green-500 mx-auto mb-3" />
                <p className="text-sm text-gray-700">Mot de passe réinitialisé avec succès.</p>
                <p className="text-xs text-gray-500 mt-1">Connectez-vous avec votre nouveau mot de passe.</p>
                <button onClick={() => setShowForgot(false)} className="btn-primary mt-4 justify-center w-full text-sm">Retour à la connexion</button>
              </div>
            ) : (
              forgotStep === 1 ? (
              <form onSubmit={handleSendCode} className="space-y-3">
                <p className="text-xs text-gray-500">Saisissez votre email. Nous vous enverrons un code de vérification à 6 chiffres.</p>
                {forgotError && (<div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{forgotError}</div>)}
                <div>
                  <label className="text-xs font-medium text-gray-600">Adresse email</label>
                  <input type="email" required value={forgot.email} onChange={(e) => setForgot({ ...forgot, email: e.target.value })} className="input text-sm mt-1" placeholder="votre@email.com" />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setShowForgot(false)} className="btn-ghost flex-1 justify-center border border-gray-200 text-sm">Annuler</button>
                  <button type="submit" disabled={forgotLoading} className="btn-primary flex-1 justify-center text-sm">{forgotLoading ? 'Envoi...' : 'Envoyer le code'}</button>
                </div>
              </form>
              ) : (
              <form onSubmit={handleResetWithCode} className="space-y-3">
                <p className="text-xs text-gray-500">Un code a été envoyé à <span className="font-medium">{forgot.email}</span>. Saisissez-le ci-dessous avec votre nouveau mot de passe.</p>
                {forgotError && (<div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{forgotError}</div>)}
                <div>
                  <label className="text-xs font-medium text-gray-600">Code de vérification</label>
                  <input type="text" inputMode="numeric" maxLength={6} required value={forgot.code} onChange={(e) => setForgot({ ...forgot, code: e.target.value.replace(/[^0-9]/g, '') })} className="input text-sm mt-1 tracking-[0.5em] text-center font-bold" placeholder="------" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Nouveau mot de passe</label>
                  <input type="password" required value={forgot.newPassword} onChange={(e) => setForgot({ ...forgot, newPassword: e.target.value })} className="input text-sm mt-1" placeholder="Au moins 6 caractères" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Confirmer le mot de passe</label>
                  <input type="password" required value={forgot.confirm} onChange={(e) => setForgot({ ...forgot, confirm: e.target.value })} className="input text-sm mt-1" placeholder="Retapez le mot de passe" />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setForgotStep(1)} className="btn-ghost flex-1 justify-center border border-gray-200 text-sm">Retour</button>
                  <button type="submit" disabled={forgotLoading} className="btn-primary flex-1 justify-center text-sm">{forgotLoading ? 'Réinitialisation...' : 'Réinitialiser'}</button>
                </div>
                <button type="button" onClick={handleSendCode} className="text-xs text-blue-600 hover:underline w-full text-center">Renvoyer le code</button>
              </form>
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}