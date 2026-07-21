import { CalendarCheck, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { parentApi } from '../../lib/api'
import { useCachedFetch } from '../../hooks/useCachedFetch'
import { cache } from '../../lib/cache'

const STATUS_BADGE = {
  pending: { label: 'En attente', cls: 'bg-amber-50 text-amber-700' },
  approved: { label: 'Confirmé', cls: 'bg-green-50 text-green-700' },
  rejected: { label: 'Refusé', cls: 'bg-red-50 text-red-600' },
  completed: { label: 'Terminé', cls: 'bg-gray-100 text-gray-600' },
}

/** Rendez-vous demandés par les parents — vue principal / vice-principal. */
export default function SchoolAppointmentsPage() {
  const listQ = useCachedFetch('/parent/appointments/school', async () => (await parentApi.schoolAppointments()).data || [], [])
  const appointments = listQ.data || []
  const refresh = () => { cache.invalidate('/parent/appointments'); listQ.refetch() }

  const setStatus = async (a, status) => {
    try { await parentApi.setAppointmentStatus(a._id, status); refresh() } catch (err) { alert(err.message) }
  }

  if (listQ.loading) return <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><CalendarCheck size={20} className="text-indigo-600" /> Rendez-vous des parents</h1>
        <p className="text-sm text-gray-500">Demandes de rendez-vous — confirmez puis recevez le parent via le Messenger</p>
      </div>

      {appointments.length === 0 ? (
        <div className="card p-10 text-center">
          <CalendarCheck size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">Aucun rendez-vous demandé.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="px-4 py-3">Parent</th>
                <th className="px-4 py-3">Élève</th>
                <th className="px-4 py-3">Avec</th>
                <th className="px-4 py-3">Date / heure</th>
                <th className="px-4 py-3">Motif</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => {
                const badge = STATUS_BADGE[a.status] || STATUS_BADGE.pending
                return (
                  <tr key={a._id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{a.parent?.name || '—'}</span>
                      {a.parent?.phone && <span className="block text-[11px] text-gray-400">{a.parent.phone}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{a.student ? `${a.student.lastName} ${a.student.firstName}` : '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 capitalize">{a.with === 'directeur' ? 'Principal' : a.with === 'vice_principal' ? 'Vice-Principal' : a.with}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{new Date(a.date).toLocaleDateString('fr-FR')} · {a.time}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate" title={a.reason}>{a.reason}</td>
                    <td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-1 rounded-full ${badge.cls}`}>{badge.label}</span></td>
                    <td className="px-4 py-3">
                      {a.status === 'pending' && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => setStatus(a, 'approved')} title="Confirmer" className="p-1.5 rounded-lg hover:bg-green-50 text-green-600"><CheckCircle2 size={15} /></button>
                          <button onClick={() => setStatus(a, 'rejected')} title="Refuser" className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><XCircle size={15} /></button>
                        </div>
                      )}
                      {a.status === 'approved' && (
                        <button onClick={() => setStatus(a, 'completed')} className="text-[11px] font-semibold text-gray-500 hover:text-gray-700">Marquer terminé</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
