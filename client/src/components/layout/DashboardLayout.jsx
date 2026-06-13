import { Outlet } from 'react-router-dom'
import DashboardHeader from './DashboardHeader'
import PublicNavBar from './PublicNavBar'
import { useAuth } from '../../context/AuthContext'

export default function DashboardLayout() {
  const { user, school } = useAuth()
  const isDirecteur = user?.role === 'directeur'
  const subscribedCycle = isDirecteur && school?.subscription?.cycle ? school.subscription.cycle : null

  return (
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
  )
}
