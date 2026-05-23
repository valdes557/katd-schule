import { useEffect, useState } from 'react'
import { GraduationCap, Search, Plus, Trash2, Edit2, Loader2, AlertCircle, X } from 'lucide-react'
import { studentsApi, classesApi } from '../lib/api'
import { useAuth } from '../context/AuthContext'

const EMPTY = { firstName: '', lastName: '', gender: 'M', cycle: 'Primaire', class: '', dateOfBirth: '', placeOfBirth: '', parent: { name: '', phone: '', email: '', relation: 'pere' } }

export default function ElevesPage() {
  const { user } = useAuth()
  const isDirecteur = user?.role === 'directeur' || user?.role === 'super_admin'

  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [cycleFilter, setCycleFilter] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)

  const fetchStudents = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (cycleFilter) params.set('cycle', cycleFilter)
      if (classFilter) params.set('classId', classFilter)
      const res = await studentsApi.list(params.toString())
      setStudents(res.data || [])
      setTotal(res.total || 0)
    } catch (e) {}
    setLoading(false)
  }

  const fetchClasses = async () => {
    try { const res = await classesApi.list(); setClasses(res.data || []) } catch (e) {}
  }

  useEffect(() => { fetchStudents(); fetchClasses() }, [])
  useEffect(() => { const t = setTimeout(fetchStudents, 400); return () => clearTimeout(t) }, [search, cycleFilter, classFilter])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editing) await studentsApi.update(editing._id, form)
      else await studentsApi.create(form)
      setShowModal(false)
      setEditing(null)
      setForm(EMPTY)
      fetchStudents()
    } catch (e) { alert(e.message) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cet élève ?')) return
    try { await studentsApi.remove(id); fetchStudents() } catch (e) { alert(e.message) }
  }

  const openEdit = (s) => {
    setEditing(s)
    setForm({
      firstName: s.firstName, lastName: s.lastName, gender: s.gender, cycle: s.cycle || 'Primaire',
      class: s.class?._id || s.class || '', dateOfBirth: s.dateOfBirth?.slice(0, 10) || '',
      placeOfBirth: s.placeOfBirth || '',
      parent: s.parent || { name: '', phone: '', email: '', relation: 'pere' },
    })
    setShowModal(true)
  }

  const filteredClasses = classes.filter((c) => !form.cycle || c.cycle === form.cycle)

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <GraduationCap size={22} className="text-blue-600" /> Élèves
          </h1>
          <p className="text-sm text-gray-500">{total} élève(s) inscrit(s)</p>
        </div>
        {isDirecteur && (
          <button onClick={() => { setEditing(null); setForm(EMPTY); setShowModal(true) }} className="btn-primary text-sm self-start">
            <Plus size={15} /> Ajouter un élève
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..." className="input pl-9 text-sm" />
        </div>
        <select value={cycleFilter} onChange={(e) => { setCycleFilter(e.target.value); setClassFilter('') }} className="input text-sm w-auto">
          <option value="">Tous les cycles</option>
          <option value="Maternelle">Maternelle</option>
          <option value="Primaire">Primaire</option>
          <option value="Secondaire">Secondaire</option>
        </select>
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="input text-sm w-auto">
          <option value="">Toutes les classes</option>
          {classes.filter((c) => !cycleFilter || c.cycle === cycleFilter).map((c) => (
            <option key={c._id} value={c._id}>{c.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-16"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div>
      ) : students.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <AlertCircle size={36} className="mx-auto mb-3 opacity-30" />
          <p>Aucun élève trouvé</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Matricule', 'Nom', 'Classe', 'Genre', 'Naissance', 'Parent', ...(isDirecteur ? ['Actions'] : [])].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {students.map((s) => (
                <tr key={s._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs font-mono text-gray-600">{s.matricule}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.lastName} {s.firstName}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{s.class?.name || '—'}</td>
                  <td className="px-4 py-3"><span className={`badge ${s.gender === 'M' ? 'badge-blue' : 'badge-pink'} text-xs`}>{s.gender === 'M' ? 'G' : 'F'}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString('fr-FR') : '—'}
                    {s.placeOfBirth && <span className="text-gray-400"> à {s.placeOfBirth}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{s.parent?.name || '—'}<br/>{s.parent?.phone && <span className="text-gray-400">{s.parent.phone}</span>}</td>
                  {isDirecteur && (
                    <td className="px-4 py-3 flex gap-1">
                      <button onClick={() => openEdit(s)} className="p-1.5 rounded hover:bg-blue-50 text-blue-600"><Edit2 size={14} /></button>
                      <button onClick={() => handleDelete(s._id)} className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 size={14} /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">{editing ? 'Modifier l\'élève' : 'Nouvel élève'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Prénom *</label>
                  <input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="input text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Nom *</label>
                  <input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="input text-sm mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Genre *</label>
                  <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="input text-sm mt-1">
                    <option value="M">Garçon</option>
                    <option value="F">Fille</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Cycle *</label>
                  <select value={form.cycle} onChange={(e) => setForm({ ...form, cycle: e.target.value, class: '' })} className="input text-sm mt-1">
                    <option>Maternelle</option>
                    <option>Primaire</option>
                    <option>Secondaire</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Classe</label>
                  <select value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })} className="input text-sm mt-1">
                    <option value="">— Aucune —</option>
                    {filteredClasses.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Date de naissance</label>
                  <input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} className="input text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Lieu de naissance</label>
                  <input value={form.placeOfBirth} onChange={(e) => setForm({ ...form, placeOfBirth: e.target.value })} className="input text-sm mt-1" placeholder="Ex: Douala" />
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                <p className="text-xs font-bold text-gray-700 mb-2">Parent / Responsable</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Nom</label>
                    <input value={form.parent.name} onChange={(e) => setForm({ ...form, parent: { ...form.parent, name: e.target.value } })} className="input text-sm mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Téléphone</label>
                    <input value={form.parent.phone} onChange={(e) => setForm({ ...form, parent: { ...form.parent, phone: e.target.value } })} className="input text-sm mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Email</label>
                    <input type="email" value={form.parent.email || ''} onChange={(e) => setForm({ ...form, parent: { ...form.parent, email: e.target.value } })} className="input text-sm mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Relation</label>
                    <select value={form.parent.relation || 'pere'} onChange={(e) => setForm({ ...form, parent: { ...form.parent, relation: e.target.value } })} className="input text-sm mt-1">
                      <option value="pere">Père</option>
                      <option value="mere">Mère</option>
                      <option value="tuteur">Tuteur</option>
                    </select>
                  </div>
                </div>
              </div>

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
