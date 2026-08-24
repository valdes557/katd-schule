import { useState, useEffect, useCallback } from 'react'
import { Loader2, Rocket, Search, Pause, Play, XCircle, RotateCcw, Coins, Users, CheckCircle2, Activity, Settings2, Save } from 'lucide-react'
import { adminBoostsApi } from '../lib/api'

// Dashboard Super Admin — « Gestion des boosts » : onglet Campagnes (liste + filtres + revenus
// + actions) et onglet Configuration (grille tarifaire + limites anti-spam).

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')
const STATUS_LABEL = {
  pending_payment: 'Paiement', pending_review: 'Validation', active: 'Active', paused: 'Suspendue',
  completed: 'Terminée', rejected: 'Rejetée', cancelled: 'Annulée', refunded: 'Remboursée',
}
const STATUS_CLS = {
  active: 'bg-green-50 text-green-700', paused: 'bg-orange-50 text-orange-700',
  completed: 'bg-gray-100 text-gray-600', rejected: 'bg-red-50 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500', refunded: 'bg-blue-50 text-blue-700',
  pending_payment: 'bg-amber-50 text-amber-700', pending_review: 'bg-amber-50 text-amber-700',
}

export default function AdminBoostsPage() {
  const [tab, setTab] = useState('campaigns')
  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-9 h-9 rounded-full bg-purple-50 flex items-center justify-center text-purple-600"><Rocket size={18} /></span>
        <h1 className="text-xl font-bold text-gray-900">Gestion des boosts</h1>
      </div>
      <div className="flex gap-2 mb-4 border-b border-gray-200">
        {[['campaigns', 'Campagnes'], ['config', 'Configuration']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === k ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'campaigns' ? <CampaignsTab /> : <ConfigTab />}
    </div>
  )
}

function CampaignsTab() {
  const [stats, setStats] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ status: '', q: '', from: '', to: '' })
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [busyId, setBusyId] = useState(null)
  const limit = 20

  const loadStats = useCallback(async () => {
    try { setStats(await adminBoostsApi.stats()) } catch { /* ignore */ }
  }, [])

  const loadRows = useCallback(async () => {
    setLoading(true)
    try {
      const r = await adminBoostsApi.list({ ...filters, page, limit })
      setRows(r.data || [])
      setTotal(r.total || 0)
    } catch { setRows([]) }
    setLoading(false)
  }, [filters, page])

  useEffect(() => { loadStats() }, [loadStats])
  useEffect(() => { loadRows() }, [loadRows])

  const act = async (id, fn, confirmMsg) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return
    setBusyId(id)
    try { await fn(); await loadRows(); await loadStats() }
    catch (e) { alert(e.message || 'Action impossible') }
    setBusyId(null)
  }
  const setStatus = (id, status, reason) => act(id, () => adminBoostsApi.setStatus(id, { status, reason }),
    status === 'rejected' ? 'Rejeter cette campagne ?' : status === 'paused' ? 'Suspendre cette campagne ?' : null)
  const refund = (id) => act(id, () => adminBoostsApi.refund(id), 'Rembourser cette campagne ? (irréversible)')

  const TILES = stats ? [
    { label: 'Revenus (net)', value: fmt(stats.netRevenue) + ' F', icon: Coins },
    { label: 'Campagnes', value: fmt(stats.campaigns), icon: Rocket },
    { label: 'Actives', value: fmt(stats.activeCampaigns), icon: Activity },
    { label: 'Terminées', value: fmt(stats.completedCampaigns), icon: CheckCircle2 },
    { label: 'Budget moyen', value: fmt(stats.avgBudget) + ' F', icon: Coins },
    { label: 'Acheteurs', value: fmt(stats.buyers), icon: Users },
  ] : []

  const pages = Math.max(1, Math.ceil(total / limit))

  return (
    <div>
      {/* Tuiles de revenus */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
        {TILES.map((t) => (
          <div key={t.label} className="bg-white rounded-xl border border-gray-100 p-3">
            <t.icon size={16} className="text-blue-600 mb-1" />
            <p className="text-base font-bold text-gray-900 leading-tight">{t.value}</p>
            <p className="text-[11px] text-gray-500">{t.label}</p>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={filters.q} onChange={(e) => { setPage(1); setFilters({ ...filters, q: e.target.value }) }}
            placeholder="Rechercher un utilisateur (nom/email)" className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400" />
        </div>
        <select value={filters.status} onChange={(e) => { setPage(1); setFilters({ ...filters, status: e.target.value }) }} className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
          <option value="">Tous statuts</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input type="date" value={filters.from} onChange={(e) => { setPage(1); setFilters({ ...filters, from: e.target.value }) }} className="text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white" />
        <input type="date" value={filters.to} onChange={(e) => { setPage(1); setFilters({ ...filters, to: e.target.value }) }} className="text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white" />
      </div>

      {/* Tableau */}
      {loading ? (
        <div className="text-center py-16"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div>
      ) : rows.length === 0 ? (
        <p className="text-center text-gray-400 py-16">Aucune campagne.</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Utilisateur</th>
                <th className="text-left px-3 py-2 font-medium">Publication</th>
                <th className="text-right px-3 py-2 font-medium">Budget</th>
                <th className="text-right px-3 py-2 font-medium">Impr.</th>
                <th className="text-center px-3 py-2 font-medium">Statut</th>
                <th className="text-right px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((c) => (
                <tr key={c._id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <p className="font-medium text-gray-900 truncate max-w-[140px]">{c.user?.name || '—'}</p>
                    <p className="text-[11px] text-gray-400 truncate max-w-[140px]">{c.user?.email || ''}</p>
                  </td>
                  <td className="px-3 py-2 text-gray-600 truncate max-w-[160px]">{c.post?.title || c.post?.content || '—'}</td>
                  <td className="px-3 py-2 text-right font-semibold text-gray-900 whitespace-nowrap">{fmt(c.budget)} {c.currency}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{fmt(c.stats?.impressions)}</td>
                  <td className="px-3 py-2 text-center"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_CLS[c.status] || 'bg-gray-100 text-gray-600'}`}>{STATUS_LABEL[c.status] || c.status}</span></td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {c.status === 'active' && <IconBtn title="Suspendre" onClick={() => setStatus(c._id, 'paused')} busy={busyId === c._id} icon={Pause} cls="text-orange-600 hover:bg-orange-50" />}
                      {c.status === 'paused' && <IconBtn title="Réactiver" onClick={() => setStatus(c._id, 'active')} busy={busyId === c._id} icon={Play} cls="text-green-600 hover:bg-green-50" />}
                      {['active', 'paused', 'pending_review'].includes(c.status) && <IconBtn title="Rejeter" onClick={() => setStatus(c._id, 'rejected')} busy={busyId === c._id} icon={XCircle} cls="text-red-600 hover:bg-red-50" />}
                      {['active', 'paused', 'completed'].includes(c.status) && c.refundedAmount === 0 && <IconBtn title="Rembourser" onClick={() => refund(c._id)} busy={busyId === c._id} icon={RotateCcw} cls="text-blue-600 hover:bg-blue-50" />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-3">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40">Précédent</button>
          <span className="text-sm text-gray-500">{page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40">Suivant</button>
        </div>
      )}
    </div>
  )
}

function IconBtn({ title, onClick, busy, icon: Icon, cls }) {
  return (
    <button title={title} onClick={onClick} disabled={busy} className={`p-1.5 rounded-lg disabled:opacity-40 ${cls}`}>
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
    </button>
  )
}

function ConfigTab() {
  const [pricing, setPricing] = useState([])
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [p, c] = await Promise.all([adminBoostsApi.pricing(), adminBoostsApi.getConfig()])
      setPricing(p.data || [])
      setConfig(c.config || null)
    } catch { /* ignore */ }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const savePricing = async (row) => {
    setSaving(row._id)
    try { await adminBoostsApi.updatePricing(row._id, { label: row.label, hours: row.hours, price: row.price, isActive: row.isActive }); await load() }
    catch (e) { alert(e.message || 'Enregistrement impossible') }
    setSaving('')
  }
  const saveConfig = async () => {
    setSaving('config')
    try { const r = await adminBoostsApi.updateConfig(config); setConfig(r.config) }
    catch (e) { alert(e.message || 'Enregistrement impossible') }
    setSaving('')
  }

  if (loading) return <div className="text-center py-16"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div>

  const NUM_FIELDS = [
    ['minBudget', 'Budget min'], ['maxBudget', 'Budget max'],
    ['maxActiveCampaignsPerUser', 'Campagnes actives / utilisateur'], ['maxBoostsPerPost', 'Boosts max / publication'],
    ['maxDailyBudget', 'Budget max / jour'], ['maxMonthlyBudget', 'Budget max / mois'],
    ['minDelayBetweenCampaignsHours', 'Délai min entre campagnes (h)'], ['maxCampaignDurationHours', 'Durée max (h)'],
    ['feedInjectionRatio', 'Ratio injection feed (1/N)'], ['maxSponsoredPerPage', 'Sponsorisés max / page'],
  ]

  return (
    <div className="space-y-6">
      {/* Grille tarifaire */}
      <div>
        <h2 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-1.5"><Coins size={15} /> Grille tarifaire</h2>
        <p className="text-[11px] text-gray-400 mb-2">Les changements de prix s'appliquent aux NOUVELLES campagnes. Les campagnes déjà payées ne sont jamais modifiées rétroactivement.</p>
        <div className="space-y-2">
          {pricing.map((row, i) => (
            <div key={row._id} className="flex flex-wrap items-center gap-2 bg-white rounded-xl border border-gray-100 p-2.5">
              <span className="text-xs font-mono text-gray-500 w-10">{row.durationKey}</span>
              <input value={row.label || ''} onChange={(e) => setPricing(pricing.map((r, j) => j === i ? { ...r, label: e.target.value } : r))} placeholder="Libellé" className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 flex-1 min-w-[120px]" />
              <label className="text-xs text-gray-500">Heures <input type="number" value={row.hours} onChange={(e) => setPricing(pricing.map((r, j) => j === i ? { ...r, hours: Number(e.target.value) } : r))} className="w-20 text-sm border border-gray-200 rounded-lg px-2 py-1.5 ml-1" /></label>
              <label className="text-xs text-gray-500">Prix <input type="number" value={row.price} onChange={(e) => setPricing(pricing.map((r, j) => j === i ? { ...r, price: Number(e.target.value) } : r))} className="w-24 text-sm border border-gray-200 rounded-lg px-2 py-1.5 ml-1" /></label>
              <label className="text-xs text-gray-500 flex items-center gap-1"><input type="checkbox" checked={row.isActive} onChange={(e) => setPricing(pricing.map((r, j) => j === i ? { ...r, isActive: e.target.checked } : r))} /> Actif</label>
              <button onClick={() => savePricing(row)} disabled={saving === row._id} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-1.5 disabled:opacity-50">
                {saving === row._id ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Enregistrer
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Limites / config */}
      {config && (
        <div>
          <h2 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-1.5"><Settings2 size={15} /> Limites & diffusion</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 bg-white rounded-xl border border-gray-100 p-4">
            <label className="text-xs text-gray-500">Devise
              <input value={config.currency} onChange={(e) => setConfig({ ...config, currency: e.target.value })} className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5" />
            </label>
            {NUM_FIELDS.map(([key, label]) => (
              <label key={key} className="text-xs text-gray-500">{label}
                <input type="number" value={config[key] ?? 0} onChange={(e) => setConfig({ ...config, [key]: Number(e.target.value) })} className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5" />
              </label>
            ))}
            <label className="text-xs text-gray-600 flex items-center gap-2 col-span-2 lg:col-span-3 mt-1">
              <input type="checkbox" checked={!!config.requireReview} onChange={(e) => setConfig({ ...config, requireReview: e.target.checked })} />
              Validation manuelle avant activation (sinon activation immédiate au paiement)
            </label>
          </div>
          <button onClick={saveConfig} disabled={saving === 'config'} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-5 py-2.5 disabled:opacity-50">
            {saving === 'config' ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer la configuration
          </button>
        </div>
      )}
    </div>
  )
}
