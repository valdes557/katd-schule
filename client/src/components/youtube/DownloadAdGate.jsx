import { useEffect, useRef, useState } from 'react'
import { X, Download, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { youtubeApi } from '../../lib/api'

// Charge le script AdSense une seule fois (idempotent). Résout false si aucun client ou échec.
function loadAdsense(client) {
  return new Promise((resolve) => {
    if (!client) return resolve(false)
    if (document.querySelector('script[data-adsbygoogle="1"]')) return resolve(true)
    const s = document.createElement('script')
    s.async = true
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`
    s.crossOrigin = 'anonymous'
    s.setAttribute('data-adsbygoogle', '1')
    s.onload = () => resolve(true)
    s.onerror = () => resolve(false)
    document.head.appendChild(s)
  })
}

// Modal « publicité avant téléchargement » : affiche une annonce Google AdSense pendant un
// compte à rebours (configurable côté admin), puis débloque le téléchargement direct sur l'appareil.
// Si aucun identifiant AdSense n'est encore configuré, un encart neutre « Publicité » est
// montré à la place — la fonctionnalité reste opérationnelle, la pub s'activera dès l'ID saisi.
export default function DownloadAdGate({ videoId, title, onClose }) {
  const [cfg, setCfg] = useState(null)
  const [seconds, setSeconds] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const adPushed = useRef(false)

  // 1) Récupère la config (compte à rebours + IDs AdSense) puis démarre le minuteur.
  useEffect(() => {
    let alive = true
    ;(async () => {
      let c = { downloadEnabled: true, adsenseClient: '', adSlot: '', adCountdown: 5 }
      try { const r = await youtubeApi.adConfig(); if (r) c = { ...c, ...r } } catch (_) {}
      if (!alive) return
      setCfg(c)
      setSeconds(Number(c.adCountdown) > 0 ? Number(c.adCountdown) : 5)
      loadAdsense(c.adsenseClient)
    })()
    return () => { alive = false }
  }, [])

  // Pousse l'annonce une fois que la config (donc l'élément <ins>) est montée.
  useEffect(() => {
    if (!cfg || !cfg.adsenseClient || !cfg.adSlot || adPushed.current) return
    adPushed.current = true
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}) } catch (_) {}
  }, [cfg])

  // 2) Compte à rebours (1 tick/seconde) jusqu'à 0.
  useEffect(() => {
    if (seconds == null || seconds <= 0) return
    const t = setTimeout(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000)
    return () => clearTimeout(t)
  }, [seconds])

  const ready = seconds === 0

  const startDownload = () => {
    setDownloading(true)
    setError('')
    try {
      const safeTitle = (title || videoId).replace(/[^\w\s.-]+/g, '').trim().slice(0, 80) || 'video'
      const downloadUrl = youtubeApi.getDownloadUrl(videoId)

      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `${safeTitle}.mp4`
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      setDone(true)
      setTimeout(() => onClose?.(), 4000)
    } catch (e) {
      setError(e.message || 'Erreur lors du téléchargement direct')
    } finally {
      setDownloading(false)
    }
  }

  const safeTitle = (title || videoId).replace(/[^\w\s.-]+/g, '').trim().slice(0, 80) || 'video'
  const directUrl = youtubeApi.getDownloadUrl(videoId)

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-4" onClick={(e) => { e.stopPropagation(); onClose?.() }}>
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 truncate pr-2">Téléchargement — {title || 'vidéo'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg flex-shrink-0"><X size={18} /></button>
        </div>

        <div className="p-4">
          {/* Zone publicitaire */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden min-h-[180px] flex items-center justify-center">
            {cfg?.adsenseClient && cfg?.adSlot ? (
              <ins
                className="adsbygoogle"
                style={{ display: 'block', width: '100%', minHeight: 180 }}
                data-ad-client={cfg.adsenseClient}
                data-ad-slot={cfg.adSlot}
                data-ad-format="auto"
                data-full-width-responsive="true"
              />
            ) : (
              <div className="text-center text-gray-400 px-6 py-8">
                <p className="text-xs uppercase tracking-wide">Publicité</p>
                <p className="text-[11px] mt-1">Cet espace soutient la plateforme KATD-SCHÜLE.</p>
              </div>
            )}
          </div>

          {/* État / action */}
          <div className="mt-4">
            {done ? (
              <div className="py-2 space-y-3">
                <div className="flex items-center justify-center gap-2 text-green-600 text-sm font-semibold">
                  <CheckCircle2 size={18} /> Téléchargement lancé directement sur votre appareil !
                </div>
                <p className="text-xs text-gray-500 text-center">
                  Le fichier MP4 s'enregistre directement dans votre dossier Téléchargements.
                </p>
                <div className="text-center pt-1">
                  <a
                    href={directUrl}
                    download={`${safeTitle}.mp4`}
                    className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-semibold underline"
                  >
                    <Download size={13} /> Relancer le téléchargement direct si besoin
                  </a>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-start gap-2 text-red-600 text-sm py-1">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" /> <span>{error}</span>
              </div>
            ) : !ready ? (
              <p className="text-center text-sm text-gray-500 py-2">
                Votre téléchargement direct sera disponible dans <span className="font-bold text-gray-800">{seconds ?? '…'}</span> s…
              </p>
            ) : null}

            {!done && (
              <button
                onClick={startDownload}
                disabled={!ready || downloading}
                className="mt-2 w-full inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl px-4 py-2.5 shadow-md transition-all active:scale-[0.98]"
              >
                {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {downloading ? 'Téléchargement direct en cours…' : ready ? 'Télécharger directement sur cet appareil (MP4)' : `Patientez ${seconds ?? ''}s`}
              </button>
            )}
            <p className="mt-2 text-[11px] text-gray-400 text-center">
              Téléchargement direct dans votre appareil (sans quitter le site).
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
