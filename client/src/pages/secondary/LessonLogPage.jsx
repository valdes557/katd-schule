import { useState } from 'react'
import { BookOpen, Plus, Loader2, AlertCircle, X, CheckCircle2, Eye, Trash2 } from 'lucide-react'
import { lessonLogsApi, classesApi } from '../../lib/api'
import { useCachedFetch } from '../../hooks/useCachedFetch'
import { cache } from '../../lib/cache'
import { useAuth } from '../../context/AuthContext'

// Cahier de texte (cycle Secondaire).
// - Professeur : remplit chaque séance (leçon, contenu, devoirs donnés), modifie, supprime.
// - Vice-principal / Directeur : consultent tout, apposent leur visa.
// - Élève / Parent : consultent le cahier de la classe (lecture seule).
export default function LessonLogPage() {
  const { user } = useAuth()
  const role = user?.role
  const canWrite = role === 'enseignant'
  const canVisa = ['vice_principal', 'directeur'].includes(role)
  const canFilterClass = !['eleve'].includes(role)

  const [selectedClass, setSelectedClass] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null) // séance en cours d'édition
  const [saving, setSaving] = useState(false)
  const emptyForm = {
    classId: '', subject: '', date: new Date().toISOString().slice(0, 10),
    startTime: '', endTime: '', title: '', content: '', homeworkGiven: '',
  }
  const [form, setForm] = useState(emptyForm)

  const classesQ = useCachedFetch(canFilterClass ? '/classes?' : null, async () => (await classesApi.list()).data || [], [])
  const classes = classesQ.data || []

  const params = selectedClass ? { classId: selectedClass } : {}
  const qs = new URLSearchParams(params).toString()
  const logsQ = useCachedFetch(`/lesson-logs?${qs}`, async () => (await lessonLogsApi.list(params)).data || [], [qs])
  const logs = logsQ.data || []

  const refresh = () => { cache.invalidate('/lesson-logs'); logsQ.refetch() }

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm, classId: selectedClass || '' }); setShowModal(true) }
  const openEdit = (log) => {
    setEditing(log)
    setForm({
      classId: log.class?._id || log.class, subject: log.subject,
      date: new Date(log.date).toISOString().slice(0, 10),
      startTime: log.startTime || '', endTime: log.endTime || '',
      title: log.title, content: log.content || '', homeworkGiven: log.homeworkGiven || '',
    })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) await lessonLogsApi.update(editing._id, form)
      else await lessonLogsApi.create(form)
      setShowModal(false)
      refresh()
    } catch (e2) { alert(e2.message) }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette séance du cahier de texte ?')) return
    try { await lessonLogsApi.remove(id); refresh() } catch (e) { alert(e.message) }
  }

  const handleVisa = async (id) => {
    try { await lessonLogsApi.visa(id); refresh() } catch (e) { alert(e.message) }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen size={22} className="text-teal-600" /> Cahier de texte
          </h1>
          <p className="text-sm text-gray-500">
            {canWrite ? 'Remplissez chaque séance : leçon dispensée et devoirs donnés.'
              : canVisa ? 'Suivi pédagogique des séances : consultez et apposez votre visa.'
              : 'Leçons dispensées et devoirs donnés dans votre classe.'}
          </p>
        </div>
        {canWrite && (
          <button onClick={openCreate} className="btn-primary text-sm self-start"><Plus size={15} /> Nouvelle séance</button>
        )}
      </div>

      {canFilterClass && (
        <div className="flex flex-wrap gap-3">
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="input text-sm w-auto">
            <option value="">Toutes les classes</option>
            {classes.map((c) => <option key={c._id} value={c._id}>{c.name} ({c.level})</option>)}
          </select>
        </div>
      )}

      {logsQ.loading ? (
        <div className="text-center py-16"><Loader2 size={24} className="animate-spin mx-auto text-teal-600" /></div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-gray-400"><AlertCircle size={36} className="mx-auto mb-3 opacity-30" /><p>Aucune séance dans le cahier de texte</p></div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <div key={log._id} className="card p-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mb-1">
                    <span className="font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-2 py-0.5">{log.subject}</span>
                    {log.class?.name && <span className="badge badge-blue">{log.class.name}</span>}
                    <span>{new Date(log.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                    {(log.startTime || log.endTime) && <span>{log.startTime}{log.endTime ? ` – ${log.endTime}` : ''}</span>}
                    {log.teacher && <span>· {log.teacher.firstName} {log.teacher.lastName}</span>}
                  </div>
                  <h3 className="text-sm font-bold text-gray-900">{log.title}</h3>
                  {log.content && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{log.content}</p>}
                  {log.homeworkGiven && (
                    <p className="text-sm mt-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-amber-800">
                      <span className="font-semibold">Devoirs :</span> {log.homeworkGiven}
                    </p>
                  )}
                  {log.viewedAt && (
                    <p className="text-xs text-green-600 mt-2 flex items-center gap-1"><CheckCircle2 size={12} /> Visé le {new Date(log.viewedAt).toLocaleDateString('fr-FR')}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  {canVisa && !log.viewedAt && (
                    <button onClick={() => handleVisa(log._id)} className="btn-ghost border border-green-200 text-green-700 text-xs flex items-center gap-1"><Eye size={13} /> Viser</button>
                  )}
                  {canWrite && (
                    <>
                      <button onClick={() => openEdit(log)} className="btn-ghost border border-gray-200 text-xs">Modifier</button>
                      <button onClick={() => handleDelete(log._id)} className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 size={14} /></button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modale saisie / édition de séance */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">{editing ? 'Modifier la séance' : 'Nouvelle séance'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Classe</label>
                  <select required value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })} className="input text-sm mt-1" disabled={!!editing}>
                    <option value="">Sélectionner...</option>
                    {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </div>
                <div><label className="text-xs font-medium text-gray-600">Matière</label><input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Mathématiques" className="input text-sm mt-1" /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-xs font-medium text-gray-600">Date</label><input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input text-sm mt-1" /></div>
                <div><label className="text-xs font-medium text-gray-600">Début</label><input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="input text-sm mt-1" /></div>
                <div><label className="text-xs font-medium text-gray-600">Fin</label><input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="input text-sm mt-1" /></div>
              </div>
              <div><label className="text-xs font-medium text-gray-600">Titre de la leçon</label><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex. Théorème de Pythagore" className="input text-sm mt-1" /></div>
              <div><label className="text-xs font-medium text-gray-600">Contenu de la séance</label><textarea rows={4} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Décrivez ce qui a été fait pendant la séance..." className="input text-sm mt-1" /></div>
              <div><label className="text-xs font-medium text-gray-600">Devoirs donnés <span className="text-gray-400">(optionnel)</span></label><textarea rows={2} value={form.homeworkGiven} onChange={(e) => setForm({ ...form, homeworkGiven: e.target.value })} placeholder="Ex. Exercices 3 à 7 page 42 pour vendredi" className="input text-sm mt-1" /></div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost flex-1 justify-center border border-gray-200">Annuler</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : null} Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
