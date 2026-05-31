import { useEffect, useState } from 'react'
import { dashboardApi, classesApi, teachersApi } from '../lib/api'
import { FileText, Filter, Loader2, CheckCircle2, Clock } from 'lucide-react'

export default function DirectorReportsPage() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ classId: '', teacherId: '', status: '' })
  const [classes, setClasses] = useState([])
  const [teachers, setTeachers] = useState([])
  const [processing, setProcessing] = useState(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (filters.classId) qs.set('classId', filters.classId)
      if (filters.teacherId) qs.set('teacherId', filters.teacherId)
      if (filters.status) qs.set('status', filters.status)
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

  const toggleReview = async (rep) => {
    setProcessing(rep._id)
    try {
      if (rep.status === 'reviewed') {
        const res = await dashboardApi.unreviewReport(rep._id)
        setReports((prev) => prev.map((r) => r._id === rep._id ? res.data : r))
      } else {
        const res = await dashboardApi.reviewReport(rep._id)
        setReports((prev) => prev.map((r) => r._id === rep._id ? res.data : r))
      }
    } catch (_) {}
    setProcessing(null)
  }

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
          <div>
            <label className="text-xs text-gray-600">Statut</label>
            <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="input text-sm mt-1 w-44">
              <option value="">Tous</option>
              <option value="submitted">Soumis</option>
              <option value="reviewed">Revu</option>
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
                {['Date', 'Enseignant', 'Classes', 'Titre', 'Extrait', 'Statut', ''].map((h) => (
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
                  <td className="px-4 py-3">
                    {r.status === 'reviewed' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200"><CheckCircle2 size={12} /> Revu</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200"><Clock size={12} /> Soumis</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggleReview(r)}
                      disabled={processing === r._id}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${r.status === 'reviewed' ? 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50' : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'}`}
                    >
                      {processing === r._id ? <Loader2 size={12} className="animate-spin inline" /> : null}
                      {processing === r._id ? ' ' : ''}
                      {r.status === 'reviewed' ? 'Annuler' : 'Marquer revu'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
