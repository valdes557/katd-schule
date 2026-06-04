import { useEffect, useState } from 'react'
import { teacherApi } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Loader2, FileText, Plus, Check, Eye, X } from 'lucide-react'

export default function TeacherReportsPage() {
  const { user } = useAuth()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ classes: [], title: '', content: '', attachment: null })
  const [sending, setSending] = useState(false)
  const [teacherClasses, setTeacherClasses] = useState([])
  const [viewReport, setViewReport] = useState(null)
  const [editReport, setEditReport] = useState(null)
  const [editForm, setEditForm] = useState({ title: '', content: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const fetchReports = async () => {
    setLoading(true)
    try { const res = await teacherApi.reports(); setReports(res.data || []) } catch (err) { console.error(err) }
    setLoading(false)
  }

  const openEdit = (r) => {
    setEditReport(r)
    setEditForm({
      title: r.title || '',
      content: r.content || '',
    })
  }

  const handleEditSave = async (e) => {
    e.preventDefault()
    if (!editForm.content.trim()) return
    if (!editReport) return
    setSavingEdit(true)
    try {
      const res = await teacherApi.updateReport(editReport._id, {
        title: editForm.title,
        content: editForm.content,
      })
      if (res.success) {
        setReports((prev) => prev.map((r) => (r._id === res.data._id ? res.data : r)))
        setEditReport(null)
      }
    } catch (err) {
      alert(err.message)
    }
    setSavingEdit(false)
  }

  const handleDelete = async (r) => {
    if (!window.confirm('Supprimer ce rapport ?')) return
    setDeletingId(r._id)
    try {
      const res = await teacherApi.deleteReport(r._id)
      if (res.success) {
        setReports((prev) => prev.filter((x) => x._id !== r._id))
      }
    } catch (err) {
      alert(err.message)
    }
    setDeletingId(null)
  }

  useEffect(() => { fetchReports(); loadClasses() }, [])

  const loadClasses = async () => {
    try {
      const res = await teacherApi.dashboard()
      const classes = res?.data?.teacher?.classes || []
      setTeacherClasses(classes)
    } catch (err) { console.error(err) }
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
        setForm({ classes: [], title: '', content: '', attachment: null })
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
          <label className="text-xs font-medium text-gray-600">Pièce jointe PDF (optionnel)</label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setForm({ ...form, attachment: e.target.files?.[0] || null })}
            className="mt-1 block w-full text-xs text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-gray-200 file:text-xs file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100"
          />
          {form.attachment && (
            <p className="text-[11px] text-gray-500 mt-0.5">Fichier sélectionné : {form.attachment.name}</p>
          )}
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
                {['Date', 'Titre', 'Classes', 'Statut', 'Actions'].map((h) => (
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
                  <td className="px-4 py-3 text-xs text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => setViewReport(r)}
                      className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                    >
                      <Eye size={12} /> Voir
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(r)}
                      className="inline-flex items-center gap-1 text-gray-600 hover:underline"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(r)}
                      disabled={deletingId === r._id}
                      className="inline-flex items-center gap-1 text-red-600 hover:underline"
                    >
                      {deletingId === r._id ? 'Suppression…' : 'Supprimer'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* View modal */}
      {viewReport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <FileText size={16} className="text-blue-600" /> {viewReport.title || 'Rapport'}
                </h3>
                <p className="text-[11px] text-gray-500">
                  {new Date(viewReport.date).toLocaleDateString('fr-FR')} · {(viewReport.classes || []).map((c) => c.name || c).join(', ')}
                </p>
              </div>
              <button onClick={() => setViewReport(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto text-sm text-gray-800 whitespace-pre-line">
              {viewReport.content}
              {viewReport.attachmentUrl && (
                <div className="mt-4 text-xs">
                  <a
                    href={viewReport.attachmentUrl.startsWith('http') ? viewReport.attachmentUrl : `${import.meta.env.VITE_API_URL || ''}${viewReport.attachmentUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    <Eye size={12} /> Ouvrir le PDF joint{viewReport.attachmentName ? ` (${viewReport.attachmentName})` : ''}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editReport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <FileText size={16} className="text-blue-600" /> Modifier le rapport
              </h3>
              <button onClick={() => setEditReport(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleEditSave} className="p-5 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Titre</label>
                <input
                  value={editForm.title}
                  onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                  className="input text-sm mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Contenu du rapport *</label>
                <textarea
                  rows={5}
                  value={editForm.content}
                  onChange={(e) => setEditForm((f) => ({ ...f, content: e.target.value }))}
                  className="input text-sm mt-1 resize-y"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditReport(null)} className="btn-ghost border border-gray-200 text-sm px-4">
                  Annuler
                </button>
                <button type="submit" disabled={savingEdit || !editForm.content.trim()} className="btn-primary text-sm px-4">
                  {savingEdit ? <Loader2 size={14} className="animate-spin" /> : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
