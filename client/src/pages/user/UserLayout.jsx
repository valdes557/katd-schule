import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { BookOpen, Home, User, Bell, Users, Plus } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { messagesApi, platformApi } from '../../lib/api'

// Clé localStorage : date de dernière consultation des notifications (pour le badge).
const NOTIF_SEEN_KEY = 'u_notif_seen'

// Petite pastille rouge de comptage (style Messenger) affichée en haut-droite d'un bouton.
function Badge({ count }) {
  if (!count || count < 1) return null
  return (
    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow ring-2 ring-white">
      {count > 9 ? '9+' : count}
    </span>
  )
}

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

  const [unreadMessages, setUnreadMessages] = useState(0)
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const myId = String(user?.id || user?._id || '')

  // Rafraîchit les deux compteurs (messages non lus + notifications non lues).
  const refreshBadges = useCallback(async () => {
    try {
      const r = await messagesApi.unreadCount()
      setUnreadMessages(r?.data?.count || 0)
    } catch { /* silencieux */ }
    try {
      const seen = Number(localStorage.getItem(NOTIF_SEEN_KEY) || 0)
      const r = await platformApi.getFeed(1)
      const feed = r.data || []
      let n = 0
      for (const p of feed) {
        const authorId = String(p.author?._id || p.author || '')
        if (!myId || authorId !== myId) continue
        for (const c of (p.comments || [])) {
          if (new Date(c.createdAt || p.createdAt).getTime() > seen) n++
        }
        if ((p.likes?.length || 0) > 0 && new Date(p.createdAt).getTime() > seen) n++
      }
      setUnreadNotifs(n)
    } catch { /* silencieux */ }
  }, [myId])

  // Marque les notifications comme vues (badge -> 0). Appelé par UserNotificationsPage.
  const markNotifsSeen = useCallback(() => {
    localStorage.setItem(NOTIF_SEEN_KEY, String(Date.now()))
    setUnreadNotifs(0)
  }, [])

  // Polling toutes les 15 s + à chaque changement de route.
  const bgRef = useRef(refreshBadges)
  bgRef.current = refreshBadges
  useEffect(() => {
    bgRef.current()
    const t = setInterval(() => bgRef.current(), 15000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => { refreshBadges() }, [pathname, refreshBadges])

  // Icône de l'en-tête (haut de page)
  const HeaderIcon = ({ active, onClick, icon: Icon, avatar, badge }) => (
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
      <Badge count={badge} />
      {active && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-blue-600" />}
    </button>
  )

  // Bouton de la barre flottante (bas de page) — fond transparent, cercle dégradé.
  const NavButton = ({ active, onClick, icon: Icon, label, gradient, badge }) => (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-semibold transition-all ${
        active ? 'text-blue-600' : 'text-gray-600 hover:text-blue-600'
      }`}
      title={label}
    >
      <span className={`relative w-10 h-10 rounded-full flex items-center justify-center shadow-md transition-all ${
        active ? 'bg-blue-600 text-white' : `bg-gradient-to-br ${gradient} text-white`
      }`}>
        <Icon size={20} />
        <Badge count={badge} />
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
            <HeaderIcon active={isNotif} onClick={() => navigate('/u/notifications')} icon={Bell} badge={unreadNotifs} />
          </div>
        </div>
      </header>

      {/* ── Contenu ── */}
      <main className={`flex-1 w-full max-w-2xl mx-auto px-4 py-5 ${isMessages ? '' : 'pb-28'}`}>
        <Outlet context={{ refreshBadges, markNotifsSeen }} />
      </main>

      {/* ── Barre de navigation flottante (4 boutons, fond transparent) — masquée en messagerie ── */}
      {!isMessages && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-2 pointer-events-none">
          <div className="flex items-end gap-4 px-4 py-1 pointer-events-auto">
            <NavButton active={onHome} onClick={() => navigate('/u')} icon={Home} label="Accueil" gradient="from-blue-500 to-indigo-600" />
            <NavButton active={isMessages} onClick={() => navigate('/u/messages')} icon={Users} label="Amis" gradient="from-teal-500 to-emerald-600" badge={unreadMessages} />

            {/* Bouton central Publier (surélevé) */}
            <button
              onClick={() => navigate('/u/publier')}
              className="flex flex-col items-center gap-0.5 px-2 text-[10px] font-semibold text-gray-600"
              title="Publier"
            >
              <span className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg -mt-5 border-4 border-white text-white">
                <Plus size={24} strokeWidth={3} />
              </span>
              <span className="mt-0.5">Publier</span>
            </button>

            <NavButton active={isNotif} onClick={() => navigate('/u/notifications')} icon={Bell} label="Notifs" gradient="from-purple-500 to-pink-500" badge={unreadNotifs} />
          </div>
        </div>
      )}
    </div>
  )
}
