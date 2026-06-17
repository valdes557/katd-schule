import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import { teacherAttendanceApi } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'
import { Loader2, QrCode, Download, RefreshCw, Clock, CheckCircle2, XCircle, Save, Users, BarChart3 } from 'lucide-react'

function fmt(d) {
  return d ? new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'
}

export default function TeacherAttendanceAdminPage() {
  const { school } = useAuth()
  const qrRef = useRef(null)
  const [regenerating, setRegenerating] = useState(false)
  const [savingCfg, setSavingCfg] = useState(false)
  const [cfg, setCfg] = useState({ lateAfter: '08:00', earliestDeparture: '16:00' })
  const [cfgLoaded, setCfgLoaded] = useState(false)

  const qrQ = useCachedFetch('/teacher-attendance/qr', async () => {
    const r = await teacherAttendanceApi.qr()
    return r.data
  }, [])

  const todayQ = useCachedFetch('/teacher-attendance/today', async () => {
    const r = await teacherAttendanceApi.today()
    return r.data || []
  }, [])

  const qr = qrQ.data
  const rows = todayQ.data || []

  // Initialise la config depuis le serveur une seule fois
  if (qr?.config && !cfgLoaded) {
    setCfg({ lateAfter: qr.config.lateAfter || '08:00', earliestDeparture: qr.config.earliestDeparture || '16:00' })
    setCfgLoaded(true)
  }

  const refreshToday = () => { cache.invalidate('/teacher-attendance/today'); todayQ.refetch() }

  const downloadQr = () => {
    const canvas = qrRef.current?.querySelector('canvas')
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `qr-pointage-${(school?.name || 'ecole').replace(/\s+/g, '-').toLowerCase()}.png`
    a.click()
  }

  const regenerate = async () => {
    if (!window.confirm('Régénérer le QR code ? L\'ancien QR affiché ne fonctionnera plus.')) return
    setRegenerating(true)
    try {
      await teacherAttendanceApi.regenerate()
      cache.invalidate('/teacher-attendance/qr')
      qrQ.refetch()
    } catch (e) { alert(e.message) }
    setRegenerating(false)
  }

  const saveConfig = async () => {
    setSavingCfg(true)
    try {
      await teacherAttendanceApi.setConfig(cfg)
      cache.invalidate('/teacher-attendance/qr')
      refreshToday()
      alert('Configuration enregistrée')
    } catch (e) { alert(e.message) }
    setSavingCfg(false)
  }

  const qrValue = qr?.token || ''
  const present = rows.filter((r) => r.status !== 'absent')
  const late = rows.filter((r) => r.status === 'late')

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><QrCode size={22} className="text-indigo-600" /> Pointage du personnel (QR Code)</h1>
          <p className="text-sm text-gray-500">Affichez ce QR code à l'entrée. Les enseignants le scannent à l'arrivée et au départ.</p>
        </div>
        <Link to="/dashboard/pointage/rapports" className="btn-ghost border border-gray-200 text-sm justify-center"><BarChart3 size={15} /> Rapports & stats</Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* QR + config */}
        <div className="space-y-5">
          <div className="card p-5 text-center">
            {qrQ.loading ? (
              <div className="py-12"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div>
            ) : qrValue ? (
              <>
                <div ref={qrRef} className="inline-block bg-white p-3 rounded-xl border border-gray-100">
                  <QRCodeCanvas value={qrValue} size={200} level="M" includeMargin />
                </div>
                <p className="text-xs text-gray-500 mt-3">{school?.name}</p>
                <div className="flex gap-2 mt-4">
                  <button onClick={downloadQr} className="btn-primary flex-1 justify-center text-sm"><Download size={15} /> Télécharger</button>
                  <button onClick={regenerate} disabled={regenerating} className="btn-ghost border border-gray-200 justify-center text-sm">
                    {regenerating ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-400 py-8">QR indisponible</p>
            )}
          </div>

          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><Clock size={15} className="text-amber-500" /> Horaires</h3>
            <div>
              <label className="text-xs font-medium text-gray-600">Heure limite d'arrivée (retard au-delà)</label>
              <input type="time" value={cfg.lateAfter} onChange={(e) => setCfg({ ...cfg, lateAfter: e.target.value })} className="input text-sm mt-1 w-full" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Heure de sortie minimale (départ anticipé avant)</label>
              <input type="time" value={cfg.earliestDeparture} onChange={(e) => setCfg({ ...cfg, earliestDeparture: e.target.value })} className="input text-sm mt-1 w-full" />
            </div>
            <button onClick={saveConfig} disabled={savingCfg} className="btn-primary w-full justify-center text-sm">
              {savingCfg ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer
            </button>
          </div>
        </div>

        {/* Liste du jour */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><Users size={16} className="text-indigo-600" /> Présences du jour</h3>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>{present.length}/{rows.length} présents</span>
              {late.length > 0 && <span className="text-red-600 font-semibold">{late.length} en retard</span>}
              <button onClick={refreshToday} className="p-1 rounded hover:bg-gray-100"><RefreshCw size={14} /></button>
            </div>
          </div>

          {todayQ.loading ? (
            <div className="py-10 text-center"><Loader2 size={22} className="animate-spin mx-auto text-blue-600" /></div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Aucun enseignant enregistré.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Enseignant', 'Arrivée', 'Départ', 'Statut'].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 px-3 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((r) => (
                    <tr key={r.teacherId} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-sm font-medium text-gray-900">{r.name}</td>
                      <td className="px-3 py-2.5 text-sm text-gray-700">
                        {fmt(r.checkInAt)}
                        {r.status === 'late' && <span className="ml-2 text-xs text-red-600 font-semibold">en retard +{r.lateMinutes} min</span>}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-gray-700">
                        {fmt(r.checkOutAt)}
                        {r.earlyDeparture && <span className="ml-2 text-xs text-red-600 font-semibold">anticipé −{r.earlyMinutes} min</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        {r.status === 'absent' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-400"><XCircle size={13} /> Absent</span>
                        ) : r.status === 'late' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-red-600 font-semibold"><Clock size={13} /> En retard</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 font-semibold"><CheckCircle2 size={13} /> Présent</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
