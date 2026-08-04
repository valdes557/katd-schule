import { Clock, X, AlertCircle, CheckCircle2, Bell } from 'lucide-react'

const PERM_KIND = { sortie: 'Sortie', absence: 'Absence', retard: 'Retard' }
const PERM_STATUS = {
  pending: { label: 'En attente', cls: 'text-amber-700 bg-amber-50 border-amber-200' },
  approved: { label: 'Approuvée', cls: 'text-green-700 bg-green-50 border-green-200' },
  rejected: { label: 'Rejetée', cls: 'text-red-700 bg-red-50 border-red-200' },
}
const CLASS_STATUS = {
  absent: { label: 'Absence', cls: 'text-red-600', icon: X },
  late: { label: 'Retard', cls: 'text-orange-500', icon: Clock },
  excused: { label: 'Justifié', cls: 'text-blue-600', icon: CheckCircle2 },
}

/** Affichage du dossier discipline (résumé + retards entrée + incidents classe + permissions).
 *  Utilisé par l'espace élève (ma discipline) et l'espace parent (discipline par enfant). */
export default function DisciplineView({ data }) {
  const { summary, entries = [], classRecords = [], permissions = [] } = data || {}
  if (!summary) return null
  const lateEntries = entries.filter((e) => e.status === 'late')
  const incidents = classRecords.filter((r) => r.status !== 'present')

  return (
    <div className="space-y-5">
      {/* Résumé */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-3 text-center">
          <div className="text-2xl font-bold text-orange-500">{summary.entryLate}</div>
          <div className="text-xs text-gray-500">Retards à l'entrée{summary.entryLateMinutes > 0 ? ` (${summary.entryLateMinutes} min)` : ''}</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-2xl font-bold text-red-600">{summary.classAbsent}</div>
          <div className="text-xs text-gray-500">Absences en classe</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-2xl font-bold text-orange-500">{summary.classLate}</div>
          <div className="text-xs text-gray-500">Retards en classe</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-2xl font-bold text-blue-600">{summary.classExcused}</div>
          <div className="text-xs text-gray-500">Absences justifiées</div>
        </div>
      </div>

      {/* Retards à l'entrée (scan portier) */}
      <div className="card p-4">
        <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5"><Clock size={15} className="text-orange-500" /> Retards à l'entrée de l'école</h3>
        {lateEntries.length === 0 ? (
          <p className="text-xs text-gray-400">Aucun retard enregistré à l'entrée.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {lateEntries.map((e) => (
              <div key={e._id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-gray-700">{new Date(e.day + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                <span className="text-orange-600 font-semibold text-xs">+{e.lateMinutes} min</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Incidents en classe */}
      <div className="card p-4">
        <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5"><AlertCircle size={15} className="text-red-500" /> Absences & retards en classe</h3>
        {incidents.length === 0 ? (
          <p className="text-xs text-gray-400">Aucune absence ni retard en classe.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {incidents.map((r, i) => {
              const s = CLASS_STATUS[r.status]
              if (!s) return null
              const Icon = s.icon
              return (
                <div key={i} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-gray-700">{new Date(r.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                  <span className={`font-semibold text-xs flex items-center gap-1 ${s.cls}`}><Icon size={12} /> {s.label}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Permissions */}
      <div className="card p-4">
        <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5"><Bell size={15} className="text-indigo-500" /> Permissions</h3>
        {permissions.length === 0 ? (
          <p className="text-xs text-gray-400">Aucune demande de permission.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {permissions.map((p) => {
              const st = PERM_STATUS[p.status] || PERM_STATUS.pending
              return (
                <div key={p._id} className="py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-800">{PERM_KIND[p.kind] || p.kind}</span>
                    <span className={`text-xs font-semibold border rounded-full px-2 py-0.5 ${st.cls}`}>{st.label}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{p.reason}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {p.fromDate ? new Date(p.fromDate).toLocaleDateString('fr-FR') : ''}
                    {p.toDate ? ` → ${new Date(p.toDate).toLocaleDateString('fr-FR')}` : ''}
                    {p.decidedBy?.name ? ` · décidé par ${p.decidedBy.name}` : ''}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
