import { useState, useEffect } from 'react'
import { Link, NavLink } from 'react-router-dom'
import {
  Search, BookOpen, Menu, X, Globe2, Users, Phone, HelpCircle,
  BookMarked, School, GraduationCap, Star, Heart, Newspaper, Video
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { platformApi, newsApi } from '../../lib/api'
import { getUnreadCountFromFeed, subscribeToBadgeUpdates } from '../../lib/publicationBadge'

const NAV_TABS = [
  { label: 'KATDTUBE', path: '/katdtube', icon: Video, highlight: true },
  { label: 'Actualités & News', path: '/news', icon: Newspaper, isNews: true },
  { label: 'Social', path: '/social', icon: Globe2 },
  { label: 'Blog', path: '/blogs', icon: Newspaper },
  { label: 'À propos', path: '/apropos', icon: Users },
  { label: 'Contacts', path: '/contacts', icon: Phone },
  { label: 'Aide', path: '/aide', icon: HelpCircle },
  { label: 'CGU', path: '/cgu', icon: BookOpen },
  { label: 'Ressources', path: '/ressources', icon: BookMarked },
  { label: 'Nos écoles', path: '/ecoles', icon: School },
  { label: 'Tarifs', path: '/tarifs', icon: GraduationCap },
  { label: 'Expériences', path: '/experiences', icon: Star },
  { label: 'Support Social', path: '/support-social', icon: Heart },
]

export default function PublicHeader() {
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user } = useAuth()
  const [brand, setBrand] = useState({ siteName: 'KATD-SCHÜLE', logo: '' })
  const [newsCount, setNewsCount] = useState(0)

  useEffect(() => {
    let active = true
    platformApi.get()
      .then((res) => {
        const d = res?.data || {}
        if (active) setBrand({ siteName: d.siteName || 'KATD-SCHÜLE', logo: d.logo || '' })
      })
      .catch(() => {})

    const refreshNewsCount = () => {
      newsApi.publicFeed()
        .then((r) => {
          if (active) {
            const feed = r?.data || []
            setNewsCount(getUnreadCountFromFeed(feed))
          }
        })
        .catch(() => {})
    }

    refreshNewsCount()
    const unsub = subscribeToBadgeUpdates(() => {
      refreshNewsCount()
    })

    return () => {
      active = false
      unsub()
    }
  }, [])

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      {/* ── Main bar ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center h-14 gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 sm:gap-3 flex-shrink-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 bg-blue-600 rounded-xl flex items-center justify-center overflow-hidden shadow-xs ring-1 ring-blue-700/10">
              {brand.logo ? (
                <img src={brand.logo} alt={brand.siteName} className="w-full h-full object-cover" />
              ) : (
                <BookOpen size={22} className="text-white" />
              )}
            </div>
            <div className="hidden sm:block">
              <div className="text-[15px] sm:text-base font-extrabold text-gray-900 leading-tight tracking-tight">{brand.siteName}</div>
              <div className="text-[10px] text-gray-500 leading-tight">Apprendre · Partager · Grandir</div>
            </div>
          </Link>

          {/* Search */}
          <div className="flex-1 max-w-sm hidden md:flex items-center">
            <div className="relative w-full">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher (écoles, vidéos...)"
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
              />
            </div>
          </div>

          <div className="flex-1" />

          {/* Auth */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              to="/katdtube"
              title="KATDTUBE Vidéos"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1.5 rounded-xl transition-colors shadow-2xs shrink-0"
            >
              <Video size={17} className="text-red-600 shrink-0" />
              <span className="font-extrabold tracking-tight">KATDTUBE</span>
            </Link>

            {/* News / Actualités : Masqué sur mobile dans la top-bar pour laisser la place au bouton Menu et éviter de saturer l'écran */}
            <Link
              to="/news"
              title="Actualités & recrutement"
              className="relative hidden md:inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-amber-600 px-2.5 py-1.5 rounded-lg hover:bg-amber-50 transition-colors"
            >
              <Newspaper size={17} />
              <span>News</span>
              {newsCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                  {newsCount > 9 ? '9+' : newsCount}
                </span>
              )}
            </Link>

            {user ? (
              user.role === 'utilisateur' ? (
                <Link to="/u" className="btn-primary text-xs sm:text-sm py-1.5 px-3 sm:px-4">
                  Mon espace
                </Link>
              ) : (
                <Link to="/dashboard" className="btn-primary text-xs sm:text-sm py-1.5 px-3 sm:px-4">
                  Mon école
                </Link>
              )
            ) : (
              <>
                <Link to="/login" className="hidden sm:inline-flex text-sm font-medium text-gray-600 hover:text-blue-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                  Connexion
                </Link>
                <Link to="/tarifs" className="hidden sm:inline-flex btn-primary text-sm py-1.5 px-4">
                  Rejoindre
                </Link>
              </>
            )}

            {/* Bouton Menu Mobile : Bien visible, en évidence avec texte et icône */}
            <button
              type="button"
              aria-label="Ouvrir le menu"
              className="md:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={17} /> : <Menu size={17} />}
              <span className="font-semibold text-xs">{mobileOpen ? 'Fermer' : 'Menu'}</span>
              {newsCount > 0 && (
                <span className="min-w-[16px] h-[16px] px-1 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center ring-1 ring-white">
                  {newsCount > 9 ? '9+' : newsCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── 9-Tab nav bar (desktop) ── */}
      <div className="hidden md:block border-t border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center overflow-x-auto scrollbar-thin gap-0">
            {NAV_TABS.map(({ label, path, icon: Icon, isNews }) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors relative ${
                    isActive
                      ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                      : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                  }`
                }
              >
                <Icon size={13} /> {label}
                {isNews && newsCount > 0 && (
                  <span className="min-w-[15px] h-[15px] px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center ml-0.5">
                    {newsCount > 9 ? '9+' : newsCount}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      </div>

      {/* ── Mobile menu ── */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white py-3 px-4 space-y-1 shadow-lg animate-in fade-in slide-in-from-top-2 duration-150">
          <Link
            to="/"
            className="flex items-center gap-2.5 py-2.5 px-3 text-sm font-bold text-gray-900 rounded-xl hover:bg-gray-50"
            onClick={() => setMobileOpen(false)}
          >
            🏠 Accueil
          </Link>

          {/* Actualités & News inséré en tête du menu mobile avec son badge unifié */}
          <Link
            to="/news"
            className="flex items-center justify-between py-2.5 px-3 text-sm font-semibold text-gray-800 hover:text-amber-600 hover:bg-amber-50/70 rounded-xl transition-colors"
            onClick={() => setMobileOpen(false)}
          >
            <span className="flex items-center gap-2.5">
              <Newspaper size={17} className="text-amber-600" />
              <span>Actualités & News</span>
            </span>
            {newsCount > 0 && (
              <span className="min-w-[20px] h-[20px] px-1.5 bg-red-600 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center shadow-xs">
                {newsCount > 9 ? '9+' : newsCount}
              </span>
            )}
          </Link>

          {NAV_TABS.filter((t) => t.path !== '/news').map(({ label, path, icon: Icon, isNews }) => (
            <Link
              key={path}
              to={path}
              className="flex items-center justify-between py-2.5 px-3 text-sm text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              <span className="flex items-center gap-2.5">
                <Icon size={16} className="text-gray-400" />
                <span>{label}</span>
              </span>
              {isNews && newsCount > 0 && (
                <span className="min-w-[20px] h-[20px] px-1.5 bg-red-600 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center">
                  {newsCount > 9 ? '9+' : newsCount}
                </span>
              )}
            </Link>
          ))}

          <div className="pt-2 border-t border-gray-100 mt-2 space-y-2">
            {user ? (
              user.role === 'utilisateur' ? (
                <Link to="/u" className="btn-primary w-full text-center block text-sm py-2.5 rounded-xl font-bold" onClick={() => setMobileOpen(false)}>
                  Mon espace
                </Link>
              ) : (
                <Link to="/dashboard" className="btn-primary w-full text-center block text-sm py-2.5 rounded-xl font-bold" onClick={() => setMobileOpen(false)}>
                  Mon école
                </Link>
              )
            ) : (
              <div className="flex gap-2">
                <Link to="/login" className="flex-1 text-center text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 py-2.5 rounded-xl transition-colors" onClick={() => setMobileOpen(false)}>
                  Connexion
                </Link>
                <Link to="/tarifs" className="flex-1 btn-primary text-center text-sm py-2.5 rounded-xl justify-center font-bold" onClick={() => setMobileOpen(false)}>
                  Rejoindre
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}