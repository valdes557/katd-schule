import { useState } from 'react'
import { CreditCard, Loader2, CheckCircle2, XCircle, Clock, RefreshCw, TrendingUp, Wallet, GraduationCap } from 'lucide-react'
import { walletAdminApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'
import { cn } from '../lib/utils'

const STATUS_MAP = {
  pending: { label: 'En attente', icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  approved: { label: 'Encaissé', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  rejected: { label: 'Rejeté', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  expired: { label: 'Expiré', icon: XCircle, color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200' },
}

const PURPOSE_MAP = {
  subscription: { label: 'Souscription', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
  enrollment: { label: 'Inscription élève', icon: GraduationCap, color: 'text-purple-600', bg: 'bg-purple-50' },
  deposit: { label: 'Dépôt portefeuille', icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-50' },
}

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')
const fmtDate = (d) => d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

export default function AdminPaiementsPage() {
  const [purpose, setPurpose] = useState('')
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')

  const statsQ = useCachedFetch('/admin/payments/stats', async () => (await walletAdminApi.paymentsStats()).stats, [])
  const paymentsQ = useCachedFetch(
    `/admin/payments?purpose=${purpose}&status=${status}&q=${search}`,
    async () => (await walletAdminApi.payments({ purpose, status, q: search })).payments || [],
    [purpose, status, search],
  )

  const stats = statsQ.data || { approved: { count: 0, total: 0 }, pending: { count: 0, total: 0 }, rejected: { count: 0, total: 0 } }
  const payments = paymentsQ.data || []
  const loading = paymentsQ.loading

  const refresh = () => {
    cache.invalidate('/admin/payments')
    statsQ.refetch()
    paymentsQ.refetch()
  }

  const onSearch = (e) => { e.preventDefault(); setSearch(q.trim()) }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CreditCard size={22} className="text-blue-600" /> Paiements SEBPay
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Argent entrant via Mobile Money (souscriptions, inscriptions, dépôts).</p>
        </div>
        <button onClick={refresh} className="btn-secondary text-sm inline-flex items-center gap-1.5">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Actualiser
        </button>
      </div>

      {/* Cartes de synthèse */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 border-l-4 border-green-500">
          <div className="flex items-center gap-2 text-green-700"><CheckCircle2 size={16} /><span className="text-xs font-semibold uppercase tracking-wide">Encaissé</span></div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{fmt(stats.approved?.total)} <span className="text-sm font-medium text-gray-400">XAF</span></div>
          <div className="text-xs text-gray-500 mt-0.5">{stats.approved?.count || 0} paiement(s) confirmé(s)</div>
        </div>
        <div className="card p-4 border-l-4 border-orange-400">
          <div className="flex items-center gap-2 text-orange-600"><Clock size={16} /><span className="text-xs font-semibold uppercase tracking-wide">En attente</span></div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{fmt(stats.pending?.total)} <span className="text-sm font-medium text-gray-400">XAF</span></div>
          <div className="text-xs text-gray-500 mt-0.5">{stats.pending?.count || 0} en cours de validation</div>
        </div>
        <div className="card p-4 border-l-4 border-red-400">
          <div className="flex items-center gap-2 text-red-600"><XCircle size={16} /><span className="text-xs font-semibold uppercase tracking-wide">Rejeté</span></div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{fmt(stats.rejected?.total)} <span className="text-sm font-medium text-gray-400">XAF</span></div>
          <div className="text-xs text-gray-500 mt-0.5">{stats.rejected?.count || 0} échec(s)</div>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className="input text-sm w-auto">
          <option value="">Tous les types</option>
          <option value="subscription">Souscriptions</option>
          <option value="enrollment">Inscriptions élève</option>
          <option value="deposit">Dépôts portefeuille</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input text-sm w-auto">
          <option value="">Tous les statuts</option>
          <option value="approved">Encaissé</option>
          <option value="pending">En attente</option>
          <option value="rejected">Rejeté</option>
          <option value="expired">Expiré</option>
        </select>
        <form onSubmit={onSearch} className="flex items-center gap-2 flex-1 min-w-[200px]">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (nom, email, n°, réf. transaction)…" className="input text-sm flex-1" />
          <button type="submit" className="btn-secondary text-sm">Rechercher</button>
        </form>
      </div>

      {/* Tableau */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400"><Loader2 size={24} className="animate-spin mx-auto mb-2" /> Chargement…</div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center text-gray-400">Aucun paiement trouvé pour ces filtres.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Payeur / École</th>
                  <th className="px-4 py-3 font-semibold text-right">Montant</th>
                  <th className="px-4 py-3 font-semibold">Opérateur</th>
                  <th className="px-4 py-3 font-semibold">Réf. transaction</th>
                  <th className="px-4 py-3 font-semibold">Statut</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const st = STATUS_MAP[p.status] || STATUS_MAP.pending
                  const pu = PURPOSE_MAP[p.purpose] || { label: p.purpose, icon: CreditCard, color: 'text-gray-600', bg: 'bg-gray-50' }
                  const StIcon = st.icon
                  const PuIcon = pu.icon
                  const who = p.payerName || p.meta?.directorName || p.meta?.schoolName || p.initiatedBy?.name || '—'
                  const schoolName = p.school?.name || p.meta?.schoolName || ''
                  return (
                    <tr key={p._id} className="border-b border-gray-50 hover:bg-gray-50/60">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(p.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium', pu.bg, pu.color)}>
                          <PuIcon size={13} /> {pu.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{who}</div>
                        {schoolName && <div className="text-xs text-gray-500">{schoolName}</div>}
                        {p.payerEmail && <div className="text-xs text-gray-400">{p.payerEmail}</div>}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900 whitespace-nowrap">{fmt(p.amount)} <span className="text-xs font-medium text-gray-400">{p.currency || 'XAF'}</span></td>
                      <td className="px-4 py-3 text-gray-600">
                        <div className="capitalize">{p.payerOperator || '—'}</div>
                        {p.payerPhone && <div className="text-xs text-gray-400">{p.payerPhone}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-gray-500">{p.sebpayTransactionId || p.reference}</span>
                        {p.mode === 'test' && <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">TEST</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border', st.bg, st.color, st.border)}>
                          <StIcon size={13} /> {st.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
