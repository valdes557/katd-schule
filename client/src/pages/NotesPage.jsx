import { useState, useRef } from 'react'
import { FileText, Plus, Search, TrendingUp, Loader2, AlertCircle, X } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { gradesApi, classesApi, studentsApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'
import DownloadPdfButton from '../components/DownloadPdfButton'

const TERMS = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3']
const SEQUENCES = ['Séquence 1', 'Séquence 2', 'Séquence 3', 'Séquence 4', 'Séquence 5', 'Séquence 6']

export default function NotesPage() {
  const pdfRef = useRef(null)
  const [tab, setTab] = useState('notes')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedTerm, setSelectedTerm] = useState('Trimestre 1')
  const [selectedSeq, setSelectedSeq] = useState('')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ student: '', subject: '', value: '', type: 'devoir', term: 'Trimestre 1', sequence: '', coefficient: 1 })

  const params = new URLSearchParams()
  if (selectedClass) params.set('classId', selectedClass)
  if (selectedTerm) params.set('term', selectedTerm)
  if (selectedSeq) params.set('sequence', selectedSeq)
  const qs = params.toString()

  const gradesQ = useCachedFetch(`/grades?${qs}`, async () => (await gradesApi.list(qs)).data || [], [qs])
  const statsQ = useCachedFetch(`/grades/stats?${qs}`, async () => (await gradesApi.stats(qs)).data || null, [qs])
  const classesQ = useCachedFetch('/classes?', async () => (await classesApi.list()).data || [], [])
  const studentsQ = useCachedFetch('/students?', async () => (await studentsApi.list()).data || [], [])

  const grades = gradesQ.data || []
  const stats = statsQ.data
  const classes = classesQ.data || []
  const students = studentsQ.data || []
  const loading = gradesQ.loading

  const refreshGrades = () => { cache.invalidate('/grades'); gradesQ.refetch(); statsQ.refetch() }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const student = students.find((s) => s._id === form.student)
      await gradesApi.create({
        ...form,
        value: Number(form.value),
        coefficient: Number(form.coefficient),
        class: student?.class?._id || student?.class || selectedClass,
      })
      setShowModal(false)
      setForm({ student: '', subject: '', value: '', type: 'devoir', term: 'Trimestre 1', sequence: '', coefficient: 1 })
      refreshGrades()
    } catch (e) { alert(e.message) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette note ?')) return
    try { await gradesApi.remove(id); refreshGrades() } catch (e) { alert(e.message) }
  }

  const filteredGrades = grades.filter((g) => {
    if (!search) return true
    const name = `${g.student?.lastName || ''} ${g.student?.firstName || ''} ${g.subject || ''}`.toLowerCase()
    return name.includes(search.toLowerCase())
  })

  const chartData = stats?.bySubject?.map((s) => ({
    name: s._id,
    moyenne: Math.round(s.average * 10) / 10,
  })) || []

  return (
    <div className="space-y-5 animate-fade-in" ref={pdfRef}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText size={22} className="text-purple-600" /> Notes & Évaluations
          </h1>
          <p className="text-sm text-gray-500">{grades.length} note(s) enregistrée(s)</p>
        </div>
        <div className="flex gap-2">
          <DownloadPdfButton containerRef={pdfRef} filename="notes.pdf" title="Notes" label="Notes PDF" />
          <button onClick={() => setShowModal(true)} className="btn-primary text-sm self-start">
            <Plus size={15} /> Ajouter une note
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[{ key: 'notes', label: 'Notes' }, { key: 'stats', label: 'Statistiques' }].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="input text-sm w-auto">
          <option value="">Toutes les classes</option>
          {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)} className="input text-sm w-auto">
          {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={selectedSeq} onChange={(e) => setSelectedSeq(e.target.value)} className="input text-sm w-auto">
          <option value="">Toutes les séquences</option>
          {SEQUENCES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {tab === 'notes' && (
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher élève ou matière..." className="input pl-9 text-sm" />
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div>
      ) : tab === 'notes' ? (
        /* Notes table */
        filteredGrades.length === 0 ? (
          <div className="text-center py-16 text-gray-400"><AlertCircle size={36} className="mx-auto mb-3 opacity-30" /><p>Aucune note trouvée</p></div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Élève', 'Matière', 'Type', 'Note', 'Coeff', 'Trimestre', 'Séquence', ''].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredGrades.map((g) => (
                  <tr key={g._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{g.student?.lastName} {g.student?.firstName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{g.subject}</td>
                    <td className="px-4 py-3"><span className="badge badge-blue text-xs">{g.type}</span></td>
                    <td className="px-4 py-3 text-sm font-bold" style={{ color: g.value >= 10 ? '#10B981' : '#EF4444' }}>{g.value}/20</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{g.coefficient}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{g.term}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{g.sequence || '—'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(g._id)} className="p-1 rounded hover:bg-red-50 text-red-500 text-xs">Suppr.</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* Stats tab */
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{stats?.overall?.average?.toFixed(1) || '—'}</div>
              <div className="text-xs text-gray-500 mt-1">Moyenne générale</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{stats?.overall?.count || 0}</div>
              <div className="text-xs text-gray-500 mt-1">Total notes</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{stats?.bySubject?.length || 0}</div>
              <div className="text-xs text-gray-500 mt-1">Matières</div>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2"><TrendingUp size={15} /> Moyennes par matière</h3>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis domain={[0, 20]} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="moyenne" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-gray-400 text-center py-12">Aucune donnée</p>
            )}
          </div>

          {/* Per-subject detail */}
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Matière', 'Moyenne', 'Min', 'Max', 'Nb notes'].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(stats?.bySubject || []).map((s) => (
                  <tr key={s._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{s._id}</td>
                    <td className="px-4 py-3 text-sm font-bold" style={{ color: s.average >= 10 ? '#10B981' : '#EF4444' }}>{s.average.toFixed(1)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{s.min}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{s.max}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{s.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add grade modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Nouvelle note</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Élève</label>
                <select required value={form.student} onChange={(e) => setForm({ ...form, student: e.target.value })} className="input text-sm mt-1">
                  <option value="">Sélectionner...</option>
                  {students.map((s) => <option key={s._id} value={s._id}>{s.lastName} {s.firstName}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600">Matière</label><input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Mathématiques" className="input text-sm mt-1" /></div>
                <div><label className="text-xs font-medium text-gray-600">Note (/20)</label><input required type="number" min="0" max="20" step="0.5" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="input text-sm mt-1" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600">Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input text-sm mt-1">
                    <option value="devoir">Devoir</option><option value="examen">Examen</option><option value="composition">Composition</option><option value="oral">Oral</option><option value="tp">TP</option>
                  </select>
                </div>
                <div><label className="text-xs font-medium text-gray-600">Trimestre</label>
                  <select value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} className="input text-sm mt-1">
                    {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600">Séquence <span className="text-gray-400">(optionnel)</span></label>
                  <select value={form.sequence} onChange={(e) => setForm({ ...form, sequence: e.target.value })} className="input text-sm mt-1">
                    <option value="">Aucune</option>
                    {SEQUENCES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div><label className="text-xs font-medium text-gray-600">Coeff</label><input type="number" min="1" max="10" value={form.coefficient} onChange={(e) => setForm({ ...form, coefficient: e.target.value })} className="input text-sm mt-1" /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost flex-1 justify-center border border-gray-200">Annuler</button>
                <button type="submit" className="btn-primary flex-1 justify-center">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
