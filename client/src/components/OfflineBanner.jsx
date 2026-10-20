// components/OfflineBanner.jsx — Détecte et affiche l'état de la connexion Internet en temps réel.
import { useState, useEffect } from 'react'
import { WifiOff, Wifi, RefreshCw } from 'lucide-react'

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true))
  const [showReconnected, setShowReconnected] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setShowReconnected(true)
      const timer = setTimeout(() => setShowReconnected(false), 3500)
      return () => clearTimeout(timer)
    }

    const handleOffline = () => {
      setIsOnline(false)
      setShowReconnected(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOnline && !showReconnected) return null

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[9999] max-w-md w-[92%] sm:w-auto animate-bounce-short">
      {!isOnline ? (
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-slate-900/95 text-amber-300 text-xs font-semibold shadow-xl border border-amber-500/30 backdrop-blur-md">
          <WifiOff size={15} className="text-amber-400 shrink-0 animate-pulse" />
          <span className="flex-1">Mode hors-ligne actif — Vos données en cache restent consultables.</span>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-emerald-900/95 text-emerald-200 text-xs font-semibold shadow-xl border border-emerald-500/30 backdrop-blur-md">
          <Wifi size={15} className="text-emerald-400 shrink-0" />
          <span>Connexion Internet rétablie.</span>
        </div>
      )}
    </div>
  )
}
