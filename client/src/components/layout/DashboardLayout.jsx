import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import DashboardHeader from './DashboardHeader'
import PublicNavBar from './PublicNavBar'
import { useAuth } from '../../context/AuthContext'
import { UnreadProvider, useUnread } from '../../context/UnreadContext'

// Associe le chemin courant à une rubrique et la marque comme lue (efface le badge).
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

function RubricSeenWatcher() {
  const { pathname } = useLocation()
  const { markSeen } = useUnread()
  useEffect(() => {
    const rubric = RUBRIC_BY_PATH[pathname]
    if (rubric) markSeen(rubric)
  }, [pathname, markSeen])
  return null
}

export default function DashboardLayout() {
  const { user, school } = useAuth()
  const isDirecteur = user?.role === 'directeur'
  const subscribedCycle = isDirecteur && school?.subscription?.cycle ? school.subscription.cycle : null

  return (
    <UnreadProvider>
      <RubricSeenWatcher />
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader />
        <PublicNavBar />

        {/* pt-24 = h-14 (header) + h-10 (public nav) ; plus de sidebar, contenu pleine largeur */}
        <main className="pt-24 transition-all">
          <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
            {isDirecteur && subscribedCycle && (
              <div className="mb-3">
                <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Cycle souscrit : <strong className="ml-1">{subscribedCycle}</strong>
                </span>
              </div>
            )}
            <Outlet />
          </div>
        </main>
      </div>
    </UnreadProvider>
  )
}
