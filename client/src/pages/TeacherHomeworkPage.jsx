import { useEffect, useState } from 'react'
import {
  Plus, Loader2, ClipboardList, Trash2, Edit2, X, CheckCircle2, Clock,
  Users, AlertTriangle, ChevronDown, ChevronUp, FileText, Save, Star, Bell,
  ToggleLeft, ToggleRight,
} from 'lucide-react'
import { teacherApi } from '../lib/api'

export default function TeacherHomeworkPage() {
  const [homeworks, setHomeworks] = useState([])
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ title: '', description: '', subject: '', class: '', dueDate: '', type: 'devoir' })
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [gradeForm, setGradeForm] = useState({})
  const [filterClass, setFilterClass] = useState('')
  const [completionView, setCompletionView] = useState({}) // hwId -> 'submissions' | 'completion'
  const [completions, setCompletions] = useState({}) // hwId -> { studentId: bool }
  const [completionStudents, setCompletionStudents] = useState({}) // hwId -> []
  const [completionLoading, setCompletionLoading] = useState(null)
  const [notifying, setNotifying] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const [hwRes, dashRes] = await Promise.all([
        teacherApi.homeworks(filterClass ? `classId=${filterClass}` : ''),
        teacherApi.dashboard(),
      ])
      setHomeworks(hwRes.data || [])
      setClasses(dashRes.data?.teacher?.classes || [])
    } catch (_) {}
    setLoading(false)
  }
  useEffect(() => { load() }, [filterClass])

  const openCreate = () => {
    setEditId(null)
    setForm({ title: '', description: '', subject: '', class: '', dueDate: '', type: 'devoir' })
    setShowForm(true)
  }

  const openEdit = (hw) => {
    setEditId(hw._id)
    setForm({
      title: hw.title,
      description: hw.description || '',
      subject: hw.subject,
      class: hw.class?._id || hw.class,
      dueDate: hw.dueDate ? new Date(hw.dueDate).toISOString().slice(0, 10) : '',
      type: hw.type,
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.title || !form.subject || !form.class || !form.dueDate) return alert('Tous les champs obligatoires doivent être remplis')
    setSaving(true)
    try {
      if (editId) {
        await teacherApi.updateHomework(editId, form)
      } else {
        await teacherApi.createHomework(form)
      }
      setShowForm(false)
      load()
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce devoir ?')) return
    try {
      await teacherApi.deleteHomework(id)
      load()
    } catch (e) { alert(e.message) }
  }

  const loadCompletionStudents = async (hw) => {
    if (completionStudents[hw._id]) return
    setCompletionLoading(hw._id)
    try {
      const r = await teacherApi.students()
      const classStudents = (r.data || []).filter((s) => {
        const sid = s.class?._id || s.class
        const hcid = hw.class?._id || hw.class
        return sid === hcid
      })
      setCompletionStudents((p) => ({ ...p, [hw._id]: classStudents }))
      const init = {}
      classStudents.forEach((s) => {
        const sub = hw.submissions?.find((sub) => sub.student === s._id || sub.student?._id === s._id)
        init[s._id] = !!sub
      })
      setCompletions((p) => ({ ...p, [hw._id]: init }))
    } catch (_) {}
    setCompletionLoading(null)
  }

  const toggleCompletion = (hwId, studentId) => {
    setCompletions((p) => ({ ...p, [hwId]: { ...p[hwId], [studentId]: !p[hwId]?.[studentId] } }))
  }

  const saveCompletion = async (hwId) => {
    const entries = Object.entries(completions[hwId] || {})
    const payload = entries.map(([studentId, done]) => ({ studentId, done }))
    try {
      await teacherApi.markHomeworkCompletion(hwId, payload)
      alert('Complétion enregistrée')
      load()
    } catch (e) { alert(e.message) }
  }

  const handleGrade = async (hwId, subId) => {
    const g = gradeForm[subId]
    if (!g?.grade && g?.grade !== 0) return
    try {
      await teacherApi.gradeSubmission(hwId, subId, { grade: Number(g.grade), comment: g.comment || '' })
      setGradeForm((prev) => { const n = { ...prev }; delete n[subId]; return n })
      load()
    } catch (e) { alert(e.message) }
  }

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><ClipboardList size={22} className="text-purple-600" /> Devoirs & Évaluations</h1>
          <p className="text-sm text-gray-500">Créez, gérez et notez les devoirs de vos classes</p>
        </div>
        <button onClick={openCreate} className="btn-primary text-xs"><Plus size={14} /> Nouveau devoir</button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} className="input text-xs w-auto">
          <option value="">Toutes les classes</option>
          {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
      </div>

      {/* Homework list */}
      {homeworks.length === 0 ? (
        <div className="text-center py-16 text-gray-400"><ClipboardList size={36} className="mx-auto mb-3 opacity-30" /><p>Aucun devoir</p></div>
      ) : (
        <div className="space-y-3">
          {homeworks.map((hw) => {
            const isExpanded = expanded === hw._id
            const pct = hw.totalStudents > 0 ? Math.round((hw.submissionCount / hw.totalStudents) * 100) : 0
            return (
              <div key={hw._id} className="card overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-gray-900">{hw.title}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          hw.isOverdue && hw.notSubmitted > 0 ? 'bg-red-100 text-red-700' :
                          hw.gradedCount === hw.submissionCount && hw.submissionCount > 0 ? 'bg-green-100 text-green-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {hw.isOverdue && hw.notSubmitted > 0 ? 'En retard' :
                           hw.gradedCount === hw.submissionCount && hw.submissionCount > 0 ? 'Tout noté' : 'Actif'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{hw.subject} · {hw.class?.name} · <span className="capitalize">{hw.type}</span></p>
                      <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400">
                        <span>Échéance: {new Date(hw.dueDate).toLocaleDateString('fr-FR')}</span>
                        <span className="flex items-center gap-1"><Users size={10} /> {hw.submissionCount}/{hw.totalStudents} soumissions</span>
                        {hw.notSubmitted > 0 && hw.isOverdue && <span className="text-red-500 flex items-center gap-1"><AlertTriangle size={10} /> {hw.notSubmitted} manquant(s)</span>}
                      </div>

                      {/* Progress bar */}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] font-medium text-gray-500">{pct}%</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(hw)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded"><Edit2 size={13} /></button>
                      <button onClick={() => handleDelete(hw._id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 size={13} /></button>
                      <button onClick={() => setExpanded(isExpanded ? null : hw._id)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded: submissions / completion */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 p-4">
                    {/* View switcher */}
                    <div className="flex items-center gap-2 mb-3">
                      <button
                        onClick={() => setCompletionView((v) => ({ ...v, [hw._id]: 'submissions' }))}
                        className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                          (completionView[hw._id] || 'submissions') === 'submissions'
                            ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }`}
                      >Soumissions</button>
                      <button
                        onClick={() => { setCompletionView((v) => ({ ...v, [hw._id]: 'completion' })); loadCompletionStudents(hw) }}
                        className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                          completionView[hw._id] === 'completion'
                            ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }`}
                      >Marquer complétion</button>
                    </div>

                    {completionView[hw._id] === 'completion' && (
                      <div className="space-y-2">
                        {completionLoading === hw._id && (
                          <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-blue-600" /></div>
                        )}
                        {completionLoading !== hw._id && (completionStudents[hw._id] || []).length === 0 && (
                          <p className="text-xs text-gray-400 text-center py-2">Aucun élève trouvé pour cette classe</p>
                        )}
                        {completionLoading !== hw._id && (completionStudents[hw._id] || []).length > 0 && (
                          <div className="space-y-1">
                            {(completionStudents[hw._id] || []).map((s) => {
                              const done = completions[hw._id]?.[s._id] ?? false
                              return (
                                <div key={s._id} className={`flex items-center gap-3 p-2 rounded-lg ${done ? 'bg-green-50' : 'bg-red-50'}`}>
                                  <button onClick={() => toggleCompletion(hw._id, s._id)} className={`flex-shrink-0 ${done ? 'text-green-600' : 'text-red-400'}`}>
                                    {done ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                                  </button>
                                  <div className="flex-1">
                                    <p className="text-xs font-medium text-gray-800">{s.lastName} {s.firstName}</p>
                                    <p className="text-[10px] text-gray-400">{s.matricule}</p>
                                  </div>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${done ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                    {done ? '✅ Fait' : '❌ Non fait'}
                                  </span>
                                </div>
                              )
                            })}
                            <div className="flex gap-2 pt-2">
                              <button onClick={() => saveCompletion(hw._id)} className="btn-primary text-xs flex-1 justify-center">
                                <Save size={12} /> Enregistrer &amp; notifier parents
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {(completionView[hw._id] || 'submissions') === 'submissions' && (
                      <div>
                        <h4 className="text-xs font-bold text-gray-700 mb-2">Soumissions ({hw.submissions?.length || 0})</h4>
                        {(!hw.submissions || hw.submissions.length === 0) && (
                          <p className="text-xs text-gray-400">Aucune soumission encore</p>
                        )}
                        {hw.submissions && hw.submissions.length > 0 && (
                          <div className="space-y-2">
                            {hw.submissions.map((sub) => (
                              <div key={sub._id} className="bg-white rounded-lg p-3 flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <p className="text-xs font-medium text-gray-800">
                                    Élève #{sub.student?.toString().slice(-6) || '—'}
                                  </p>
                                  <p className="text-[10px] text-gray-400">
                                    {new Date(sub.submittedAt).toLocaleDateString('fr-FR')} ·
                                    <span className={`ml-1 ${sub.status === 'graded' ? 'text-green-600' : sub.status === 'late' ? 'text-amber-600' : 'text-blue-600'}`}>
                                      {sub.status === 'graded' ? 'Noté' : sub.status === 'late' ? 'En retard' : 'Soumis'}
                                    </span>
                                  </p>
                                  {sub.text && <p className="text-[10px] text-gray-500 mt-1 italic line-clamp-2">{sub.text}</p>}
                                  {sub.file && <a href={sub.file} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 hover:underline mt-1 inline-flex items-center gap-1"><FileText size={10} /> Fichier joint</a>}
                                </div>
                                <div className="flex items-center gap-2">
                                  {sub.status === 'graded' && (
                                    <span className="text-sm font-bold text-green-600 flex items-center gap-1"><Star size={12} /> {sub.grade}/20</span>
                                  )}
                                  {sub.status !== 'graded' && (
                                    <div className="flex items-center gap-1">
                                      <input type="number" min="0" max="20" step="0.5" placeholder="Note"
                                        value={gradeForm[sub._id]?.grade ?? ''}
                                        onChange={(e) => setGradeForm({ ...gradeForm, [sub._id]: { ...gradeForm[sub._id], grade: e.target.value } })}
                                        className="input text-xs w-16 py-1"
                                      />
                                      <input placeholder="Comm."
                                        value={gradeForm[sub._id]?.comment ?? ''}
                                        onChange={(e) => setGradeForm({ ...gradeForm, [sub._id]: { ...gradeForm[sub._id], comment: e.target.value } })}
                                        className="input text-xs w-24 py-1"
                                      />
                                      <button onClick={() => handleGrade(hw._id, sub._id)} className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200">
                                        <Save size={12} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">{editId ? 'Modifier le devoir' : 'Nouveau devoir'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Titre *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input text-sm" placeholder="Ex: Exercice de mathématiques ch.5" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input text-sm" rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Matière *</label>
                  <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="input text-sm" placeholder="Mathématiques" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input text-sm">
                    <option value="devoir">Devoir</option>
                    <option value="exercice">Exercice</option>
                    <option value="projet">Projet</option>
                    <option value="expose">Exposé</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Classe *</label>
                  <select value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })} className="input text-sm">
                    <option value="">Sélectionner...</option>
                    {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Date d'échéance *</label>
                  <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="input text-sm" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="btn-ghost flex-1 justify-center border border-gray-200">Annuler</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
                {saving ? <Loader2 size={14} className="animate-spin" /> : editId ? <Save size={14} /> : <Plus size={14} />}
                {editId ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
