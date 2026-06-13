import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { announcementsApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'
import { Loader2, Bell, Plus, Trash2, X, Users, GraduationCap, UserCheck } from 'lucide-react'

const AUDIENCES = [
  { value: 'all', label: 'Tous (parents & enseignants)', icon: Users, color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'parents', label: 'Parents uniquement', icon: GraduationCap, color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'teachers', label: 'Enseignants uniquement', icon: UserCheck, color: 'bg-teal-50 text-teal-700 border-teal-200' },
]
const AUDIENCE_META = Object.fromEntries(AUDIENCES.map((a) => [a.value, a]))

export default function AnnoncesPage() {
  const { user } = useAuth()
  const isDirector = user?.role === 'directeur'

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', audience: 'all' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const annQ = useCachedFetch('/announcements', async () => (await announcementsApi.list()).data || [], [])
  const announcements = annQ.data || []
  const loading = annQ.loading

  const refresh = () => { cache.invalidate('/announcements'); annQ.refetch() }

  const openCreate = () => { setForm({ title: '', content: '', audience: 'all' }); setError(''); setModalOpen(true) }

  const handleCreate = async () => {
    if (!form.content.trim()) { setError("Le contenu de l'annonce est requis"); return }
    setSaving(true); setError('')
    try {
      await announcementsApi.create(form)
      refresh(); setModalOpen(false)
    } catch (err) { setError(err.message) }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!isDirector || !window.confirm('Supprimer cette annonce ?')) return
    try { await announcementsApi.remove(id); refresh() } catch (err) { alert(err.message) }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Bell size={22} className="text-indigo-600" /> Annonces de l'école</h1>
          <p className="text-sm text-gray-500">{isDirector ? 'Publiez des annonces officielles pour les parents et/ou les enseignants' : 'Annonces publiées par la direction'}</p>
        </div>
        {isDirector && (
          <button onClick={openCreate} className="btn-primary text-sm self-start"><Plus size={15} /> Ajouter une annonce</button>
        )}
      </div>

      <div className="card p-5">
        {loading ? (
          <div className="py-12 text-center"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div>
        ) : announcements.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Aucune annonce publiée pour le moment.</p>
        ) : (
          <div className="space-y-4">
            {announcements.map((a) => {
              const meta = AUDIENCE_META[a.audience] || AUDIENCE_META.all
              return (
                <div key={a._id} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm font-semibold text-gray-900">{a.title || 'Annonce'}</h2>
                        {isDirector && (
                          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${meta.color}`}>
                            <meta.icon size={10} /> {meta.value === 'all' ? 'Tous' : meta.value === 'parents' ? 'Parents' : 'Enseignants'}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400">{new Date(a.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    </div>
                    {isDirector && (
                      <button type="button" onClick={() => handleDelete(a._id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 flex-shrink-0"><Trash2 size={14} /></button>
                    )}
                  </div>
                  <p className="text-xs text-gray-700 mt-1 whitespace-pre-line">{a.content}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal de création (directeur) */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Nouvelle annonce</h3>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3">
              {error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
              <div>
                <label className="text-xs font-medium text-gray-600">Destinataires</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
                  {AUDIENCES.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm({ ...form, audience: opt.value })}
                      className={`flex items-center gap-2 text-xs py-2 px-3 rounded-xl border transition-colors ${form.audience === opt.value ? opt.color + ' font-semibold' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                      <opt.icon size={14} /> {opt.value === 'all' ? 'Tous' : opt.value === 'parents' ? 'Parents' : 'Enseignants'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Titre (optionnel)</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input text-sm mt-1 w-full" placeholder="Ex: Réunion de rentrée" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Contenu *</label>
                <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={4} className="input text-sm mt-1 w-full resize-none" placeholder="Votre annonce..." />
              </div>
            </div>
            <div className="flex gap-2 px-5 py-3 border-t border-gray-100">
              <button onClick={() => setModalOpen(false)} className="flex-1 justify-center border border-gray-200 rounded-lg px-3 py-2 text-sm hover:bg-gray-50">Annuler</button>
              <button disabled={saving} onClick={handleCreate} className="btn-primary flex-1 justify-center text-sm">{saving ? <Loader2 size={14} className="animate-spin" /> : 'Publier'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
