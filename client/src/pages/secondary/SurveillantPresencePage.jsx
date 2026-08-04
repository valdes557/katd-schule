import { useState, useEffect } from 'react'
import {
  CalendarCheck, Loader2, Users, GraduationCap, Clock, AlertCircle, RefreshCw,
} from 'lucide-react'
import { entryAttendanceApi, visitorsApi } from '../../lib/api'
import { roleLabel } from '../../lib/roleLabels'
import { useAuth } from '../../context/AuthContext'

/**
 * Vue Surveillant Général (et journal du portier / principal) :
 * présents, retards et absents du jour — personnel et élèves par classe.
 * Auto-refresh toutes les 30 s.
 */
export default function SurveillantPresencePage() {
  const { school } = useAuth()
  const [day, setDay] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('students')
  const [visitors, setVisitors] = useState([])

  const load = async (d = day) => {
    try {
      const [res, vis] = await Promise.all([
        entryAttendanceApi.today(d),
        visitorsApi.list(d ? { day: d } : {}).catch(() => ({ data: [] })), // journal visiteurs (E4)
      ])
      setData(res.data)
      setVisitors(vis.data || [])
      setError('')
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  useEffect(() => {
    setLoading(true)
    load(day)
    const t = setInterval(() => load(day), 30000)
    return () => clearInterval(t)
  }, [day])

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>
  if (error) return <div className="text-center py-16"><AlertCircle size={36} className="mx-auto text-red-400 mb-3" /><p className="text-sm text-gray-600">{error}</p></div>

  const d = data || { staff: [], students: [], absentStaff: [], absentStudents: [], stats: {} }
  const s = d.stats || {}

  // Groupe les élèves par classe pour repérer les retards/absents par salle
  const groupByClass = (arr) => {
    const map = new Map()
    for (const it of arr) {
      const key = it.className || 'Sans classe'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(it)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }

  const kpis = [
    { label: 'Élèves présents', value: s.studentsPresent || 0, cls: 'text-green-600 bg-green-50' },
    { label: 'Élèves en retard', value: s.studentsLate || 0, cls: 'text-orange-600 bg-orange-50' },
    { label: 'Élèves absents', value: s.studentsAbsent || 0, cls: 'text-red-600 bg-red-50' },
    { label: 'Personnel présent', value: s.staffPresent || 0, cls: 'text-green-600 bg-green-50' },
    { label: 'Personnel en retard', value: s.staffLate || 0, cls: 'text-orange-600 bg-orange-50' },
    { label: 'Personnel absent', value: s.staffAbsent || 0, cls: 'text-red-600 bg-red-50' },
  ]

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><CalendarCheck size={20} className="text-indigo-600" /> Présences du jour</h1>
          <p className="text-sm text-gray-500">Arrivées, retards et absences enregistrés à la loge — {d.day}</p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="input text-xs w-auto" />
          <button onClick={() => { setLoading(true); load(day) }} className="btn-ghost text-xs border border-gray-200 bg-white"><RefreshCw size={13} /> Actualiser</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="card p-3 text-center">
            <div className={`text-2xl font-bold rounded-lg py-1 ${k.cls}`}>{k.value}</div>
            <div className="text-[11px] text-gray-500 mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button onClick={() => setTab('students')} className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 ${tab === 'students' ? 'bg-white shadow text-indigo-700' : 'text-gray-500'}`}>
          <GraduationCap size={13} /> Élèves
        </button>
        <button onClick={() => setTab('staff')} className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 ${tab === 'staff' ? 'bg-white shadow text-indigo-700' : 'text-gray-500'}`}>
          <Users size={13} /> Personnel
        </button>
        <button onClick={() => setTab('visitors')} className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 ${tab === 'visitors' ? 'bg-white shadow text-indigo-700' : 'text-gray-500'}`}>
          <Users size={13} /> Visiteurs {visitors.length > 0 && <span className="bg-indigo-100 text-indigo-700 rounded-full px-1.5">{visitors.length}</span>}
        </button>
      </div>

      {tab === 'visitors' ? (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="px-4 py-2">Visiteur</th>
                <th className="px-4 py-2">Motif</th>
                <th className="px-4 py-2">Visite à</th>
                <th className="px-4 py-2">Entrée</th>
                <th className="px-4 py-2">Sortie</th>
              </tr>
            </thead>
            <tbody>
              {visitors.map((v) => (
                <tr key={v._id} className="border-b last:border-0">
                  <td className="px-4 py-2 font-medium text-gray-900">{v.name}{v.phone ? <span className="text-xs font-normal text-gray-400"> · {v.phone}</span> : null}</td>
                  <td className="px-4 py-2 text-gray-600">{v.reason}</td>
                  <td className="px-4 py-2 text-gray-600">{v.visiting || '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{v.checkInTime || '—'}</td>
                  <td className="px-4 py-2">
                    {v.checkOutTime
                      ? <span className="text-gray-600">{v.checkOutTime}</span>
                      : <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full w-fit">Sur place</span>}
                  </td>
                </tr>
              ))}
              {visitors.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-400">Aucun visiteur enregistré ce jour</td></tr>}
            </tbody>
          </table>
        </div>
      ) : tab === 'students' ? (
        <div className="space-y-4">
          {/* Présents / retards par classe */}
          {groupByClass(d.students).map(([className, list]) => (
            <div key={className} className="card overflow-x-auto">
              <div className="px-4 py-2.5 border-b bg-gray-50 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-800">{className}</h3>
                <span className="text-xs text-gray-500">{list.length} présent(s) · {list.filter((x) => x.status === 'late').length} retard(s)</span>
              </div>
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b">
                    <th className="px-4 py-2">Élève</th>
                    <th className="px-4 py-2">Arrivée</th>
                    <th className="px-4 py-2">Sortie</th>
                    <th className="px-4 py-2">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-4 py-2 font-medium text-gray-900">{r.name}</td>
                      <td className="px-4 py-2 text-gray-600">{r.checkInTime || '—'}</td>
                      <td className="px-4 py-2 text-gray-600">{r.checkOutTime || '—'}</td>
                      <td className="px-4 py-2">
                        {r.status === 'late'
                          ? <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit"><Clock size={11} /> +{r.lateMinutes} min</span>
                          : <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full w-fit">À l'heure</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {/* Absents par classe */}
          {d.absentStudents.length > 0 && (
            <div className="card">
              <div className="px-4 py-2.5 border-b bg-red-50">
                <h3 className="text-sm font-bold text-red-700">Absents ({d.absentStudents.length})</h3>
              </div>
              <div className="p-4 space-y-2">
                {groupByClass(d.absentStudents).map(([className, list]) => (
                  <div key={className} className="text-sm">
                    <span className="font-semibold text-gray-700">{className} :</span>{' '}
                    <span className="text-gray-600">{list.map((x) => x.name).join(', ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b">
                  <th className="px-4 py-2">Nom</th>
                  <th className="px-4 py-2">Fonction</th>
                  <th className="px-4 py-2">Arrivée</th>
                  <th className="px-4 py-2">Sortie</th>
                  <th className="px-4 py-2">Statut</th>
                </tr>
              </thead>
              <tbody>
                {d.staff.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-4 py-2 font-medium text-gray-900">{r.name}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{roleLabel(r.role, school)}</td>
                    <td className="px-4 py-2 text-gray-600">{r.checkInTime || '—'}</td>
                    <td className="px-4 py-2 text-gray-600">{r.checkOutTime || '—'}</td>
                    <td className="px-4 py-2">
                      {r.status === 'late'
                        ? <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit"><Clock size={11} /> +{r.lateMinutes} min</span>
                        : <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full w-fit">À l'heure</span>}
                    </td>
                  </tr>
                ))}
                {d.staff.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-400">Aucun pointage du personnel aujourd'hui</td></tr>}
              </tbody>
            </table>
          </div>
          {d.absentStaff.length > 0 && (
            <div className="card">
              <div className="px-4 py-2.5 border-b bg-red-50">
                <h3 className="text-sm font-bold text-red-700">Personnel absent ({d.absentStaff.length})</h3>
              </div>
              <div className="p-4 text-sm text-gray-600">
                {d.absentStaff.map((x) => `${x.name} (${roleLabel(x.role, school)})`).join(', ')}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
