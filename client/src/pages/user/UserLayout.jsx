import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { BookOpen, Home, User, LogOut, Plus, MessageSquare } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function UserLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const isActive = (p) =>
    p === '/u' ? pathname === '/u' || pathname === '/u/' : pathname.startsWith(p)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo */}
          <Link to="/u" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <BookOpen size={18} />
            </div>
            <span className="font-bold text-gray-900 hidden sm:block">KATD-SCHÜLE</span>
          </Link>

          {/* Nav droite */}
          <div className="flex items-center gap-2">
            {/* Accueil / Social */}
            <button
              onClick={() => navigate('/u')}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive('/u') && !pathname.startsWith('/u/') ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <Home size={22} />
              <span className="hidden sm:block">Social</span>
            </button>

            {/* Profil */}
            <button
              onClick={() => navigate('/u/profil')}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive('/u/profil') ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <User size={22} />
              )}
              <span className="hidden sm:block">Profil</span>
            </button>

            {/* Déconnexion */}
            <button
              onClick={() => { logout(); navigate('/login') }}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-red-600 transition-colors"
              title="Se déconnecter"
            >
              <LogOut size={22} />
              <span className="hidden sm:block">Quitter</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-5 pb-24">
        <Outlet />
      </main>

      {/* ── Barre de navigation flottante en bas (mobile + desktop) ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-4 pointer-events-none">
        <div className="flex items-center gap-4 bg-white rounded-2xl shadow-xl border border-gray-100 px-6 py-3 pointer-events-auto">

          {/* Bouton Messagerie style Messenger */}
          <button
            onClick={() => navigate('/u/messages')}
            className={`relative flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              isActive('/u/messages')
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-500 hover:bg-gray-50 hover:text-blue-600'
            }`}
            title="Messagerie"
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md transition-all ${
              isActive('/u/messages') ? 'bg-blue-600' : 'bg-gradient-to-br from-blue-500 to-indigo-600'
            }`}>
              <MessageSquare size={24} className="text-white" fill="white" />
            </div>
            <span>Messages</span>
          </button>

          {/* Bouton + Publier (central, plus grand) */}
          <button
            onClick={() => navigate('/u/publier')}
            className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:scale-105"
            title="Publier"
          >
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg -mt-6 border-4 border-white">
              <Plus size={28} strokeWidth={3} />
            </div>
            <span className="text-gray-500 mt-0.5">Publier</span>
          </button>

          {/* Bouton Social */}
          <button
            onClick={() => navigate('/u')}
            className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              isActive('/u') && !pathname.startsWith('/u/')
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-500 hover:bg-gray-50 hover:text-blue-600'
            }`}
            title="Fil social"
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md ${
              isActive('/u') && !pathname.startsWith('/u/') ? 'bg-blue-600' : 'bg-gradient-to-br from-purple-500 to-pink-500'
            }`}>
              <Home size={24} className="text-white" />
            </div>
            <span>Social</span>
          </button>
        </div>
      </div>
    </div>
  )
}
