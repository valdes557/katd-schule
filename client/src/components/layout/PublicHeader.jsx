import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import {
  Search, BookOpen, Menu, X, Globe2, Users, Phone, HelpCircle,
  BookMarked, School, GraduationCap, Star, Heart,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const NAV_TABS = [
  { label: 'Social', path: '/social', icon: Globe2 },
  { label: 'À propos', path: '/apropos', icon: Users },
  { label: 'Contacts', path: '/contacts', icon: Phone },
  { label: 'Aide', path: '/aide', icon: HelpCircle },
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

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      {/* ── Main bar ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center h-14 gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <BookOpen size={16} className="text-white" />
            </div>
            <div className="hidden sm:block">
              <div className="text-[14px] font-bold text-gray-900 leading-tight">KATD-SCHÜLE</div>
              <div className="text-[9px] text-gray-400 leading-tight">Apprendre · Partager · Grandir</div>
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
            {user ? (
              <Link to="/dashboard" className="btn-primary text-sm py-1.5 px-4">
                Mon école
              </Link>
            ) : (
              <>
                <Link to="/login" className="hidden sm:inline-flex text-sm font-medium text-gray-600 hover:text-blue-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                  Connexion
                </Link>
                <Link to="/tarifs" className="btn-primary text-sm py-1.5 px-4">
                  Rejoindre
                </Link>
              </>
            )}
            <button
              className="md:hidden p-1.5 rounded-lg hover:bg-gray-100"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* ── 9-Tab nav bar (desktop) ── */}
      <div className="hidden md:block border-t border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center overflow-x-auto scrollbar-thin gap-0">
            {NAV_TABS.map(({ label, path, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                    isActive
                      ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                      : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                  }`
                }
              >
                <Icon size={13} /> {label}
              </NavLink>
            ))}
          </div>
        </div>
      </div>

      {/* ── Mobile menu ── */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white py-3 px-4 space-y-0.5">
          <Link
            to="/"
            className="flex items-center gap-2 py-2.5 px-3 text-sm font-semibold text-gray-900 rounded-lg hover:bg-gray-50"
            onClick={() => setMobileOpen(false)}
          >
            🏠 Accueil
          </Link>
          {NAV_TABS.map(({ label, path, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className="flex items-center gap-2.5 py-2.5 px-3 text-sm text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              <Icon size={15} className="text-gray-400" /> {label}
            </Link>
          ))}
          <div className="pt-2 border-t border-gray-100 mt-2">
            {user ? (
              <Link to="/dashboard" className="btn-primary w-full text-center block text-sm" onClick={() => setMobileOpen(false)}>
                Mon école
              </Link>
            ) : (
              <div className="flex gap-2">
                <Link to="/login" className="flex-1 text-center text-sm font-medium text-gray-600 border border-gray-200 py-2 rounded-lg" onClick={() => setMobileOpen(false)}>
                  Connexion
                </Link>
                <Link to="/tarifs" className="flex-1 btn-primary text-center text-sm" onClick={() => setMobileOpen(false)}>
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
