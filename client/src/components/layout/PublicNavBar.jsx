import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Globe2, Users, Phone, HelpCircle, BookMarked, School, GraduationCap, Star, Heart,
  Newspaper, BookOpen, Youtube
} from 'lucide-react'
import { newsApi } from '../../lib/api'
import { getUnreadCountFromFeed, subscribeToBadgeUpdates } from '../../lib/publicationBadge'

const NAV_TABS = [
  { label: 'KATDTUBE', path: '/katdtube', icon: Youtube, highlight: true },
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

export default function PublicNavBar() {
  const [newsCount, setNewsCount] = useState(0)

  useEffect(() => {
    let active = true
    const refreshCount = () => {
      newsApi.publicFeed()
        .then((r) => {
          if (active) {
            const feed = r?.data || []
            setNewsCount(getUnreadCountFromFeed(feed))
          }
        })
        .catch(() => {})
    }
    refreshCount()
    const unsub = subscribeToBadgeUpdates(() => refreshCount())
    return () => {
      active = false
      unsub()
    }
  }, [])

  return (
    <div className="fixed top-14 right-0 left-0 h-10 bg-white border-b border-gray-100 z-20 flex items-center overflow-x-auto scrollbar-thin">
      <div className="flex items-center min-w-max px-3 gap-0">
        {NAV_TABS.map(({ label, path, icon: Icon, isNews }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `flex items-center gap-1 px-3 py-2 text-[11px] font-medium whitespace-nowrap border-b-2 transition-colors relative ${
                isActive
                  ? 'border-blue-600 text-blue-600 bg-blue-50/40'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
              }`
            }
          >
            <Icon size={11} /> {label}
            {isNews && newsCount > 0 && (
              <span className="min-w-[14px] h-[14px] px-0.5 bg-red-500 text-white text-[8px] font-extrabold rounded-full flex items-center justify-center ml-0.5 shadow-2xs">
                {newsCount > 9 ? '9+' : newsCount}
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  )
}
