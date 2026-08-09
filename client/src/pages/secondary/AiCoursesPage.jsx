import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bot, Plus, Loader2, AlertCircle, X, Clock, CalendarCheck, FileText,
  Play, CheckCircle2, Trash2, Ban, Radio, Sparkles,
} from 'lucide-react'
import { aiCoursesApi, classesApi } from '../../lib/api'
import { useCachedFetch } from '../../hooks/useCachedFetch'
import { cache } from '../../lib/cache'
import { useAuth } from '../../context/AuthContext'

// Cours de l'IA enseignante autonome (F2 Secondaire).
// - Professeur : programme un cours (texte ou PDF, heure + durée) pour SES classes,
//   modifie/annule tant qu'il est planifié.
// - Élève / Parent : voient les cours de la classe (à venir, en direct, terminés).
// - VP / Directeur : supervision de tous les cours de l'école.
const STATUS_META = {
  planifie: { label: 'Planifié', cls: 'bg-blue-50 text-blue-700 border-blue-200', icon: CalendarCheck },
  generation: { label: 'Préparation IA...', cls: 'bg-purple-50 text-purple-700 border-purple-200', icon: Sparkles },
  pret: { label: 'Prêt', cls: 'bg-teal-50 text-teal-700 border-teal-200', icon: CheckCircle2 },
  en_cours: { label: 'EN DIRECT', cls: 'bg-red-50 text-red-600 border-red-200 animate-pulse', icon: Radio },
  termine: { label: 'Terminé', cls: 'bg-gray-100 text-gray-600 border-gray-200', icon: CheckCircle2 },
  annule: { label: 'Annulé', cls: 'bg-gray-50 text-gray-400 border-gray-200', icon: Ban },
  erreur: { label: 'Erreur', cls: 'bg-red-50 text-red-700 border-red-200', icon: AlertCircle },
}

// Valeur par défaut du champ datetime-local : dans 30 min, arrondi au quart d'heure
function defaultScheduledAt() {
  const d = new Date(Date.now() + 30 * 60 * 1000)
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function AiCoursesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const role = user?.role
  const canCreate = ['enseignant', 'directeur'].includes(role)

  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const emptyForm = {
    classId: '', subject: '', title: '', sourceType: 'text', sourceText: '',
    pdf: null, scheduledAt: defaultScheduledAt(), durationMinutes: 45,
  }
  const [form, setForm] = useState(emptyForm)

  const classesQ = useCachedFetch(canCreate ? '/classes?' : null, async () => (await classesApi.list()).data || [], [])
  const classes = classesQ.data || []

  const coursesQ = useCachedFetch('/ai-courses?', async () => (await aiCoursesApi.list()).data || [], [])
  const courses = coursesQ.data || []

  const refresh = () => { cache.invalidate('/ai-courses'); coursesQ.refetch() }

  const openCreate = () => { setForm({ ...emptyForm, scheduledAt: defaultScheduledAt() }); setError(''); setShowModal(true) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.sourceType === 'text' && form.sourceText.trim().length < 200) {
      setError('Le contenu du cours est trop court (200 caractères minimum).')
      return
    }
    if (form.sourceType === 'pdf' && !form.pdf) {
      setError('Sélectionnez le fichier PDF du cours.')
      return
    }
    setSaving(true)
    try {
      await aiCoursesApi.create({
        ...form,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
      })
      setShowModal(false)
      refresh()
    } catch (e2) { setError(e2.message) }
    setSaving(false)
  }

  const handleCancel = async (id) => {
    if (!confirm('Annuler ce cours ? Les élèves ne le verront plus.')) return
    try { await aiCoursesApi.cancel(id); refresh() } catch (e) { alert(e.message) }
  }
  const handleDelete = async (id) => {
    if (!confirm('Supprimer définitivement ce cours ?')) return
    try { await aiCoursesApi.remove(id); refresh() } catch (e) { alert(e.message) }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Bot size={22} className="text-purple-600" /> Cours IA
          </h1>
          <p className="text-sm text-gray-500">
            {canCreate
              ? "Programmez un cours : l'IA enseignante le donne en direct à l'heure prévue, puis répond aux questions des élèves."
              : "Suivez les cours donnés en direct par l'IA enseignante et posez vos questions à la fin."}
          </p>
        </div>
        {canCreate && (
          <button onClick={openCreate} className="btn-primary text-sm self-start"><Plus size={15} /> Programmer un cours</button>
        )}
      </div>

      {coursesQ.loading ? (
        <div className="text-center py-16"><Loader2 size={24} className="animate-spin mx-auto text-purple-600" /></div>
      ) : courses.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Bot size={36} className="mx-auto mb-3 opacity-30" />
          <p>Aucun cours IA {canCreate ? 'programmé' : 'pour votre classe'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {courses.map((c) => {
            const meta = STATUS_META[c.status] || STATUS_META.planifie
            const Icon = meta.icon
            const canOpen = ['en_cours', 'termine'].includes(c.status) ||
              (canCreate && ['pret', 'planifie', 'generation', 'erreur'].includes(c.status))
            const isOwner = canCreate && (role === 'directeur' || String(c.teacher) === String(user?._id))
            return (
              <div key={c._id} className="card p-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mb-1">
                      <span className={`font-semibold border rounded-full px-2 py-0.5 flex items-center gap-1 ${meta.cls}`}>
                        <Icon size={11} /> {meta.label}
                      </span>
                      <span className="font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-2 py-0.5">{c.subject}</span>
                      {c.class?.name && <span className="badge badge-blue">{c.class.name}</span>}
                      {c.teacherName && <span>· {c.teacherName}</span>}
                    </div>
                    <h3 className="text-sm font-bold text-gray-900">{c.title}</h3>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-1">
                      <span className="flex items-center gap-1">
                        <CalendarCheck size={12} />
                        {new Date(c.scheduledAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        {' à '}
                        {new Date(c.scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="flex items-center gap-1"><Clock size={12} /> {c.durationMinutes} min</span>
                      {c.sourceType === 'pdf' && <span className="flex items-center gap-1"><FileText size={12} /> PDF</span>}
                      {c.questionCount > 0 && <span>{c.questionCount} question{c.questionCount > 1 ? 's' : ''}</span>}
                    </div>
                    {c.status === 'erreur' && isOwner && (
                      <p className="text-xs text-red-600 mt-1">Ce cours n'a pas pu être diffusé.</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0 flex-wrap">
                    {canOpen && (
                      <button
                        onClick={() => navigate(`/dashboard/ia-cours/${c._id}/live`)}
                        className={`text-xs flex items-center gap-1 ${c.status === 'en_cours' ? 'btn-primary' : 'btn-ghost border border-gray-200'}`}
                      >
                        <Play size={13} />
                        {c.status === 'en_cours' ? 'Rejoindre le direct' : c.status === 'termine' ? 'Relire le cours' : 'Aperçu'}
                      </button>
                    )}
                    {isOwner && ['planifie', 'generation', 'pret'].includes(c.status) && (
                      <button onClick={() => handleCancel(c._id)} className="btn-ghost border border-amber-200 text-amber-700 text-xs flex items-center gap-1">
                        <Ban size={13} /> Annuler
                      </button>
                    )}
                    {isOwner && ['planifie', 'annule', 'erreur'].includes(c.status) && (
                      <button onClick={() => handleDelete(c._id)} className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 size={14} /></button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modale de programmation */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Bot size={18} className="text-purple-600" /> Programmer un cours IA</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Classe</label>
                  <select required value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })} className="input text-sm mt-1">
                    <option value="">Sélectionner...</option>
                    {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Matière</label>
                  <input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Mathématiques" className="input text-sm mt-1" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Titre du cours</label>
                <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex. Théorème de Pythagore" className="input text-sm mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Date & heure de début</label>
                  <input required type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} className="input text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Durée (minutes)</label>
                  <input required type="number" min={5} max={240} value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} className="input text-sm mt-1" />
                </div>
              </div>

              {/* Source du contenu : texte saisi ou PDF */}
              <div>
                <label className="text-xs font-medium text-gray-600">Contenu du cours</label>
                <div className="flex gap-2 mt-1">
                  {[['text', 'Saisir le texte'], ['pdf', 'Importer un PDF']].map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setForm({ ...form, sourceType: v })}
                      className={`text-xs px-3 py-1.5 rounded-full border ${form.sourceType === v ? 'bg-purple-600 text-white border-purple-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      {l}
                    </button>
                  ))}
                </div>
                {form.sourceType === 'text' ? (
                  <textarea rows={6} value={form.sourceText} onChange={(e) => setForm({ ...form, sourceText: e.target.value })}
                    placeholder="Collez ou rédigez ici le contenu du cours (200 caractères minimum). L'IA le développera en une leçon structurée..."
                    className="input text-sm mt-2" />
                ) : (
                  <div className="mt-2">
                    <input type="file" accept="application/pdf" onChange={(e) => setForm({ ...form, pdf: e.target.files?.[0] || null })}
                      className="text-sm w-full border border-dashed border-gray-300 rounded-lg p-3" />
                    <p className="text-[11px] text-gray-400 mt-1">PDF texte uniquement (pas de document scanné).</p>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-gray-500 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
                L'IA prépare la leçon 5 minutes avant l'heure — programmez au moins 10 minutes à l'avance.
                Le cours démarre et se termine automatiquement à l'heure ; les élèves posent leurs questions à la fin.
              </p>

              {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost flex-1 justify-center border border-gray-200">Annuler</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Programmer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
