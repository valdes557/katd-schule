import { Link, useOutletContext } from 'react-router-dom'
import {
  Home, Newspaper, Globe, Plus, Users, Briefcase,
  Wallet, Store, Landmark, Rocket, User, Bell,
  ShoppingBag,
} from 'lucide-react'

// Palette de couleurs foncées (fond saturé + icône blanche) tournant par bouton, identique à AppLauncher des autres dashboards.
const PALETTE = [
  { bg: 'bg-blue-600 group-hover:bg-blue-700', icon: 'text-white' },
  { bg: 'bg-orange-500 group-hover:bg-orange-600', icon: 'text-white' },
  { bg: 'bg-green-600 group-hover:bg-green-700', icon: 'text-white' },
  { bg: 'bg-purple-600 group-hover:bg-purple-700', icon: 'text-white' },
  { bg: 'bg-teal-600 group-hover:bg-teal-700', icon: 'text-white' },
  { bg: 'bg-pink-600 group-hover:bg-pink-700', icon: 'text-white' },
  { bg: 'bg-amber-500 group-hover:bg-amber-600', icon: 'text-white' },
  { bg: 'bg-indigo-600 group-hover:bg-indigo-700', icon: 'text-white' },
]

export default function UserStorePage() {
  const ctx = useOutletContext() || {}
  const unreadMessages = ctx.unreadMessages || 0
  const unreadNotifs = ctx.unreadNotifs || 0
  const unreadNews = ctx.unreadNews || 0

  const sections = [
    {
      label: 'NAVIGATION & MÉDIAS',
      items: [
        { label: 'Accueil (Vidéos)', icon: Home, path: '/u' },
        { label: 'Blogs & Articles', icon: Newspaper, path: '/u/blogs', badgeText: 'Nouveau' },
        { label: 'Fil Social', icon: Globe, path: '/u/social' },
        { label: 'Publier', icon: Plus, path: '/u/publier' },
        { label: 'Amis & Messages', icon: Users, path: '/u/messages', badge: unreadMessages },
        { label: 'News & Recrutement', icon: Briefcase, path: '/u/news', badge: unreadNews },
      ],
    },
    {
      label: 'COMMERCE & SERVICES',
      items: [
        { label: 'Mon Portefeuille', icon: Wallet, path: '/u/portefeuille' },
        { label: 'Espace Marchand', icon: Store, path: '/u/marchand' },
        { label: 'Actionnaires', icon: Landmark, path: '/u/actionnaires' },
        { label: 'Mes Boosts', icon: Rocket, path: '/u/mes-boosts' },
      ],
    },
    {
      label: 'COMPTE & PARAMÈTRES',
      items: [
        { label: 'Mon Profil', icon: User, path: '/u/profil' },
        { label: 'Notifications', icon: Bell, path: '/u/notifications', badge: unreadNotifs },
      ],
    },
  ]

  let colorIndex = 0

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-fade-in">
      {/* En-tête Store */}
      <div className="flex items-center gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm">
        <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md shrink-0">
          <ShoppingBag size={24} />
        </span>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">Store Utilisateur</h1>
          <p className="text-xs text-gray-500">Toutes les fonctionnalités et services de votre espace réunis en un seul endroit.</p>
        </div>
      </div>

      {/* Grille de sections avec exactement les mêmes formes et alignements que dans AppLauncher */}
      {sections.map((section) => (
        <div key={section.label} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase mb-4">{section.label}</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-x-3 gap-y-5 justify-items-center">
            {section.items.map((item) => {
              const color = PALETTE[colorIndex++ % PALETTE.length]
              return (
                <Link
                  key={item.path + item.label}
                  to={item.path}
                  className="group flex flex-col items-center gap-1.5 text-center focus:outline-none"
                >
                  <span className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center shadow-sm transition-all duration-200 group-hover:shadow-card-lg group-hover:-translate-y-0.5 ${color.bg}`}>
                    <item.icon size={24} className={`transition-colors ${color.icon}`} />
                    {item.badge > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                        {item.badge > 9 ? '9+' : item.badge}
                      </span>
                    )}
                    {item.badgeText && (
                      <span className="absolute -top-1 -right-2 px-1.5 py-0.5 bg-yellow-400 text-slate-900 text-[9px] font-extrabold rounded-full shadow ring-2 ring-white uppercase">
                        {item.badgeText}
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] leading-tight text-gray-600 group-hover:text-gray-900 line-clamp-2 max-w-[80px]">
                    {item.label}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
