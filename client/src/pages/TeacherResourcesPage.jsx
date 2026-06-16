import { useState } from 'react'
import { Plus, BookOpen, Trash2, Edit2, X, Loader2 } from 'lucide-react'
import { teacherApi, classesApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'
import { useAuth } from '../context/AuthContext'
import ResourcePreview from '../components/ResourcePreview'

const TYPES = [
  { value: 'document', label: 'Document' },
  { value: 'pdf', label: 'PDF' },
  { value: 'video', label: 'Vidéo' },
  { value: 'audio', label: 'Audio' },
  { value: 'link', label: 'Lien web' },
  { value: 'image', label: 'Image' },
]

export default function TeacherResourcesPage() {
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', type: 'document', category: 'Général',
    subject: '', url: '', classes: [],
  })

  const { user, school } = useAuth()
  const isDirector = user?.role === 'directeur' || user?.role === 'super_admin'
  const subscribedCycle = user?.role === 'directeur' && school?.subscription?.cycle ? school.subscription.cycle : ''

  const resourcesQ = useCachedFetch('/teacher/resources?', async () => (await teacherApi.resources()).data || [], [])
  // Classes : directeur → toutes les classes de l'école (cache partagé) ; enseignant → ses classes
  const classesQ = useCachedFetch(
    isDirector ? `/classes?${subscribedCycle ? `cycle=${subscribedCycle}` : ''}` : '/teacher/dashboard?',
    async () => isDirector
      ? (await classesApi.list(subscribedCycle ? `cycle=${subscribedCycle}` : '')).data || []
      : (await teacherApi.dashboard()).data?.teacher?.classes || [],
    [isDirector, subscribedCycle],
  )

  const items = resourcesQ.data || []
  const classes = classesQ.data || []
  const loading = resourcesQ.loading

  const refresh = () => { cache.invalidate('/teacher/resources'); resourcesQ.refetch() }

  const open = (r) => {
    if (r) {
      setEditId(r._id)
      setForm({
        title: r.title, description: r.description || '', type: r.type,
        category: r.category || 'Général', subject: r.subject || '',
        url: r.url || '', classes: (r.classes || []).map((c) => c._id || c),
      })
    } else {
      setEditId(null)
      setForm({ title: '', description: '', type: 'document', category: 'Général', subject: '', url: '', classes: [] })
    }
    setShowForm(true)
  }

  const toggleClass = (id) => {
    setForm((f) => ({
      ...f,
      classes: f.classes.includes(id) ? f.classes.filter((c) => c !== id) : [...f.classes, id],
    }))
  }

  const save = async () => {
    if (!form.title || form.classes.length === 0) return alert('Titre et au moins une classe requis')
    setSaving(true)
    try {
      if (editId) await teacherApi.updateResource(editId, form)
      else await teacherApi.createResource(form)
      setShowForm(false)
      refresh()
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const remove = async (id) => {
    if (!confirm('Supprimer cette ressource ?')) return
    try { await teacherApi.deleteResource(id); refresh() } catch (e) { alert(e.message) }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="w-6 h-6 text-emerald-600"/>Ressources pédagogiques</h1>
          <p className="text-sm text-gray-500">Partagez documents, liens et médias avec vos classes. Visibles par les parents.</p>
        </div>
        <button onClick={() => open(null)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-emerald-700">
          <Plus className="w-4 h-4"/> Nouvelle ressource
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-600"/></div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3"/>
          <p className="text-gray-500">Aucune ressource pour le moment</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((r) => (
            <div key={r._id} className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-700">{r.type}</span>
                <div className="flex gap-1">
                  <button onClick={() => open(r)} className="p-1.5 hover:bg-gray-100 rounded"><Edit2 className="w-4 h-4 text-gray-600"/></button>
                  <button onClick={() => remove(r._id)} className="p-1.5 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500"/></button>
                </div>
              </div>
              <h3 className="font-bold text-lg mb-1">{r.title}</h3>
              {r.subject && <p className="text-xs text-gray-500 mb-1">{r.subject} · {r.category}</p>}
              {r.description && <p className="text-sm text-gray-600 mb-3 line-clamp-2">{r.description}</p>}
              <div className="flex flex-wrap gap-1 mb-2">
                {(r.classes || []).map((c) => <span key={c._id || c} className="text-xs px-2 py-0.5 bg-gray-100 rounded">{c.name || ''}</span>)}
              </div>
              <ResourcePreview type={r.type} url={r.url} title={r.title} />
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-bold">{editId ? 'Modifier' : 'Nouvelle'} ressource</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-sm font-medium">Titre *</label>
                <input value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Type</label>
                  <select value={form.type} onChange={(e) => setForm({...form, type: e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2">
                    {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Catégorie</label>
                  <input value={form.category} onChange={(e) => setForm({...form, category: e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2"/>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Matière</label>
                <input value={form.subject} onChange={(e) => setForm({...form, subject: e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2"/>
              </div>
              <div>
                <label className="text-sm font-medium">URL (lien, fichier...)</label>
                <input value={form.url} onChange={(e) => setForm({...form, url: e.target.value})} placeholder="https://..." className="mt-1 w-full border rounded-lg px-3 py-2"/>
              </div>
              <div>
                <label className="text-sm font-medium">Classes destinataires *</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {classes.map((c) => (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => toggleClass(c._id)}
                      className={`px-3 py-1.5 rounded-full text-sm border ${form.classes.includes(c._id) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-700'}`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} rows={3} className="mt-1 w-full border rounded-lg px-3 py-2"/>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg">Annuler</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 bg-emerald-600 text-white rounded-lg flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin"/>} Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
