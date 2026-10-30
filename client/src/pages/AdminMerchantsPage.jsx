import { useRef, useState } from 'react'
import {
  Store, Loader2, RefreshCw, Wallet, Coins, Users, Smartphone,
  ChevronLeft, ChevronRight, PlusCircle, UserPlus, X, Search, Trash2,
  CreditCard, ArrowDownRight, ArrowUpRight, Calendar, DollarSign,
  Send, CheckCircle2, ShieldCheck, Key, Eye, EyeOff, AlertCircle,
} from 'lucide-react'
import { adminMerchantsApi, adminUsersApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'
import DownloadPdfButton from '../components/DownloadPdfButton'

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—')
const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'
const OPERATOR_LABELS = { mtn: 'MTN MoMo', moov: 'Moov Money', celtiis: 'Celtiis Cash', orange: 'Orange Money' }

export default function AdminMerchantsPage() {
  const [tab, setTab] = useState('merchants') // 'merchants' | 'subscriptions'
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [acting, setActing] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const pdfRef = useRef(null)

  // 1. Liste des marchands
  const key = `/admin/merchants?q=${search}&p=${page}`
  const query = useCachedFetch(key, async () => adminMerchantsApi.list({ q: search, page, limit: 50 }), [search, page])
  const data = query.data || {}
  const merchants = data.merchants || []
  const stats = data.stats || { totalMerchants: 0, totalBalance: 0, totalCommission: 0 }
  const loading = query.loading

  // 2. Souscriptions marchands & frais
  const subKey = '/admin/merchants/subscriptions'
  const subQuery = useCachedFetch(subKey, async () => adminMerchantsApi.subscriptions(), [])
  const subData = subQuery.data || { totalRevenue: 0, totalCount: 0, adminBalance: 0, byMonth: [], history: [], merchantFees: [] }
  const subLoading = subQuery.loading

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 5000) }
  const refresh = () => {
    cache.invalidate('/admin/merchants')
    cache.invalidate(subKey)
    query.refetch()
    subQuery.refetch()
  }
  const onSearch = (e) => { e.preventDefault(); setPage(1); setSearch(q.trim()) }

  const revoke = async (m) => {
    if (!window.confirm(`Retirer le statut marchand de ${m.name} ?`)) return
    setErr(''); setActing(m._id)
    try {
      await adminMerchantsApi.grant(m._id, false)
      flash(`${m.name} n'est plus marchand.`)
      refresh()
    } catch (e) {
      setErr(e.message)
    } finally {
      setActing('')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Store size={22} className="text-orange-600" /> Gestion des marchands
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Comptes marchands, commissions gagnées, revenus de souscription et retraits Mobile Money.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setAddOpen(true)}
            className="btn-secondary text-sm inline-flex items-center gap-1.5"
          >
            <UserPlus size={15} /> Ajouter un marchand
          </button>
          <DownloadPdfButton
            containerRef={pdfRef}
            filename="marchands.pdf"
            title="Marchands de la plateforme"
            label="Exporter PDF"
          />
          <button
            onClick={refresh}
            className="btn-ghost border border-gray-200 text-sm inline-flex items-center gap-1.5"
          >
            <RefreshCw size={15} className={loading || subLoading ? 'animate-spin' : ''} /> Actualiser
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setTab('merchants')}
          className={`pb-2.5 px-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            tab === 'merchants'
              ? 'border-orange-600 text-orange-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Store size={16} /> Marchands actifs ({stats.totalMerchants})
        </button>
        <button
          onClick={() => setTab('subscriptions')}
          className={`pb-2.5 px-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            tab === 'subscriptions'
              ? 'border-orange-600 text-orange-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Coins size={16} /> Souscriptions & Retraits MoMo
        </button>
      </div>

      {msg && <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-3 text-sm">{msg}</div>}
      {err && <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-sm">{err}</div>}

      {/* ── TAB 1 : MARCHANDS ACTIFS ── */}
      {tab === 'merchants' && (
        <div ref={pdfRef} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card p-4 border-l-4 border-orange-500">
              <div className="flex items-center gap-2 text-orange-600">
                <Users size={16} />
                <span className="text-xs font-semibold uppercase tracking-wide">Marchands</span>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{fmt(stats.totalMerchants)}</div>
            </div>
            <div className="card p-4 border-l-4 border-emerald-500">
              <div className="flex items-center gap-2 text-emerald-600">
                <Wallet size={16} />
                <span className="text-xs font-semibold uppercase tracking-wide">Total des soldes</span>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
                {fmt(stats.totalBalance)} <span className="text-sm font-medium text-gray-400">XAF</span>
              </div>
            </div>
            <div className="card p-4 border-l-4 border-amber-500">
              <div className="flex items-center gap-2 text-amber-600">
                <Coins size={16} />
                <span className="text-xs font-semibold uppercase tracking-wide">Commissions versées</span>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
                {fmt(stats.totalCommission)} <span className="text-sm font-medium text-gray-400">XAF</span>
              </div>
            </div>
          </div>

          <div className="card p-4 no-pdf">
            <form onSubmit={onSearch} className="flex items-center gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher (nom, email, téléphone, n° compte)…"
                className="input text-sm flex-1"
              />
              <button type="submit" className="btn-secondary text-sm">
                Rechercher
              </button>
              {search && (
                <button
                  type="button"
                  onClick={() => { setQ(''); setSearch(''); setPage(1) }}
                  className="text-xs text-gray-500 underline"
                >
                  Réinitialiser
                </button>
              )}
            </form>
          </div>

          <div className="card overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-gray-400">
                <Loader2 size={24} className="animate-spin mx-auto mb-2" /> Chargement…
              </div>
            ) : merchants.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                Aucun marchand pour le moment. Utilisez « Ajouter un marchand ».
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                      <th className="px-4 py-3 font-semibold">Marchand</th>
                      <th className="px-4 py-3 font-semibold">Identifiants</th>
                      <th className="px-4 py-3 font-semibold text-right">Solde</th>
                      <th className="px-4 py-3 font-semibold text-right">Commissions</th>
                      <th className="px-4 py-3 font-semibold">Compte Mobile Money</th>
                      <th className="px-4 py-3 font-semibold text-right no-pdf">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {merchants.map((m) => (
                      <tr key={m._id} className="hover:bg-gray-50/60">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{m.name}</div>
                          <div className="text-xs text-gray-400">{m.email}</div>
                          <div className="text-[11px] text-gray-400">Depuis le {fmtDate(m.merchantSince)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs text-gray-700">N° {m.walletAccountNo || '—'}</div>
                          {m.matricule && <div className="text-xs text-gray-500">Mat. {m.matricule}</div>}
                          {m.phone && <div className="text-xs text-gray-400">{m.phone}</div>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-bold text-gray-900">{fmt(m.balance)} F</div>
                          {m.locked > 0 && <div className="text-[11px] text-amber-600">bloqué {fmt(m.locked)} F</div>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-semibold text-amber-700">{fmt(m.commissionTotal)} F</div>
                          <div className="text-[11px] text-gray-400">{m.commissionCount || 0} gain(s)</div>
                        </td>
                        <td className="px-4 py-3">
                          {m.externalAccount?.number ? (
                            <div className="text-xs">
                              <span className="font-medium text-gray-800">
                                {OPERATOR_LABELS[m.externalAccount.operator] || m.externalAccount.operator}
                              </span>
                              <div className="font-mono text-gray-600">{m.externalAccount.number}</div>
                              {m.externalAccount.name && <div className="text-gray-400">{m.externalAccount.name}</div>}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">Non renseigné</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right no-pdf">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => revoke(m)}
                              disabled={acting === m._id}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                              title="Retirer le statut"
                            >
                              {acting === m._id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2 : SOUSCRIPTIONS MARCHANDS & RETRAITS MOMO ── */}
      {tab === 'subscriptions' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card p-4 border-l-4 border-indigo-500">
              <div className="flex items-center gap-2 text-indigo-600">
                <Coins size={16} />
                <span className="text-xs font-semibold uppercase tracking-wide">Total souscriptions</span>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
                {fmt(subData.totalRevenue)} <span className="text-sm font-medium text-gray-400">FCFA</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">{subData.totalCount} activation(s) marchands</p>
            </div>

            <div className="card p-4 border-l-4 border-emerald-500">
              <div className="flex items-center gap-2 text-emerald-600">
                <Wallet size={16} />
                <span className="text-xs font-semibold uppercase tracking-wide">Solde Admin Retirable</span>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
                {fmt(subData.adminBalance)} <span className="text-sm font-medium text-gray-400">FCFA</span>
              </div>
              <p className="text-[11px] text-emerald-600 mt-1">Disponible pour paiement Mobile Money</p>
            </div>

            <div className="card p-4 border-l-4 border-blue-500">
              <div className="flex items-center gap-2 text-blue-600">
                <Users size={16} />
                <span className="text-xs font-semibold uppercase tracking-wide">Marchands inscrits</span>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{fmt(stats.totalMerchants)}</div>
              <p className="text-[11px] text-gray-400 mt-1">Tarif unique : 6 933 FCFA / compte</p>
            </div>

          </div>

          {/* Répartition Mensuelle */}
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Calendar size={16} className="text-blue-600" />
              Répartition mensuelle des revenus de souscription
            </h3>
            {subData.byMonth?.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">Aucune souscription enregistrée à ce jour.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {subData.byMonth.map((m) => (
                  <div key={m.key} className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-100 space-y-1">
                    <span className="text-xs font-semibold text-gray-700 capitalize">{m.label}</span>
                    <div className="text-lg font-bold text-gray-900">{fmt(m.total)} FCFA</div>
                    <div className="text-[11px] text-gray-500">{m.count} souscription(s)</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Historique des souscriptions */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Historique des souscriptions marchands</h3>
                <p className="text-xs text-gray-500 mt-0.5">Toutes les activations payées via Mobile Money (6 933 FCFA).</p>
              </div>
            </div>

            {subLoading ? (
              <div className="p-12 text-center text-gray-400">
                <Loader2 size={24} className="animate-spin mx-auto mb-2" /> Chargement…
              </div>
            ) : subData.history?.length === 0 ? (
              <div className="p-12 text-center text-gray-400">Aucune souscription pour le moment.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left uppercase tracking-wide text-gray-400 border-b border-gray-100 bg-gray-50/50">
                      <th className="px-4 py-3 font-semibold">Date & Heure</th>
                      <th className="px-4 py-3 font-semibold">Marchand</th>
                      <th className="px-4 py-3 font-semibold">N° Portefeuille</th>
                      <th className="px-4 py-3 font-semibold">Téléphone / Opérateur</th>
                      <th className="px-4 py-3 font-semibold text-right">Montant</th>
                      <th className="px-4 py-3 font-semibold">Référence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {subData.history.map((h) => (
                      <tr key={h._id} className="hover:bg-gray-50/60">
                        <td className="px-4 py-3 whitespace-nowrap text-gray-500">{fmtDateTime(h.date)}</td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-gray-900">{h.user?.name}</div>
                          <div className="text-[11px] text-gray-400">{h.user?.email}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-700">{h.user?.accountNo || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="text-gray-800">{h.phone || '—'}</div>
                          <div className="text-[10px] text-gray-400 uppercase">{OPERATOR_LABELS[h.operator] || h.operator}</div>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <span className="font-bold text-emerald-600">+{fmt(h.amount)} FCFA</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-gray-500 truncate max-w-xs">{h.reference}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Frais & Volumes par Marchand */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Suivi des volumes et commissions par marchand</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Volumes totaux d'opérations (dépôts, retraits, transferts) et commissions cumulées versées à chaque marchand.
              </p>
            </div>

            {subData.merchantFees?.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs">Aucun marchand enregistré.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left uppercase tracking-wide text-gray-400 border-b border-gray-100 bg-gray-50/50">
                      <th className="px-4 py-3 font-semibold">Marchand</th>
                      <th className="px-4 py-3 font-semibold">N° Compte</th>
                      <th className="px-4 py-3 font-semibold text-right">Commissions Reçues</th>
                      <th className="px-4 py-3 font-semibold text-right">Vol. Dépôts</th>
                      <th className="px-4 py-3 font-semibold text-right">Vol. Retraits</th>
                      <th className="px-4 py-3 font-semibold text-right">Vol. Transferts</th>
                      <th className="px-4 py-3 font-semibold text-center">Opérations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {subData.merchantFees.map((mf) => (
                      <tr key={mf._id} className="hover:bg-gray-50/60">
                        <td className="px-4 py-3">
                          <div className="font-bold text-gray-900">{mf.name}</div>
                          <div className="text-[11px] text-gray-400">{mf.phone}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-700">{mf.walletAccountNo || '—'}</td>
                        <td className="px-4 py-3 text-right font-bold text-amber-700">
                          {fmt(mf.commissionTotal)} FCFA
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">{fmt(mf.volumeDeposit)} F</td>
                        <td className="px-4 py-3 text-right text-gray-700">{fmt(mf.volumeWithdrawal)} F</td>
                        <td className="px-4 py-3 text-right text-gray-700">{fmt(mf.volumeTransfer)} F</td>
                        <td className="px-4 py-3 text-center">
                          <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-semibold">
                            {mf.totalOperations}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Approvisionnement */}
      {fundFor && (
        <FundModal
          merchant={fundFor}
          onClose={() => setFundFor(null)}
          onDone={(m) => { setFundFor(null); flash(m); refresh() }}
          onError={(e) => setErr(e)}
        />
      )}

      {/* Modal Ajout Marchand */}
      {addOpen && (
        <AddMerchantModal
          onClose={() => setAddOpen(false)}
          onDone={(m) => { setAddOpen(false); flash(m); refresh() }}
          onError={(e) => setErr(e)}
        />
      )}

      {/* Modal Retrait Souscriptions Mobile Money */}
      {withdrawOpen && (
        <WithdrawSubscriptionsModal
          maxBalance={subData.adminBalance}
          onClose={() => setWithdrawOpen(false)}
          onDone={(m) => { setWithdrawOpen(false); flash(m); refresh() }}
          onError={(e) => setErr(e)}
        />
      )}
    </div>
  )
}

// ── Modal Retrait des souscriptions marchands vers Mobile Money ─────────────────
function AddMerchantModal({ onClose, onDone, onError }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [acting, setActing] = useState('')

  const doSearch = async (e) => {
    e?.preventDefault()
    if (!q.trim()) return
    setSearching(true)
    try {
      const r = await adminUsersApi.list({ q: q.trim(), limit: 20 })
      setResults(r.users || [])
    } catch (err) {
      onError(err.message)
    } finally {
      setSearching(false)
    }
  }

  const grant = async (u) => {
    setActing(u._id)
    try {
      await adminMerchantsApi.grant(u._id, true)
      onDone(`${u.name} est désormais marchand.`)
    } catch (err) {
      onError(err.message)
      setActing('')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Ajouter un marchand</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-gray-500">Recherchez un utilisateur puis accordez-lui le statut marchand.</p>
        <form onSubmit={doSearch} className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nom, email, téléphone, n° compte…"
            className="input text-sm flex-1"
          />
          <button type="submit" className="btn-secondary text-sm inline-flex items-center gap-1">
            <Search size={14} /> Chercher
          </button>
        </form>
        <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
          {searching ? (
            <div className="py-6 text-center text-gray-400">
              <Loader2 size={20} className="animate-spin mx-auto" />
            </div>
          ) : results.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">Aucun résultat.</p>
          ) : (
            results.map((u) => (
              <div key={u._id} className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">
                    {u.name} {u.isMerchant && <span className="text-[10px] text-amber-600">(déjà marchand)</span>}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {u.email} · {u.role}
                  </div>
                </div>
                <button
                  onClick={() => grant(u)}
                  disabled={u.isMerchant || acting === u._id}
                  className="btn-primary text-xs inline-flex items-center gap-1 disabled:opacity-40"
                >
                  {acting === u._id ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />} Accorder
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
