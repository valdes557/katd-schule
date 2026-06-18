import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useUnread } from '../../context/UnreadContext'
import { getVisibleSections } from '../../data/navSections'

// Palette de couleurs foncées (fond saturé + icône blanche) tournant par bouton, style écran d'accueil.
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

// Associe un chemin de rubrique à sa clé de compteur de nouveautés.
const RUBRIC_BY_PATH = {
  '/dashboard/social': 'social',
  '/dashboard/annonces': 'annonces',
  '/dashboard/activites': 'activites',
  '/dashboard/parent/activites': 'activites',
  '/dashboard/ressources': 'ressources',
  '/dashboard/parent/ressources': 'ressources',
  '/dashboard/documents': 'documents',
  '/dashboard/parent/documents': 'documents',
  '/dashboard/infos': 'infos',
  '/dashboard/devoirs': 'devoirs',
  '/dashboard/parent/devoirs': 'devoirs',
}

// Grille de boutons ronds remplaçant la sidebar : chaque bouton ouvre une fonctionnalité.
export default function AppLauncher() {
  const { user, school } = useAuth()
  const { unread, counts } = useUnread()
  const sections = getVisibleSections(user, school)
  if (sections.length === 0) return null

  // Index global pour faire tourner la palette sur l'ensemble des boutons.
  let colorIndex = 0

  return (
    <div className="space-y-6 animate-fade-in">
      {sections.map((section) => (
        <div key={section.label}>
          <h3 className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase mb-3">{section.label}</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-x-2 gap-y-4">
            {section.items.map((item) => {
              const color = PALETTE[colorIndex++ % PALETTE.length]
              const rubric = RUBRIC_BY_PATH[item.path]
              const badge = item.path === '/dashboard/messagerie' ? unread : (rubric ? (counts?.[rubric] || 0) : 0)
              return (
                <Link
                  key={item.path + item.label}
                  to={item.path}
                  className="group flex flex-col items-center gap-1.5 text-center focus:outline-none"
                >
                  <span className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center shadow-sm transition-all duration-200 group-hover:shadow-card-lg group-hover:-translate-y-0.5 ${color.bg}`}>
                    <item.icon size={24} className={`transition-colors ${color.icon}`} />
                    {badge > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                        {badge > 9 ? '9+' : badge}
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
