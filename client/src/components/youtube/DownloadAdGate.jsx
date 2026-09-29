import { useEffect, useRef, useState, useMemo } from 'react'
import {
  X,
  Download,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Music2,
  Video as VideoIcon,
  Sparkles,
  Clock,
  ArrowDownToLine,
  RefreshCw,
} from 'lucide-react'
import { youtubeApi } from '../../lib/api'

// Charge le script AdSense une seule fois (idempotent)
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

// Convertit une chaîne de durée "04:15" ou "01:20:30" en secondes
function parseDurationSec(durationStr) {
  if (!durationStr) return 210 // Valeur par défaut ~ 3m30s
  if (typeof durationStr === 'number') return durationStr
  const parts = String(durationStr).trim().split(':').map(Number)
  if (parts.length === 3) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0)
  if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0)
  return 210
}

// Calcule l'estimation de la taille en Mo/Go en fonction de la durée et du débit
function formatSize(sec, kbps) {
  const mb = (sec * (kbps / 8)) / 1024
  if (mb < 1) return `${Math.max(0.6, Math.round(mb * 10) / 10)} Mo`
  if (mb > 1000) return `${(mb / 1024).toFixed(1)} Go`
  return `${mb.toFixed(1)} Mo`
}

export default function DownloadAdGate({ video, videoId: propVideoId, title: propTitle, onClose }) {
  const videoId = video?.videoId || propVideoId
  const title = video?.title || propTitle || 'Vidéo'
  const thumbnail =
    video?.thumbnail || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '')
  const duration = video?.duration || ''
  const channelTitle = video?.channelTitle || 'KATDTUBE'

  const durationSec = useMemo(() => parseDurationSec(duration), [duration])

  const [cfg, setCfg] = useState(null)
  const [seconds, setSeconds] = useState(null)
  const [activeJob, setActiveJob] = useState(null) // { key, format, status, progress, text, downloadUrl, error }
  const adPushed = useRef(false)
  const pollTimerRef = useRef(null)

  // 1. Récupération de la configuration publicitaire (AdSense) et minuteur
  useEffect(() => {
    let alive = true
    ;(async () => {
      let c = { downloadEnabled: true, adsenseClient: '', adSlot: '', adCountdown: 5 }
      try {
        const r = await youtubeApi.adConfig()
        if (r) c = { ...c, ...r }
      } catch (_) {}
      if (!alive) return
      setCfg(c)
      setSeconds(Number(c.adCountdown) > 0 ? Number(c.adCountdown) : 0)
      if (c.adsenseClient) loadAdsense(c.adsenseClient)
    })()
    return () => {
      alive = false
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [])

  // Pousser l'annonce AdSense quand la config est prête
  useEffect(() => {
    if (!cfg || !cfg.adsenseClient || !cfg.adSlot || adPushed.current) return
    adPushed.current = true
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch (_) {}
  }, [cfg])

  // Compte à rebours AdSense
  useEffect(() => {
    if (seconds == null || seconds <= 0) return
    const t = setTimeout(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000)
    return () => clearTimeout(t)
  }, [seconds])

  const ready = seconds === 0 || seconds == null

  // Déclenche le téléchargement direct sur l'appareil de l'utilisateur
  const triggerNativeDownload = (url, customName = '') => {
    try {
      const safeName = (customName || title || videoId)
        .replace(/[^\w\s.-]+/g, '')
        .trim()
        .slice(0, 80)
      const a = document.createElement('a')
      a.href = url
      a.download = safeName
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        try {
          document.body.removeChild(a)
        } catch (_) {}
      }, 1000)
    } catch (_) {
      window.open(url, '_blank')
    }
  }

  // Démarre la préparation et le téléchargement pour un format sélectionné
  const handleSelectFormat = async (option) => {
    if (!ready) return
    if (activeJob && (activeJob.status === 'init' || activeJob.status === 'converting')) return

    const jobKey = option.key
    setActiveJob({
      key: jobKey,
      format: option.format,
      label: option.label,
      status: 'init',
      progress: 10,
      text: 'Initialisation de la conversion…',
      downloadUrl: null,
      error: '',
    })

    try {
      const initRes = await youtubeApi.initDownload(videoId, option.format, option.quality)
      if (!initRes || !initRes.progressUrl) {
        throw new Error(initRes?.message || "Impossible d'initialiser le téléchargement.")
      }

      const progressUrl = initRes.progressUrl

      // Sondage régulier de l'état de conversion
      let attempts = 0
      const maxAttempts = 35

      if (pollTimerRef.current) clearInterval(pollTimerRef.current)

      pollTimerRef.current = setInterval(async () => {
        attempts++
        try {
          const p = await youtubeApi.downloadProgress(progressUrl)
          const pVal = Number(p.progress) || 0
          // Normalise la progression entre 10% et 95%
          const pct = pVal >= 1000 ? 100 : Math.min(95, Math.max(15, Math.round(pVal / 10)))

          setActiveJob((prev) =>
            prev && prev.key === jobKey
              ? {
                  ...prev,
                  status: 'converting',
                  progress: pct,
                  text: p.text || 'Conversion en cours…',
                }
              : prev
          )

          if (p.downloadUrl) {
            clearInterval(pollTimerRef.current)
            setActiveJob((prev) =>
              prev && prev.key === jobKey
                ? {
                    ...prev,
                    status: 'done',
                    progress: 100,
                    text: 'Fichier prêt ! Téléchargement direct en cours…',
                    downloadUrl: p.downloadUrl,
                  }
                : prev
            )
            // Lance immédiatement le téléchargement direct sur l'appareil
            const ext = option.type === 'music' ? (option.format === 'm4a' ? 'm4a' : 'mp3') : 'mp4'
            triggerNativeDownload(p.downloadUrl, `${title}.${ext}`)
          } else if (attempts >= maxAttempts) {
            clearInterval(pollTimerRef.current)
            // Repli sur le lien direct de secours
            const directUrl = youtubeApi.getDownloadUrl(videoId, option.format, option.quality)
            setActiveJob((prev) =>
              prev && prev.key === jobKey
                ? {
                    ...prev,
                    status: 'done',
                    progress: 100,
                    text: 'Téléchargement direct prêt !',
                    downloadUrl: directUrl,
                  }
                : prev
            )
            triggerNativeDownload(directUrl, `${title}.${option.format}`)
          }
        } catch (err) {
          if (attempts >= maxAttempts) {
            clearInterval(pollTimerRef.current)
            const directUrl = youtubeApi.getDownloadUrl(videoId, option.format, option.quality)
            setActiveJob((prev) =>
              prev && prev.key === jobKey
                ? {
                    ...prev,
                    status: 'done',
                    progress: 100,
                    downloadUrl: directUrl,
                    text: 'Téléchargement direct disponible.',
                  }
                : prev
            )
            triggerNativeDownload(directUrl, `${title}.${option.format}`)
          }
        }
      }, 1200)
    } catch (e) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
      // Repli immédiat : lien direct
      const directUrl = youtubeApi.getDownloadUrl(videoId, option.format, option.quality)
      setActiveJob({
        key: jobKey,
        format: option.format,
        label: option.label,
        status: 'done',
        progress: 100,
        text: 'Téléchargement direct prêt !',
        downloadUrl: directUrl,
        error: '',
      })
      triggerNativeDownload(directUrl, `${title}.${option.format}`)
    }
  }

  // ── OPTIONS DE TÉLÉCHARGEMENT STYLE SNAPTUBE ──
  // 1) Musique / Audio
  const musicOptions = [
    {
      key: 'audio_fast',
      label: 'Fast (M4A)',
      quality: '128k',
      badge: 'M4A',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      desc: 'Léger & Ultra rapide • 128 kbps',
      capacity: formatSize(durationSec, 128),
      format: 'm4a',
      type: 'music',
    },
    {
      key: 'audio_mp3_classic',
      label: 'Classique MP3',
      quality: '192k',
      badge: 'MP3',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      desc: 'Qualité standard universelle • 192 kbps',
      capacity: formatSize(durationSec, 192),
      format: 'mp3',
      type: 'music',
      recommended: true,
    },
    {
      key: 'audio_mp3_hq',
      label: 'Haute Qualité MP3',
      quality: '320k',
      badge: 'HQ',
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
      desc: 'Son haute fidélité cristallin • 320 kbps',
      capacity: formatSize(durationSec, 320),
      format: 'mp3',
      type: 'music',
    },
  ]

  // 2) Vidéo
  const videoOptions = [
    {
      key: 'video_360',
      label: 'Fast (360p)',
      quality: '360p',
      badge: '360p',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      desc: 'Économiseur de données • Rapide',
      capacity: formatSize(durationSec, 580),
      format: '360',
      type: 'video',
    },
    {
      key: 'video_480',
      label: 'Standard (480p)',
      quality: '480p',
      badge: '480p',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      desc: 'Qualité équilibrée • Format DVD',
      capacity: formatSize(durationSec, 1150),
      format: '480',
      type: 'video',
    },
    {
      key: 'video_720',
      label: 'High Quality (720p HD)',
      quality: '720p',
      badge: '720p HD',
      badgeColor: 'bg-red-50 text-red-700 border-red-200',
      desc: 'Haute Définition nette • Recommandé',
      capacity: formatSize(durationSec, 2300),
      format: '720',
      type: 'video',
      recommended: true,
    },
    {
      key: 'video_1080',
      label: 'Full HD (1080p FHD)',
      quality: '1080p',
      badge: '1080p',
      badgeColor: 'bg-violet-50 text-violet-700 border-violet-200',
      desc: 'Très Haute Définition • Cristal',
      capacity: formatSize(durationSec, 4300),
      format: '1080',
      type: 'video',
    },
  ]

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        e.stopPropagation()
        onClose?.()
      }}
    >
      <div
        className="bg-white w-full max-w-lg rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden my-auto border border-gray-100 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* EN-TÊTE MODAL STYLE SNAPTUBE */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white shadow-sm">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-white/20 rounded-lg">
              <ArrowDownToLine size={18} className="text-white" />
            </span>
            <div>
              <h3 className="text-sm sm:text-base font-bold tracking-tight">
                Télécharger la vidéo
              </h3>
              <p className="text-[11px] text-red-100 font-medium">
                Enregistrement direct sur votre appareil (sans quitter le site)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 active:scale-95 rounded-xl transition-all text-white/90 hover:text-white"
            title="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        {/* CARTE VIDÉO (Aperçu miniature, titre, durée) */}
        <div className="p-4 sm:p-5 pb-3 bg-gray-50 border-b border-gray-100">
          <div className="flex gap-3 items-center">
            <div className="relative w-24 sm:w-28 aspect-video rounded-xl overflow-hidden bg-gray-200 shrink-0 shadow-sm border border-black/5">
              {thumbnail ? (
                <img src={thumbnail} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <VideoIcon size={20} />
                </div>
              )}
              {duration && (
                <span className="absolute bottom-1 right-1 bg-black/80 backdrop-blur-xs text-white text-[9px] font-semibold px-1.5 py-0.5 rounded">
                  {duration}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs sm:text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">
                {title}
              </h4>
              <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1.5">
                <span className="truncate">{channelTitle}</span>
                {duration && (
                  <>
                    <span>•</span>
                    <span className="inline-flex items-center gap-0.5 text-gray-600">
                      <Clock size={11} /> {duration}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* BANNIÈRE ADSENSE / COMPTE À REBOURS (MONÉTISATION KATD) */}
          <div className="mt-3 rounded-xl border border-gray-200 bg-white overflow-hidden p-2 text-center shadow-xs">
            {cfg?.adsenseClient && cfg?.adSlot ? (
              <div>
                <ins
                  className="adsbygoogle"
                  style={{ display: 'block', width: '100%', minHeight: 90 }}
                  data-ad-client={cfg.adsenseClient}
                  data-ad-slot={cfg.adSlot}
                  data-ad-format="auto"
                  data-full-width-responsive="true"
                />
              </div>
            ) : (
              <div className="py-2 px-3 text-[11px] text-gray-500 flex items-center justify-between">
                <span className="font-semibold text-gray-700 flex items-center gap-1">
                  <Sparkles size={13} className="text-amber-500" /> Espace Partenaire KATD
                </span>
                <span className="text-[10px] text-gray-400 uppercase tracking-wider">Publicité</span>
              </div>
            )}
            {!ready && (
              <div className="mt-1 pt-1 border-t border-gray-100 flex items-center justify-center gap-1.5 text-xs text-amber-700 font-medium">
                <Loader2 size={13} className="animate-spin text-amber-600" />
                Déblocage des formats de téléchargement dans{' '}
                <span className="font-bold text-gray-900">{seconds}s</span>…
              </div>
            )}
          </div>
        </div>

        {/* ÉTAT DE CONVERSION / TÉLÉCHARGEMENT ACTIF */}
        {activeJob && (
          <div className="mx-4 sm:mx-5 mt-4 p-3.5 bg-red-50/80 border border-red-200 rounded-2xl">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-red-900 flex items-center gap-1.5">
                {activeJob.status === 'done' ? (
                  <CheckCircle2 size={15} className="text-green-600" />
                ) : (
                  <Loader2 size={15} className="animate-spin text-red-600" />
                )}
                {activeJob.label}
              </span>
              <span className="text-xs font-bold text-red-700">{activeJob.progress}%</span>
            </div>

            {/* Barre de progression animée */}
            <div className="w-full bg-red-200/70 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  activeJob.status === 'done' ? 'bg-green-600' : 'bg-red-600'
                }`}
                style={{ width: `${activeJob.progress}%` }}
              />
            </div>

            <p className="text-[11px] text-gray-700 mt-2 font-medium">{activeJob.text}</p>

            {activeJob.downloadUrl && (
              <div className="mt-2.5 pt-2 border-t border-red-200/60 flex items-center justify-between gap-2">
                <span className="text-[11px] text-green-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 size={13} /> Fichier envoyé à votre appareil !
                </span>
                <button
                  type="button"
                  onClick={() => triggerNativeDownload(activeJob.downloadUrl)}
                  className="inline-flex items-center gap-1 text-[11px] text-red-600 hover:text-red-700 font-bold underline"
                >
                  <RefreshCw size={11} /> Relancer si besoin
                </button>
              </div>
            )}
          </div>
        )}

        {/* CORPS DE LA MODAL : FORMATS MUSIQUE & VIDÉO */}
        <div className="p-4 sm:p-5 max-h-[60vh] overflow-y-auto space-y-5">
          {/* ── SECTION 1 : DOWNLOAD VIDEO AS MUSIC ── */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <span className="p-1 bg-amber-100 text-amber-700 rounded-lg">
                <Music2 size={15} />
              </span>
              <h4 className="text-xs sm:text-sm font-bold text-gray-900 tracking-tight">
                DOWNLOAD VIDEO AS MUSIC
              </h4>
              <span className="text-[10px] bg-amber-50 text-amber-700 font-semibold px-2 py-0.5 rounded-full border border-amber-200">
                Audio
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {musicOptions.map((opt) => {
                const isSelected = activeJob?.key === opt.key
                const isBusy = isSelected && (activeJob.status === 'init' || activeJob.status === 'converting')
                return (
                  <button
                    key={opt.key}
                    type="button"
                    disabled={!ready || (activeJob && isBusy)}
                    onClick={() => handleSelectFormat(opt)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-amber-400 bg-amber-50/60 ring-2 ring-amber-400/20 shadow-xs'
                        : 'border-gray-200 hover:border-amber-300 hover:bg-amber-50/30 bg-white'
                    } disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`text-xs font-black px-2 py-1 rounded-lg border shrink-0 ${opt.badgeColor}`}
                      >
                        {opt.badge}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                            {opt.label}
                          </span>
                          {opt.recommended && (
                            <span className="text-[9px] bg-red-600 text-white font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                              Populaire
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 truncate">{opt.desc}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-black text-gray-700 bg-gray-100 px-2 py-1 rounded-lg">
                        {opt.capacity}
                      </span>
                      <span
                        className={`p-2 rounded-xl transition-colors ${
                          isSelected
                            ? 'bg-amber-600 text-white'
                            : 'bg-gray-100 text-gray-700 group-hover:bg-amber-600 group-hover:text-white'
                        }`}
                      >
                        {isBusy ? (
                          <Loader2 size={15} className="animate-spin text-amber-700" />
                        ) : (
                          <Download size={15} />
                        )}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── SECTION 2 : AS VIDEO ── */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <span className="p-1 bg-red-100 text-red-700 rounded-lg">
                <VideoIcon size={15} />
              </span>
              <h4 className="text-xs sm:text-sm font-bold text-gray-900 tracking-tight">
                AS VIDEO
              </h4>
              <span className="text-[10px] bg-red-50 text-red-700 font-semibold px-2 py-0.5 rounded-full border border-red-200">
                Vidéo MP4
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {videoOptions.map((opt) => {
                const isSelected = activeJob?.key === opt.key
                const isBusy = isSelected && (activeJob.status === 'init' || activeJob.status === 'converting')
                return (
                  <button
                    key={opt.key}
                    type="button"
                    disabled={!ready || (activeJob && isBusy)}
                    onClick={() => handleSelectFormat(opt)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-red-400 bg-red-50/60 ring-2 ring-red-400/20 shadow-xs'
                        : 'border-gray-200 hover:border-red-300 hover:bg-red-50/30 bg-white'
                    } disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`text-xs font-black px-2 py-1 rounded-lg border shrink-0 ${opt.badgeColor}`}
                      >
                        {opt.badge}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                            {opt.label}
                          </span>
                          {opt.recommended && (
                            <span className="text-[9px] bg-red-600 text-white font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                              HD Recommandé
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 truncate">{opt.desc}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-black text-gray-700 bg-gray-100 px-2 py-1 rounded-lg">
                        {opt.capacity}
                      </span>
                      <span
                        className={`p-2 rounded-xl transition-colors ${
                          isSelected
                            ? 'bg-red-600 text-white'
                            : 'bg-gray-100 text-gray-700 group-hover:bg-red-600 group-hover:text-white'
                        }`}
                      >
                        {isBusy ? (
                          <Loader2 size={15} className="animate-spin text-red-700" />
                        ) : (
                          <Download size={15} />
                        )}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* PIED DE MODAL */}
        <div className="px-4 sm:px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span className="text-[11px]">Enregistrement direct sans quitter la page</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 font-semibold text-xs transition-colors shadow-2xs"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
