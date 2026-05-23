import { useEffect, useState } from 'react'
import { BookOpen, Plus, Search, Edit2, Trash2, X, Loader2, AlertCircle, Users, DoorOpen } from 'lucide-react'
import { classesApi, teachersApi } from '../lib/api'
import { useAuth } from '../context/AuthContext'

const CYCLES = ['Maternelle', 'Primaire', 'Secondaire']
const CYCLE_COLORS = { Maternelle: 'bg-orange-100 text-orange-700', Primaire: 'bg-blue-100 text-blue-700', Secondaire: 'bg-green-100 text-green-700' }

const EMPTY = { name: '', level: '', cycle: 'Primaire', room: '', capacity: 40, enrollmentFee: 0, mainTeacher: '', academicYear: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1) }

export default function ClassesPage() {
  const { user } = useAuth()
  const isDirecteur = user?.role === 'directeur' || user?.role === 'super_admin'

  const [classes, setClasses] = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [cycleFilter, setCycleFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)

  const fetch = async () => {
    setLoading(true)
    try {
      const [cr, tr] = await Promise.all([classesApi.list(cycleFilter ? `cycle=${cycleFilter}` : ''), teachersApi.list()])
      setClasses(cr.data || [])
      setTeachers(tr.data || [])
    } catch (e) {}
    setLoading(false)
  }

  useEffect(() => { fetch() }, [cycleFilter])

  const filtered = classes.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.room || '').toLowerCase().includes(search.toLowerCase())
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editing) await classesApi.update(editing._id, form)
      else await classesApi.create(form)
      setShowModal(false)
      setEditing(null)
      setForm(EMPTY)
      fetch()
    } catch (e) { alert(e.message) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette classe ?')) return
    try { await classesApi.remove(id); fetch() } catch (e) { alert(e.message) }
  }

  const openEdit = (c) => {
    setEditing(c)
    setForm({
      name: c.name, level: c.level, cycle: c.cycle, room: c.room || '',
      capacity: c.capacity || 40, enrollmentFee: c.enrollmentFee || 0,
      mainTeacher: c.mainTeacher?._id || '', academicYear: c.academicYear || EMPTY.academicYear,
    })
    setShowModal(true)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen size={22} className="text-blue-600" /> Classes & Salles
          </h1>
          <p className="text-sm text-gray-500">{classes.length} classe(s)</p>
        </div>
        {isDirecteur && (
          <button onClick={() => { setEditing(null); setForm(EMPTY); setShowModal(true) }} className="btn-primary text-sm self-start">
            <Plus size={15} /> Créer une classe
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..." className="input pl-9 text-sm" />
        </div>
        <select value={cycleFilter} onChange={(e) => setCycleFilter(e.target.value)} className="input text-sm w-auto">
          <option value="">Tous les cycles</option>
          {CYCLES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-16"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <AlertCircle size={36} className="mx-auto mb-3 opacity-30" />
          <p>Aucune classe trouvée</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <div key={c._id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">{c.name}</h3>
                  <p className="text-xs text-gray-500">{c.level}</p>
                </div>
                {isDirecteur && (
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(c)} className="p-1 rounded hover:bg-blue-50 text-blue-600"><Edit2 size={13} /></button>
                    <button onClick={() => handleDelete(c._id)} className="p-1 rounded hover:bg-red-50 text-red-500"><Trash2 size={13} /></button>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                <span className={`badge text-[10px] ${CYCLE_COLORS[c.cycle] || 'bg-gray-100 text-gray-600'}`}>{c.cycle}</span>
                {c.room && <span className="badge bg-purple-100 text-purple-700 text-[10px] flex items-center gap-0.5"><DoorOpen size={9} />{c.room}</span>}
              </div>
              <div className="space-y-1 text-xs text-gray-500">
                <div className="flex items-center gap-1.5"><Users size={11} /> Capacité : {c.capacity || '—'}</div>
                {c.mainTeacher && <div className="flex items-center gap-1.5">👨‍🏫 {c.mainTeacher.lastName || ''} {c.mainTeacher.firstName || ''}</div>}
                {c.academicYear && <div>📅 {c.academicYear}</div>}
                {c.enrollmentFee > 0 && <div>💰 Frais : {c.enrollmentFee.toLocaleString()} F CFA</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">{editing ? 'Modifier la classe' : 'Nouvelle classe'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Nom de la classe *</label>
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input text-sm mt-1" placeholder="Ex: CM1 A" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Niveau *</label>
                  <input required value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} className="input text-sm mt-1" placeholder="Ex: CM1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Cycle *</label>
                  <select value={form.cycle} onChange={(e) => setForm({ ...form, cycle: e.target.value })} className="input text-sm mt-1">
                    {CYCLES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Salle</label>
                  <input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} className="input text-sm mt-1" placeholder="Ex: Salle 12" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Capacité</label>
                  <input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} className="input text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Frais d'inscription (CFA)</label>
                  <input type="number" value={form.enrollmentFee} onChange={(e) => setForm({ ...form, enrollmentFee: Number(e.target.value) })} className="input text-sm mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Enseignant principal</label>
                  <select value={form.mainTeacher} onChange={(e) => setForm({ ...form, mainTeacher: e.target.value })} className="input text-sm mt-1">
                    <option value="">Aucun</option>
                    {teachers.map((t) => <option key={t._id} value={t._id}>{t.lastName} {t.firstName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Année scolaire</label>
                  <input value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} className="input text-sm mt-1" placeholder="2025-2026" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost flex-1 justify-center border border-gray-200">Annuler</button>
                <button type="submit" className="btn-primary flex-1 justify-center">{editing ? 'Enregistrer' : 'Créer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
