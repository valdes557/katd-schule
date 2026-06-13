import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getVisibleSections } from '../../data/navSections'

// Palette de couleurs (fond pastel + icône) tournant par bouton, style écran d'accueil.
const PALETTE = [
  { bg: 'bg-blue-100 group-hover:bg-blue-600', icon: 'text-blue-600 group-hover:text-white' },
  { bg: 'bg-orange-100 group-hover:bg-orange-500', icon: 'text-orange-500 group-hover:text-white' },
  { bg: 'bg-green-100 group-hover:bg-green-600', icon: 'text-green-600 group-hover:text-white' },
  { bg: 'bg-purple-100 group-hover:bg-purple-600', icon: 'text-purple-600 group-hover:text-white' },
  { bg: 'bg-teal-100 group-hover:bg-teal-600', icon: 'text-teal-600 group-hover:text-white' },
  { bg: 'bg-pink-100 group-hover:bg-pink-600', icon: 'text-pink-600 group-hover:text-white' },
  { bg: 'bg-amber-100 group-hover:bg-amber-500', icon: 'text-amber-600 group-hover:text-white' },
  { bg: 'bg-indigo-100 group-hover:bg-indigo-600', icon: 'text-indigo-600 group-hover:text-white' },
]

// Grille de boutons ronds remplaçant la sidebar : chaque bouton ouvre une fonctionnalité.
export default function AppLauncher() {
  const { user, school } = useAuth()
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
              return (
                <Link
                  key={item.path + item.label}
                  to={item.path}
                  className="group flex flex-col items-center gap-1.5 text-center focus:outline-none"
                >
                  <span className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center shadow-sm transition-all duration-200 group-hover:shadow-card-lg group-hover:-translate-y-0.5 ${color.bg}`}>
                    <item.icon size={24} className={`transition-colors ${color.icon}`} />
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
