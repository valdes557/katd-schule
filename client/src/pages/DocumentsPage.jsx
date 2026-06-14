import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { documentsApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'
import { Loader2, FolderOpen, Plus, Trash2, X, Download, FileText } from 'lucide-react'

const ROLE_LABEL = { directeur: 'Direction', enseignant: 'Enseignant', super_admin: 'Admin' }

function humanSize(bytes) {
  if (!bytes) return ''
  const units = ['o', 'Ko', 'Mo', 'Go']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

export default function DocumentsPage() {
  const { user } = useAuth()
  const canUpload = ['directeur', 'enseignant', 'super_admin'].includes(user?.role)

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', category: 'Général', file: null })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const docsQ = useCachedFetch('/documents', async () => (await documentsApi.list()).data || [], [])
  const documents = docsQ.data || []
  const loading = docsQ.loading

  const refresh = () => { cache.invalidate('/documents'); docsQ.refetch() }

  const openCreate = () => {
    setForm({ title: '', description: '', category: 'Général', file: null })
    setError('')
    setModalOpen(true)
  }

  const handleUpload = async () => {
    if (!form.title.trim()) { setError('Le titre est requis'); return }
    if (!form.file) { setError('Veuillez choisir un fichier'); return }
    setSaving(true); setError('')
    try {
      await documentsApi.upload(form)
      refresh(); setModalOpen(false)
    } catch (err) { setError(err.message) }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce document ?')) return
    try { await documentsApi.remove(id); refresh() } catch (err) { alert(err.message) }
  }

  const canDelete = (d) =>
    ['directeur', 'super_admin'].includes(user?.role) ||
    d.uploadedBy?._id === user?._id || d.uploadedBy === user?._id

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><FolderOpen size={22} className="text-indigo-600" /> Documents partagés</h1>
          <p className="text-sm text-gray-500">{canUpload ? 'Partagez épreuves et documentations avec les membres de l\'école' : 'Documents et épreuves partagés par l\'école'}</p>
        </div>
        {canUpload && (
          <button onClick={openCreate} className="btn-primary text-sm self-start"><Plus size={15} /> Ajouter un document</button>
        )}
      </div>

      {loading ? (
        <div className="py-12 text-center"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div>
      ) : documents.length === 0 ? (
        <div className="card p-5"><p className="text-sm text-gray-400 text-center py-6">Aucun document partagé pour le moment.</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((d) => (
            <div key={d._id} className="card p-4 flex flex-col">
              <div className="flex items-start justify-between mb-2">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0"><FileText size={18} className="text-indigo-600" /></div>
                {canDelete(d) && (
                  <button onClick={() => handleDelete(d._id)} className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 size={14} /></button>
                )}
              </div>
              <h3 className="text-sm font-bold text-gray-900 line-clamp-2">{d.title}</h3>
              {d.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{d.description}</p>}
              <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[10px]">
                <span className="badge badge-blue">{d.category}</span>
                {d.class?.name && <span className="badge bg-purple-50 text-purple-600">{d.class.name}</span>}
                {d.fileSize > 0 && <span className="text-gray-400">{humanSize(d.fileSize)}</span>}
              </div>
              <div className="text-[10px] text-gray-400 mt-2">
                {ROLE_LABEL[d.uploadedBy?.role] || d.uploadedBy?.name || ''} · {new Date(d.createdAt).toLocaleDateString('fr-FR')}
              </div>
              <a href={d.fileUrl} target="_blank" rel="noreferrer" download className="btn-ghost text-sm border border-gray-200 justify-center mt-3">
                <Download size={14} /> Télécharger
              </a>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Nouveau document</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Titre *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input text-sm mt-1" placeholder="Ex: Épreuve de Maths - Trimestre 1" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Catégorie</label>
                <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input text-sm mt-1" placeholder="Ex: Épreuves, Documentation…" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="input text-sm mt-1 resize-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Fichier *</label>
                <input
                  type="file"
                  onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })}
                  className="block w-full text-xs mt-1 text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
                {form.file && <p className="text-[10px] text-gray-400 mt-1">{form.file.name} · {humanSize(form.file.size)}</p>}
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost flex-1 justify-center border border-gray-200">Annuler</button>
                <button onClick={handleUpload} disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Publier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
