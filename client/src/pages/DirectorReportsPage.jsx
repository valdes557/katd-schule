import { useEffect, useState } from 'react'
import { dashboardApi, classesApi, teachersApi } from '../lib/api'
import { FileText, Filter, Loader2 } from 'lucide-react'

export default function DirectorReportsPage() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ classId: '', teacherId: '' })
  const [classes, setClasses] = useState([])
  const [teachers, setTeachers] = useState([])

  const loadData = async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (filters.classId) qs.set('classId', filters.classId)
      if (filters.teacherId) qs.set('teacherId', filters.teacherId)
      const res = await dashboardApi.getReports(qs.toString())
      setReports(res.data || [])
    } catch (_) {}
    setLoading(false)
  }

  const loadFilters = async () => {
    try {
      const [cRes, tRes] = await Promise.all([classesApi.list(), teachersApi.list()])
      setClasses(cRes.data || [])
      setTeachers(tRes.data || [])
    } catch (_) {}
  }

  useEffect(() => { loadFilters() }, [])
  useEffect(() => { loadData() }, [filters])

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText size={20} className="text-blue-600" /> Rapports des enseignants
          </h1>
          <p className="text-sm text-gray-500">Vue consolidée des rapports quotidiens envoyés</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex items-center gap-2 text-gray-500 text-sm font-medium"><Filter size={14} /> Filtres</div>
        <div className="flex gap-2 flex-1 flex-wrap">
          <div>
            <label className="text-xs text-gray-600">Classe</label>
            <select value={filters.classId} onChange={(e) => setFilters({ ...filters, classId: e.target.value })} className="input text-sm mt-1 w-56">
              <option value="">Toutes</option>
              {classes.map((c) => <option key={c._id} value={c._id}>{c.name}{c.level ? ` (${c.level})` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600">Enseignant</label>
            <select value={filters.teacherId} onChange={(e) => setFilters({ ...filters, teacherId: e.target.value })} className="input text-sm mt-1 w-56">
              <option value="">Tous</option>
              {teachers.map((t) => <option key={t._id} value={t._id}>{t.lastName} {t.firstName}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="card overflow-x-auto">
        {loading ? (
          <div className="text-center py-10"><Loader2 size={22} className="animate-spin text-blue-600" /></div>
        ) : reports.length === 0 ? (
          <div className="text-center py-10 text-gray-400">Aucun rapport trouvé</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Date', 'Enseignant', 'Classes', 'Titre', 'Extrait'].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {reports.map((r) => (
                <tr key={r._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-600">{new Date(r.date).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-3 text-xs text-gray-900">{r.teacher ? `${r.teacher.lastName} ${r.teacher.firstName}` : '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{(r.classes || []).map((c) => c.name || c).join(', ')}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{r.title || 'Rapport'}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-[420px] truncate">{r.content}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
