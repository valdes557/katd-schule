import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, BookOpen, Menu, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const navLinks = [
  { label: 'Accueil', path: '/' },
  { label: 'Explorer', path: '/explorer' },
  { label: 'Écoles', path: '/ecoles' },
  { label: 'À propos', path: '/about' },
  { label: 'Tarifs', path: '/tarifs' },
  { label: 'Contact', path: '/contact' },
]

export default function PublicHeader() {
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()
  const currentPath = window.location.pathname

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center h-16 gap-6">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
              <BookOpen size={18} className="text-white" />
            </div>
            <div>
              <div className="text-[15px] font-bold text-gray-900 leading-tight">KATD-SCHÜLE</div>
              <div className="text-[9px] text-gray-400 leading-tight">Apprendre, Partager, Grandir</div>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1 flex-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  currentPath === link.path
                    ? 'text-blue-600 border-b-2 border-blue-600 rounded-none'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Search */}
          <div className="hidden md:flex items-center flex-1 max-w-xs">
            <div className="relative w-full">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher (écoles, vidéos, photos...)"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
              />
            </div>
          </div>

          {/* Auth buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {user ? (
              <Link to="/dashboard" className="btn-primary text-sm py-1.5">
                Mon école
              </Link>
            ) : (
              <>
                <Link to="/login" className="hidden sm:inline-flex btn-ghost text-sm py-1.5">
                  Connexion
                </Link>
                <Link to="/login" className="btn-primary text-sm py-1.5">
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

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-100 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="block px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </header>
  )
}
