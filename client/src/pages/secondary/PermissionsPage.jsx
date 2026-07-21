import { useState } from 'react'
import {
  Bell, Loader2, Plus, X, CheckCircle2, XCircle, Clock, AlertCircle,
} from 'lucide-react'
import { permissionsApi, parentApi } from '../../lib/api'
import { useCachedFetch } from '../../hooks/useCachedFetch'
import { cache } from '../../lib/cache'
import { useAuth } from '../../context/AuthContext'
import { roleLabel } from '../../lib/roleLabels'

const KIND_LABELS = { sortie: 'Sortie', absence: 'Absence', retard: 'Retard' }
const STATUS_BADGE = {
  pending: { label: 'En attente', cls: 'bg-amber-50 text-amber-700' },
  approved: { label: 'Accordée', cls: 'bg-green-50 text-green-700' },
  rejected: { label: 'Refusée', cls: 'bg-red-50 text-red-600' },
}

/**
 * Page unique /dashboard/permissions, rendu selon le rôle :
 * - SG / principal : file d'attente + Approuver/Refuser
 * - portier : sorties autorisées du jour (lecture)
 * - parent / élève / professeur : formulaire de demande + suivi
 */
export default function PermissionsPage() {
  const { user, school } = useAuth()
  const isDecider = ['surveillant_general', 'directeur', 'super_admin'].includes(user?.role)
  const isPortier = user?.role === 'portier'
  const canRequest = !isDecider && !isPortier

  const listQ = useCachedFetch('/permissions', async () => (await permissionsApi.list()).data || [], [])
  // Les parents choisissent l'enfant concerné
  const childrenQ = useCachedFetch(
    user?.role === 'parent' ? '/parent/children-mini' : null,
    async () => {
      if (user?.role !== 'parent') return []
      try { const r = await parentApi.dashboard(); return r.data?.children || [] } catch { return [] }
    },
    [user?.role]
  )

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ kind: 'sortie', reason: '', fromDate: '', toDate: '', studentId: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const requests = listQ.data || []
  const refresh = () => { cache.invalidate('/permissions'); listQ.refetch() }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      await permissionsApi.create(form)
      setShowModal(false)
      setForm({ kind: 'sortie', reason: '', fromDate: '', toDate: '', studentId: '' })
      refresh()
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const decide = async (r, action) => {
    const note = window.prompt(action === 'approve' ? 'Note (optionnelle) :' : 'Motif du refus (optionnel) :')
    if (note === null) return
    try {
      if (action === 'approve') await permissionsApi.approve(r._id, note)
      else await permissionsApi.reject(r._id, note)
      refresh()
    } catch (err) { alert(err.message) }
  }

  if (listQ.loading) return <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>

  const pending = requests.filter((r) => r.status === 'pending')

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Bell size={20} className="text-indigo-600" /> Permissions</h1>
          <p className="text-sm text-gray-500">
            {isDecider ? 'Demandes de permission de votre établissement — approuvez ou refusez.'
              : isPortier ? "Sorties autorisées aujourd'hui : seules ces personnes peuvent quitter l'établissement."
              : 'Vos demandes de permission (sortie, absence, retard).'}
          </p>
        </div>
        {canRequest && (
          <button onClick={() => setShowModal(true)} className="btn-primary text-sm self-start"><Plus size={15} /> Nouvelle demande</button>
        )}
      </div>

      {isDecider && pending.length > 0 && (
        <div className="card border-l-4 border-l-amber-400">
          <div className="px-4 py-2.5 border-b bg-amber-50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-amber-800">En attente ({pending.length})</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {pending.map((r) => (
              <div key={r._id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {r.requester?.name} <span className="text-xs text-gray-400">({roleLabel(r.requester?.role, school)})</span>
                    {r.student && <span className="text-xs text-indigo-600"> — pour {r.student.lastName} {r.student.firstName}{r.student.class?.name ? ` (${r.student.class.name})` : ''}</span>}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5"><strong>{KIND_LABELS[r.kind]}</strong> · {new Date(r.fromDate).toLocaleDateString('fr-FR')}{r.toDate ? ` → ${new Date(r.toDate).toLocaleDateString('fr-FR')}` : ''}</p>
                  <p className="text-xs text-gray-500 mt-1">{r.reason}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => decide(r, 'approve')} className="flex items-center gap-1.5 text-xs font-bold bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg"><CheckCircle2 size={13} /> Accorder</button>
                  <button onClick={() => decide(r, 'reject')} className="flex items-center gap-1.5 text-xs font-bold bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg"><XCircle size={13} /> Refuser</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Liste générale (historique / journal portier / mes demandes) */}
      {requests.length === 0 ? (
        <div className="card p-10 text-center">
          <Bell size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">{isPortier ? "Aucune sortie autorisée aujourd'hui." : 'Aucune demande pour le moment.'}</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="px-4 py-3">Demandeur</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Date(s)</th>
                <th className="px-4 py-3">Motif</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Décidée par</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => {
                const badge = STATUS_BADGE[r.status] || STATUS_BADGE.pending
                return (
                  <tr key={r._id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{r.requester?.name || '—'}</span>
                      {r.student && <span className="block text-[11px] text-indigo-600">pour {r.student.lastName} {r.student.firstName}{r.student.class?.name ? ` (${r.student.class.name})` : ''}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-700">{KIND_LABELS[r.kind]}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {new Date(r.fromDate).toLocaleDateString('fr-FR')}{r.toDate ? ` → ${new Date(r.toDate).toLocaleDateString('fr-FR')}` : ''}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[220px] truncate" title={r.reason}>{r.reason}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${badge.cls}`}>{badge.label}</span>
                      {r.decisionNote && <span className="block text-[10px] text-gray-400 mt-0.5" title={r.decisionNote}>« {r.decisionNote.slice(0, 40)} »</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{r.decidedBy?.name || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modale nouvelle demande */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Nouvelle demande de permission</h2>
              <button type="button" onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}
            {user?.role === 'parent' && (
              <div>
                <label className="text-xs font-semibold text-gray-600">Enfant concerné *</label>
                <select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} className="input mt-1" required>
                  <option value="">— Choisir —</option>
                  {(childrenQ.data || []).map((c) => <option key={c._id} value={c._id}>{c.lastName} {c.firstName}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-gray-600">Type *</label>
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="input mt-1">
                <option value="sortie">Sortie anticipée</option>
                <option value="absence">Absence</option>
                <option value="retard">Retard prévu</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600">Du *</label>
                <input type="date" value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} className="input mt-1" required />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Au (optionnel)</label>
                <input type="date" value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} className="input mt-1" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Motif *</label>
              <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="input mt-1 min-h-[80px]" required placeholder="Expliquez la raison de la demande…" />
            </div>
            <button type="submit" disabled={saving} className="btn-primary w-full justify-center text-sm">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Clock size={15} />} Envoyer la demande
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
