import { useState } from 'react'
import {
  Plus, Loader2, ClipboardList, Trash2, Edit2, X, CheckCircle2, Clock,
  Users, AlertTriangle, ChevronDown, ChevronUp, FileText, Save, Star, Bell,
  ToggleLeft, ToggleRight,
} from 'lucide-react'
import { teacherApi, dashboardApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'
import { useAuth } from '../context/AuthContext'

function TeacherHomeworkView() {
  const [filterClass, setFilterClass] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ title: '', description: '', subject: '', class: '', dueDate: '', type: 'devoir' })
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [gradeForm, setGradeForm] = useState({})
  const [completionView, setCompletionView] = useState({}) // hwId -> 'submissions' | 'completion'
  const [completions, setCompletions] = useState({}) // hwId -> { studentId: bool }
  const [completionStudents, setCompletionStudents] = useState({}) // hwId -> []
  const [completionLoading, setCompletionLoading] = useState(null)
  const [notifying, setNotifying] = useState(null)
  const [subStatus, setSubStatus] = useState({})     // hwId -> { studentId: 'none'|'on_time'|'late' }
  const [subDateTime, setSubDateTime] = useState({}) // hwId -> { studentId: 'YYYY-MM-DDTHH:mm' }
  const [savingSub, setSavingSub] = useState(null)

  // Format a Date into the value expected by <input type="datetime-local"> (local time)
  const toLocalDatetime = (d) => {
    const dt = new Date(d)
    const pad = (n) => String(n).padStart(2, '0')
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
  }

  const hwKey = `/teacher/homeworks?classId=${filterClass}`
  const homeworksQ = useCachedFetch(hwKey, async () => {
    return (await teacherApi.homeworks(filterClass ? `classId=${filterClass}` : '')).data || []
  }, [filterClass])

  const dashboardQ = useCachedFetch('/teacher/dashboard?', async () => {
    const r = await teacherApi.dashboard()
    return r.data?.teacher?.classes || []
  }, [])

  const homeworks = homeworksQ.data || []
  const classes = dashboardQ.data || []
  const loading = homeworksQ.loading

  const refresh = () => { cache.invalidate('/teacher/homeworks'); homeworksQ.refetch() }

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
      refresh()
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce devoir ?')) return
    try {
      await teacherApi.deleteHomework(id)
      refresh()
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
      const initStatus = {}
      const initDt = {}
      classStudents.forEach((s) => {
        const sub = hw.submissions?.find((sub) => sub.student === s._id || sub.student?._id === s._id)
        init[s._id] = !!sub
        if (sub) {
          initStatus[s._id] = sub.submissionType === 'late' ? 'late' : 'on_time'
          initDt[s._id] = sub.submittedAt ? toLocalDatetime(sub.submittedAt) : ''
        } else {
          initStatus[s._id] = 'none'
          initDt[s._id] = ''
        }
      })
      setCompletions((p) => ({ ...p, [hw._id]: init }))
      setSubStatus((p) => ({ ...p, [hw._id]: initStatus }))
      setSubDateTime((p) => ({ ...p, [hw._id]: initDt }))
    } catch (_) {}
    setCompletionLoading(null)
  }

  const setStudentStatus = (hwId, studentId, status) => {
    setSubStatus((p) => ({ ...p, [hwId]: { ...p[hwId], [studentId]: status } }))
  }

  const setStudentDateTime = (hwId, studentId, value) => {
    setSubDateTime((p) => ({ ...p, [hwId]: { ...p[hwId], [studentId]: value } }))
  }

  const saveSubmissions = async (hwId) => {
    const statusMap = subStatus[hwId] || {}
    const dtMap = subDateTime[hwId] || {}
    // Every "late" submission must carry a submission date/time
    const missingDt = Object.entries(statusMap).some(([sid, st]) => st === 'late' && !dtMap[sid])
    if (missingDt) return alert("Veuillez indiquer la date et l'heure de remise pour chaque devoir remis en retard.")
    const entries = Object.entries(statusMap).map(([studentId, status]) => {
      const e = { studentId, submissionType: status }
      if (status === 'late') e.submittedAt = new Date(dtMap[studentId]).toISOString()
      return e
    })
    setSavingSub(hwId)
    try {
      await teacherApi.recordSubmissions(hwId, entries)
      alert('Remises validées ✅ — les parents concernés ont été notifiés par email.')
      refresh()
    } catch (e) { alert(e.message) }
    setSavingSub(null)
  }

  const handleGrade = async (hwId, subId) => {
    const g = gradeForm[subId]
    if (!g?.grade && g?.grade !== 0) return
    try {
      await teacherApi.gradeSubmission(hwId, subId, { grade: Number(g.grade), comment: g.comment || '' })
      setGradeForm((prev) => { const n = { ...prev }; delete n[subId]; return n })
      refresh()
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
                      >Remises &amp; validation</button>
                    </div>

                    {completionView[hw._id] === 'completion' && (
                      <div className="space-y-2">
                        <p className="text-[11px] text-gray-500">
                          Pour chaque élève, indiquez s'il a remis le devoir <strong>à temps</strong> ou <strong>en retard</strong>.
                          En cas de retard, précisez la date et l'heure de remise. À la validation, les parents concernés sont notifiés par email.
                        </p>
                        {completionLoading === hw._id && (
                          <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-blue-600" /></div>
                        )}
                        {completionLoading !== hw._id && (completionStudents[hw._id] || []).length === 0 && (
                          <p className="text-xs text-gray-400 text-center py-2">Aucun élève trouvé pour cette classe</p>
                        )}
                        {completionLoading !== hw._id && (completionStudents[hw._id] || []).length > 0 && (
                          <div className="space-y-1.5">
                            {(completionStudents[hw._id] || []).map((s) => {
                              const status = subStatus[hw._id]?.[s._id] ?? 'none'
                              const bg = status === 'on_time' ? 'bg-green-50' : status === 'late' ? 'bg-amber-50' : 'bg-gray-50'
                              const Opt = ({ value, label, activeClass }) => (
                                <button
                                  onClick={() => setStudentStatus(hw._id, s._id, value)}
                                  className={`text-[10px] px-2 py-1 rounded-full font-medium transition-colors ${
                                    status === value ? activeClass : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-100'
                                  }`}
                                >{label}</button>
                              )
                              return (
                                <div key={s._id} className={`p-2 rounded-lg ${bg}`}>
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium text-gray-800 truncate">{s.lastName} {s.firstName}</p>
                                      <p className="text-[10px] text-gray-400">{s.matricule}</p>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      <Opt value="none" label="Non remis" activeClass="bg-red-100 text-red-600 border border-red-200" />
                                      <Opt value="on_time" label="✅ À temps" activeClass="bg-green-600 text-white" />
                                      <Opt value="late" label="⏰ En retard" activeClass="bg-amber-500 text-white" />
                                    </div>
                                  </div>
                                  {status === 'late' && (
                                    <div className="mt-2 flex items-center gap-2 pl-1">
                                      <Clock size={12} className="text-amber-600 flex-shrink-0" />
                                      <label className="text-[10px] text-gray-500">Remis le :</label>
                                      <input
                                        type="datetime-local"
                                        value={subDateTime[hw._id]?.[s._id] || ''}
                                        onChange={(e) => setStudentDateTime(hw._id, s._id, e.target.value)}
                                        className="input text-[11px] py-1 w-auto"
                                      />
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                            <div className="flex gap-2 pt-2">
                              <button onClick={() => saveSubmissions(hw._id)} disabled={savingSub === hw._id} className="btn-primary text-xs flex-1 justify-center">
                                {savingSub === hw._id ? <Loader2 size={12} className="animate-spin" /> : <Bell size={12} />}
                                Approuver &amp; notifier les parents
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
                                  {sub.justification?.submittedAt && (
                                    <div className="mt-1.5 p-2 rounded-lg bg-blue-50 border border-blue-100">
                                      <p className="text-[10px] font-semibold text-blue-700 flex items-center gap-1"><Bell size={10} /> Justificatif du parent</p>
                                      {sub.justification.text && <p className="text-[10px] text-gray-600 italic mt-0.5">{sub.justification.text}</p>}
                                      {sub.justification.file && <a href={sub.justification.file.startsWith('http') ? sub.justification.file : `${import.meta.env.VITE_API_URL || ''}${sub.justification.file}`} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 hover:underline mt-0.5 inline-flex items-center gap-1"><FileText size={10} /> Pièce jointe</a>}
                                    </div>
                                  )}
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

/* ─── Vue Directeur : supervision des devoirs par classe (lecture seule) ─── */
function DirectorHomeworkOverview() {
  const [expanded, setExpanded] = useState(null)
  const ovQ = useCachedFetch('/dashboard/homework-overview', async () => {
    const r = await dashboardApi.homeworkOverview()
    return r.data || { classes: [], summary: {} }
  }, [])

  const data = ovQ.data || { classes: [], summary: {} }
  const classes = data.classes || []
  const s = data.summary || {}
  const loading = ovQ.loading

  const refresh = () => { cache.invalidate('/dashboard/homework-overview'); ovQ.refetch() }

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>

  const cards = [
    { label: 'Devoirs donnés', value: s.totalHomeworks || 0, cls: 'text-blue-600' },
    { label: 'Entièrement corrigés', value: s.fullyGradedHomeworks || 0, cls: 'text-green-600' },
    { label: 'Copies à corriger', value: s.pendingCorrection || 0, cls: (s.pendingCorrection > 0 ? 'text-amber-600' : 'text-gray-500') },
    { label: 'Classes sans devoir', value: s.classesWithoutHomework || 0, cls: (s.classesWithoutHomework > 0 ? 'text-red-500' : 'text-gray-500') },
  ]

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><ClipboardList size={22} className="text-purple-600" /> Devoirs & Évaluations — supervision</h1>
          <p className="text-sm text-gray-500">Vérifiez que chaque enseignant donne et corrige les devoirs, classe par classe</p>
        </div>
        <button onClick={refresh} className="btn-ghost text-xs border border-gray-200 self-start"><Loader2 size={13} className={ovQ.loading ? 'animate-spin' : 'hidden'} /> Actualiser</button>
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="card p-4 text-center">
            <p className={`text-2xl font-bold ${c.cls}`}>{c.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Par classe */}
      <div className="space-y-3">
        {classes.map((c) => {
          const isOpen = expanded === c.classId
          return (
            <div key={c.classId} className="card overflow-hidden">
              <div className="p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50" onClick={() => setExpanded(isOpen ? null : c.classId)}>
                <div className={`w-2 h-8 rounded-full flex-shrink-0 ${c.totalHomeworks === 0 ? 'bg-red-400' : c.ungradedSubmissions > 0 ? 'bg-amber-400' : 'bg-green-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">{c.className} <span className="text-xs font-normal text-gray-400">· {c.level || c.cycle}</span></p>
                  <p className="text-xs text-gray-500">
                    {c.totalHomeworks === 0
                      ? 'Aucun devoir donné'
                      : `${c.totalHomeworks} devoir(s)${c.ungradedSubmissions > 0 ? ` · ${c.ungradedSubmissions} copie(s) à corriger` : ' · tout corrigé'}`}
                  </p>
                </div>
                {c.overdueWithMissing > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-600 flex items-center gap-1"><AlertTriangle size={10} /> {c.overdueWithMissing} en retard</span>
                )}
                {isOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              </div>

              {isOpen && (
                <div className="border-t border-gray-100 bg-gray-50 p-4">
                  {c.homeworks.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-2">Cette classe n'a aucun devoir enregistré.</p>
                  ) : (
                    <div className="space-y-2">
                      {c.homeworks.map((h) => (
                        <div key={h._id} className="bg-white rounded-lg p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold text-gray-800">{h.title}</p>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                  h.fullyGraded ? 'bg-green-100 text-green-700' :
                                  h.isOverdue && h.notSubmitted > 0 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {h.fullyGraded ? 'Tout corrigé' : h.isOverdue && h.notSubmitted > 0 ? 'En retard' : 'Actif'}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">{h.subject} · <span className="capitalize">{h.type}</span> · par <strong className="text-gray-600">{h.teacherName}</strong></p>
                              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400 flex-wrap">
                                <span>Échéance : {new Date(h.dueDate).toLocaleDateString('fr-FR')}</span>
                                <span className="flex items-center gap-1"><Users size={10} /> {h.submissionCount}/{h.totalStudents} remis</span>
                                <span className={h.gradedCount === h.submissionCount && h.submissionCount > 0 ? 'text-green-600' : 'text-amber-600'}>{h.gradedCount}/{h.submissionCount} corrigés</span>
                                {h.isOverdue && h.notSubmitted > 0 && <span className="text-red-500 flex items-center gap-1"><AlertTriangle size={10} /> {h.notSubmitted} manquant(s)</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function TeacherHomeworkPage() {
  const { user } = useAuth()
  if (user?.role === 'directeur' || user?.role === 'super_admin') return <DirectorHomeworkOverview />
  return <TeacherHomeworkView />
}
