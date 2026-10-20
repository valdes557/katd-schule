// components/OfflineBanner.jsx — Détecte et affiche l'état de la connexion Internet en temps réel.
import { useState, useEffect } from 'react'
import { WifiOff, Wifi, Info, X } from 'lucide-react'

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true))
  const [showReconnected, setShowReconnected] = useState(false)
  const [showInfo, setShowInfo] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setShowReconnected(true)
      const timer = setTimeout(() => setShowReconnected(false), 4000)
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

  if (isOnline && !showReconnected && !showInfo) return null

  return (
    <>
      <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[9999] max-w-md w-[94%] sm:w-auto animate-fade-in select-none">
        {!isOnline ? (
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-slate-900/95 text-amber-300 text-xs font-semibold shadow-2xl border border-amber-500/40 backdrop-blur-md">
            <WifiOff size={16} className="text-amber-400 shrink-0 animate-pulse" />
            <span className="flex-1">Mode hors-ligne actif • Données en cache consultables</span>
            <button
              onClick={() => setShowInfo(true)}
              className="p-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition-colors"
              title="Comment ça marche ?"
            >
              <Info size={14} />
            </button>
          </div>
        ) : showReconnected ? (
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-emerald-900/95 text-emerald-200 text-xs font-semibold shadow-2xl border border-emerald-500/40 backdrop-blur-md">
            <Wifi size={15} className="text-emerald-400 shrink-0" />
            <span>Connexion Internet rétablie • Synchronisation active</span>
          </div>
        ) : null}
      </div>

      {/* Modal explicatif Mode Hors-Ligne */}
      {showInfo && (
        <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-xs text-gray-700">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <div className="flex items-center gap-2 text-indigo-900 font-black text-sm">
                <WifiOff size={18} className="text-indigo-600" />
                <span>Fonctionnement Hors-Ligne</span>
              </div>
              <button onClick={() => setShowInfo(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 leading-relaxed">
              <p>
                <b>1. Comment désactiver les données mobiles ?</b><br />
                Par mesure de sécurité imposée par Android et iOS, aucun site web ne peut désactiver lui-même les données mobiles de votre téléphone. Pour couper la connexion, faites glisser le volet de notifications de votre téléphone et désactivez l'icône <b>« Données mobiles »</b> ou activez le <b>« Mode Avion »</b>.
              </p>
              <p>
                <b>2. Comment réagit l'application ?</b><br />
                La plateforme détecte la coupure instantanément et bascule sur le cache local (PWA). Vous pouvez naviguer sur les pages déjà ouvertes et consulter vos historiques.
              </p>
              <p>
                <b>3. Le pointage des enseignants sans connexion :</b><br />
                <b>Oui !</b> Les enseignants peuvent scanner le QR code de l'école même sans Internet. Le pointage est enregistré immédiatement avec l'heure exacte sur le téléphone, puis transmis automatiquement dès que le réseau revient.
              </p>
            </div>

            <button
              onClick={() => setShowInfo(false)}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-center shadow-xs"
            >
              J'ai compris
            </button>
          </div>
        </div>
      )}
    </>
  )
}
