import { NavLink } from 'react-router-dom'
import {
  Globe2, Users, Phone, HelpCircle, BookMarked, School, GraduationCap, Star, Heart,
} from 'lucide-react'

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

export default function PublicNavBar() {
  return (
    <div className="fixed top-14 right-0 left-0 h-10 bg-white border-b border-gray-100 z-20 flex items-center overflow-x-auto scrollbar-thin">
      <div className="flex items-center min-w-max px-3 gap-0">
        {NAV_TABS.map(({ label, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `flex items-center gap-1 px-3 py-2 text-[11px] font-medium whitespace-nowrap border-b-2 transition-colors ${
                isActive
                  ? 'border-blue-600 text-blue-600 bg-blue-50/40'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
              }`
            }
          >
            <Icon size={11} /> {label}
          </NavLink>
        ))}
      </div>
    </div>
  )
}
