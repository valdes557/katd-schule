import { useRef, useState } from 'react'
import {
  Coins, Loader2, RefreshCw, Wallet, Hash, Calculator, ChevronLeft, ChevronRight,
  Users, Building2, CalendarRange,
} from 'lucide-react'
import { walletAdminApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'
import { cn } from '../lib/utils'
import DownloadPdfButton from '../components/DownloadPdfButton'

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')
const fmtDate = (d) => d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

const ROLE_LABELS = {
  super_admin: 'Administrateur', directeur: 'Directeur', enseignant: 'Enseignant',
  parent: 'Parent', eleve: 'Élève', utilisateur: 'Utilisateur', admin: 'Administrateur',
}

// Libellé lisible d'une période (« 2026-07 » → « Juillet 2026 », « 2026-07-11 » → « 11/07/2026 »)
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
function periodLabel(key) {
  if (!key) return '—'
  if (key.length === 7) { const [y, m] = key.split('-'); return `${MONTHS[Number(m) - 1] || m} ${y}` }
  const [y, m, d] = key.split('-'); return `${d}/${m}/${y}`
}

export default function AdminTransactionFeesPage() {
  const [group, setGroup] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [period, setPeriod] = useState('month')
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pdfRef = useRef(null)

  const key = `/admin/transaction-fees?g=${group}&f=${from}&t=${to}&per=${period}&q=${search}&p=${page}`
  const query = useCachedFetch(
    key,
    async () => walletAdminApi.transactionFees({ group, from, to, period, q: search, page, limit: 50 }),
    [group, from, to, period, search, page],
  )

  const data = query.data || {}
  const fees = data.fees || []
  const stats = data.stats || { totalCount: 0, totalAmount: 0, avg: 0, byGroup: { staff: {}, users: {} }, byPeriod: [] }
  const loading = query.loading

  const refresh = () => { cache.invalidate('/admin/transaction-fees'); query.refetch() }
  const onSearch = (e) => { e.preventDefault(); setPage(1); setSearch(q.trim()) }
  const resetFilters = () => { setGroup(''); setFrom(''); setTo(''); setQ(''); setSearch(''); setPage(1) }
  const changeFilter = (setter) => (e) => { setPage(1); setter(e.target.value) }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Coins size={22} className="text-amber-600" /> Frais de transaction
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Frais versés à l'administrateur par le personnel et les utilisateurs de la plateforme.</p>
        </div>
        <div className="flex items-center gap-2">
          <DownloadPdfButton containerRef={pdfRef} filename="frais-transaction.pdf" title="Frais de transaction encaissés" label="Exporter PDF" />
          <button onClick={refresh} className="btn-secondary text-sm inline-flex items-center gap-1.5">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Actualiser
          </button>
        </div>
      </div>

      <div ref={pdfRef} className="space-y-6">
        {/* Cartes de synthèse */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4 border-l-4 border-amber-500">
            <div className="flex items-center gap-2 text-amber-700"><Wallet size={16} /><span className="text-xs font-semibold uppercase tracking-wide">Total encaissé</span></div>
            <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{fmt(stats.totalAmount)} <span className="text-sm font-medium text-gray-400">XAF</span></div>
            <div className="text-xs text-gray-500 mt-0.5">Frais versés à l'admin</div>
          </div>
          <div className="card p-4 border-l-4 border-indigo-500">
            <div className="flex items-center gap-2 text-indigo-600"><Hash size={16} /><span className="text-xs font-semibold uppercase tracking-wide">Opérations</span></div>
            <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{fmt(stats.totalCount)}</div>
            <div className="text-xs text-gray-500 mt-0.5">Frais prélevés</div>
          </div>
          <div className="card p-4 border-l-4 border-blue-500">
            <div className="flex items-center gap-2 text-blue-600"><Calculator size={16} /><span className="text-xs font-semibold uppercase tracking-wide">Frais moyen</span></div>
            <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{fmt(stats.avg)} <span className="text-sm font-medium text-gray-400">XAF</span></div>
            <div className="text-xs text-gray-500 mt-0.5">Par opération</div>
          </div>
          <div className="card p-4 border-l-4 border-emerald-500">
            <div className="flex items-center gap-2 text-emerald-600"><Users size={16} /><span className="text-xs font-semibold uppercase tracking-wide">Répartition</span></div>
            <div className="text-sm font-bold text-gray-900 mt-1">Personnel : {fmt(stats.byGroup?.staff?.total)} XAF</div>
            <div className="text-sm font-bold text-gray-900">Utilisateurs : {fmt(stats.byGroup?.users?.total)} XAF</div>
          </div>
        </div>

        {/* Filtres */}
        <div className="card p-4 space-y-3 no-pdf">
          <div className="flex flex-wrap items-center gap-3">
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
            <label className="text-xs text-gray-500 flex items-center gap-1.5">Du <input type="date" value={from} onChange={changeFilter(setFrom)} className="input text-sm w-auto" /></label>
            <label className="text-xs text-gray-500 flex items-center gap-1.5">Au <input type="date" value={to} onChange={changeFilter(setTo)} className="input text-sm w-auto" /></label>
            <select value={period} onChange={changeFilter(setPeriod)} className="input text-sm w-auto">
              <option value="month">Regrouper par mois</option>
              <option value="day">Regrouper par jour</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <form onSubmit={onSearch} className="flex items-center gap-2 flex-1 min-w-[200px]">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (nom, téléphone, matricule, n° compte)…" className="input text-sm flex-1" />
              <button type="submit" className="btn-secondary text-sm">Rechercher</button>
            </form>
            {(group || from || to || search) && (
              <button onClick={resetFilters} className="text-xs text-gray-500 hover:text-gray-700 underline">Réinitialiser</button>
            )}
          </div>
        </div>

        {/* Statistiques par période */}
        {stats.byPeriod?.length > 0 && (
          <div className="card p-4">
            <div className="flex items-center gap-2 text-gray-700 mb-3">
              <CalendarRange size={16} className="text-amber-600" />
              <span className="text-sm font-semibold">Total des frais par {period === 'day' ? 'jour' : 'mois'}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                    <th className="px-4 py-2 font-semibold">Période</th>
                    <th className="px-4 py-2 font-semibold text-right">Opérations</th>
                    <th className="px-4 py-2 font-semibold text-right">Montant total</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byPeriod.map((p) => (
                    <tr key={p.period} className="border-b border-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-800">{periodLabel(p.period)}</td>
                      <td className="px-4 py-2 text-right text-gray-600">{fmt(p.count)}</td>
                      <td className="px-4 py-2 text-right font-bold text-amber-700">{fmt(p.total)} <span className="text-xs font-medium text-gray-400">XAF</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Détail des frais */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400"><Loader2 size={24} className="animate-spin mx-auto mb-2" /> Chargement…</div>
          ) : fees.length === 0 ? (
            <div className="p-12 text-center text-gray-400">Aucun frais de transaction trouvé pour ces filtres.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Payeur</th>
                    <th className="px-4 py-3 font-semibold">Identifiants</th>
                    <th className="px-4 py-3 font-semibold">Type de frais</th>
                    <th className="px-4 py-3 font-semibold text-right">Base</th>
                    <th className="px-4 py-3 font-semibold text-right">Frais</th>
                  </tr>
                </thead>
                <tbody>
                  {fees.map((f) => {
                    const isStaff = f.payer?.group === 'staff'
                    return (
                      <tr key={f._id} className="border-b border-gray-50 hover:bg-gray-50/60">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(f.date)}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{f.payer?.name || '—'}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium',
                              isStaff ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600')}>
                              {isStaff ? <Building2 size={11} /> : <Users size={11} />}
                              {ROLE_LABELS[f.payer?.role] || f.payer?.role || '—'}
                            </span>
                          </div>
                          {f.payer?.phone && <div className="text-xs text-gray-400 mt-0.5">📱 {f.payer.phone}</div>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                          {f.payer?.matricule && <div>{f.payer.matricule}</div>}
                          {f.payer?.accountNo && <div>{f.payer.accountNo}</div>}
                          {f.payer?.email && <div className="text-gray-400 font-sans">{f.payer.email}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-700">{f.feeLabel}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500 whitespace-nowrap">{f.baseAmount ? fmt(f.baseAmount) : '—'}</td>
                        <td className="px-4 py-3 text-right font-bold text-amber-700 whitespace-nowrap">{fmt(f.amount)} <span className="text-xs font-medium text-gray-400">{f.currency}</span></td>
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
            <span>{fmt(data.total)} frais · page {data.page} / {data.pages}</span>
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
