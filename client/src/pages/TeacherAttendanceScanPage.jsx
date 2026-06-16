import { useState, useRef, useEffect } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { teacherAttendanceApi } from '../lib/api'
import { Loader2, QrCode, Camera, CheckCircle2, Clock, LogIn, LogOut, AlertCircle } from 'lucide-react'

function fmt(d) {
  return d ? new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'
}

const SCANNER_ID = 'qr-reader-region'

export default function TeacherAttendanceScanPage() {
  const [scanning, setScanning] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState(null) // { ok, message, type }
  const [today, setToday] = useState(null)
  const [loadingToday, setLoadingToday] = useState(true)
  const scannerRef = useRef(null)
  const lockRef = useRef(false)

  const loadToday = async () => {
    setLoadingToday(true)
    try { const r = await teacherAttendanceApi.me(); setToday(r.data) } catch (_) {}
    setLoadingToday(false)
  }

  useEffect(() => { loadToday() }, [])

  // Nettoyage à la sortie
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
    try {
      const r = await teacherAttendanceApi.scan(decodedText)
      setResult({ ok: true, message: r.message, type: r.data?.type })
      await loadToday()
    } catch (e) {
      setResult({ ok: false, message: e.message })
    }
    setProcessing(false)
    setTimeout(() => { lockRef.current = false }, 1500)
  }

  const startScanner = async () => {
    setResult(null)
    setScanning(true)
    // Laisse le DOM rendre la région avant d'initialiser la caméra
    setTimeout(async () => {
      try {
        const html5 = new Html5Qrcode(SCANNER_ID)
        scannerRef.current = html5
        await html5.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          onScanSuccess,
          () => {} // ignore les échecs de lecture intermédiaires
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
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><QrCode size={22} className="text-indigo-600" /> Mon pointage</h1>
        <p className="text-sm text-gray-500">Scannez le QR code de l'école à votre arrivée et à votre départ.</p>
      </div>

      {/* État du jour */}
      <div className="card p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-3">Aujourd'hui</h3>
        {loadingToday ? (
          <div className="py-4 text-center"><Loader2 size={20} className="animate-spin mx-auto text-blue-600" /></div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-gray-100 p-3">
              <div className="flex items-center gap-1.5 text-xs text-gray-500"><LogIn size={13} /> Arrivée</div>
              <div className="text-lg font-bold text-gray-900 mt-1">{fmt(today?.checkInAt)}</div>
              {today?.status === 'late' && <div className="text-xs text-red-600 font-semibold">en retard +{today.lateMinutes} min</div>}
            </div>
            <div className="rounded-xl border border-gray-100 p-3">
              <div className="flex items-center gap-1.5 text-xs text-gray-500"><LogOut size={13} /> Départ</div>
              <div className="text-lg font-bold text-gray-900 mt-1">{fmt(today?.checkOutAt)}</div>
              {today?.earlyDeparture && <div className="text-xs text-red-600 font-semibold">anticipé −{today.earlyMinutes} min</div>}
            </div>
          </div>
        )}
      </div>

      {/* Résultat du scan */}
      {result && (
        <div className={`card p-4 flex items-start gap-3 ${result.ok ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-red-500'}`}>
          {result.ok ? <CheckCircle2 size={20} className="text-green-600 flex-shrink-0 mt-0.5" /> : <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />}
          <p className={`text-sm ${result.ok ? 'text-green-700' : 'text-red-600'}`}>{result.message}</p>
        </div>
      )}

      {/* Scanner */}
      <div className="card p-5">
        {scanning ? (
          <div>
            <div id={SCANNER_ID} className="w-full rounded-xl overflow-hidden" />
            {processing && <div className="text-center mt-3 text-sm text-gray-500"><Loader2 size={16} className="animate-spin inline mr-1" /> Enregistrement…</div>}
            <button onClick={stopScanner} className="btn-ghost border border-gray-200 w-full justify-center text-sm mt-3">Arrêter</button>
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
            <button onClick={startScanner} className="btn-primary justify-center text-sm mx-auto"><Camera size={16} /> Scanner le QR code</button>
          </div>
        )}
      </div>
    </div>
  )
}
