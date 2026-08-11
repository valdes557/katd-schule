import { useState, useEffect, useMemo } from 'react'
import { Gavel, Loader2, AlertCircle, Plus, X, Filter, RefreshCw, Ban } from 'lucide-react'
import { sanctionsApi, classesApi, studentsApi } from '../../lib/api'
import { SANCTION_LABELS } from '../../components/DisciplineView'
import ExportCsvButton from '../../components/ExportCsvButton'

const TYPES = Object.keys(SANCTION_LABELS)
// Les types à durée (jours) : exclusion temporaire et retenue.
const WITH_DURATION = ['exclusion_temporaire', 'retenue']

const TYPE_BADGE = {
  avertissement: 'text-amber-700 bg-amber-50 border-amber-200',
  blame: 'text-orange-700 bg-orange-50 border-orange-200',
  exclusion_temporaire: 'text-red-700 bg-red-50 border-red-200',
  exclusion_definitive: 'text-red-800 bg-red-100 border-red-300',
  convocation: 'text-indigo-700 bg-indigo-50 border-indigo-200',
  retenue: 'text-purple-700 bg-purple-50 border-purple-200',
}

/**
 * Dashboard Surveillant Général — Discipline (G1).
 * Enregistrement des sanctions (avertissement, blâme, exclusion, convocation, retenue)
 * et consultation de l'historique disciplinaire filtrable. Accessible SG / Principal / VP.
 */
export default function SurveillantDisciplinePage() {
  const [classes, setClasses] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [formOpen, setFormOpen] = useState(false)

  // Filtres de l'historique
  const [fClass, setFClass] = useState('')
  const [fType, setFType] = useState('')

  // Formulaire de sanction
  const emptyForm = { classId: '', studentId: '', type: 'avertissement', reason: '', durationDays: '', date: '', note: '' }
  const [form, setForm] = useState(emptyForm)
  const [students, setStudents] = useState([])
  const [studentsLoading, setStudentsLoading] = useState(false)

  const loadClasses = async () => {
    try { const r = await classesApi.list(); setClasses(r.data || []) } catch (_) { /* non bloquant */ }
  }

  const loadHistory = async () => {
    setLoading(true)
    try {
      const params = {}
      if (fClass) params.classId = fClass
      if (fType) params.type = fType
      const r = await sanctionsApi.list(params)
      setRows(r.data || [])
      setError('')
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  useEffect(() => { loadClasses() }, [])
  useEffect(() => { loadHistory() }, [fClass, fType])

  // Charge les élèves de la classe choisie dans le formulaire
  useEffect(() => {
    if (!form.classId) { setStudents([]); return }
    setStudentsLoading(true)
    studentsApi.list(`classId=${form.classId}&limit=300`)
      .then((r) => setStudents(r.data || []))
      .catch(() => setStudents([]))
      .finally(() => setStudentsLoading(false))
  }, [form.classId])

  const submit = async (e) => {
    e.preventDefault()
    if (!form.studentId || !form.reason.trim()) return
    setSaving(true)
    try {
      await sanctionsApi.create({
        studentId: form.studentId,
        type: form.type,
        reason: form.reason.trim(),
        durationDays: WITH_DURATION.includes(form.type) ? Number(form.durationDays) || 0 : 0,
        date: form.date || undefined,
        note: form.note || '',
      })
      setForm(emptyForm)
      setFormOpen(false)
      await loadHistory()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  const cancel = async (id) => {
    if (!window.confirm('Annuler cette sanction ? Elle restera visible dans l\'historique mais marquée annulée.')) return
    try { await sanctionsApi.cancel(id); await loadHistory() } catch (e) { setError(e.message) }
  }

  const exportColumns = useMemo(() => [
    { key: 'date', label: 'Date', format: (v) => v ? new Date(v).toLocaleDateString('fr-FR') : '' },
    { key: 'student', label: 'Élève', format: (v) => v ? `${v.lastName || ''} ${v.firstName || ''}`.trim() : '' },
    { key: 'type', label: 'Type', format: (v) => SANCTION_LABELS[v] || v },
    { key: 'durationDays', label: 'Durée (j)' },
    { key: 'reason', label: 'Motif' },
    { key: 'decidedBy', label: 'Décidé par', format: (v) => v?.name || '' },
    { key: 'canceled', label: 'Annulée', format: (v) => (v ? 'oui' : 'non') },
  ], [])

  return (
    <div className="space-y-5 animate-fade-in">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Gavel size={20} className="text-rose-600" /> Discipline</h1>
          <p className="text-sm text-gray-500">Enregistrer les sanctions et consulter l'historique disciplinaire.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportCsvButton filename="sanctions.csv" columns={exportColumns} rows={rows} disabled={rows.length === 0} className="shrink-0" />
          <button onClick={() => setFormOpen((v) => !v)} className="btn-primary text-sm shrink-0">
            {formOpen ? <><X size={15} /> Fermer</> : <><Plus size={15} /> Nouvelle sanction</>}
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 flex items-center gap-2"><AlertCircle size={15} /> {error}</div>}

      {/* Formulaire de sanction */}
      {formOpen && (
        <form onSubmit={submit} className="card p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600">Classe</label>
              <select className="input mt-1" value={form.classId} onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value, studentId: '' }))} required>
                <option value="">— Choisir une classe —</option>
                {classes.map((c) => <option key={c._id} value={c._id}>{c.name}{c.level ? ` (${c.level})` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Élève</label>
              <select className="input mt-1" value={form.studentId} onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))} required disabled={!form.classId || studentsLoading}>
                <option value="">{studentsLoading ? 'Chargement…' : '— Choisir un élève —'}</option>
                {students.map((s) => <option key={s._id} value={s._id}>{s.lastName} {s.firstName}{s.matricule ? ` · ${s.matricule}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Type de sanction</label>
              <select className="input mt-1" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                {TYPES.map((t) => <option key={t} value={t}>{SANCTION_LABELS[t]}</option>)}
              </select>
            </div>
            {WITH_DURATION.includes(form.type) && (
              <div>
                <label className="text-xs font-semibold text-gray-600">Durée (jours)</label>
                <input type="number" min="0" className="input mt-1" value={form.durationDays} onChange={(e) => setForm((f) => ({ ...f, durationDays: e.target.value }))} placeholder="ex. 3" />
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-gray-600">Date</label>
              <input type="date" className="input mt-1" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Motif <span className="text-red-500">*</span></label>
            <textarea className="input mt-1" rows={2} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Raison de la sanction…" required />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary text-sm">
              {saving ? <><Loader2 size={15} className="animate-spin" /> Enregistrement…</> : <><Gavel size={15} /> Enregistrer la sanction</>}
            </button>
          </div>
        </form>
      )}

      {/* Filtres de l'historique */}
      <div className="card p-4 flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider"><Filter size={13} /> Filtrer</div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Classe</label>
          <select className="input text-sm w-auto" value={fClass} onChange={(e) => setFClass(e.target.value)}>
            <option value="">Toutes</option>
            {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Type</label>
          <select className="input text-sm w-auto" value={fType} onChange={(e) => setFType(e.target.value)}>
            <option value="">Tous</option>
            {TYPES.map((t) => <option key={t} value={t}>{SANCTION_LABELS[t]}</option>)}
          </select>
        </div>
        <button onClick={loadHistory} className="btn-ghost text-xs border border-gray-200 ml-auto"><RefreshCw size={13} /> Actualiser</button>
      </div>

      {/* Historique */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={26} className="animate-spin text-blue-600" /></div>
      ) : rows.length === 0 ? (
        <div className="card p-10 text-center text-sm text-gray-500">Aucune sanction enregistrée pour ces filtres.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Élève</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Motif</th>
                <th className="px-4 py-3 font-semibold">Décidé par</th>
                <th className="px-4 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s._id} className={`border-b border-gray-50 last:border-0 ${s.canceled ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600">{s.date ? new Date(s.date).toLocaleDateString('fr-FR') : ''}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{s.student ? `${s.student.lastName} ${s.student.firstName}` : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold border rounded-full px-2 py-0.5 ${TYPE_BADGE[s.type] || 'text-gray-600 bg-gray-50 border-gray-200'}`}>
                      {SANCTION_LABELS[s.type] || s.type}{s.durationDays > 0 ? ` · ${s.durationDays}j` : ''}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs">{s.reason}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{s.decidedBy?.name || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {s.canceled ? (
                      <span className="text-xs text-gray-400">Annulée</span>
                    ) : (
                      <button onClick={() => cancel(s._id)} className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-800">
                        <Ban size={13} /> Annuler
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
