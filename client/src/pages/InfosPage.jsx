import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { eventsApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'
import { Loader2, CalendarDays, Plus, Trash2, X, MapPin, Users, GraduationCap, UserCheck } from 'lucide-react'

const TYPES = [
  { value: 'reunion', label: 'Réunion' },
  { value: 'ceremonie', label: 'Cérémonie' },
  { value: 'examen', label: 'Examen' },
  { value: 'sortie', label: 'Sortie' },
  { value: 'autre', label: 'Autre' },
]
const TYPE_LABEL = Object.fromEntries(TYPES.map((t) => [t.value, t.label]))

const TYPE_COLOR = {
  reunion: 'bg-blue-50 text-blue-700 border-blue-200',
  ceremonie: 'bg-purple-50 text-purple-700 border-purple-200',
  examen: 'bg-amber-50 text-amber-700 border-amber-200',
  sortie: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  autre: 'bg-gray-50 text-gray-600 border-gray-200',
}

const AUDIENCES = [
  { value: 'all', label: 'Tous', icon: Users },
  { value: 'parents', label: 'Parents', icon: GraduationCap },
  { value: 'teachers', label: 'Enseignants', icon: UserCheck },
]
const AUDIENCE_LABEL = Object.fromEntries(AUDIENCES.map((a) => [a.value, a.label]))

function fmtDate(d) {
  return new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtTime(d) {
  const dt = new Date(d)
  const h = dt.getHours(); const m = dt.getMinutes()
  if (h === 0 && m === 0) return ''
  return dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function InfosPage() {
  const { user } = useAuth()
  const isDirector = ['directeur', 'super_admin'].includes(user?.role)

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', type: 'reunion', startDate: '', endDate: '', location: '', audience: 'all' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const evQ = useCachedFetch('/events', async () => (await eventsApi.list()).data || [], [])
  const events = evQ.data || []
  const loading = evQ.loading

  const refresh = () => { cache.invalidate('/events'); evQ.refetch() }

  const now = Date.now()
  const upcoming = events.filter((e) => new Date(e.endDate || e.startDate).getTime() >= now)
  const past = events.filter((e) => new Date(e.endDate || e.startDate).getTime() < now)

  const openCreate = () => {
    setForm({ title: '', description: '', type: 'reunion', startDate: '', endDate: '', location: '', audience: 'all' })
    setError('')
    setModalOpen(true)
  }

  const handleCreate = async () => {
    if (!form.title.trim()) { setError('Le titre est requis'); return }
    if (!form.startDate) { setError('La date de début est requise'); return }
    setSaving(true); setError('')
    try {
      await eventsApi.create(form)
      refresh(); setModalOpen(false)
    } catch (err) { setError(err.message) }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!isDirector || !window.confirm('Supprimer cet évènement ?')) return
    try { await eventsApi.remove(id); refresh() } catch (err) { alert(err.message) }
  }

  const EventCard = ({ e, faded }) => (
    <div className={`card p-4 ${faded ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-indigo-50 text-indigo-700 flex-shrink-0">
            <span className="text-base font-bold leading-none">{new Date(e.startDate).getDate()}</span>
            <span className="text-[10px] uppercase">{new Date(e.startDate).toLocaleDateString('fr-FR', { month: 'short' })}</span>
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-900">{e.title}</h3>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${TYPE_COLOR[e.type] || TYPE_COLOR.autre}`}>{TYPE_LABEL[e.type]}</span>
              {isDirector && <span className="text-[10px] px-2 py-0.5 rounded-full border bg-gray-50 text-gray-500 border-gray-200">{AUDIENCE_LABEL[e.audience]}</span>}
            </div>
          </div>
        </div>
        {isDirector && (
          <button onClick={() => handleDelete(e._id)} className="p-1.5 rounded hover:bg-red-50 text-red-500 flex-shrink-0"><Trash2 size={14} /></button>
        )}
      </div>
      {e.description && <p className="text-xs text-gray-600 mt-2 whitespace-pre-line">{e.description}</p>}
      <div className="mt-2 space-y-0.5 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <CalendarDays size={12} />
          {fmtDate(e.startDate)}{fmtTime(e.startDate) ? ` à ${fmtTime(e.startDate)}` : ''}
          {e.endDate ? ` → ${fmtDate(e.endDate)}${fmtTime(e.endDate) ? ` ${fmtTime(e.endDate)}` : ''}` : ''}
        </div>
        {e.location && <div className="flex items-center gap-1.5"><MapPin size={12} /> {e.location}</div>}
      </div>
    </div>
  )

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><CalendarDays size={22} className="text-indigo-600" /> Informations générales</h1>
          <p className="text-sm text-gray-500">{isDirector ? 'Publiez les évènements de l\'école (réunions, cérémonies…)' : 'Évènements et informations publiés par l\'école'}</p>
        </div>
        {isDirector && (
          <button onClick={openCreate} className="btn-primary text-sm self-start"><Plus size={15} /> Ajouter un évènement</button>
        )}
      </div>

      {loading ? (
        <div className="py-12 text-center"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div>
      ) : events.length === 0 ? (
        <div className="card p-5"><p className="text-sm text-gray-400 text-center py-6">Aucun évènement publié pour le moment.</p></div>
      ) : (
        <div className="space-y-5">
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold tracking-wider text-gray-400 uppercase mb-3">À venir</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcoming.map((e) => <EventCard key={e._id} e={e} />)}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold tracking-wider text-gray-400 uppercase mb-3">Passés</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {past.map((e) => <EventCard key={e._id} e={e} faded />)}
              </div>
            </div>
          )}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Nouvel évènement</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Titre *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input text-sm mt-1" placeholder="Ex: Réunion de rentrée" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input text-sm mt-1">
                    {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Audience</label>
                  <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} className="input text-sm mt-1">
                    {AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Début *</label>
                  <input type="datetime-local" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="input text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Fin (optionnel)</label>
                  <input type="datetime-local" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="input text-sm mt-1" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Lieu</label>
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="input text-sm mt-1" placeholder="Ex: Salle polyvalente" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="input text-sm mt-1 resize-none" />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost flex-1 justify-center border border-gray-200">Annuler</button>
                <button onClick={handleCreate} disabled={saving} className="btn-primary flex-1 justify-center">
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
