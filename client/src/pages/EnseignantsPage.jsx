import { useEffect, useState } from 'react'
import { UserCheck, Search, Plus, Trash2, Edit2, Loader2, AlertCircle, X, Mail, Phone } from 'lucide-react'
import { teachersApi } from '../lib/api'
import { getInitials } from '../lib/utils'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4']

export default function EnseignantsPage() {
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', gender: 'M', subjects: '', speciality: '' })

  const fetchTeachers = async () => {
    setLoading(true)
    try {
      const params = search ? `search=${search}` : ''
      const res = await teachersApi.list(params)
      setTeachers(res.data || [])
      setTotal(res.total || 0)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { fetchTeachers() }, [])
  useEffect(() => { const t = setTimeout(fetchTeachers, 400); return () => clearTimeout(t) }, [search])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const data = { ...form, subjects: form.subjects.split(',').map((s) => s.trim()).filter(Boolean) }
      if (editing) {
        await teachersApi.update(editing._id, data)
      } else {
        await teachersApi.create(data)
      }
      setShowModal(false)
      setEditing(null)
      setForm({ firstName: '', lastName: '', email: '', phone: '', gender: 'M', subjects: '', speciality: '' })
      fetchTeachers()
    } catch (e) { alert(e.message) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cet enseignant ?')) return
    try { await teachersApi.remove(id); fetchTeachers() } catch (e) { alert(e.message) }
  }

  const openEdit = (t) => {
    setEditing(t)
    setForm({ firstName: t.firstName, lastName: t.lastName, email: t.email || '', phone: t.phone || '', gender: t.gender || 'M', subjects: (t.subjects || []).join(', '), speciality: t.speciality || '' })
    setShowModal(true)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><UserCheck size={22} className="text-teal-600" /> Enseignants</h1>
          <p className="text-sm text-gray-500">{total} enseignant(s)</p>
        </div>
        <button onClick={() => { setEditing(null); setForm({ firstName: '', lastName: '', email: '', phone: '', gender: 'M', subjects: '', speciality: '' }); setShowModal(true) }} className="btn-primary text-sm self-start">
          <Plus size={15} /> Ajouter
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..." className="input pl-9 text-sm" />
      </div>

      {loading ? (
        <div className="text-center py-16"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div>
      ) : teachers.length === 0 ? (
        <div className="text-center py-16 text-gray-400"><AlertCircle size={36} className="mx-auto mb-3 opacity-30" /><p>Aucun enseignant trouvé</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teachers.map((t, i) => (
            <div key={t._id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                    {getInitials(`${t.lastName} ${t.firstName}`)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900">{t.lastName} {t.firstName}</div>
                    <div className="text-xs text-gray-500">{t.speciality || 'Enseignant'}</div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(t)} className="p-1 rounded hover:bg-blue-50 text-blue-600"><Edit2 size={13} /></button>
                  <button onClick={() => handleDelete(t._id)} className="p-1 rounded hover:bg-red-50 text-red-500"><Trash2 size={13} /></button>
                </div>
              </div>
              {t.subjects?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {t.subjects.map((s) => <span key={s} className="badge badge-blue text-[10px]">{s}</span>)}
                </div>
              )}
              <div className="space-y-1 text-xs text-gray-500">
                {t.email && <div className="flex items-center gap-1.5"><Mail size={11} />{t.email}</div>}
                {t.phone && <div className="flex items-center gap-1.5"><Phone size={11} />{t.phone}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">{editing ? 'Modifier' : 'Nouvel enseignant'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600">Prénom</label><input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="input text-sm mt-1" /></div>
                <div><label className="text-xs font-medium text-gray-600">Nom</label><input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="input text-sm mt-1" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600">Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input text-sm mt-1" /></div>
                <div><label className="text-xs font-medium text-gray-600">Téléphone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input text-sm mt-1" /></div>
              </div>
              <div><label className="text-xs font-medium text-gray-600">Matières (séparées par des virgules)</label><input value={form.subjects} onChange={(e) => setForm({ ...form, subjects: e.target.value })} placeholder="Mathématiques, Français" className="input text-sm mt-1" /></div>
              <div><label className="text-xs font-medium text-gray-600">Spécialité</label><input value={form.speciality} onChange={(e) => setForm({ ...form, speciality: e.target.value })} className="input text-sm mt-1" /></div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost flex-1 justify-center border border-gray-200">Annuler</button>
                <button type="submit" className="btn-primary flex-1 justify-center">{editing ? 'Enregistrer' : 'Ajouter'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
