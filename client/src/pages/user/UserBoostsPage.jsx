import { useState, useEffect, useMemo } from 'react'
import { Loader2, Rocket, Eye, BarChart3, ThumbsUp, Megaphone, XCircle } from 'lucide-react'
import { boostApi } from '../../lib/api'
import BoostStatsModal from '../../components/boost/BoostStatsModal'

// Page « Mes boosts » (espace utilisateur /u) — historique des campagnes + filtres + stats.

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')

// Libellés + couleurs de statut.
const STATUS_META = {
  pending_payment: { label: 'Paiement en attente', cls: 'bg-amber-50 text-amber-700' },
  pending_review: { label: 'En validation', cls: 'bg-amber-50 text-amber-700' },
  active: { label: 'Active', cls: 'bg-green-50 text-green-700' },
  paused: { label: 'Suspendue', cls: 'bg-orange-50 text-orange-700' },
  completed: { label: 'Terminée', cls: 'bg-gray-100 text-gray-600' },
  rejected: { label: 'Rejetée', cls: 'bg-red-50 text-red-700' },
  cancelled: { label: 'Annulée', cls: 'bg-gray-100 text-gray-500' },
  refunded: { label: 'Remboursée', cls: 'bg-blue-50 text-blue-700' },
}
const DURATION_LABEL = { '24h': '24 heures', '3d': '3 jours', '7d': '7 jours' }

// Onglets de filtre → ensemble de statuts.
const FILTERS = [
  { key: 'all', label: 'Toutes', match: () => true },
  { key: 'active', label: 'Actives', match: (s) => s === 'active' || s === 'paused' },
  { key: 'completed', label: 'Terminées', match: (s) => s === 'completed' },
  { key: 'pending', label: 'En attente', match: (s) => s === 'pending_payment' || s === 'pending_review' },
  { key: 'cancelled', label: 'Annulées', match: (s) => s === 'cancelled' || s === 'rejected' || s === 'refunded' },
]

export default function UserBoostsPage() {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [statsId, setStatsId] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const r = await boostApi.myCampaigns('')
      setCampaigns(r.data || [])
    } catch { setCampaigns([]) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const shown = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter) || FILTERS[0]
    return campaigns.filter((c) => f.match(c.status))
  }, [campaigns, filter])

  const cancel = async (id) => {
    if (!window.confirm('Annuler cette campagne de boost ?')) return
    setBusyId(id)
    try {
      await boostApi.cancel(id)
      await load()
    } catch (e) { alert(e.message || 'Annulation impossible') }
    setBusyId(null)
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="w-9 h-9 rounded-full bg-purple-50 flex items-center justify-center text-purple-600"><Rocket size={18} /></span>
        <h1 className="text-lg font-bold text-gray-900">Mes boosts</h1>
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filter === f.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div>
      ) : shown.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Megaphone size={40} className="mx-auto mb-3 opacity-30" />
          <p>Aucune campagne de boost pour le moment.</p>
          <p className="text-xs mt-1">Boostez une publication depuis le fil pour la mettre en avant.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((c) => {
            const meta = STATUS_META[c.status] || { label: c.status, cls: 'bg-gray-100 text-gray-600' }
            const thumb = c.post?.thumbnail || c.post?.images?.[0] || ''
            const canCancel = ['pending_payment', 'pending_review', 'active', 'paused'].includes(c.status)
            return (
              <div key={c._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
                <div className="flex gap-3">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                    {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" /> : <Megaphone size={20} className="text-gray-400" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900 line-clamp-1">{c.post?.title || c.post?.content || 'Publication'}</p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${meta.cls}`}>{meta.label}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {DURATION_LABEL[c.durationKey] || c.durationKey} · <span className="font-semibold text-gray-700">{fmt(c.budget)} {c.currency}</span>
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500">
                      <span className="flex items-center gap-0.5"><BarChart3 size={11} /> {fmt(c.stats?.impressions)}</span>
                      <span className="flex items-center gap-0.5"><Eye size={11} /> {fmt(c.stats?.views)}</span>
                      <span className="flex items-center gap-0.5"><ThumbsUp size={11} /> {fmt(c.stats?.likes)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-50">
                  <button onClick={() => setStatsId(c._id)} className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg px-3 py-1.5">
                    <BarChart3 size={13} /> Statistiques
                  </button>
                  {canCancel && (
                    <button onClick={() => cancel(c._id)} disabled={busyId === c._id} className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg px-3 py-1.5 disabled:opacity-50">
                      {busyId === c._id ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />} Annuler
                    </button>
                  )}
                  <span className="ml-auto text-[11px] text-gray-400">{c.createdAt ? new Date(c.createdAt).toLocaleDateString('fr-FR') : ''}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {statsId && <BoostStatsModal campaignId={statsId} onClose={() => setStatsId(null)} />}
    </div>
  )
}
