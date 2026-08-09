import { useState, useEffect, useCallback } from 'react'
import {
  History, Loader2, AlertCircle, Filter, ChevronLeft, ChevronRight,
  User, Clock, ShieldAlert,
} from 'lucide-react'
import { auditLogsApi } from '../../lib/api'
import ExportCsvButton from '../../components/ExportCsvButton'

// Journal des actions sensibles (F3 Secondaire).
// Directeur : son école. Super_admin : toute la plateforme. Lecture seule.
// Chaque ligne = une mutation surveillée (finances, comptes, notes, IA, école).
const ACTION_LABELS = {
  'fee.discount': 'Remise appliquée', 'fee.discount.remove': 'Remise retirée',
  'fee.payment': 'Paiement enregistré', 'fee.delete': 'Frais supprimé',
  'expense.create': 'Dépense créée', 'expense.delete': 'Dépense supprimée',
  'salary.create': 'Salaire enregistré', 'salary.delete': 'Salaire supprimé',
  'wallet.withdraw': 'Demande de retrait', 'wallet.admin': 'Portefeuille (admin)',
  'user.block': 'Compte bloqué/débloqué', 'user.delete': 'Compte supprimé',
  'staff.account': 'Compte personnel', 'staff.account.delete': 'Compte personnel supprimé',
  'grade.publish': 'Notes publiées', 'grade.delete': 'Note supprimée',
  'school.delete': 'École supprimée',
  'aicourse.create': 'Cours IA programmé', 'aicourse.delete': 'Cours IA supprimé',
  'ai.subscription': 'Souscription IA traitée',
}

// Couleur du badge selon la gravité de l'action.
function actionTone(action) {
  if (action.includes('delete') || action === 'user.block' || action === 'school.delete') return 'bg-red-50 text-red-700 border-red-200'
  if (action.startsWith('fee') || action.startsWith('salary') || action.startsWith('expense') || action.startsWith('wallet')) return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-blue-50 text-blue-700 border-blue-200'
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [action, setAction] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [actionOptions, setActionOptions] = useState([])

  useEffect(() => {
    auditLogsApi.actions().then((r) => setActionOptions(r.data || [])).catch(() => {})
  }, [])

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = { page, limit: 50 }
      if (action) params.action = action
      if (from) params.from = new Date(from).toISOString()
      if (to) params.to = new Date(to + 'T23:59:59').toISOString()
      const r = await auditLogsApi.list(params)
      setLogs(r.data || [])
      setPages(r.pages || 1)
      setTotal(r.total || 0)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [page, action, from, to])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  // Un changement de filtre ramène en page 1
  const onFilter = (setter) => (e) => { setter(e.target.value); setPage(1) }

  // Récupère TOUTES les lignes correspondant aux filtres (le backend plafonne
  // limit à 100 → on dépagine) pour l'export Excel.
  const fetchAllForExport = useCallback(async () => {
    const base = {}
    if (action) base.action = action
    if (from) base.from = new Date(from).toISOString()
    if (to) base.to = new Date(to + 'T23:59:59').toISOString()
    const all = []
    let p = 1, totalPages = 1
    do {
      const r = await auditLogsApi.list({ ...base, page: p, limit: 100 })
      all.push(...(r.data || []))
      totalPages = r.pages || 1
      p += 1
    } while (p <= totalPages && p <= 100) // garde-fou : 10 000 lignes max
    return all
  }, [action, from, to])

  const exportColumns = [
    { label: 'Date', key: 'createdAt', format: (v) => new Date(v).toLocaleString('fr-FR') },
    { label: 'Action', key: 'action', format: (v, r) => ACTION_LABELS[v] || r.label || v },
    { label: 'Auteur', key: 'actorName', format: (v) => v || 'Inconnu' },
    { label: 'Rôle', key: 'actorRole' },
    { label: 'Méthode', key: 'method' },
    { label: 'Chemin', key: 'path' },
    { label: 'Entité', key: 'entityId' },
  ]

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <History size={22} className="text-gray-700" /> Journal des actions
          </h1>
          <p className="text-sm text-gray-500">
            Traçabilité des actions sensibles : finances, comptes, notes, cours IA, suppressions.
          </p>
        </div>
        <ExportCsvButton
          filename="journal-actions.csv"
          columns={exportColumns}
          rows={fetchAllForExport}
          disabled={loading || total === 0}
          className="shrink-0"
        />
      </div>

      {/* Filtres */}
      <div className="card p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[160px]">
          <label className="text-xs font-medium text-gray-600 flex items-center gap-1"><Filter size={12} /> Type d'action</label>
          <select value={action} onChange={onFilter(setAction)} className="input text-sm mt-1">
            <option value="">Toutes</option>
            {actionOptions.map((a) => <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Du</label>
          <input type="date" value={from} onChange={onFilter(setFrom)} className="input text-sm mt-1" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Au</label>
          <input type="date" value={to} onChange={onFilter(setTo)} className="input text-sm mt-1" />
        </div>
        {(action || from || to) && (
          <button onClick={() => { setAction(''); setFrom(''); setTo(''); setPage(1) }} className="btn-ghost border border-gray-200 text-sm">Réinitialiser</button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16"><Loader2 size={24} className="animate-spin mx-auto text-gray-500" /></div>
      ) : error ? (
        <div className="text-center py-16 text-gray-500"><AlertCircle size={32} className="mx-auto mb-3 text-red-400" /><p className="text-sm">{error}</p></div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ShieldAlert size={36} className="mx-auto mb-3 opacity-30" />
          <p>Aucune action enregistrée{action || from || to ? ' pour ces filtres' : ''}.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log._id} className="card p-3 flex flex-col sm:flex-row sm:items-center gap-2">
                <span className={`text-xs font-semibold border rounded-full px-2.5 py-1 shrink-0 ${actionTone(log.action)}`}>
                  {ACTION_LABELS[log.action] || log.label || log.action}
                </span>
                <div className="flex-1 min-w-0 text-sm text-gray-700">
                  <span className="flex items-center gap-1.5 text-gray-600">
                    <User size={13} className="shrink-0" />
                    <span className="font-medium">{log.actorName || 'Inconnu'}</span>
                    {log.actorRole && <span className="text-xs text-gray-400">({log.actorRole})</span>}
                  </span>
                  <span className="text-xs text-gray-400 font-mono break-all">{log.method} {log.path}</span>
                </div>
                <span className="text-xs text-gray-500 flex items-center gap-1 shrink-0">
                  <Clock size={12} />
                  {new Date(log.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm text-gray-500 pt-1">
            <span>{total} action{total > 1 ? 's' : ''}</span>
            {pages > 1 && (
              <div className="flex items-center gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="btn-ghost border border-gray-200 p-1.5 disabled:opacity-40"><ChevronLeft size={16} /></button>
                <span>Page {page} / {pages}</span>
                <button disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))} className="btn-ghost border border-gray-200 p-1.5 disabled:opacity-40"><ChevronRight size={16} /></button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
