import { useState, useRef, useEffect } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { QrCode, Camera, CheckCircle2, AlertCircle, Loader2, LogIn, LogOut, Clock } from 'lucide-react'
import { entryAttendanceApi } from '../../lib/api'

const SCANNER_ID = 'portier-qr-region'

/**
 * Page portier : scan CONTINU des QR individuels (élèves + personnel).
 * À chaque scan → entrée ou sortie enregistrée, feedback à l'écran, la caméra reste active.
 */
export default function PortierScanPage() {
  const [scanning, setScanning] = useState(false)
  const [last, setLast] = useState(null) // { ok, name, className, direction, status, lateMinutes, time, message }
  const [recent, setRecent] = useState([])
  const scannerRef = useRef(null)
  const recentQrRef = useRef(new Map()) // anti-rebond : qrId → timestamp

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

  const onScan = async (decodedText) => {
    const qrId = (decodedText || '').trim()
    if (!qrId) return
    // Anti-rebond : ignore le même QR pendant 5 secondes (la caméra lit en continu)
    const lastSeen = recentQrRef.current.get(qrId)
    if (lastSeen && Date.now() - lastSeen < 5000) return
    recentQrRef.current.set(qrId, Date.now())

    try {
      const r = await entryAttendanceApi.scan(qrId)
      const d = r.data || {}
      const entry = { ok: true, ...d, at: new Date() }
      setLast(entry)
      setRecent((prev) => [entry, ...prev].slice(0, 15))
    } catch (e) {
      setLast({ ok: false, message: e.message, at: new Date() })
    }
  }

  const startScanner = async () => {
    setLast(null)
    setScanning(true)
    setTimeout(async () => {
      try {
        const html5 = new Html5Qrcode(SCANNER_ID)
        scannerRef.current = html5
        await html5.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          onScan,
          () => {} // ignore les échecs de lecture intermédiaires
        )
      } catch (e) {
        setScanning(false)
        setLast({ ok: false, message: "Impossible d'accéder à la caméra. Autorisez l'accès et réessayez." })
      }
    }, 100)
  }

  return (
    <div className="space-y-5 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><QrCode size={22} className="text-indigo-600" /> Scanner les entrées / sorties</h1>
        <p className="text-sm text-gray-500">Scannez le QR de chaque élève ou membre du personnel. 1er scan = entrée, 2e scan = sortie.</p>
      </div>

      {/* Feedback du dernier scan */}
      {last && (
        <div className={`card p-4 border-l-4 ${!last.ok ? 'border-l-red-500' : last.status === 'late' && last.direction === 'in' ? 'border-l-orange-500' : 'border-l-green-500'}`}>
          {last.ok ? (
            <div className="flex items-center gap-3">
              {last.direction === 'out' ? <LogOut size={26} className="text-blue-600" /> : last.status === 'late' ? <Clock size={26} className="text-orange-500" /> : <LogIn size={26} className="text-green-600" />}
              <div className="flex-1">
                <p className="text-base font-bold text-gray-900">{last.name}</p>
                <p className="text-xs text-gray-500">{last.className || last.role || ''}</p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold ${last.direction === 'out' ? 'text-blue-600' : last.status === 'late' ? 'text-orange-600' : 'text-green-600'}`}>
                  {last.direction === 'out' ? 'Sortie' : last.direction === 'done' ? 'Déjà pointé' : last.status === 'late' ? `Retard +${last.lateMinutes} min` : 'À l\'heure'}
                </p>
                <p className="text-xs text-gray-500">{last.time}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <AlertCircle size={20} className="text-red-500" />
              <p className="text-sm text-red-600">{last.message}</p>
            </div>
          )}
        </div>
      )}

      {/* Scanner */}
      <div className="card p-5">
        {scanning ? (
          <div>
            <div id={SCANNER_ID} className="w-full rounded-xl overflow-hidden" />
            <p className="text-center text-xs text-gray-400 mt-2">La caméra reste active : scannez les personnes les unes après les autres.</p>
            <button onClick={stopScanner} className="btn-ghost border border-gray-200 w-full justify-center text-sm mt-3">Arrêter</button>
          </div>
        ) : (
          <div className="text-center py-6">
            <button onClick={startScanner} className="btn-primary justify-center text-sm mx-auto"><Camera size={16} /> Démarrer le scan</button>
          </div>
        )}
      </div>

      {/* Derniers scans de la session */}
      {recent.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-bold text-gray-900 mb-2">Derniers scans</h3>
          <div className="divide-y divide-gray-100">
            {recent.map((r, i) => (
              <div key={i} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="font-medium text-gray-800">{r.name}</span>
                  {r.className && <span className="text-xs text-gray-400 ml-1.5">{r.className}</span>}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {r.direction === 'out'
                    ? <span className="text-blue-600 font-semibold">Sortie {r.time}</span>
                    : r.status === 'late'
                      ? <span className="text-orange-600 font-semibold">Retard +{r.lateMinutes} min · {r.time}</span>
                      : <span className="text-green-600 font-semibold flex items-center gap-1"><CheckCircle2 size={12} /> {r.time}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
