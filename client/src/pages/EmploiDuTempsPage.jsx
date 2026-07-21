import { useEffect, useRef, useState } from 'react'
import { Clock, Plus, Trash2, X, Loader2, AlertCircle, Copy, CheckCircle2 } from 'lucide-react'
import { timetablesApi, classesApi, subjectsApi, teachersApi } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'
import DownloadPdfButton from '../components/DownloadPdfButton'

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const SLOT_COLORS = ['#3B82F6','#10B981','#F59E0B','#8B5CF6','#EF4444','#06B6D4','#EC4899','#14B8A6','#F97316','#6366F1']
const DAY_COLORS = { Lundi: 'bg-blue-50', Mardi: 'bg-green-50', Mercredi: 'bg-yellow-50', Jeudi: 'bg-purple-50', Vendredi: 'bg-red-50', Samedi: 'bg-cyan-50' }

const EMPTY_SLOT = { day: 'Lundi', date: '', startTime: '08:00', endTime: '09:00', subject: '', teacher: '', room: '', color: '#3B82F6' }

export default function EmploiDuTempsPage() {
  const pdfRef = useRef(null)
  const { user } = useAuth()
  const isDirecteur = user?.role === 'directeur' || user?.role === 'super_admin'
  // Le personnel enseignant peut aussi gérer l'emploi du temps (ajout de créneaux avec
  // heures libres + duplication vers plusieurs classes) — routes serveur déjà ouvertes.
  // Le vice-principal (Secondaire) gère les EDT de tout l'établissement.
  const canEdit = isDirecteur || user?.role === 'enseignant' || user?.role === 'vice_principal'

  const [selectedClass, setSelectedClass] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [slotForm, setSlotForm] = useState(EMPTY_SLOT)
  const [showAssign, setShowAssign] = useState(false)
  const [assignTargets, setAssignTargets] = useState([])
  const [assigning, setAssigning] = useState(false)

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
      const r = await timetablesApi.assignTo(timetable._id, assignTargets)
      if (r.success) {
        cache.invalidate('/timetables')
        alert(`Emploi du temps appliqué à ${r.data.updated} salle(s)/classe(s).`)
        setShowAssign(false)
        setAssignTargets([])
      } else alert(r.message || 'Erreur')
    } catch (e) { alert(e.message) }
    setAssigning(false)
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
            <Clock size={22} className="text-indigo-600" /> Emploi du temps
          </h1>
          <p className="text-sm text-gray-500">{currentClass ? `${currentClass.name} — ${currentClass.cycle}` : 'Sélectionnez une classe'}</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="input text-sm w-auto">
            {classes.map((c) => <option key={c._id} value={c._id}>{c.name} ({c.cycle})</option>)}
          </select>
          <DownloadPdfButton containerRef={pdfRef} filename="emploi-du-temps.pdf" title="Emploi du temps" subtitle={currentClass ? `${currentClass.name} — ${currentClass.cycle}` : ''} label="Emploi du temps PDF" iconOnly />
          {canEdit && timetable && (
            <button onClick={() => { setSlotForm(EMPTY_SLOT); setShowModal(true) }} className="btn-primary text-sm">
              <Plus size={15} /> Ajouter
            </button>
          )}
          {canEdit && timetable && (
            <button onClick={() => { setAssignTargets([]); setShowAssign(true) }} className="btn-ghost text-sm border border-gray-200" title="Appliquer cet emploi du temps à d'autres salles">
              <Copy size={15} /> Dupliquer vers d'autres salles
            </button>
          )}
        </div>
      </div>

      {classes.length === 0 ? (
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
                          {daySlots.map((s) => (
                            <div
                              key={s._id}
                              className="rounded-lg px-2 py-1.5 mb-0.5 text-white text-[10px] leading-tight group relative"
                              style={{ backgroundColor: s.color || '#3B82F6' }}
                            >
                              <div className="font-bold">{s.subject || '—'}</div>
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
                          ))}
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
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Copy size={18} className="text-indigo-600" /> Dupliquer l'emploi du temps</h3>
              <button onClick={() => setShowAssign(false)} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Les créneaux de <strong>{currentClass?.name}</strong> seront copiés vers les salles/classes cochées.
              <span className="text-amber-600"> L'emploi du temps existant de ces classes sera remplacé.</span>
            </p>
            {(() => {
              const others = classes.filter((c) => c._id !== selectedClass)
              const allSelected = others.length > 0 && others.every((c) => assignTargets.includes(c._id))
              return (
                <div className="space-y-1.5 mb-4">
                  {others.length > 0 && (
                    <label className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-indigo-100 bg-indigo-50/60 hover:bg-indigo-50 cursor-pointer">
                      <input type="checkbox" checked={allSelected}
                        onChange={() => setAssignTargets(allSelected ? [] : others.map((c) => c._id))}
                        className="w-4 h-4 accent-indigo-600" />
                      <span className="text-sm font-semibold text-indigo-700">Toute l'établissement (toutes les classes)</span>
                    </label>
                  )}
                  {others.map((c) => (
                    <label key={c._id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={assignTargets.includes(c._id)} onChange={() => toggleTarget(c._id)} className="w-4 h-4 accent-indigo-600" />
                      <span className="text-sm text-gray-700">{c.name} <span className="text-gray-400">({c.cycle})</span></span>
                    </label>
                  ))}
                  {others.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-3">Aucune autre classe disponible.</p>
                  )}
                </div>
              )
            })()}
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowAssign(false)} className="btn-ghost flex-1 justify-center border border-gray-200">Annuler</button>
              <button type="button" disabled={assigning || assignTargets.length === 0} onClick={handleAssign} className="btn-primary flex-1 justify-center">
                {assigning ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Appliquer ({assignTargets.length})
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