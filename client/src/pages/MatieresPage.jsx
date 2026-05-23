import { useEffect, useState } from 'react'
import { ClipboardList, Plus, Search, Edit2, Trash2, X, Loader2, AlertCircle } from 'lucide-react'
import { subjectsApi, classesApi, teachersApi } from '../lib/api'
import { useAuth } from '../context/AuthContext'

const CYCLES = ['Maternelle', 'Primaire', 'Secondaire']
const CYCLE_COLORS = { Maternelle: 'bg-orange-100 text-orange-700', Primaire: 'bg-blue-100 text-blue-700', Secondaire: 'bg-green-100 text-green-700' }

const EMPTY = { name: '', code: '', cycle: 'Primaire', level: '', coefficient: 1, hoursPerWeek: 2, teacher: '', classes: [], description: '', program: '' }

export default function MatieresPage() {
  const { user } = useAuth()
  const isDirecteur = user?.role === 'directeur' || user?.role === 'super_admin'

  const [subjects, setSubjects] = useState([])
  const [classes, setClasses] = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [cycleFilter, setCycleFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)

  const load = async () => {
    setLoading(true)
    try {
      const [sr, cr, tr] = await Promise.all([
        subjectsApi.list(cycleFilter ? `cycle=${cycleFilter}` : ''),
        classesApi.list(),
        teachersApi.list(),
      ])
      setSubjects(sr.data || [])
      setClasses(cr.data || [])
      setTeachers(tr.data || [])
    } catch (e) {}
    setLoading(false)
  }

  useEffect(() => { load() }, [cycleFilter])

  const filtered = subjects.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.code || '').toLowerCase().includes(search.toLowerCase())
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editing) await subjectsApi.update(editing._id, form)
      else await subjectsApi.create(form)
      setShowModal(false)
      setEditing(null)
      setForm(EMPTY)
      load()
    } catch (e) { alert(e.message) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette matière ?')) return
    try { await subjectsApi.remove(id); load() } catch (e) { alert(e.message) }
  }

  const openEdit = (s) => {
    setEditing(s)
    setForm({
      name: s.name, code: s.code || '', cycle: s.cycle, level: s.level || '',
      coefficient: s.coefficient || 1, hoursPerWeek: s.hoursPerWeek || 2,
      teacher: s.teacher?._id || '', classes: (s.classes || []).map((c) => c._id || c),
      description: s.description || '', program: s.program || '',
    })
    setShowModal(true)
  }

  const toggleClass = (classId) => {
    setForm((f) => ({
      ...f,
      classes: f.classes.includes(classId) ? f.classes.filter((c) => c !== classId) : [...f.classes, classId],
    }))
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList size={22} className="text-purple-600" /> Matières & Programmes
          </h1>
          <p className="text-sm text-gray-500">{subjects.length} matière(s)</p>
        </div>
        {isDirecteur && (
          <button onClick={() => { setEditing(null); setForm(EMPTY); setShowModal(true) }} className="btn-primary text-sm self-start">
            <Plus size={15} /> Ajouter une matière
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
          <p>Aucune matière trouvée</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <div key={s._id} className="card p-5">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">{s.name}</h3>
                  {s.code && <p className="text-[10px] font-mono text-gray-400">{s.code}</p>}
                </div>
                {isDirecteur && (
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(s)} className="p-1 rounded hover:bg-blue-50 text-blue-600"><Edit2 size={13} /></button>
                    <button onClick={() => handleDelete(s._id)} className="p-1 rounded hover:bg-red-50 text-red-500"><Trash2 size={13} /></button>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1 mb-3">
                <span className={`badge text-[10px] ${CYCLE_COLORS[s.cycle] || ''}`}>{s.cycle}</span>
                {s.level && <span className="badge bg-gray-100 text-gray-600 text-[10px]">{s.level}</span>}
              </div>
              <div className="space-y-1 text-xs text-gray-500">
                <div>Coefficient : <strong>{s.coefficient}</strong> · {s.hoursPerWeek}h/sem</div>
                {s.teacher && <div>👨‍🏫 {s.teacher.lastName || ''} {s.teacher.firstName || ''}</div>}
                {s.classes?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {s.classes.map((c) => <span key={c._id || c} className="badge bg-indigo-50 text-indigo-600 text-[9px]">{c.name || c}</span>)}
                  </div>
                )}
                {s.description && <p className="mt-2 text-gray-400 line-clamp-2">{s.description}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">{editing ? 'Modifier la matière' : 'Nouvelle matière'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Nom *</label>
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input text-sm mt-1" placeholder="Mathématiques" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Code</label>
                  <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="input text-sm mt-1" placeholder="MATH" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Cycle *</label>
                  <select value={form.cycle} onChange={(e) => setForm({ ...form, cycle: e.target.value })} className="input text-sm mt-1">
                    {CYCLES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Coefficient</label>
                  <input type="number" min="1" value={form.coefficient} onChange={(e) => setForm({ ...form, coefficient: Number(e.target.value) })} className="input text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Heures/sem</label>
                  <input type="number" min="1" value={form.hoursPerWeek} onChange={(e) => setForm({ ...form, hoursPerWeek: Number(e.target.value) })} className="input text-sm mt-1" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Enseignant</label>
                <select value={form.teacher} onChange={(e) => setForm({ ...form, teacher: e.target.value })} className="input text-sm mt-1">
                  <option value="">Aucun</option>
                  {teachers.map((t) => <option key={t._id} value={t._id}>{t.lastName} {t.firstName}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Classes associées</label>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto bg-gray-50 p-2 rounded-lg">
                  {classes.map((c) => (
                    <button key={c._id} type="button" onClick={() => toggleClass(c._id)}
                      className={`px-2 py-1 rounded text-[10px] font-medium border transition-all ${form.classes.includes(c._id) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Description</label>
                <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input text-sm mt-1 resize-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Programme détaillé</label>
                <textarea rows={3} value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })} className="input text-sm mt-1 resize-none" placeholder="Chapitre 1 : ..." />
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
