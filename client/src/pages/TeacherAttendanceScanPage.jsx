import { useState, useRef, useEffect } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { teacherAttendanceApi } from '../lib/api'
import {
  Loader2, QrCode, Camera, CheckCircle2, Clock, LogIn, LogOut,
  AlertCircle, XCircle, WifiOff, Wifi, RefreshCw,
} from 'lucide-react'

function fmt(d) {
  return d ? new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'
}

const SCANNER_ID = 'qr-reader-region'
const OFFLINE_KEY = 'katd_offline_attendance_scans'
const OFFLINE_TODAY_KEY = 'katd_offline_attendance_today'

function getOfflineScans() {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]')
  } catch (_) {
    return []
  }
}

function saveOfflineScans(scans) {
  try {
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(scans))
  } catch (_) {}
}

function getStoredOfflineToday() {
  try {
    const raw = localStorage.getItem(OFFLINE_TODAY_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const todayStr = new Date().toISOString().slice(0, 10)
    if (parsed.day === todayStr) return parsed
    localStorage.removeItem(OFFLINE_TODAY_KEY)
    return null
  } catch (_) {
    return null
  }
}

function saveStoredOfflineToday(data) {
  try {
    localStorage.setItem(OFFLINE_TODAY_KEY, JSON.stringify(data))
  } catch (_) {}
}

export default function TeacherAttendanceScanPage() {
  const [scanning, setScanning] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState(null) // { ok, message, type, isOffline }
  const [today, setToday] = useState(null)
  const [loadingToday, setLoadingToday] = useState(true)
  const [pendingScans, setPendingScans] = useState(() => getOfflineScans())
  const [syncingOffline, setSyncingOffline] = useState(false)
  const scannerRef = useRef(null)
  const lockRef = useRef(false)

  const loadToday = async () => {
    setLoadingToday(true)
    try {
      const r = await teacherAttendanceApi.me()
      if (r?.data) {
        setToday(r.data)
        saveStoredOfflineToday(r.data)
      } else {
        const local = getStoredOfflineToday()
        if (local) setToday(local)
      }
    } catch (_) {
      // Si hors-ligne, récupérer le dernier état sauvegardé en local
      const local = getStoredOfflineToday()
      if (local) setToday(local)
    }
    setLoadingToday(false)
  }

  const syncPendingScans = async () => {
    const queue = getOfflineScans()
    if (!queue.length) return
    if (!navigator.onLine) return

    setSyncingOffline(true)
    const remaining = []
    let syncedCount = 0

    for (const item of queue) {
      try {
        await teacherAttendanceApi.scan(item.token, item.timestamp)
        syncedCount++
      } catch (err) {
        // Si déjà pointé ou erreur logique (hors réseau), on retire de la file
        if (err.message && !/failed to fetch|network|offline/i.test(err.message)) {
          syncedCount++
        } else {
          remaining.push(item)
        }
      }
    }

    saveOfflineScans(remaining)
    setPendingScans(remaining)
    setSyncingOffline(false)

    if (syncedCount > 0) {
      setResult({
        ok: true,
        message: `${syncedCount} pointage(s) hors-ligne synchronisé(s) avec succès avec l'école !`,
      })
      await loadToday()
    }
  }

  useEffect(() => {
    loadToday()
    syncPendingScans()

    const handleOnline = () => syncPendingScans()
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  // Nettoyage scanner à la sortie
  useEffect(() => () => { stopScanner() }, [])

  const stopScanner = async () => {
    const s = scannerRef.current
    if (s) {
      try { await s.stop() } catch (_) {}
      try { await s.clear() } catch (_) {}
      scannerRef.current = null
    }
    setScanning(false)
  }

  const onScanSuccess = async (decodedText) => {
    if (lockRef.current) return
    lockRef.current = true
    setProcessing(true)
    await stopScanner()

    const scanTime = new Date()
    const scanType = !today?.checkInAt ? 'checkin' : 'checkout'
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true

    // 1. Si l'appareil est hors-ligne, enregistrement local immédiat
    if (!isOnline) {
      const scans = getOfflineScans()
      const newScan = {
        token: decodedText,
        timestamp: scanTime.toISOString(),
        timeStr: fmt(scanTime),
        type: scanType,
      }
      scans.push(newScan)
      saveOfflineScans(scans)
      setPendingScans(scans)

      const updatedToday = {
        ...(today || {}),
        day: scanTime.toISOString().slice(0, 10),
        checkInAt: today?.checkInAt || scanTime,
        checkOutAt: today?.checkInAt ? scanTime : today?.checkOutAt,
        status: today?.status === 'late' ? 'late' : 'present',
        isOfflinePending: true,
      }
      setToday(updatedToday)
      saveStoredOfflineToday(updatedToday)

      setResult({
        ok: true,
        message: `Pointage (${scanType === 'checkin' ? 'Arrivée' : 'Départ'}) enregistré HORS-LIGNE à ${newScan.timeStr} ! Vos données sont sauvegardées en sécurité sur votre téléphone et seront envoyées automatiquement dès le rétablissement du réseau.`,
        type: scanType,
        isOffline: true,
      })

      setProcessing(false)
      setTimeout(() => { lockRef.current = false }, 1500)
      return
    }

    // 2. Si l'appareil est connecté, envoi direct au serveur
    try {
      const r = await teacherAttendanceApi.scan(decodedText, scanTime.toISOString())
      setResult({ ok: true, message: r.message, type: r.data?.type })
      await loadToday()
    } catch (e) {
      // Si la requête échoue suite à une déconnexion subite
      if (!navigator.onLine || /network|failed to fetch|offline/i.test(e.message)) {
        const scans = getOfflineScans()
        const newScan = {
          token: decodedText,
          timestamp: scanTime.toISOString(),
          timeStr: fmt(scanTime),
          type: scanType,
        }
        scans.push(newScan)
        saveOfflineScans(scans)
        setPendingScans(scans)

        const updatedToday = {
          ...(today || {}),
          day: scanTime.toISOString().slice(0, 10),
          checkInAt: today?.checkInAt || scanTime,
          checkOutAt: today?.checkInAt ? scanTime : today?.checkOutAt,
          status: 'present',
          isOfflinePending: true,
        }
        setToday(updatedToday)
        saveStoredOfflineToday(updatedToday)

        setResult({
          ok: true,
          message: `Réseau indisponible : pointage (${scanType === 'checkin' ? 'Arrivée' : 'Départ'}) sauvegardé en local à ${newScan.timeStr}. Il sera synchronisé dès le retour de la connexion.`,
          type: scanType,
          isOffline: true,
        })
      } else {
        setResult({ ok: false, message: e.message })
      }
    }

    setProcessing(false)
    setTimeout(() => { lockRef.current = false }, 1500)
  }

  const startScanner = async () => {
    setResult(null)
    setScanning(true)
    setTimeout(async () => {
      try {
        const html5 = new Html5Qrcode(SCANNER_ID)
        scannerRef.current = html5
        await html5.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          onScanSuccess,
          () => {}
        )
      } catch (e) {
        setScanning(false)
        setResult({ ok: false, message: "Impossible d'accéder à la caméra. Autorisez l'accès et réessayez." })
      }
    }, 100)
  }

  const alreadyDone = today?.checkInAt && today?.checkOutAt
  const nextAction = !today?.checkInAt ? 'arrivée' : !today?.checkOutAt ? 'départ' : null

  return (
    <div className="space-y-5 animate-fade-in max-w-lg mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <QrCode size={22} className="text-indigo-600" /> Mon pointage
        </h1>
        <p className="text-sm text-gray-500">
          Scannez le QR code de l'école à votre arrivée et à votre départ. Fonctionne avec ou sans connexion Internet.
        </p>
      </div>

      {/* Alerte pointages hors-ligne en attente de synchronisation */}
      {pendingScans.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-center justify-between text-xs text-amber-900 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <WifiOff size={18} className="text-amber-600 shrink-0 animate-pulse" />
            <div>
              <div className="font-bold">{pendingScans.length} pointage(s) enregistré(s) hors-ligne</div>
              <div className="text-[11px] text-amber-700">Sauvegardés en local • En attente de synchronisation</div>
            </div>
          </div>
          {typeof navigator !== 'undefined' && navigator.onLine && (
            <button
              onClick={syncPendingScans}
              disabled={syncingOffline}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all"
            >
              {syncingOffline ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              <span>Synchroniser</span>
            </button>
          )}
        </div>
      )}

      {/* État du jour */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">Statut de présence du jour</h3>
          {!loadingToday && (
            !today?.checkInAt ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 border border-red-200 px-2.5 py-0.5 rounded-full">
                <XCircle size={13} className="text-red-600" /> ABSENT (Non pointé)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-100 border border-green-200 px-2.5 py-0.5 rounded-full">
                <CheckCircle2 size={13} className="text-green-600" />
                <span>PRÉSENT</span>
                {today?.isOfflinePending && (
                  <span className="text-[10px] bg-green-200 text-green-900 px-1.5 py-0.2 rounded-md font-semibold ml-1">
                    Hors-ligne
                  </span>
                )}
              </span>
            )
          )}
        </div>

        {!loadingToday && !today?.checkInAt && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800">
            <strong>⚠️ Règle d'assiduité :</strong> Vous n'avez pas encore scanné le QR code d'arrivée. Tout enseignant qui ne scanne pas le code QR est considéré comme <strong>absent durant la journée</strong>.
          </div>
        )}

        {loadingToday ? (
          <div className="py-4 text-center">
            <Loader2 size={20} className="animate-spin mx-auto text-blue-600" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-xl border p-3 ${!today?.checkInAt ? 'border-red-200 bg-red-50/40' : 'border-gray-100'}`}>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <LogIn size={13} /> Arrivée
              </div>
              <div className="text-lg font-bold text-gray-900 mt-1">{fmt(today?.checkInAt)}</div>
              {today?.status === 'late' && (
                <div className="text-xs text-red-600 font-semibold">en retard +{today.lateMinutes} min</div>
              )}
              {!today?.checkInAt && (
                <div className="text-[11px] text-red-600 font-semibold">Non enregistré (Absent)</div>
              )}
            </div>

            <div className="rounded-xl border border-gray-100 p-3">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <LogOut size={13} /> Départ
              </div>
              <div className="text-lg font-bold text-gray-900 mt-1">{fmt(today?.checkOutAt)}</div>
              {today?.earlyDeparture && (
                <div className="text-xs text-red-600 font-semibold">anticipé −{today.earlyMinutes} min</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Résultat du scan */}
      {result && (
        <div className={`card p-4 flex items-start gap-3 ${result.ok ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-red-500'}`}>
          {result.ok ? (
            <CheckCircle2 size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
          )}
          <p className={`text-sm ${result.ok ? 'text-green-700' : 'text-red-600'}`}>{result.message}</p>
        </div>
      )}

      {/* Scanner */}
      <div className="card p-5">
        {scanning ? (
          <div>
            <div id={SCANNER_ID} className="w-full rounded-xl overflow-hidden" />
            {processing && (
              <div className="text-center mt-3 text-sm text-gray-500">
                <Loader2 size={16} className="animate-spin inline mr-1" /> Enregistrement…
              </div>
            )}
            <button onClick={stopScanner} className="btn-ghost border border-gray-200 w-full justify-center text-sm mt-3">
              Arrêter
            </button>
          </div>
        ) : alreadyDone ? (
          <div className="text-center py-6">
            <CheckCircle2 size={36} className="mx-auto text-green-500 mb-2" />
            <p className="text-sm text-gray-600">Vous avez pointé votre arrivée et votre départ aujourd'hui.</p>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-gray-600 mb-3">
              Prochain pointage : <strong className="text-indigo-600">{nextAction}</strong>
            </p>
            <button onClick={startScanner} className="btn-primary justify-center text-sm mx-auto">
              <Camera size={16} /> Scanner le QR code
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
