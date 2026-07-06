import { useEffect, useState } from 'react'
import {
  GraduationCap, Plus, Trash2, Edit2, X, Loader2, Upload,
  CheckCircle2, BookOpen, MapPin, Clock, DollarSign, MessageCircle, Mail,
} from 'lucide-react'
import { tutoringApi } from '../lib/api'

const EMPTY = { title: '', subjects: '', price: '', description: '', contactWhatsapp: '', contactEmail: '', location: '', schedule: '', status: 'published', photo: null }

export default function TutoringPage() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState('')

  const load = async () => {
    setLoading(true)
    try { const r = await tutoringApi.list(); setPosts(r.data || []) } catch (_) {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openCreate = () => { setEditing(null); setForm(EMPTY); setPreview(''); setShowModal(true) }
  const openEdit = (p) => {
    setEditing(p)
    setForm({
      title: p.title || '', subjects: p.subjects || '', price: p.price || '', description: p.description || '',
      contactWhatsapp: p.contactWhatsapp || '', contactEmail: p.contactEmail || '', location: p.location || '',
      schedule: p.schedule || '', status: p.status || 'published', photo: null,
    })
    setPreview(p.photo || '')
    setShowModal(true)
  }

  const onPickPhoto = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setForm((prev) => ({ ...prev, photo: f }))
    setPreview(URL.createObjectURL(f))
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const r = editing ? await tutoringApi.update(editing._id, form) : await tutoringApi.create(form)
      if (r.success) { setShowModal(false); load() } else alert(r.message || 'Erreur')
    } catch (err) { alert(err.message) }
    setSaving(false)
  }

  const remove = async (id) => {
    if (!confirm('Supprimer cette annonce de répétition ?')) return
    try { await tutoringApi.remove(id); load() } catch (err) { alert(err.message) }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><GraduationCap size={22} className="text-indigo-600" /> Gestion des répétitions</h1>
          <p className="text-sm text-gray-500">Publiez vos cours de répétition — visibles dans les News de toute la plateforme</p>
        </div>
        <button onClick={openCreate} className="btn-primary text-sm self-start"><Plus size={15} /> Nouvelle annonce</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-indigo-600" /></div>
      ) : posts.length === 0 ? (
        <div className="text-center py-14 text-gray-400">
          <GraduationCap size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucune annonce. Cliquez sur « Nouvelle annonce ».</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {posts.map((p) => (
            <div key={p._id} className="card overflow-hidden">
              {p.photo && <img src={p.photo} alt="" className="w-full h-40 object-cover" />}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900">{p.title}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${p.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {p.status === 'published' ? 'Publiée' : 'Clôturée'}
                      </span>
                    </div>
                    {p.subjects && <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1"><BookOpen size={12} /> {p.subjects}</p>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(p)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"><Edit2 size={15} /></button>
                    <button onClick={() => remove(p._id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 size={15} /></button>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-2 line-clamp-2">{p.description}</p>
                <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-400">
                  {p.price && <span className="flex items-center gap-1"><DollarSign size={12} /> {p.price}</span>}
                  {p.location && <span className="flex items-center gap-1"><MapPin size={12} /> {p.location}</span>}
                  {p.schedule && <span className="flex items-center gap-1"><Clock size={12} /> {p.schedule}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">{editing ? 'Modifier l\'annonce' : 'Nouvelle annonce de répétition'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
            </div>
            <form onSubmit={save} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Titre *</label>
                <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input text-sm mt-1 w-full" placeholder="Cours de répétition — Mathématiques & Physique" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Matières</label>
                  <input value={form.subjects} onChange={(e) => setForm({ ...form, subjects: e.target.value })} className="input text-sm mt-1 w-full" placeholder="Maths, Physique" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Prix / tarif</label>
                  <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="input text-sm mt-1 w-full" placeholder="5000 F CFA / séance" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Lieu</label>
                  <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="input text-sm mt-1 w-full" placeholder="À domicile / quartier" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Horaires / jours</label>
                  <input value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })} className="input text-sm mt-1 w-full" placeholder="Sam. & Dim. 15h-17h" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Contact WhatsApp</label>
                  <input value={form.contactWhatsapp} onChange={(e) => setForm({ ...form, contactWhatsapp: e.target.value })} className="input text-sm mt-1 w-full" placeholder="+237 6XX XXX XXX" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Contact email</label>
                  <input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} className="input text-sm mt-1 w-full" placeholder="vous@email.com" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Description *</label>
                <textarea required rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input text-sm mt-1 w-full" placeholder="Détails des répétitions, niveau, méthode, autres informations..." />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Photo de l'annonce</label>
                <label className="mt-1 flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 text-sm text-gray-500">
                  <Upload size={15} />
                  <span className="truncate">{form.photo ? form.photo.name : 'Choisir une image...'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
                </label>
                {preview && <img src={preview} alt="" className="mt-2 w-full h-40 object-cover rounded-lg" />}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Statut</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input text-sm mt-1 w-full">
                  <option value="published">Publiée (visible dans les News)</option>
                  <option value="closed">Clôturée (masquée)</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost flex-1 justify-center border border-gray-200">Annuler</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} {editing ? 'Enregistrer' : 'Publier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
