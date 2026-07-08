import { useEffect, useState } from 'react'
import { Bell, X, Smartphone } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { pushSupported, subscribeToPush, permissionState } from '../lib/push'

// Invite insistante à activer les notifications, affichée après connexion tant que
// l'utilisateur n'a pas accordé la permission. On ne PEUT PAS forcer techniquement
// (l'OS/navigateur décide), mais on ré-affiche à chaque session et on ré-abonne
// automatiquement si la permission est déjà accordée (nouvel appareil / navigateur).
export default function PushOptIn() {
  const { user } = useAuth()
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)
  const isStandalone = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches

  useEffect(() => {
    if (!user || !pushSupported()) return
    const state = permissionState()
    if (state === 'granted') {
      // Déjà autorisé : on s'assure (silencieusement) que ce navigateur est bien abonné côté serveur.
      subscribeToPush().catch(() => {})
      return
    }
    if (state === 'denied') return // l'utilisateur a refusé au niveau navigateur : on n'insiste pas via prompt natif
    // Permission "default" → on affiche l'invite (une fois par session).
    const dismissedAt = sessionStorage.getItem('push_prompt_dismissed')
    if (dismissedAt) return
    const t = setTimeout(() => setShow(true), 2500)
    return () => clearTimeout(t)
  }, [user])

  const enable = async () => {
    setBusy(true)
    setError('')
    const res = await subscribeToPush()
    setBusy(false)
    if (res.ok) {
      setShow(false)
    } else if (res.reason === 'denied') {
      setError("Vous avez refusé. Activez les notifications dans les réglages du navigateur pour être alerté.")
    } else if (res.reason === 'no-vapid') {
      setError('Les notifications ne sont pas encore configurées côté serveur.')
    } else {
      setError("Impossible d'activer les notifications sur cet appareil.")
    }
  }

  const dismiss = () => {
    sessionStorage.setItem('push_prompt_dismissed', '1')
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden animate-in slide-in-from-bottom">
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 text-white relative">
          <button onClick={dismiss} className="absolute top-3 right-3 text-white/80 hover:text-white" aria-label="Fermer">
            <X size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <Bell size={26} />
            </div>
            <div>
              <h3 className="text-lg font-bold leading-tight">Activez les alertes</h3>
              <p className="text-white/90 text-sm">Ne manquez plus rien, même hors du site</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-5">
          <p className="text-gray-700 text-sm mb-4">
            Recevez une notification dès qu'il y a du nouveau : messages, publications,
            annonces, actualités… <strong>même lorsque vous n'êtes pas connecté au site</strong>,
            tant que vous avez internet.
          </p>

          {isIOS && !isStandalone && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
              <Smartphone size={16} className="mt-0.5 shrink-0" />
              <span>
                Sur iPhone/iPad : ouvrez le menu <strong>Partager</strong> puis
                <strong> « Sur l'écran d'accueil »</strong> pour installer l'app et recevoir les notifications.
              </span>
            </div>
          )}

          {error && <p className="text-red-600 text-xs mb-3">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={enable}
              disabled={busy}
              className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 disabled:opacity-60"
            >
              {busy ? 'Activation…' : 'Activer les notifications'}
            </button>
            <button onClick={dismiss} className="rounded-xl px-4 py-3 text-gray-600 hover:bg-gray-100 font-medium">
              Plus tard
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
