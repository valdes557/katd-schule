import { useEffect, useState } from 'react'
import {
  CalendarCheck, Plus, Loader2, Clock, CheckCircle2, XCircle, AlertCircle, X,
} from 'lucide-react'
import { parentApi } from '../lib/api'

const STATUS_MAP = {
  pending: { label: 'En attente', cls: 'bg-amber-100 text-amber-700', icon: Clock },
  approved: { label: 'Approuvé', cls: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  rejected: { label: 'Refusé', cls: 'bg-red-100 text-red-700', icon: XCircle },
  completed: { label: 'Terminé', cls: 'bg-gray-100 text-gray-500', icon: CheckCircle2 },
}

export default function ParentAppointmentsPage() {
  const [appointments, setAppointments] = useState([])
  const [children, setChildren] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ studentId: '', withRole: 'enseignant', date: '', time: '', reason: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const [appts, dash] = await Promise.all([parentApi.appointments(), parentApi.dashboard()])
        setAppointments(appts.data || [])
        setChildren(dash.data?.children || [])
      } catch (_) {}
      setLoading(false)
    })()
  }, [])

  const handleCreate = async () => {
    if (!form.studentId || !form.date || !form.time || !form.reason) return alert('Tous les champs sont obligatoires')
    setSubmitting(true)
    try {
      await parentApi.createAppointment(form)
      const r = await parentApi.appointments()
      setAppointments(r.data || [])
      setShowForm(false)
      setForm({ studentId: '', withRole: 'enseignant', date: '', time: '', reason: '' })
    } catch (e) { alert(e.message) }
    setSubmitting(false)
  }

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><CalendarCheck size={22} className="text-purple-600" /> Rendez-vous</h1>
          <p className="text-sm text-gray-500">Demandez un rendez-vous (soumis à approbation de la direction)</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary text-xs"><Plus size={14} /> Nouveau</button>
      </div>

      {appointments.length === 0 ? (
        <div className="text-center py-16 text-gray-400"><CalendarCheck size={36} className="mx-auto mb-3 opacity-30" /><p>Aucun rendez-vous</p></div>
      ) : (
        <div className="space-y-3">
          {appointments.map((a) => {
            const st = STATUS_MAP[a.status] || STATUS_MAP.pending
            return (
              <div key={a._id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{a.reason}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {a.student?.firstName} {a.student?.lastName} · Avec: <span className="capitalize">{a.with}</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(a.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} à {a.time}
                    </p>
                    {a.notes && <p className="text-xs text-gray-500 mt-1 italic">Note: {a.notes}</p>}
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${st.cls}`}>
                    <st.icon size={10} /> {st.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Demander un rendez-vous</h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-start gap-2">
              <AlertCircle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">Le rendez-vous doit d'abord être approuvé par la direction de l'école.</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Enfant</label>
                <select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} className="input text-sm">
                  <option value="">Sélectionner...</option>
                  {children.map((c) => <option key={c._id} value={c._id}>{c.fullName}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Avec qui</label>
                <select value={form.withRole} onChange={(e) => setForm({ ...form, withRole: e.target.value })} className="input text-sm">
                  <option value="enseignant">Enseignant</option>
                  <option value="directeur">Directeur</option>
                  <option value="conseiller">Conseiller pédagogique</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Date</label>
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Heure</label>
                  <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="input text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Motif</label>
                <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="input text-sm" rows={3} placeholder="Décrivez le motif du rendez-vous..." />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="btn-ghost flex-1 justify-center border border-gray-200">Annuler</button>
              <button onClick={handleCreate} disabled={submitting} className="btn-primary flex-1 justify-center">
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <CalendarCheck size={14} />}
                Envoyer la demande
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
