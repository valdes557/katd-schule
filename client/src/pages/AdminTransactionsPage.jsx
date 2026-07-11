import { useRef, useState } from 'react'
import {
  ArrowLeftRight, Loader2, RefreshCw, TrendingUp, TrendingDown, Scale, Hash,
  CheckCircle2, Clock, XCircle, ChevronLeft, ChevronRight, Users, Building2,
} from 'lucide-react'
import { walletAdminApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'
import { cn } from '../lib/utils'
import DownloadPdfButton from '../components/DownloadPdfButton'

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')
const fmtDate = (d) => d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

// Natures d'opération (doit rester aligné avec CATEGORY_LABELS côté serveur)
const CATEGORIES = [
  { value: 'subscription', label: 'Souscription' },
  { value: 'enrollment', label: 'Inscription élève' },
  { value: 'deposit', label: 'Dépôt portefeuille' },
  { value: 'salary_transfer', label: 'Transfert salaire' },
  { value: 'salary_received', label: 'Salaire reçu' },
  { value: 'withdrawal', label: 'Retrait' },
  { value: 'withdrawal_refund', label: 'Remboursement retrait' },
  { value: 'adjustment', label: 'Ajustement' },
  { value: 'transfer_sent', label: 'Transfert envoyé' },
  { value: 'transfer_received', label: 'Transfert reçu' },
  { value: 'transfer_fee', label: 'Frais de transfert' },
  { value: 'fee_collected', label: 'Frais encaissés' },
  { value: 'pension_payment', label: 'Paiement pension' },
  { value: 'pension_received', label: 'Pension reçue' },
]

const STATUS_MAP = {
  completed: { label: 'Effectué', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  approved: { label: 'Encaissé', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  pending: { label: 'En attente', icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  rejected: { label: 'Rejeté', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  expired: { label: 'Expiré', icon: XCircle, color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200' },
}

const ROLE_LABELS = {
  super_admin: 'Administrateur', directeur: 'Directeur', enseignant: 'Enseignant',
  parent: 'Parent', eleve: 'Élève', utilisateur: 'Utilisateur', admin: 'Administrateur',
}

export default function AdminTransactionsPage() {
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [group, setGroup] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pdfRef = useRef(null)

  const key = `/admin/transactions?c=${category}&s=${status}&g=${group}&f=${from}&t=${to}&q=${search}&p=${page}`
  const query = useCachedFetch(
    key,
    async () => walletAdminApi.transactions({ category, status, group, from, to, q: search, page, limit: 50 }),
    [category, status, group, from, to, search, page],
  )

  const data = query.data || {}
  const items = data.transactions || []
  const stats = data.stats || { totalCount: 0, totalIn: 0, totalOut: 0, net: 0, byGroup: { staff: {}, users: {} } }
  const loading = query.loading

  const refresh = () => { cache.invalidate('/admin/transactions'); query.refetch() }
  const onSearch = (e) => { e.preventDefault(); setPage(1); setSearch(q.trim()) }
  const resetFilters = () => { setCategory(''); setStatus(''); setGroup(''); setFrom(''); setTo(''); setQ(''); setSearch(''); setPage(1) }
  const changeFilter = (setter) => (e) => { setPage(1); setter(e.target.value) }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ArrowLeftRight size={22} className="text-indigo-600" /> Gestion des transactions
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Toutes les souscriptions et paiements du personnel et des utilisateurs de la plateforme.</p>
        </div>
        <div className="flex items-center gap-2">
          <DownloadPdfButton containerRef={pdfRef} filename="transactions.pdf" title="Transactions de la plateforme" label="Exporter PDF" />
          <button onClick={refresh} className="btn-secondary text-sm inline-flex items-center gap-1.5">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Actualiser
          </button>
        </div>
      </div>

      <div ref={pdfRef} className="space-y-6">
        {/* Cartes de synthèse */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4 border-l-4 border-green-500">
            <div className="flex items-center gap-2 text-green-700"><TrendingUp size={16} /><span className="text-xs font-semibold uppercase tracking-wide">Entrées</span></div>
            <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{fmt(stats.totalIn)} <span className="text-sm font-medium text-gray-400">XAF</span></div>
            <div className="text-xs text-gray-500 mt-0.5">Total crédité</div>
          </div>
          <div className="card p-4 border-l-4 border-red-400">
            <div className="flex items-center gap-2 text-red-600"><TrendingDown size={16} /><span className="text-xs font-semibold uppercase tracking-wide">Sorties</span></div>
            <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{fmt(stats.totalOut)} <span className="text-sm font-medium text-gray-400">XAF</span></div>
            <div className="text-xs text-gray-500 mt-0.5">Total débité</div>
          </div>
          <div className="card p-4 border-l-4 border-blue-500">
            <div className="flex items-center gap-2 text-blue-600"><Scale size={16} /><span className="text-xs font-semibold uppercase tracking-wide">Solde net</span></div>
            <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{fmt(stats.net)} <span className="text-sm font-medium text-gray-400">XAF</span></div>
            <div className="text-xs text-gray-500 mt-0.5">Entrées − sorties</div>
          </div>
          <div className="card p-4 border-l-4 border-indigo-500">
            <div className="flex items-center gap-2 text-indigo-600"><Hash size={16} /><span className="text-xs font-semibold uppercase tracking-wide">Transactions</span></div>
            <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{fmt(stats.totalCount)}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              Personnel {fmt(stats.byGroup?.staff?.count)} · Utilisateurs {fmt(stats.byGroup?.users?.count)}
            </div>
          </div>
        </div>

        {/* Filtres */}
        <div className="card p-4 space-y-3 no-pdf">
          <div className="flex flex-wrap items-center gap-3">
            <select value={category} onChange={changeFilter(setCategory)} className="input text-sm w-auto">
              <option value="">Tous les types</option>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select value={status} onChange={changeFilter(setStatus)} className="input text-sm w-auto">
              <option value="">Tous les statuts</option>
              <option value="completed">Effectué</option>
              <option value="approved">Encaissé</option>
              <option value="pending">En attente</option>
              <option value="rejected">Rejeté</option>
              <option value="expired">Expiré</option>
            </select>
            <select value={group} onChange={changeFilter(setGroup)} className="input text-sm w-auto">
              <option value="">Tous les profils</option>
              <option value="staff">Personnel de la plateforme</option>
              <option value="users">Utilisateurs</option>
              <option value="directeur">Directeurs</option>
              <option value="enseignant">Enseignants</option>
              <option value="parent">Parents</option>
              <option value="eleve">Élèves</option>
              <option value="utilisateur">Utilisateurs (simples)</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs text-gray-500 flex items-center gap-1.5">Du <input type="date" value={from} onChange={changeFilter(setFrom)} className="input text-sm w-auto" /></label>
            <label className="text-xs text-gray-500 flex items-center gap-1.5">Au <input type="date" value={to} onChange={changeFilter(setTo)} className="input text-sm w-auto" /></label>
            <form onSubmit={onSearch} className="flex items-center gap-2 flex-1 min-w-[200px]">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (nom, téléphone, matricule, n° compte)…" className="input text-sm flex-1" />
              <button type="submit" className="btn-secondary text-sm">Rechercher</button>
            </form>
            {(category || status || group || from || to || search) && (
              <button onClick={resetFilters} className="text-xs text-gray-500 hover:text-gray-700 underline">Réinitialiser</button>
            )}
          </div>
        </div>

        {/* Tableau */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400"><Loader2 size={24} className="animate-spin mx-auto mb-2" /> Chargement…</div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-gray-400">Aucune transaction trouvée pour ces filtres.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Personne</th>
                    <th className="px-4 py-3 font-semibold">Profil</th>
                    <th className="px-4 py-3 font-semibold text-right">Montant</th>
                    <th className="px-4 py-3 font-semibold">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((t) => {
                    const st = STATUS_MAP[t.status] || STATUS_MAP.completed
                    const StIcon = st.icon
                    const isStaff = t.actor?.group === 'staff'
                    return (
                      <tr key={t._id} className="border-b border-gray-50 hover:bg-gray-50/60">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(t.date)}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700">{t.categoryLabel}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{t.actor?.name || '—'}</div>
                          <div className="text-xs text-gray-500">{ROLE_LABELS[t.actor?.role] || t.actor?.role || '—'}</div>
                          {(t.actor?.phone || t.actor?.matricule || t.actor?.accountNo) && (
                            <div className="text-xs text-gray-400">
                              {t.actor?.phone && <span>📱 {t.actor.phone} </span>}
                              {t.actor?.matricule && <span className="font-mono">· {t.actor.matricule} </span>}
                              {t.actor?.accountNo && <span className="font-mono">· {t.actor.accountNo}</span>}
                            </div>
                          )}
                          {t.counterparty?.name && <div className="text-xs text-gray-400">↔ {t.counterparty.name}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium',
                            isStaff ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600')}>
                            {isStaff ? <Building2 size={12} /> : <Users size={12} />}
                            {isStaff ? 'Personnel' : 'Utilisateur'}
                          </span>
                        </td>
                        <td className={cn('px-4 py-3 text-right font-bold whitespace-nowrap',
                          t.direction === 'debit' ? 'text-red-600' : 'text-green-600')}>
                          {t.direction === 'debit' ? '−' : '+'}{fmt(t.amount)} <span className="text-xs font-medium text-gray-400">{t.currency}</span>
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

        {/* Pagination */}
        {data.pages > 1 && (
          <div className="flex items-center justify-between text-sm text-gray-500 no-pdf">
            <span>{fmt(data.total)} transaction(s) · page {data.page} / {data.pages}</span>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn-secondary text-sm inline-flex items-center gap-1 disabled:opacity-40"><ChevronLeft size={15} /> Préc.</button>
              <button disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}
                className="btn-secondary text-sm inline-flex items-center gap-1 disabled:opacity-40">Suiv. <ChevronRight size={15} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
