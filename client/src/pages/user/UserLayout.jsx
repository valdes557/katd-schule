import { useState, useEffect, useCallback, useRef } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Home, User, Bell, Users, Plus, Newspaper, Search, ArrowLeft, Wallet, Store, Landmark, Youtube, Rocket, ShoppingBag } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { messagesApi, platformApi, newsApi } from '../../lib/api'
import WhatsAppFab from '../../components/WhatsAppFab'

// Clé localStorage : date de dernière consultation des notifications (pour le badge).
const NOTIF_SEEN_KEY = 'u_notif_seen'
// Clé localStorage : date de dernière consultation des News (annonces de recrutement).
const NEWS_SEEN_KEY = 'u_news_seen'

// Petite pastille rouge de comptage (style Messenger) affichée en haut-droite d'un bouton.
function Badge({ count }) {
  if (!count || count < 1) return null
  return (
    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow ring-2 ring-white">
      {count > 9 ? '9+' : count}
    </span>
  )
}

export default function UserLayout() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const onHome = pathname === '/u' || pathname === '/u/' || pathname === '/u/videos'
  const isStore = pathname.startsWith('/u/store')
  const isMessages = pathname.startsWith('/u/messages')
  const isProfil = pathname.startsWith('/u/profil')
  const isNotif = pathname.startsWith('/u/notifications')
  const isNews = pathname.startsWith('/u/news')
  const isWallet = pathname.startsWith('/u/portefeuille')
  const isMerchant = pathname.startsWith('/u/marchand')
  const isShareholder = pathname.startsWith('/u/actionnaires')
  const isVideos = pathname.startsWith('/u/videos')
  const isBoosts = pathname.startsWith('/u/mes-boosts')

  const [unreadMessages, setUnreadMessages] = useState(0)
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const [unreadNews, setUnreadNews] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [waLink, setWaLink] = useState('')
  const myId = String(user?.id || user?._id || '')

  // Lien WhatsApp de l'espace utilisateur (configuré par l'admin)
  useEffect(() => {
    let active = true
    platformApi.get().then((res) => { if (active) setWaLink(res?.data?.whatsappLinks?.utilisateur || '') }).catch(() => {})
    return () => { active = false }
  }, [])

  // Désactiver le zoom sur l'espace utilisateur
  useEffect(() => {
    const handleWheel = (e) => {
      if (e.ctrlKey) e.preventDefault()
    }
    const handleKeyDown = (e) => {
      if (e.ctrlKey && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
        e.preventDefault()
      }
    }
    const handleGesture = (e) => e.preventDefault()
    const handleTouchMove = (e) => {
      if (e.touches && e.touches.length > 1) e.preventDefault()
    }

    window.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('gesturestart', handleGesture)
    window.addEventListener('gesturechange', handleGesture)
    window.addEventListener('gestureend', handleGesture)
    document.addEventListener('touchmove', handleTouchMove, { passive: false })

    return () => {
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('gesturestart', handleGesture)
      window.removeEventListener('gesturechange', handleGesture)
      window.removeEventListener('gestureend', handleGesture)
      document.removeEventListener('touchmove', handleTouchMove)
    }
  }, [])

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
    // Compteur News (annonces de recrutement publiées depuis la dernière consultation)
    try {
      const seen = Number(localStorage.getItem(NEWS_SEEN_KEY) || 0)
      const since = seen ? new Date(seen).toISOString() : ''
      const r = await newsApi.publicCount(since)
      setUnreadNews(r?.data?.count || 0)
    } catch { /* silencieux */ }
  }, [myId])

  // Marque les notifications comme vues (badge -> 0). Appelé par UserNotificationsPage.
  const markNotifsSeen = useCallback(() => {
    localStorage.setItem(NOTIF_SEEN_KEY, String(Date.now()))
    setUnreadNotifs(0)
  }, [])

  // Marque les News comme vues (badge -> 0). Appelé par NewsPage.
  const markNewsSeen = useCallback(() => {
    localStorage.setItem(NEWS_SEEN_KEY, String(Date.now()))
    setUnreadNews(0)
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

  // (9) Bouton retour physique du navigateur : tant qu'on est dans l'espace /u, toute
  // navigation qui sortirait de /u est ramenée vers /u (on reste dans l'espace utilisateur
  // au lieu de retomber sur un dashboard interne).
  useEffect(() => {
    const onPop = () => {
      if (!window.location.pathname.startsWith('/u')) {
        navigate('/u', { replace: true })
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [navigate])

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
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ touchAction: 'pan-x pan-y' }}>
      {/* ── En-tête : KATDTUBE fixe à gauche + actions à droite ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
          {/* Marque KATDTUBE permanente et fixe (ne bouge jamais) */}
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => navigate('/u/videos')}
              className="flex items-center gap-2 group cursor-pointer focus:outline-none"
              title="KATDTUBE"
            >
              <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-red-600 via-rose-600 to-red-500 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <Youtube size={20} className="fill-white" />
              </span>
              <span className="text-lg sm:text-xl font-black tracking-wider bg-gradient-to-r from-red-600 via-rose-600 to-red-700 bg-clip-text text-transparent">
                KATDTUBE
              </span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <HeaderIcon active={isStore} onClick={() => navigate('/u/store')} icon={ShoppingBag} />
            <HeaderIcon active={isWallet} onClick={() => navigate('/u/portefeuille')} icon={Wallet} />
            <HeaderIcon active={isProfil} onClick={() => navigate('/u/profil')} icon={User} avatar={user?.avatar} />
            <HeaderIcon active={isNotif} onClick={() => navigate('/u/notifications')} icon={Bell} badge={unreadNotifs} />
          </div>
        </div>
      </header>

      {/* ── Contenu du Dashboard : Flèche retour intégrée sur le dashboard ── */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-5">
        {!onHome && (
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 mb-4 text-xs sm:text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl px-3.5 py-2 hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-xs"
          >
            <ArrowLeft size={16} /> Retour
          </button>
        )}
        <Outlet context={{ refreshBadges, markNotifsSeen, markNewsSeen, searchTerm, unreadMessages, unreadNotifs, unreadNews }} />
      </main>

      {/* ── Barre flottante latérale (Store et Notifications) ── */}
      {!isMessages && (
        <div className="fixed right-2 sm:right-3 top-[65%] -translate-y-1/2 z-50 flex flex-col items-center gap-2.5 pointer-events-auto">
          <NavButton active={isStore} onClick={() => navigate('/u/store')} icon={ShoppingBag} label="Store" gradient="from-blue-600 to-indigo-600" />
          <NavButton active={isNotif} onClick={() => navigate('/u/notifications')} icon={Bell} label="Notifs" gradient="from-purple-500 to-pink-500" badge={unreadNotifs} />
        </div>
      )}

      <WhatsAppFab link={waLink} position="bottom-left" />
    </div>
  )
}
