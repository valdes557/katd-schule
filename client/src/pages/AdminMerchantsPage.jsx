import { useRef, useState } from 'react'
import {
  Store, Loader2, RefreshCw, Wallet, Coins, Users, Smartphone,
  ChevronLeft, ChevronRight, PlusCircle, UserPlus, X, Search, Trash2,
} from 'lucide-react'
import { adminMerchantsApi, adminUsersApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'
import DownloadPdfButton from '../components/DownloadPdfButton'

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—'
const OPERATOR_LABELS = { mtn: 'MTN MoMo', moov: 'Moov Money', celtiis: 'Celtiis Cash', orange: 'Orange Money' }

export default function AdminMerchantsPage() {
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [acting, setActing] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [fundFor, setFundFor] = useState(null) // marchand à approvisionner
  const [addOpen, setAddOpen] = useState(false)
  const pdfRef = useRef(null)

  const key = `/admin/merchants?q=${search}&p=${page}`
  const query = useCachedFetch(key, async () => adminMerchantsApi.list({ q: search, page, limit: 50 }), [search, page])

  const data = query.data || {}
  const merchants = data.merchants || []
  const stats = data.stats || { totalMerchants: 0, totalBalance: 0, totalCommission: 0 }
  const loading = query.loading

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }
  const refresh = () => { cache.invalidate('/admin/merchants'); query.refetch() }
  const onSearch = (e) => { e.preventDefault(); setPage(1); setSearch(q.trim()) }

  const revoke = async (m) => {
    if (!window.confirm(`Retirer le statut marchand de ${m.name} ?`)) return
    setErr(''); setActing(m._id)
    try { await adminMerchantsApi.grant(m._id, false); flash(`${m.name} n'est plus marchand.`); refresh() }
    catch (e) { setErr(e.message) } finally { setActing('') }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Store size={22} className="text-orange-600" /> Gestion des marchands
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Soldes, commissions gagnées, identité et approvisionnement virtuel des marchands.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAddOpen(true)} className="btn-primary text-sm inline-flex items-center gap-1.5"><UserPlus size={15} /> Ajouter un marchand</button>
          <DownloadPdfButton containerRef={pdfRef} filename="marchands.pdf" title="Marchands de la plateforme" label="Exporter PDF" />
          <button onClick={refresh} className="btn-secondary text-sm inline-flex items-center gap-1.5"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Actualiser</button>
        </div>
      </div>

      {msg && <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-3 text-sm">{msg}</div>}
      {err && <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-sm">{err}</div>}

      <div ref={pdfRef} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-4 border-l-4 border-orange-500">
            <div className="flex items-center gap-2 text-orange-600"><Users size={16} /><span className="text-xs font-semibold uppercase tracking-wide">Marchands</span></div>
            <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{fmt(stats.totalMerchants)}</div>
          </div>
          <div className="card p-4 border-l-4 border-emerald-500">
            <div className="flex items-center gap-2 text-emerald-600"><Wallet size={16} /><span className="text-xs font-semibold uppercase tracking-wide">Total des soldes</span></div>
            <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{fmt(stats.totalBalance)} <span className="text-sm font-medium text-gray-400">XAF</span></div>
          </div>
          <div className="card p-4 border-l-4 border-amber-500">
            <div className="flex items-center gap-2 text-amber-600"><Coins size={16} /><span className="text-xs font-semibold uppercase tracking-wide">Commissions versées</span></div>
            <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{fmt(stats.totalCommission)} <span className="text-sm font-medium text-gray-400">XAF</span></div>
          </div>
        </div>

        <div className="card p-4 no-pdf">
          <form onSubmit={onSearch} className="flex items-center gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (nom, email, téléphone, n° compte)…" className="input text-sm flex-1" />
            <button type="submit" className="btn-secondary text-sm">Rechercher</button>
            {search && <button type="button" onClick={() => { setQ(''); setSearch(''); setPage(1) }} className="text-xs text-gray-500 underline">Réinitialiser</button>}
          </form>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400"><Loader2 size={24} className="animate-spin mx-auto mb-2" /> Chargement…</div>
          ) : merchants.length === 0 ? (
            <div className="p-12 text-center text-gray-400">Aucun marchand pour le moment. Utilisez « Ajouter un marchand ».</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                    <th className="px-4 py-3 font-semibold">Marchand</th>
                    <th className="px-4 py-3 font-semibold">Identifiants</th>
                    <th className="px-4 py-3 font-semibold text-right">Solde</th>
                    <th className="px-4 py-3 font-semibold text-right">Commissions</th>
                    <th className="px-4 py-3 font-semibold">Compte externe</th>
                    <th className="px-4 py-3 font-semibold text-right no-pdf">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {merchants.map((m) => (
                    <tr key={m._id} className="border-b border-gray-50 hover:bg-gray-50/60">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{m.name}</div>
                        <div className="text-xs text-gray-400">Marchand depuis {fmtDate(m.merchantSince)}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        <div className="text-gray-600">{m.email}</div>
                        {m.phone && <div>📱 {m.phone}</div>}
                        <div className="font-mono text-gray-400">{m.walletAccountNo}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700 whitespace-nowrap">{fmt(m.balance)} <span className="text-xs font-medium text-gray-400">F</span></td>
                      <td className="px-4 py-3 text-right font-bold text-amber-700 whitespace-nowrap">{fmt(m.commissionTotal)} <span className="text-xs font-medium text-gray-400">F</span></td>
                      <td className="px-4 py-3 text-xs">
                        {m.externalAccount?.number ? (
                          <div className="text-gray-600">
                            <div className="flex items-center gap-1"><Smartphone size={12} className="text-gray-400" /> {OPERATOR_LABELS[m.externalAccount.operator] || m.externalAccount.operator || 'MoMo'}</div>
                            <div className="font-mono">{m.externalAccount.number}</div>
                          </div>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap no-pdf">
                        <div className="inline-flex items-center gap-1.5">
                          <button onClick={() => setFundFor(m)} disabled={acting === m._id}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40">
                            <PlusCircle size={12} /> Approvisionner
                          </button>
                          <button onClick={() => revoke(m)} disabled={acting === m._id}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-40">
                            {acting === m._id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Retirer
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

        {data.pages > 1 && (
          <div className="flex items-center justify-between text-sm text-gray-500 no-pdf">
            <span>{fmt(data.total)} marchands · page {data.page} / {data.pages}</span>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="btn-secondary text-sm inline-flex items-center gap-1 disabled:opacity-40"><ChevronLeft size={15} /> Préc.</button>
              <button disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} className="btn-secondary text-sm inline-flex items-center gap-1 disabled:opacity-40">Suiv. <ChevronRight size={15} /></button>
            </div>
          </div>
        )}
      </div>

      {fundFor && <FundModal merchant={fundFor} onClose={() => setFundFor(null)} onDone={(m) => { setFundFor(null); flash(m); refresh() }} onError={setErr} />}
      {addOpen && <AddMerchantModal onClose={() => setAddOpen(false)} onDone={(m) => { setAddOpen(false); flash(m); refresh() }} onError={setErr} />}
    </div>
  )
}

function FundModal({ merchant, onClose, onDone, onError }) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    onError(''); setBusy(true)
    try {
      await adminMerchantsApi.fund(merchant._id, Number(amount), reason)
      onDone(`${fmt(Number(amount))} F crédités à ${merchant.name}.`)
    } catch (e) { onError(e.message); setBusy(false) }
  }
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !busy && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Approvisionner {merchant.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500">Montant virtuel illimité crédité au portefeuille du marchand.</p>
        <div><label className="text-xs font-medium text-gray-600 mb-1 block">Montant (FCFA)</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="input w-full" placeholder="Ex: 500000" /></div>
        <div><label className="text-xs font-medium text-gray-600 mb-1 block">Motif (facultatif)</label><input value={reason} onChange={(e) => setReason(e.target.value)} className="input w-full" placeholder="Approvisionnement float" /></div>
        <button onClick={submit} disabled={busy || !amount} className="btn-primary w-full justify-center">{busy ? <Loader2 size={16} className="animate-spin" /> : 'Approvisionner'}</button>
      </div>
    </div>
  )
}

function AddMerchantModal({ onClose, onDone, onError }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [acting, setActing] = useState('')
  const doSearch = async (e) => {
    e.preventDefault()
    if (!q.trim()) return
    setSearching(true)
    try { const r = await adminUsersApi.list({ q: q.trim(), limit: 20 }); setResults(r.users || []) }
    catch (err) { onError(err.message) } finally { setSearching(false) }
  }
  const grant = async (u) => {
    setActing(u._id)
    try { await adminMerchantsApi.grant(u._id, true); onDone(`${u.name} est désormais marchand.`) }
    catch (err) { onError(err.message); setActing('') }
  }
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Ajouter un marchand</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500">Recherchez un utilisateur puis accordez-lui le statut marchand.</p>
        <form onSubmit={doSearch} className="flex items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, email, téléphone, n° compte…" className="input text-sm flex-1" />
          <button type="submit" className="btn-secondary text-sm inline-flex items-center gap-1"><Search size={14} /> Chercher</button>
        </form>
        <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
          {searching ? (
            <div className="py-6 text-center text-gray-400"><Loader2 size={20} className="animate-spin mx-auto" /></div>
          ) : results.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">Aucun résultat.</p>
          ) : results.map((u) => (
            <div key={u._id} className="flex items-center justify-between py-2.5">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">{u.name} {u.isMerchant && <span className="text-[10px] text-amber-600">(déjà marchand)</span>}</div>
                <div className="text-xs text-gray-400 truncate">{u.email} · {u.role}</div>
              </div>
              <button onClick={() => grant(u)} disabled={u.isMerchant || acting === u._id}
                className="btn-primary text-xs inline-flex items-center gap-1 disabled:opacity-40">
                {acting === u._id ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />} Accorder
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
