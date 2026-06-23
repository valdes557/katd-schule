import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { teacherAttendanceApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { useAuth } from '../context/AuthContext'
import {
  Loader2, BarChart3, Download, Clock, LogOut, CalendarDays,
  CheckCircle2, TrendingUp, QrCode, History,
} from 'lucide-react'
import DownloadPdfButton from '../components/DownloadPdfButton'

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function fmtTime(d) {
  return d ? new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'
}

function fmtDay(s) {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

// Télécharge un tableau (array d'objets) en CSV
function downloadCsv(filename, columns, rows) {
  const esc = (v) => {
    const s = v == null ? '' : String(v)
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = columns.map((c) => esc(c.label)).join(';')
  const lines = rows.map((r) => columns.map((c) => esc(c.get(r))).join(';'))
  const csv = '﻿' + [header, ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function Kpi({ icon: Icon, label, value, sub, tone = 'indigo' }) {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
  }
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tones[tone]}`}><Icon size={20} /></div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-bold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
      </div>
    </div>
  )
}

export default function TeacherAttendanceDashboardPage() {
  const pdfRef = useRef(null)
  const { school } = useAuth()
  const [month, setMonth] = useState(currentMonth())
  const [teacherFilter, setTeacherFilter] = useState('')

  const statsQ = useCachedFetch(`/teacher-attendance/stats?month=${month}`, async () => {
    const r = await teacherAttendanceApi.stats({ month })
    return r.data
  }, [month])

  const histKey = `/teacher-attendance/history?month=${month}&teacher=${teacherFilter || 'all'}`
  const histQ = useCachedFetch(histKey, async () => {
    const params = { month }
    if (teacherFilter) params.teacherId = teacherFilter
    const r = await teacherAttendanceApi.history(params)
    return r.data || []
  }, [month, teacherFilter])

  const stats = statsQ.data
  const teachers = stats?.teachers || []
  const totals = stats?.totals || { daysLate: 0, lateMinutes: 0, earlyDepartures: 0, earlyMinutes: 0, daysPresent: 0 }
  const workingDays = stats?.workingDays || 0
  const history = histQ.data || []

  // Taux de ponctualité global (jours à l'heure / jours pointés)
  const onTime = totals.daysPresent - totals.daysLate
  const punctualityRate = totals.daysPresent ? Math.round((onTime / totals.daysPresent) * 100) : null

  const exportStats = () => {
    if (!teachers.length) return
    downloadCsv(
      `pointage-stats-${month}.csv`,
      [
        { label: 'Enseignant', get: (r) => r.name },
        { label: 'Jours présents', get: (r) => r.daysPresent },
        { label: 'Jours absents', get: (r) => r.daysAbsent },
        { label: 'Retards', get: (r) => r.daysLate },
        { label: 'Minutes de retard', get: (r) => r.lateMinutes },
        { label: 'Départs anticipés', get: (r) => r.earlyDepartures },
        { label: 'Minutes anticipées', get: (r) => r.earlyMinutes },
        { label: 'Ponctualité %', get: (r) => (r.punctualityRate == null ? '' : r.punctualityRate) },
      ],
      teachers,
    )
  }

  const exportHistory = () => {
    if (!history.length) return
    downloadCsv(
      `pointage-historique-${month}.csv`,
      [
        { label: 'Date', get: (r) => fmtDay(r.day) },
        { label: 'Enseignant', get: (r) => r.name },
        { label: 'Arrivée', get: (r) => fmtTime(r.checkInAt) },
        { label: 'Départ', get: (r) => fmtTime(r.checkOutAt) },
        { label: 'Statut', get: (r) => (r.status === 'late' ? 'En retard' : 'Présent') },
        { label: 'Retard (min)', get: (r) => r.lateMinutes || '' },
        { label: 'Départ anticipé (min)', get: (r) => (r.earlyDeparture ? r.earlyMinutes : '') },
      ],
      history,
    )
  }

  return (
    <div className="space-y-5 animate-fade-in" ref={pdfRef}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><BarChart3 size={22} className="text-indigo-600" /> Tableau de bord du pointage</h1>
          <p className="text-sm text-gray-500">Synthèse mensuelle des présences, retards et départs anticipés du personnel.</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="input text-sm" />
          <DownloadPdfButton containerRef={pdfRef} filename="rapports-pointage.pdf" label="Pointage PDF" />
          <Link to="/dashboard/pointage" className="btn-ghost border border-gray-200 text-sm justify-center"><QrCode size={15} /> QR & jour</Link>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={TrendingUp} tone={punctualityRate != null && punctualityRate >= 80 ? 'green' : 'amber'}
          label="Ponctualité globale" value={punctualityRate == null ? '—' : `${punctualityRate}%`}
          sub={`${onTime}/${totals.daysPresent} jours à l'heure`} />
        <Kpi icon={CalendarDays} tone="indigo" label="Jours d'ouverture" value={workingDays} sub={`${stats?.teacherCount || 0} enseignants`} />
        <Kpi icon={Clock} tone="red" label="Retards" value={totals.daysLate} sub={`${totals.lateMinutes} min cumulées`} />
        <Kpi icon={LogOut} tone="amber" label="Départs anticipés" value={totals.earlyDepartures} sub={`${totals.earlyMinutes} min cumulées`} />
      </div>

      {/* Stats par enseignant */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><CheckCircle2 size={16} className="text-green-600" /> Synthèse par enseignant</h3>
          <button onClick={exportStats} disabled={!teachers.length} className="btn-ghost border border-gray-200 text-sm justify-center disabled:opacity-50"><Download size={15} /> Export CSV</button>
        </div>
        {statsQ.loading ? (
          <div className="py-10 text-center"><Loader2 size={22} className="animate-spin mx-auto text-blue-600" /></div>
        ) : teachers.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Aucun enseignant.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Enseignant', 'Présents', 'Absents', 'Retards', 'Min. retard', 'Départs ant.', 'Ponctualité'].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 px-3 py-2 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {teachers.map((t) => (
                  <tr key={t.teacherId} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-sm font-medium text-gray-900 whitespace-nowrap">{t.name}</td>
                    <td className="px-3 py-2.5 text-sm text-gray-700">{t.daysPresent}</td>
                    <td className="px-3 py-2.5 text-sm text-gray-500">{t.daysAbsent}</td>
                    <td className="px-3 py-2.5 text-sm"><span className={t.daysLate ? 'text-red-600 font-semibold' : 'text-gray-500'}>{t.daysLate}</span></td>
                    <td className="px-3 py-2.5 text-sm text-gray-700">{t.lateMinutes || '—'}</td>
                    <td className="px-3 py-2.5 text-sm"><span className={t.earlyDepartures ? 'text-amber-600 font-semibold' : 'text-gray-500'}>{t.earlyDepartures}</span></td>
                    <td className="px-3 py-2.5 text-sm">
                      {t.punctualityRate == null ? <span className="text-gray-400">—</span> : (
                        <span className={`font-semibold ${t.punctualityRate >= 80 ? 'text-green-600' : t.punctualityRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{t.punctualityRate}%</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Historique détaillé */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><History size={16} className="text-indigo-600" /> Historique des pointages</h3>
          <div className="flex items-center gap-2">
            <select value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)} className="input text-sm">
              <option value="">Tous les enseignants</option>
              {teachers.map((t) => <option key={t.teacherId} value={t.teacherId}>{t.name}</option>)}
            </select>
            <button onClick={exportHistory} disabled={!history.length} className="btn-ghost border border-gray-200 text-sm justify-center disabled:opacity-50"><Download size={15} /> Export CSV</button>
          </div>
        </div>
        {histQ.loading ? (
          <div className="py-10 text-center"><Loader2 size={22} className="animate-spin mx-auto text-blue-600" /></div>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Aucun pointage sur cette période.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[580px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Date', 'Enseignant', 'Arrivée', 'Départ', 'Statut'].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 px-3 py-2 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {history.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-sm text-gray-700 whitespace-nowrap">{fmtDay(r.day)}</td>
                    <td className="px-3 py-2.5 text-sm font-medium text-gray-900 whitespace-nowrap">{r.name}</td>
                    <td className="px-3 py-2.5 text-sm text-gray-700">
                      {fmtTime(r.checkInAt)}
                      {r.status === 'late' && <span className="ml-2 text-xs text-red-600 font-semibold">+{r.lateMinutes} min</span>}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-700">
                      {fmtTime(r.checkOutAt)}
                      {r.earlyDeparture && <span className="ml-2 text-xs text-amber-600 font-semibold">−{r.earlyMinutes} min</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {r.status === 'late' ? (
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
  )
}
