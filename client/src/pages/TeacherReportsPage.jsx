import { useEffect, useState } from 'react'
import { teacherApi } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Loader2, FileText, Plus, Check } from 'lucide-react'

export default function TeacherReportsPage() {
  const { user } = useAuth()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ classes: [], title: '', content: '' })
  const [sending, setSending] = useState(false)
  const [teacherClasses, setTeacherClasses] = useState([])

  const fetchReports = async () => {
    setLoading(true)
    try { const res = await teacherApi.reports(); setReports(res.data || []) } catch (e) {}
    setLoading(false)
  }

  useEffect(() => { fetchReports(); loadClasses() }, [])

  const loadClasses = async () => {
    try {
      const res = await teacherApi.dashboard()
      const classes = res?.data?.teacher?.classes || []
      setTeacherClasses(classes)
    } catch (_) {}
  }

  const toggleClass = (id) => {
    setForm((f) => ({ ...f, classes: f.classes.includes(id) ? f.classes.filter((x) => x !== id) : [...f.classes, id] }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.content.trim() || form.classes.length === 0) return
    setSending(true)
    try {
      const res = await teacherApi.createReport({ ...form })
      if (res.success) {
        setForm({ classes: [], title: '', content: '' })
        fetchReports()
      }
    } catch (e) { alert(e.message) }
    setSending(false)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText size={20} className="text-blue-600" /> Rapports quotidiens
          </h1>
          <p className="text-sm text-gray-500">Envoyez votre rapport de fin de journée à la direction</p>
        </div>
      </div>

      {/* Compose */}
      <form onSubmit={handleSubmit} className="card p-4 space-y-3">
        <div>
          <label className="text-xs font-medium text-gray-600">Titre (optionnel)</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input text-sm mt-1" placeholder="Ex: Rapport du 31/05" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Contenu du rapport *</label>
          <textarea rows={5} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="input text-sm mt-1 resize-y" placeholder="Résumé des activités, présence, devoirs, incidents, etc." />
          <p className="text-[11px] text-gray-400 mt-1">N’indiquez aucune donnée sensible.</p>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Classes concernées *</label>
          {teacherClasses.length === 0 ? (
            <p className="text-[11px] text-gray-400 mt-1">Aucune classe attribuée</p>
          ) : (
            <div className="flex flex-wrap gap-2 mt-1">
              {teacherClasses.map((c) => (
                <label key={c._id} className={`text-xs px-2 py-1 rounded-lg border ${form.classes.includes(c._id) ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-600'} cursor-pointer`}> 
                  <input type="checkbox" className="mr-1 accent-blue-600" checked={form.classes.includes(c._id)} onChange={() => toggleClass(c._id)} />
                  {c.name} {c.level ? `(${c.level})` : ''}
                </label>
              ))}
            </div>
          )}
        </div>
        <button type="submit" disabled={sending || !form.content.trim() || form.classes.length === 0} className="btn-primary self-start text-sm">
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Envoyer le rapport
        </button>
      </form>

      {/* List */}
      <div className="card overflow-x-auto">
        {loading ? (
          <div className="text-center py-10"><Loader2 size={22} className="animate-spin text-blue-600" /></div>
        ) : reports.length === 0 ? (
          <div className="text-center py-10 text-gray-400">Aucun rapport envoyé</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Date', 'Titre', 'Classes', 'Statut'].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {reports.map((r) => (
                <tr key={r._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-600">{new Date(r.date).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{r.title || 'Rapport'}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{(r.classes || []).map((c) => c.name || c).join(', ')}</td>
                  <td className="px-4 py-3 text-xs text-green-700 flex items-center gap-1">{r.status === 'submitted' ? <><Check size={12} /> Envoyé</> : r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
