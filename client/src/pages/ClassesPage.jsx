import { useEffect, useState, useRef } from 'react'
import {
  BookOpen, Plus, Search, Edit2, Trash2, X, Loader2,
  AlertCircle, Users, DoorOpen, Sliders, Copy, Calendar, CheckCircle2
} from 'lucide-react'
import { classesApi, teachersApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'
import { useAuth } from '../context/AuthContext'
import DownloadPdfButton from '../components/DownloadPdfButton'

const CYCLES = ['Maternelle', 'Primaire', 'Secondaire']
const CYCLE_COLORS = { Maternelle: 'bg-orange-100 text-orange-700', Primaire: 'bg-blue-100 text-blue-700', Secondaire: 'bg-green-100 text-green-700' }

const EMPTY = { name: '', level: '', cycle: 'Primaire', room: '', capacity: 40, enrollmentFee: 0, mainTeacher: '', academicYear: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1) }

export default function ClassesPage() {
  const pdfRef = useRef(null)
  const { user, school } = useAuth()
  const isDirecteur = user?.role === 'directeur' || user?.role === 'super_admin'
  const isEnseignant = user?.role === 'enseignant'
  const subscribedCycle = user?.role === 'directeur' && school?.subscription?.cycle ? school.subscription.cycle : null
  const cycles = subscribedCycle ? [subscribedCycle] : CYCLES

  const [search, setSearch] = useState('')
  const [cycleFilter, setCycleFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [evalConfigClass, setEvalConfigClass] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)

  useEffect(() => {
    if (subscribedCycle && cycleFilter !== subscribedCycle) setCycleFilter(subscribedCycle)
  }, [subscribedCycle])

  const classesQ = useCachedFetch(
    `/classes?${cycleFilter ? `cycle=${cycleFilter}` : ''}`,
    async () => (await classesApi.list(cycleFilter ? `cycle=${cycleFilter}` : '')).data || [],
    [cycleFilter],
  )
  const teachersQ = useCachedFetch('/teachers?', async () => (await teachersApi.list()).data || [], [])

  const classes = classesQ.data || []
  const teachers = teachersQ.data || []
  const loading = classesQ.loading

  const refreshClasses = () => { cache.invalidate('/classes'); classesQ.refetch() }

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
      refreshClasses()
    } catch (e) { alert(e.message) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette classe ?')) return
    try { await classesApi.remove(id); refreshClasses() } catch (e) { alert(e.message) }
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
    <div className="space-y-5 animate-fade-in" ref={pdfRef}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen size={22} className="text-blue-600" /> Classes & Salles
          </h1>
          <p className="text-sm text-gray-500">{classes.length} classe(s)</p>
        </div>
        <div className="flex gap-2">
          <DownloadPdfButton containerRef={pdfRef} filename="classes-salles.pdf" title="Classes & salles" label="Classes PDF" iconOnly={!isDirecteur} />
          {isDirecteur && (
            <button onClick={() => { setEditing(null); setForm({ ...EMPTY, cycle: subscribedCycle || EMPTY.cycle }); setShowModal(true) }} className="btn-primary text-sm self-start">
              <Plus size={15} /> Créer une classe
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..." className="input pl-9 text-sm" />
        </div>
        {!isEnseignant && (
          <select value={cycleFilter} onChange={(e) => setCycleFilter(e.target.value)} className="input text-sm w-auto">
            {!subscribedCycle && <option value="">Tous les cycles</option>}
            {cycles.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
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
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEvalConfigClass(c)} title="Configurer les évaluations" className="p-1 rounded hover:bg-purple-50 text-purple-600">
                      <Sliders size={13} />
                    </button>
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
              {c.evaluationConfig?.types?.length > 0 ? (
                <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] text-purple-700">
                  <span className="flex items-center gap-1 font-medium"><Sliders size={11} /> {c.evaluationConfig.types.length} type(s) d'évaluation</span>
                  {isDirecteur && (
                    <button onClick={() => setEvalConfigClass(c)} className="text-purple-600 hover:underline font-semibold">Gérer</button>
                  )}
                </div>
              ) : isDirecteur ? (
                <div className="mt-3 pt-2.5 border-t border-gray-100">
                  <button onClick={() => setEvalConfigClass(c)} className="text-[11px] text-gray-400 hover:text-purple-600 flex items-center gap-1">
                    <Sliders size={11} /> Configurer les évaluations
                  </button>
                </div>
              ) : null}
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
                    {cycles.map((c) => <option key={c}>{c}</option>)}
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

      {evalConfigClass && (
        <EvaluationConfigModal
          cls={evalConfigClass}
          allClasses={classes}
          onClose={() => setEvalConfigClass(null)}
          onUpdated={() => { setEvalConfigClass(null); refreshClasses() }}
        />
      )}
    </div>
  )
}

function EvaluationConfigModal({ cls, allClasses, onClose, onUpdated }) {
  const [types, setTypes] = useState(cls.evaluationConfig?.types || [
    { name: 'Devoir surveillé', code: 'DS', periodicity: 'hebdomadaire', weight: 1, subjects: [], calculationMethod: 'moyenne_ponderee', appreciationRule: 'Standard' },
    { name: 'Composition', code: 'COMP', periodicity: 'trimestrielle', weight: 2, subjects: [], calculationMethod: 'moyenne_ponderee', appreciationRule: 'Standard' },
  ])
  const [annualMethod, setAnnualMethod] = useState(cls.evaluationConfig?.annualCalculationMethod || 'moyenne_trimestres')
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [duplicateModal, setDuplicateModal] = useState(false)
  const [selectedTargets, setSelectedTargets] = useState([])
  const [duplicating, setDuplicating] = useState(false)

  const otherClasses = allClasses.filter((c) => c._id !== cls._id)

  const addType = () => {
    setTypes([
      ...types,
      {
        name: 'Devoir maison',
        code: 'DM',
        periodicity: 'hebdomadaire',
        weight: 1,
        subjects: [],
        calculationMethod: 'moyenne_simple',
        appreciationRule: 'Standard'
      }
    ])
  }

  const removeType = (index) => {
    setTypes(types.filter((_, idx) => idx !== index))
  }

  const updateType = (index, field, value) => {
    const updated = [...types]
    updated[index] = { ...updated[index], [field]: value }
    setTypes(updated)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        types: types.map(t => ({
          ...t,
          weight: Number(t.weight) || 1,
          subjects: Array.isArray(t.subjects) ? t.subjects : String(t.subjects || '').split(',').map(s => s.trim()).filter(Boolean)
        })),
        annualCalculationMethod: annualMethod
      }
      const res = await classesApi.saveEvaluationConfig(cls._id, payload)
      if (res.success) {
        alert('Configuration des évaluations enregistrée avec succès.')
        onUpdated()
      } else {
        alert(res.message || 'Erreur lors de l\'enregistrement')
      }
    } catch (err) {
      alert(err.message)
    }
    setSaving(false)
  }

  const handleSyncToAgenda = async () => {
    setSyncing(true)
    try {
      const res = await classesApi.syncEvaluationsToAgenda(cls._id)
      if (res.success) {
        alert(res.message || `${res.data?.slotsAdded || 0} créneau(x) d'évaluation intégré(s) dans l'agenda de la classe !`)
      } else {
        alert(res.message || 'Erreur lors de la synchronisation')
      }
    } catch (err) {
      alert(err.message)
    }
    setSyncing(false)
  }

  const handleDuplicate = async () => {
    if (selectedTargets.length === 0) {
      alert('Veuillez sélectionner au moins une classe cible.')
      return
    }
    setDuplicating(true)
    try {
      const res = await classesApi.duplicateEvaluationConfig(cls._id, selectedTargets)
      if (res.success) {
        alert(res.message || 'Configuration dupliquée avec succès.')
        setDuplicateModal(false)
        setSelectedTargets([])
        onUpdated()
      } else {
        alert(res.message || 'Erreur lors de la duplication')
      }
    } catch (err) {
      alert(err.message)
    }
    setDuplicating(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Sliders size={18} className="text-purple-600" />
              Configuration des évaluations — {cls.name}
            </h3>
            <p className="text-xs text-gray-500">Périodicité, coefficients, appréciations et intégration automatique à l'agenda</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
        </div>

        <div className="space-y-4 py-4">
          {/* Modalité de calcul annuel */}
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
            <label className="text-xs font-bold text-gray-700 block mb-1">
              Modalité de calcul des résultats annuels :
            </label>
            <select
              value={annualMethod}
              onChange={(e) => setAnnualMethod(e.target.value)}
              className="input text-xs w-full bg-white"
            >
              <option value="moyenne_trimestres">Moyenne arithmétique des 3 trimestres</option>
              <option value="moyenne_semestres">Moyenne des 2 semestres</option>
              <option value="moyenne_annuelle_ponderee">Moyenne annuelle pondérée selon coefficients</option>
            </select>
          </div>

          {/* Types d'évaluations */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                Types d'évaluations configurés ({types.length})
              </h4>
              <button
                type="button"
                onClick={addType}
                className="text-xs font-medium text-purple-600 hover:text-purple-700 flex items-center gap-1"
              >
                <Plus size={14} /> Ajouter un type
              </button>
            </div>

            {types.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Aucun type d'évaluation configuré pour cette classe.</p>
            ) : (
              types.map((t, idx) => (
                <div key={idx} className="p-3.5 bg-white border border-gray-200 rounded-xl space-y-2.5 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="grid grid-cols-2 gap-2 flex-1">
                      <div>
                        <label className="text-[10px] font-semibold text-gray-500">Nom de l'évaluation</label>
                        <input
                          value={t.name}
                          onChange={(e) => updateType(idx, 'name', e.target.value)}
                          placeholder="Ex: Devoir surveillé"
                          className="input text-xs w-full mt-0.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-gray-500">Code / Sigle</label>
                        <input
                          value={t.code}
                          onChange={(e) => updateType(idx, 'code', e.target.value)}
                          placeholder="Ex: DS, COMP, DM"
                          className="input text-xs w-full mt-0.5"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeType(idx)}
                      className="text-red-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 mt-3"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500">Périodicité</label>
                      <select
                        value={t.periodicity}
                        onChange={(e) => updateType(idx, 'periodicity', e.target.value)}
                        className="input text-xs w-full mt-0.5"
                      >
                        <option value="hebdomadaire">Hebdomadaire</option>
                        <option value="mensuelle">Mensuelle</option>
                        <option value="trimestrielle">Trimestrielle</option>
                        <option value="annuelle">Annuelle</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500">Coefficient / Poids</label>
                      <input
                        type="number"
                        min="1"
                        value={t.weight}
                        onChange={(e) => updateType(idx, 'weight', e.target.value)}
                        className="input text-xs w-full mt-0.5"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500">Calcul note</label>
                      <select
                        value={t.calculationMethod}
                        onChange={(e) => updateType(idx, 'calculationMethod', e.target.value)}
                        className="input text-xs w-full mt-0.5"
                      >
                        <option value="moyenne_ponderee">Moyenne pondérée</option>
                        <option value="moyenne_simple">Moyenne simple</option>
                        <option value="total_points">Total points</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500">Matières concernées (séparées par virgule)</label>
                      <input
                        value={Array.isArray(t.subjects) ? t.subjects.join(', ') : (t.subjects || '')}
                        onChange={(e) => updateType(idx, 'subjects', e.target.value)}
                        placeholder="Ex: Mathématiques, Français, SVT (vide = toutes)"
                        className="input text-xs w-full mt-0.5"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500">Observations / Appréciations</label>
                      <input
                        value={t.appreciationRule || ''}
                        onChange={(e) => updateType(idx, 'appreciationRule', e.target.value)}
                        placeholder="Ex: <10 Insuffisant, 10-14 Passable, >14 Bien"
                        className="input text-xs w-full mt-0.5"
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Action buttons bar */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={handleSyncToAgenda}
              disabled={syncing || types.length === 0}
              className="btn-ghost text-xs border border-purple-200 text-purple-700 hover:bg-purple-50 flex items-center gap-1.5"
            >
              {syncing ? <Loader2 size={13} className="animate-spin" /> : <Calendar size={13} />}
              Intégrer à l'agenda de la classe
            </button>

            <button
              type="button"
              onClick={() => setDuplicateModal(true)}
              disabled={otherClasses.length === 0}
              className="btn-ghost text-xs border border-blue-200 text-blue-700 hover:bg-blue-50 flex items-center gap-1.5"
            >
              <Copy size={13} />
              Dupliquer vers d'autres classes
            </button>
          </div>
        </div>

        <div className="flex gap-2 pt-3 border-t border-gray-100">
          <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center border border-gray-200 text-xs">
            Fermer
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex-1 justify-center text-xs"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Enregistrer la configuration
          </button>
        </div>

        {/* Modal de duplication */}
        {duplicateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <Copy size={16} className="text-blue-600" /> Dupliquer la configuration
                </h4>
                <button onClick={() => setDuplicateModal(false)}><X size={16} /></button>
              </div>
              <p className="text-xs text-gray-500">
                Sélectionnez les classes qui adopteront la même configuration d'évaluations que <span className="font-semibold text-gray-800">{cls.name}</span> :
              </p>
              <div className="max-h-48 overflow-y-auto space-y-1.5 border border-gray-100 p-2 rounded-xl">
                {otherClasses.map((c) => {
                  const checked = selectedTargets.includes(c._id)
                  return (
                    <label key={c._id} className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedTargets([...selectedTargets, c._id])
                          else setSelectedTargets(selectedTargets.filter(id => id !== c._id))
                        }}
                        className="rounded text-blue-600"
                      />
                      <span className="font-medium text-gray-800">{c.name}</span>
                      <span className="text-gray-400">({c.level} - {c.cycle})</span>
                    </label>
                  )
                })}
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setDuplicateModal(false)} className="btn-ghost flex-1 text-xs border border-gray-200">
                  Annuler
                </button>
                <button
                  onClick={handleDuplicate}
                  disabled={duplicating || selectedTargets.length === 0}
                  className="btn-primary flex-1 text-xs justify-center"
                >
                  {duplicating ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
                  Appliquer aux {selectedTargets.length} classe(s)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
