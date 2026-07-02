import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { BookOpen, Home, User, Bell, Users, Plus } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

// En-tête « Fil social » professionnel + barre de navigation flottante à 4 boutons
// (Accueil · Amis · Publier · Notifications). La barre est masquée sur la messagerie
// pour ne pas recouvrir la zone de saisie du message.
export default function UserLayout() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const onHome = pathname === '/u' || pathname === '/u/'
  const isMessages = pathname.startsWith('/u/messages')
  const isProfil = pathname.startsWith('/u/profil')
  const isNotif = pathname.startsWith('/u/notifications')

  // Icône de l'en-tête (haut de page)
  const HeaderIcon = ({ active, onClick, icon: Icon, avatar }) => (
    <button
      onClick={onClick}
      className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
        active ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
      }`}
    >
      {avatar ? (
        <img src={avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
      ) : (
        <Icon size={22} />
      )}
      {active && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-blue-600" />}
    </button>
  )

  // Bouton de la barre flottante (bas de page)
  const NavButton = ({ active, onClick, icon: Icon, label, gradient }) => (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-[11px] font-semibold transition-all ${
        active ? 'text-blue-600' : 'text-gray-500 hover:text-blue-600'
      }`}
      title={label}
    >
      <span className={`w-11 h-11 rounded-full flex items-center justify-center shadow-md transition-all ${
        active ? 'bg-blue-600 text-white' : `bg-gradient-to-br ${gradient} text-white`
      }`}>
        <Icon size={22} />
      </span>
      <span>{label}</span>
    </button>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── En-tête « Fil social » ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/u" className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm flex-shrink-0">
              <BookOpen size={20} />
            </div>
            <div className="leading-tight min-w-0">
              <p className="font-bold text-gray-900 text-base truncate">Fil social</p>
              <p className="text-[11px] text-gray-400 hidden sm:block">Partagez, échangez, informez</p>
            </div>
          </Link>

          <div className="flex items-center gap-1">
            <HeaderIcon active={onHome} onClick={() => navigate('/u')} icon={Home} />
            <HeaderIcon active={isProfil} onClick={() => navigate('/u/profil')} icon={User} avatar={user?.avatar} />
            <HeaderIcon active={isNotif} onClick={() => navigate('/u/notifications')} icon={Bell} />
          </div>
        </div>
      </header>

      {/* ── Contenu ── */}
      <main className={`flex-1 w-full max-w-2xl mx-auto px-4 py-5 ${isMessages ? '' : 'pb-28'}`}>
        <Outlet />
      </main>

      {/* ── Barre de navigation flottante (4 boutons) — masquée en messagerie ── */}
      {!isMessages && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-4 pointer-events-none">
          <div className="flex items-end gap-3 bg-white rounded-2xl shadow-xl border border-gray-100 px-5 py-2.5 pointer-events-auto">
            <NavButton active={onHome} onClick={() => navigate('/u')} icon={Home} label="Accueil" gradient="from-blue-500 to-indigo-600" />
            <NavButton active={isMessages} onClick={() => navigate('/u/messages')} icon={Users} label="Amis" gradient="from-teal-500 to-emerald-600" />

            {/* Bouton central Publier (surélevé) */}
            <button
              onClick={() => navigate('/u/publier')}
              className="flex flex-col items-center gap-0.5 px-2 text-[11px] font-semibold text-gray-500"
              title="Publier"
            >
              <span className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg -mt-6 border-4 border-white text-white">
                <Plus size={28} strokeWidth={3} />
              </span>
              <span className="mt-0.5">Publier</span>
            </button>

            <NavButton active={isNotif} onClick={() => navigate('/u/notifications')} icon={Bell} label="Notifs" gradient="from-purple-500 to-pink-500" />
          </div>
        </div>
      )}
    </div>
  )
}
