import { useEffect, useRef, useState } from 'react'
import { CalendarCheck, Check, X, Clock, AlertCircle, Loader2, Save } from 'lucide-react'
import { attendanceApi, classesApi, studentsApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'
import { cn } from '../lib/utils'
import DownloadPdfButton from '../components/DownloadPdfButton'

const statusOptions = [
  { key: 'present', label: 'Présent', icon: Check, color: 'text-green-600', bg: 'bg-green-100', border: 'border-green-300' },
  { key: 'absent', label: 'Absent', icon: X, color: 'text-red-600', bg: 'bg-red-100', border: 'border-red-300' },
  { key: 'late', label: 'Retard', icon: Clock, color: 'text-orange-500', bg: 'bg-orange-100', border: 'border-orange-300' },
  { key: 'excused', label: 'Justifié', icon: AlertCircle, color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-300' },
]

export default function PresencePage() {
  const pdfRef = useRef(null)
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [records, setRecords] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [filterStatus, setFilterStatus] = useState('')

  const classesQ = useCachedFetch('/classes?', async () => (await classesApi.list()).data || [], [])
  const classes = classesQ.data || []

  // Sélectionne la première classe une fois les classes chargées.
  useEffect(() => {
    if (!selectedClass && classes.length > 0) setSelectedClass(classes[0]._id)
  }, [classes, selectedClass])

  const cls = selectedClass
  const studentsQ = useCachedFetch(
    cls ? `/students?classId=${cls}` : null,
    async () => (await studentsApi.list(`classId=${cls}`)).data || [],
    [cls],
  )
  const historyQ = useCachedFetch(
    cls ? `/attendance?classId=${cls}&limit=10` : null,
    async () => (await attendanceApi.list(`classId=${cls}&limit=10`)).data || [],
    [cls],
  )
  const statsQ = useCachedFetch(
    cls ? `/attendance/stats?classId=${cls}` : null,
    async () => (await attendanceApi.stats(`classId=${cls}`)).data || null,
    [cls],
  )

  const students = studentsQ.data || []
  const history = historyQ.data || []
  const stats = statsQ.data
  const loading = classesQ.loading || studentsQ.loading

  // records est DÉRIVÉ (pas mis en cache) : recalculé quand students/history/date changent.
  useEffect(() => {
    const todayRecord = history.find(
      (a) => new Date(a.date).toISOString().slice(0, 10) === selectedDate
    )
    const initial = {}
    students.forEach((s) => {
      const existing = todayRecord?.records?.find((r) => (r.student?._id || r.student) === s._id)
      initial[s._id] = existing?.status || 'present'
    })
    setRecords(initial)
  }, [students, history, selectedDate])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const data = {
        classId: selectedClass,
        date: selectedDate,
        records: Object.entries(records).map(([student, status]) => ({ student, status })),
      }
      await attendanceApi.save(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      cache.invalidate('/attendance')
      historyQ.refetch()
      statsQ.refetch()
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const summary = {
    present: Object.values(records).filter((v) => v === 'present').length,
    absent: Object.values(records).filter((v) => v === 'absent').length,
    late: Object.values(records).filter((v) => v === 'late').length,
    excused: Object.values(records).filter((v) => v === 'excused').length,
  }

  const filteredStudents = filterStatus
    ? students.filter((s) => records[s._id] === filterStatus)
    : []

  return (
    <div className="space-y-5 animate-fade-in" ref={pdfRef}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarCheck size={22} className="text-green-600" /> Gestion de la Présence
          </h1>
          <p className="text-sm text-gray-500">Appel journalier par classe</p>
        </div>
        <DownloadPdfButton containerRef={pdfRef} filename="presences.pdf" title="Présences" label="Présences PDF" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="input text-sm w-auto">
          <option value="">Choisir une classe</option>
          {classes.map((c) => <option key={c._id} value={c._id}>{c.name} ({c.level})</option>)}
        </select>
        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="input text-sm w-auto" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statusOptions.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setFilterStatus((prev) => (prev === opt.key ? '' : opt.key))}
            className={cn(
              'card p-3 border text-left transition-colors',
              opt.border,
              filterStatus === opt.key ? 'ring-2 ring-offset-1 ring-blue-400' : ''
            )}
          >
            <div className={cn('text-2xl font-bold', opt.color)}>{summary[opt.key]}</div>
            <div className="text-xs text-gray-500 flex items-center gap-1">
              {opt.label}s
              {filterStatus === opt.key && <span className="text-[10px] text-blue-600 font-semibold">(cliqué)</span>}
            </div>
          </button>
        ))}
      </div>

      {filterStatus && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">
            Élèves {statusOptions.find((o) => o.key === filterStatus)?.label.toLowerCase()}s ({filteredStudents.length})
          </h3>
          {filteredStudents.length === 0 ? (
            <p className="text-xs text-gray-400">Aucun élève dans ce statut pour cette date.</p>
          ) : (
            <ul className="text-xs text-gray-700 grid grid-cols-1 sm:grid-cols-2 gap-y-1 gap-x-4">
              {filteredStudents.map((s) => (
                <li key={s._id}>{s.lastName} {s.firstName}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Stats */}
      {stats && stats.totalSessions > 0 && (
        <div className="card p-4 bg-gray-50">
          <div className="flex flex-wrap gap-6 text-sm">
            <div><span className="text-gray-500">Sessions:</span> <span className="font-bold">{stats.totalSessions}</span></div>
            <div><span className="text-gray-500">Taux présence:</span> <span className="font-bold text-green-600">{stats.attendanceRate}%</span></div>
            <div><span className="text-gray-500">Total absences:</span> <span className="font-bold text-red-600">{stats.totalAbsent}</span></div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div>
      ) : !selectedClass ? (
        <div className="text-center py-16 text-gray-400"><p>Sélectionnez une classe pour faire l'appel</p></div>
      ) : students.length === 0 ? (
        <div className="text-center py-16 text-gray-400"><AlertCircle size={36} className="mx-auto mb-3 opacity-30" /><p>Aucun élève dans cette classe</p></div>
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Élève</th>
                  {statusOptions.map((o) => (
                    <th key={o.key} className="text-center text-xs font-semibold text-gray-500 px-2 py-3">{o.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {students.map((s) => (
                  <tr key={s._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.lastName} {s.firstName}</td>
                    {statusOptions.map((opt) => (
                      <td key={opt.key} className="text-center px-2 py-3">
                        <button
                          onClick={() => setRecords({ ...records, [s._id]: opt.key })}
                          className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center transition-all mx-auto',
                            records[s._id] === opt.key ? `${opt.bg} ${opt.color} ring-2 ring-offset-1 ${opt.border}` : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          )}
                        >
                          <opt.icon size={14} />
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? 'Enregistrement...' : 'Enregistrer l\'appel'}
            </button>
            {saved && <span className="text-sm text-green-600 font-medium">✓ Appel enregistré avec succès</span>}
          </div>
        </>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Historique récent</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Date', 'Classe', 'Présents', 'Absents', 'Retards', 'Justifiés'].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {history.map((h) => (
                  <tr key={h._id} className="hover:bg-gray-50 text-sm">
                    <td className="px-4 py-2 text-gray-600">{new Date(h.date).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-2 text-gray-900 font-medium">{h.class?.name || '—'}</td>
                    <td className="px-4 py-2 text-green-600 font-bold">{h.summary?.present || 0}</td>
                    <td className="px-4 py-2 text-red-600 font-bold">{h.summary?.absent || 0}</td>
                    <td className="px-4 py-2 text-orange-500">{h.summary?.late || 0}</td>
                    <td className="px-4 py-2 text-blue-600">{h.summary?.excused || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
