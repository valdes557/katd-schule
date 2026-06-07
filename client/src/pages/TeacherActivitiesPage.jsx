import { useState } from 'react'
import { Plus, Calendar, MapPin, Users, Trash2, Edit2, X, Loader2, Sparkles } from 'lucide-react'
import { teacherApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'

const TYPES = [
  { value: 'sortie', label: 'Sortie scolaire' },
  { value: 'sport', label: 'Sportive' },
  { value: 'culturel', label: 'Culturelle' },
  { value: 'scientifique', label: 'Scientifique' },
  { value: 'artistique', label: 'Artistique' },
  { value: 'social', label: 'Sociale' },
  { value: 'autre', label: 'Autre' },
]

export default function TeacherActivitiesPage() {
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', type: 'autre', date: '', endDate: '', location: '',
    cost: 0, requiresAuthorization: false, class: '',
  })

  const activitiesQ = useCachedFetch('/teacher/activities?', async () => (await teacherApi.activities()).data || [], [])
  const dashboardQ = useCachedFetch('/teacher/dashboard?', async () => {
    const r = await teacherApi.dashboard()
    return r.data?.teacher?.classes || []
  }, [])

  const items = activitiesQ.data || []
  const classes = dashboardQ.data || []
  const loading = activitiesQ.loading

  const refresh = () => { cache.invalidate('/teacher/activities'); activitiesQ.refetch() }

  const open = (act) => {
    if (act) {
      setEditId(act._id)
      setForm({
        title: act.title, description: act.description || '', type: act.type,
        date: act.date ? new Date(act.date).toISOString().slice(0, 10) : '',
        endDate: act.endDate ? new Date(act.endDate).toISOString().slice(0, 10) : '',
        location: act.location || '', cost: act.cost || 0,
        requiresAuthorization: !!act.requiresAuthorization,
        class: act.class?._id || act.class || '',
      })
    } else {
      setEditId(null)
      setForm({ title: '', description: '', type: 'autre', date: '', endDate: '', location: '', cost: 0, requiresAuthorization: false, class: '' })
    }
    setShowForm(true)
  }

  const save = async () => {
    if (!form.title || !form.class || !form.date) return alert('Titre, classe et date sont requis')
    setSaving(true)
    try {
      if (editId) await teacherApi.updateActivity(editId, form)
      else await teacherApi.createActivity(form)
      setShowForm(false)
      refresh()
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const remove = async (id) => {
    if (!confirm('Supprimer cette activité ?')) return
    try { await teacherApi.deleteActivity(id); refresh() } catch (e) { alert(e.message) }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="w-6 h-6 text-purple-600"/>Activités scolaires</h1>
          <p className="text-sm text-gray-500">Créez des activités pour vos classes. Les parents seront notifiés par email.</p>
        </div>
        <button onClick={() => open(null)} className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-purple-700">
          <Plus className="w-4 h-4"/> Nouvelle activité
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-purple-600"/></div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-3"/>
          <p className="text-gray-500">Aucune activité pour le moment</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((a) => (
            <div key={a._id} className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700">{a.type}</span>
                <div className="flex gap-1">
                  <button onClick={() => open(a)} className="p-1.5 hover:bg-gray-100 rounded"><Edit2 className="w-4 h-4 text-gray-600"/></button>
                  <button onClick={() => remove(a._id)} className="p-1.5 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500"/></button>
                </div>
              </div>
              <h3 className="font-bold text-lg mb-1">{a.title}</h3>
              {a.description && <p className="text-sm text-gray-600 mb-3 line-clamp-2">{a.description}</p>}
              <div className="space-y-1 text-sm text-gray-700">
                <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-gray-400"/>{new Date(a.date).toLocaleDateString('fr-FR')}</div>
                {a.location && <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-400"/>{a.location}</div>}
                <div className="flex items-center gap-2"><Users className="w-4 h-4 text-gray-400"/>{a.class?.name || ''}</div>
                {a.cost > 0 && <div className="text-orange-600 font-semibold">Coût: {a.cost} FCFA</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-bold">{editId ? 'Modifier' : 'Nouvelle'} activité</h2>
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
                  <label className="text-sm font-medium">Classe *</label>
                  <select value={form.class} onChange={(e) => setForm({...form, class: e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2">
                    <option value="">— Sélectionner —</option>
                    {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Date *</label>
                  <input type="date" value={form.date} onChange={(e) => setForm({...form, date: e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2"/>
                </div>
                <div>
                  <label className="text-sm font-medium">Date de fin</label>
                  <input type="date" value={form.endDate} onChange={(e) => setForm({...form, endDate: e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2"/>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Lieu</label>
                <input value={form.location} onChange={(e) => setForm({...form, location: e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Coût (FCFA)</label>
                  <input type="number" value={form.cost} onChange={(e) => setForm({...form, cost: Number(e.target.value)})} className="mt-1 w-full border rounded-lg px-3 py-2"/>
                </div>
                <label className="flex items-center gap-2 mt-6">
                  <input type="checkbox" checked={form.requiresAuthorization} onChange={(e) => setForm({...form, requiresAuthorization: e.target.checked})}/>
                  <span className="text-sm">Autorisation parentale requise</span>
                </label>
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} rows={3} className="mt-1 w-full border rounded-lg px-3 py-2"/>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg">Annuler</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 bg-purple-600 text-white rounded-lg flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin"/>} Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
