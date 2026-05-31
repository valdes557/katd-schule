import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import DashboardHeader from './DashboardHeader'
import PublicNavBar from './PublicNavBar'
import { useAuth } from '../../context/AuthContext'

export default function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const { user, school } = useAuth()
  const isDirecteur = user?.role === 'directeur'
  const subscribedCycle = isDirecteur && school?.subscription?.cycle ? school.subscription.cycle : null

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
        />
      )}

      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <DashboardHeader onMenuClick={() => setMobileOpen(true)} />
      <PublicNavBar />

      {/* pt-24 = h-14 (header) + h-10 (public nav) */}
      <main className="lg:ml-[260px] pt-24 transition-all">
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
