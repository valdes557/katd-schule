import { useEffect, useRef, useState } from 'react'
import {
  Clock, Plus, Trash2, X, Loader2, AlertCircle, Copy,
  CheckCircle2, Send, EyeOff, AlertTriangle, ShieldAlert,
  Calendar, List, Check, RefreshCw
} from 'lucide-react'
import { timetablesApi, classesApi, subjectsApi, teachersApi } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'
import DownloadPdfButton from '../components/DownloadPdfButton'

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const SLOT_COLORS = ['#3B82F6','#10B981','#F59E0B','#8B5CF6','#EF4444','#06B6D4','#EC4899','#14B8A6','#F97316','#6366F1']
const DAY_COLORS = { Lundi: 'bg-blue-50', Mardi: 'bg-green-50', Mercredi: 'bg-yellow-50', Jeudi: 'bg-purple-50', Vendredi: 'bg-red-50', Samedi: 'bg-cyan-50' }

const EMPTY_SLOT = { day: 'Lundi', date: '', startTime: '08:00', endTime: '09:00', subject: '', teacher: '', room: '', color: '#3B82F6', type: 'cours', title: '' }

export default function EmploiDuTempsPage() {
  const pdfRef = useRef(null)
  const { user } = useAuth()
  // Seul le directeur gère l'emploi du temps : créer, modifier, attribuer et retirer
  // l'emploi du temps à une classe. Tous les autres rôles (enseignant, vice-principal,
  // parent, élève) sont en lecture seule.
  const canEdit = user?.role === 'directeur'
  const canPublish = user?.role === 'directeur'

  const [viewMode, setViewMode] = useState('grille') // 'grille' | 'activites'
  const [selectedClass, setSelectedClass] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [slotForm, setSlotForm] = useState(EMPTY_SLOT)
  const [showAssign, setShowAssign] = useState(false)
  const [assignTargets, setAssignTargets] = useState([])
  const [assigning, setAssigning] = useState(false)
  // Mode de la modale : 'assign' (attribuer/dupliquer) ou 'unassign' (retirer).
  const [assignMode, setAssignMode] = useState('assign')

  // Détection des conflits
  const [conflictsData, setConflictsData] = useState(null)
  const [checkingConflicts, setCheckingConflicts] = useState(false)
  const [showConflictsBanner, setShowConflictsBanner] = useState(false)

  const classesQ = useCachedFetch('/classes?', async () => (await classesApi.list()).data || [], [])
  const subjectsQ = useCachedFetch('/subjects?', async () => (await subjectsApi.list()).data || [], [])
  const teachersQ = useCachedFetch('/teachers?', async () => (await teachersApi.list()).data || [], [])

  const classes = classesQ.data || []
  const subjects = subjectsQ.data || []
  const teachers = teachersQ.data || []

  // Auto-select first class once classes are loaded
  useEffect(() => {
    if (!selectedClass && classes.length > 0) setSelectedClass(classes[0]._id)
  }, [classes, selectedClass])

  const cls = selectedClass
  const timetableQ = useCachedFetch(
    cls ? `/timetables?classId=${cls}` : null,
    async () => (await timetablesApi.getByClass(cls)).data || null,
    [cls],
  )

  const timetable = timetableQ.data
  const loading = classesQ.loading
  const slotLoading = timetableQ.loading

  const refreshTimetable = () => { cache.invalidate('/timetables'); timetableQ.refetch() }

  const addSlot = async (e) => {
    e.preventDefault()
    if (!timetable) return
    if (slotForm.startTime && slotForm.endTime && slotForm.endTime <= slotForm.startTime) {
      alert("L'heure de fin doit être après l'heure de début")
      return
    }
    try {
      const r = await timetablesApi.addSlot(timetable._id, slotForm)
      timetableQ.setData(r.data)
      setShowModal(false)
      setSlotForm(EMPTY_SLOT)
    } catch (e) { alert(e.message) }
  }

  const removeSlot = async (slotId) => {
    if (!confirm('Supprimer ce créneau ?')) return
    try {
      const r = await timetablesApi.removeSlot(timetable._id, slotId)
      timetableQ.setData(r.data)
    } catch (e) { alert(e.message) }
  }

  const toggleTarget = (id) =>
    setAssignTargets((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const handleAssign = async () => {
    if (!timetable || assignTargets.length === 0) return
    setAssigning(true)
    try {
      if (assignMode === 'unassign') {
        const r = await timetablesApi.unassignFrom(timetable._id, assignTargets)
        if (r.success) {
          cache.invalidate('/timetables')
          alert(`Emploi du temps retiré de ${r.data.updated} classe(s).`)
          setShowAssign(false)
          setAssignTargets([])
        } else alert(r.message || 'Erreur')
      } else {
        const r = await timetablesApi.assignTo(timetable._id, assignTargets)
        if (r.success) {
          cache.invalidate('/timetables')
          alert(`Emploi du temps appliqué à ${r.data.updated} salle(s)/classe(s).`)
          setShowAssign(false)
          setAssignTargets([])
        } else alert(r.message || 'Erreur')
      }
    } catch (e) { alert(e.message) }
    setAssigning(false)
  }

  // Publie / dépublie l'emploi du temps courant (G4)
  const [publishing, setPublishing] = useState(false)
  const togglePublish = async () => {
    if (!timetable) return
    const publish = timetable.status !== 'publie'
    if (publish && slots.length === 0) { alert('Ajoutez au moins un créneau avant de publier.'); return }
    if (!publish && !confirm('Retirer la publication ? Les élèves et parents ne verront plus cet emploi du temps.')) return
    setPublishing(true)
    try {
      const r = await timetablesApi.publish(timetable._id, publish)
      timetableQ.setData(r.data)
      cache.invalidate('/timetables')
    } catch (e) { alert(e.message) }
    setPublishing(false)
  }

  const handleCheckConflicts = async () => {
    setCheckingConflicts(true)
    try {
      const res = await timetablesApi.conflicts()
      if (res.success) {
        setConflictsData(res.data)
        setShowConflictsBanner(true)
      } else {
        alert(res.message || 'Erreur lors de la vérification')
      }
    } catch (err) {
      alert(err.message)
    }
    setCheckingConflicts(false)
  }

  const slots = timetable?.slots || []
  const currentClass = classes.find((c) => c._id === selectedClass)

  // Lignes horaires de la grille : dérivées des créneaux réels (heures libres possibles,
  // ex. 06:30 ou 18:45), avec la plage par défaut 07:00 → 18:00 en repli.
  const slotHours = slots.map((s) => parseInt(s.startTime, 10)).filter((h) => !Number.isNaN(h))
  const firstHour = Math.min(7, ...(slotHours.length ? slotHours : [7]))
  const lastHour = Math.max(17, ...(slotHours.length ? slotHours : [17]))
  const GRID_HOURS = []
  for (let h = firstHour; h <= lastHour; h++) GRID_HOURS.push(String(h).padStart(2, '0') + ':00')

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>

  return (
    <div className="space-y-5 animate-fade-in" ref={pdfRef}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Clock size={22} className="text-indigo-600" /> Emploi du temps & Agenda
          </h1>
          <p className="text-sm text-gray-500 flex items-center gap-2">
            {currentClass ? `${currentClass.name} — ${currentClass.cycle}` : 'Sélectionnez une classe'}
            {timetable && (
              timetable.status === 'publie'
                ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5"><CheckCircle2 size={11} /> Publié</span>
                : <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">Brouillon</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="input text-sm w-auto">
            {classes.map((c) => <option key={c._id} value={c._id}>{c.name} ({c.cycle})</option>)}
          </select>
          <DownloadPdfButton containerRef={pdfRef} filename="emploi-du-temps.pdf" title="Emploi du temps" subtitle={currentClass ? `${currentClass.name} — ${currentClass.cycle}` : ''} label="Emploi du temps PDF" iconOnly />
          {canEdit && (
            <button
              onClick={handleCheckConflicts}
              disabled={checkingConflicts}
              className="btn-ghost text-sm border border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 flex items-center gap-1.5"
              title="Détecter les conflits d'enseignants ou de salles"
            >
              {checkingConflicts ? <Loader2 size={15} className="animate-spin" /> : <ShieldAlert size={15} />}
              Vérifier les conflits
            </button>
          )}
          {canEdit && timetable && (
            <button onClick={() => { setSlotForm(EMPTY_SLOT); setShowModal(true) }} className="btn-primary text-sm">
              <Plus size={15} /> Ajouter
            </button>
          )}
          {canEdit && timetable && (
            <button onClick={() => { setAssignMode('assign'); setAssignTargets([]); setShowAssign(true) }} className="btn-ghost text-sm border border-gray-200" title="Appliquer cet emploi du temps à d'autres salles">
              <Copy size={15} /> Attribuer à d'autres classes
            </button>
          )}
          {canEdit && timetable && (
            <button onClick={() => { setAssignMode('unassign'); setAssignTargets([]); setShowAssign(true) }} className="btn-ghost text-sm border border-red-200 text-red-600" title="Retirer l'emploi du temps de certaines classes">
              <Trash2 size={15} /> Retirer d'une classe
            </button>
          )}
          {canPublish && timetable && (
            <button
              onClick={togglePublish}
              disabled={publishing}
              className={`text-sm ${timetable.status === 'publie' ? 'btn-ghost border border-amber-200 text-amber-700' : 'btn-primary bg-green-600 hover:bg-green-700'}`}
              title={timetable.status === 'publie' ? 'Retirer la publication' : 'Publier pour les élèves et parents'}
            >
              {publishing ? <Loader2 size={15} className="animate-spin" /> : timetable.status === 'publie' ? <><EyeOff size={15} /> Dépublier</> : <><Send size={15} /> Publier</>}
            </button>
          )}
        </div>
      </div>

      {/* Onglets Grille vs Activités planifiées */}
      <div className="flex gap-2 border-b border-gray-100">
        <button
          onClick={() => setViewMode('grille')}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${viewMode === 'grille' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <Clock size={15} /> Grille hebdomadaire
        </button>
        <button
          onClick={() => setViewMode('activites')}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${viewMode === 'activites' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <Calendar size={15} /> Toutes les activités (Mois / Année)
        </button>
      </div>

      {/* Bannière de détection des conflits */}
      {showConflictsBanner && conflictsData && (
        <div className={`p-4 rounded-2xl border transition-all ${conflictsData.hasConflicts ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <h4 className={`text-sm font-bold flex items-center gap-2 ${conflictsData.hasConflicts ? 'text-red-800' : 'text-green-800'}`}>
              {conflictsData.hasConflicts ? <AlertTriangle size={18} className="text-red-600" /> : <CheckCircle2 size={18} className="text-green-600" />}
              {conflictsData.hasConflicts ? `Attention : ${conflictsData.totalConflicts} conflit(s) ou incohérence(s) détecté(s)` : 'Aucun conflit de calendrier détecté !'}
            </h4>
            <button onClick={() => setShowConflictsBanner(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded"><X size={16} /></button>
          </div>

          {conflictsData.hasConflicts ? (
            <div className="space-y-2 text-xs text-red-700">
              {conflictsData.teacherConflicts?.length > 0 && (
                <div>
                  <p className="font-bold underline">Conflits d'enseignants (même enseignant programmé simultanément) :</p>
                  <ul className="list-disc pl-5 mt-1 space-y-0.5">
                    {conflictsData.teacherConflicts.map((c, i) => (
                      <li key={i}>
                        <strong>{c.teacher}</strong> programmé(e) le <strong>{c.day}</strong> ({c.startTime} - {c.endTime}) en même temps dans les classes : {c.classNames?.join(', ')}.
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {conflictsData.roomConflicts?.length > 0 && (
                <div className="mt-2">
                  <p className="font-bold underline">Conflits de salles (même salle occupée simultanément) :</p>
                  <ul className="list-disc pl-5 mt-1 space-y-0.5">
                    {conflictsData.roomConflicts.map((c, i) => (
                      <li key={i}>
                        Salle <strong>{c.room}</strong> occupée le <strong>{c.day}</strong> ({c.startTime} - {c.endTime}) simultanément par : {c.classNames?.join(', ')}.
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {conflictsData.chronologicalErrors?.length > 0 && (
                <div className="mt-2">
                  <p className="font-bold underline">Incohérences chronologiques d'horaires :</p>
                  <ul className="list-disc pl-5 mt-1 space-y-0.5">
                    {conflictsData.chronologicalErrors.map((c, i) => (
                      <li key={i}>
                        Classe {c.className} le {c.day} : heure de début ({c.startTime}) supérieure ou égale à la fin ({c.endTime}).
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-green-700">
              Tous les créneaux horaires, enseignants et salles sont bien synchronisés sans chevauchement.
            </p>
          )}
        </div>
      )}

      {viewMode === 'activites' ? (
        <AllActivitiesView classes={classes} currentClassId={selectedClass} />
      ) : classes.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <AlertCircle size={36} className="mx-auto mb-3 opacity-30" />
          <p>Aucune classe créée. Créez d'abord des classes.</p>
        </div>
      ) : slotLoading ? (
        <div className="text-center py-16"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-500 px-3 py-3 w-24">Heure</th>
                {DAYS.map((d) => (
                  <th key={d} className={`text-center text-xs font-semibold text-gray-700 px-2 py-3 ${DAY_COLORS[d]}`}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GRID_HOURS.map((hour) => {
                const nextHour = String(parseInt(hour, 10) + 1).padStart(2, '0') + ':00'
                return (
                  <tr key={hour} className="border-b border-gray-50">
                    <td className="px-3 py-1 text-[10px] font-mono text-gray-400 align-top pt-2">{hour}</td>
                    {DAYS.map((day) => {
                      const daySlots = slots.filter((s) => s.day === day && s.startTime >= hour && s.startTime < nextHour)
                      return (
                        <td key={day} className="px-1 py-1 align-top">
                          {daySlots.map((s) => {
                            const isEval = s.type === 'evaluation' || s.isScheduledEvaluation
                            const isAct = s.type === 'activite'
                            return (
                              <div
                                key={s._id}
                                className={`rounded-lg px-2 py-1.5 mb-0.5 text-white text-[10px] leading-tight group relative ${isEval ? 'ring-2 ring-amber-300 shadow' : ''}`}
                                style={{ backgroundColor: s.color || (isEval ? '#8B5CF6' : isAct ? '#10B981' : '#3B82F6') }}
                              >
                                {isEval && (
                                  <div className="inline-block bg-white/25 text-[8px] font-extrabold uppercase px-1 rounded mb-0.5 tracking-wide">
                                    📝 {s.evaluationType || s.title || 'ÉVALUATION'}
                                  </div>
                                )}
                                {isAct && (
                                  <div className="inline-block bg-white/25 text-[8px] font-extrabold uppercase px-1 rounded mb-0.5 tracking-wide">
                                    🎯 {s.title || 'ACTIVITÉ'}
                                  </div>
                                )}
                                <div className="font-bold">{s.subject || s.title || '—'}</div>
                                <div className="opacity-80">{s.startTime}-{s.endTime}</div>
                                {s.date && <div className="opacity-70">📅 {new Date(s.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</div>}
                                {s.teacher && <div className="opacity-70">{s.teacher}</div>}
                                {s.room && <div className="opacity-70">📍 {s.room}</div>}
                                {canEdit && (
                                  <button
                                    onClick={() => removeSlot(s._id)}
                                    className="absolute top-0.5 right-0.5 bg-white/30 rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Trash2 size={9} />
                                  </button>
                                )}
                              </div>
                            )
                          })}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {slots.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">
              Aucun créneau défini.{canEdit && ' Cliquez sur "Ajouter" pour commencer.'}
            </div>
          )}
        </div>
      )}

      {showAssign && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              {assignMode === 'unassign' ? (
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Trash2 size={18} className="text-red-600" /> Retirer l'emploi du temps</h3>
              ) : (
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Copy size={18} className="text-indigo-600" /> Attribuer l'emploi du temps</h3>
              )}
              <button onClick={() => setShowAssign(false)} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
            </div>
            {assignMode === 'unassign' ? (
              <p className="text-xs text-gray-500 mb-3">
                L'emploi du temps sera <strong className="text-red-600">retiré (vidé)</strong> des classes cochées, qui repasseront en brouillon.
                <span className="text-amber-600"> Les élèves et parents ne le verront plus.</span>
              </p>
            ) : (
              <p className="text-xs text-gray-500 mb-3">
                Les créneaux de <strong>{currentClass?.name}</strong> seront copiés vers les salles/classes cochées.
                <span className="text-amber-600"> L'emploi du temps existant de ces classes sera remplacé.</span>
              </p>
            )}
            {(() => {
              // Attribuer : on exclut la classe source (on ne duplique pas sur elle-même).
              // Retirer : on autorise toutes les classes (y compris celle affichée).
              const others = assignMode === 'unassign' ? classes : classes.filter((c) => c._id !== selectedClass)
              const allSelected = others.length > 0 && others.every((c) => assignTargets.includes(c._id))
              const accent = assignMode === 'unassign' ? 'red' : 'indigo'
              return (
                <div className="space-y-1.5 mb-4">
                  {others.length > 0 && (
                    <label className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer ${accent === 'red' ? 'border-red-100 bg-red-50/60 hover:bg-red-50' : 'border-indigo-100 bg-indigo-50/60 hover:bg-indigo-50'}`}>
                      <input type="checkbox" checked={allSelected}
                        onChange={() => setAssignTargets(allSelected ? [] : others.map((c) => c._id))}
                        className={`w-4 h-4 ${accent === 'red' ? 'accent-red-600' : 'accent-indigo-600'}`} />
                      <span className={`text-sm font-semibold ${accent === 'red' ? 'text-red-700' : 'text-indigo-700'}`}>Tout l'établissement (toutes les classes)</span>
                    </label>
                  )}
                  {others.map((c) => (
                    <label key={c._id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={assignTargets.includes(c._id)} onChange={() => toggleTarget(c._id)} className={`w-4 h-4 ${accent === 'red' ? 'accent-red-600' : 'accent-indigo-600'}`} />
                      <span className="text-sm text-gray-700">{c.name} <span className="text-gray-400">({c.cycle})</span></span>
                    </label>
                  ))}
                  {others.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-3">Aucune classe disponible.</p>
                  )}
                </div>
              )
            })()}
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowAssign(false)} className="btn-ghost flex-1 justify-center border border-gray-200">Annuler</button>
              <button type="button" disabled={assigning || assignTargets.length === 0} onClick={handleAssign}
                className={`flex-1 justify-center ${assignMode === 'unassign' ? 'btn-ghost border border-red-200 text-red-600' : 'btn-primary'}`}>
                {assigning ? <Loader2 size={14} className="animate-spin" /> : assignMode === 'unassign' ? <Trash2 size={14} /> : <CheckCircle2 size={14} />} {assignMode === 'unassign' ? 'Retirer' : 'Appliquer'} ({assignTargets.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Nouveau créneau</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
            </div>
            <form onSubmit={addSlot} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Type de créneau *</label>
                  <select value={slotForm.type || 'cours'} onChange={(e) => setSlotForm({ ...slotForm, type: e.target.value })} className="input text-sm mt-1">
                    <option value="cours">Cours régulier</option>
                    <option value="evaluation">Évaluation programmée</option>
                    <option value="activite">Activité (sortie, kermesse...)</option>
                    <option value="reunion">Réunion / Conseil</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Titre / Libellé</label>
                  <input value={slotForm.title || ''} onChange={(e) => setSlotForm({ ...slotForm, title: e.target.value })} className="input text-sm mt-1" placeholder="Ex: Devoir surveillé N°1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Jour *</label>
                  <select value={slotForm.day} onChange={(e) => setSlotForm({ ...slotForm, day: e.target.value })} className="input text-sm mt-1">
                    {DAYS.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Couleur</label>
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {SLOT_COLORS.map((c) => (
                      <button key={c} type="button" onClick={() => setSlotForm({ ...slotForm, color: c })}
                        className={`w-6 h-6 rounded-lg border-2 transition-all ${slotForm.color === c ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Date précise (optionnel)</label>
                <input type="date" value={slotForm.date} onChange={(e) => setSlotForm({ ...slotForm, date: e.target.value })} className="input text-sm mt-1" />
                <p className="text-[10px] text-gray-400 mt-1">Laissez vide pour un cours hebdomadaire récurrent.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Début *</label>
                  <input type="time" required value={slotForm.startTime} onChange={(e) => setSlotForm({ ...slotForm, startTime: e.target.value })} className="input text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Fin *</label>
                  <input type="time" required value={slotForm.endTime} onChange={(e) => setSlotForm({ ...slotForm, endTime: e.target.value })} className="input text-sm mt-1" />
                </div>
              </div>
              <p className="text-[10px] text-gray-400 -mt-1">Saisissez librement les heures (ex. 07:45 → 09:15).</p>
              <div>
                <label className="text-xs font-medium text-gray-600">Matière</label>
                <select value={slotForm.subject} onChange={(e) => setSlotForm({ ...slotForm, subject: e.target.value })} className="input text-sm mt-1">
                  <option value="">— Sélectionner —</option>
                  {subjects.map((s) => <option key={s._id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Enseignant</label>
                  <select value={slotForm.teacher} onChange={(e) => setSlotForm({ ...slotForm, teacher: e.target.value })} className="input text-sm mt-1">
                    <option value="">—</option>
                    {teachers.map((t) => <option key={t._id} value={`${t.lastName} ${t.firstName}`}>{t.lastName} {t.firstName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Salle</label>
                  <input value={slotForm.room} onChange={(e) => setSlotForm({ ...slotForm, room: e.target.value })} className="input text-sm mt-1" placeholder="Salle 12" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost flex-1 justify-center border border-gray-200">Annuler</button>
                <button type="submit" className="btn-primary flex-1 justify-center">Ajouter</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Liste et planification des activités par mois / année (Point 5) ─── */
function AllActivitiesView({ classes, currentClassId }) {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState('')
  const [selectedClass, setSelectedClass] = useState(currentClassId || '')
  const [selectedType, setSelectedType] = useState('')
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const MONTHS = [
    { value: '', label: 'Toute l\'année' },
    { value: '1', label: 'Janvier' },
    { value: '2', label: 'Février' },
    { value: '3', label: 'Mars' },
    { value: '4', label: 'Avril' },
    { value: '5', label: 'Mai' },
    { value: '6', label: 'Juin' },
    { value: '7', label: 'Juillet' },
    { value: '8', label: 'Août' },
    { value: '9', label: 'Septembre' },
    { value: '10', label: 'Octobre' },
    { value: '11', label: 'Novembre' },
    { value: '12', label: 'Décembre' },
  ]

  const loadActivities = async () => {
    setLoading(true)
    try {
      const res = await timetablesApi.allActivities({
        year,
        month,
        classId: selectedClass,
        type: selectedType,
      })
      if (res.success) setActivities(res.data?.activities || [])
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadActivities()
  }, [year, month, selectedClass, selectedType])

  const handleSyncEvaluations = async () => {
    if (!selectedClass) {
      alert('Veuillez sélectionner une classe spécifique à synchroniser.')
      return
    }
    setSyncing(true)
    try {
      const res = await classesApi.syncEvaluationsToAgenda(selectedClass)
      if (res.success) {
        alert(res.message || 'Évaluations synchronisées avec succès !')
        loadActivities()
      } else {
        alert(res.message || 'Erreur lors de la synchronisation')
      }
    } catch (err) {
      alert(err.message)
    }
    setSyncing(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <label className="text-[10px] font-semibold text-gray-500 block mb-1">Année</label>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="input text-xs w-28">
              {[year - 1, year, year + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 block mb-1">Mois</label>
            <select value={month} onChange={(e) => setMonth(e.target.value)} className="input text-xs w-36">
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 block mb-1">Classe</label>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="input text-xs w-44">
              <option value="">Toutes les classes</option>
              {classes.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 block mb-1">Type d'activité</label>
            <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="input text-xs w-36">
              <option value="">Tous les types</option>
              <option value="cours">Cours réguliers</option>
              <option value="evaluation">Évaluations</option>
              <option value="activite">Activités & Projets</option>
              <option value="reunion">Réunions</option>
            </select>
          </div>
        </div>

        {selectedClass && (
          <button
            onClick={handleSyncEvaluations}
            disabled={syncing}
            className="btn-ghost text-xs border border-purple-200 text-purple-700 hover:bg-purple-50 flex items-center gap-1.5 self-start sm:self-auto"
            title="Générer automatiquement l'agenda à partir des évaluations configurées pour cette classe"
          >
            {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Générer l'agenda depuis les évaluations
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="text-center py-12"><Loader2 size={24} className="animate-spin text-indigo-600 mx-auto" /></div>
        ) : activities.length === 0 ? (
          <div className="text-center py-14 text-gray-400">
            <Calendar size={36} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm font-semibold text-gray-700">Aucune activité programmée pour cette période</p>
            <p className="text-xs text-gray-400 mt-1">Vous pouvez ajouter des cours, évaluations ou activités depuis la grille.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-600 border-b border-gray-100">
                <tr>
                  <th className="py-2.5 px-3 text-left font-semibold">Jour / Date</th>
                  <th className="py-2.5 px-3 text-left font-semibold">Horaire</th>
                  <th className="py-2.5 px-3 text-left font-semibold">Activité / Matière</th>
                  <th className="py-2.5 px-3 text-left font-semibold">Type</th>
                  <th className="py-2.5 px-3 text-left font-semibold">Classe</th>
                  <th className="py-2.5 px-3 text-left font-semibold">Intervenant / Salle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activities.map((a, idx) => (
                  <tr key={`${a._id}-${idx}`} className="hover:bg-gray-50">
                    <td className="py-2.5 px-3 font-medium text-gray-800">
                      {a.date ? new Date(a.date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' }) : a.day}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-gray-600">{a.startTime} - {a.endTime}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-gray-900">{a.title || a.subject || '—'}</div>
                      {a.title && a.subject && <div className="text-[10px] text-gray-400">{a.subject}</div>}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        a.type === 'evaluation' ? 'bg-purple-100 text-purple-700' :
                        a.type === 'activite' ? 'bg-emerald-100 text-emerald-700' :
                        a.type === 'reunion' ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {a.type === 'evaluation' ? 'Évaluation' :
                         a.type === 'activite' ? 'Activité' :
                         a.type === 'reunion' ? 'Réunion' : 'Cours'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-700">{a.className || '—'}</td>
                    <td className="py-2.5 px-3 text-gray-500">
                      {a.teacher && <div>👨‍🏫 {a.teacher}</div>}
                      {a.room && <div className="text-[10px]">📍 {a.room}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}