import { useState, useEffect } from 'react'
import { X, Eye, ThumbsUp, MessageCircle, Share2, MousePointerClick, UserPlus, BarChart3, Loader2, Clock, Coins } from 'lucide-react'
import { boostApi } from '../../lib/api'

// Modal « 📊 Statistiques du boost » — impressions, vues, engagement, coût, temps restant.
// Graphiques en barres CSS (le projet n'embarque pas de librairie de charts).

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')

function remaining(ms) {
  if (ms == null) return '—'
  if (ms <= 0) return 'Terminé'
  const h = Math.floor(ms / 3600000)
  const d = Math.floor(h / 24)
  if (d >= 1) return d + ' j ' + (h % 24) + ' h'
  const m = Math.floor((ms % 3600000) / 60000)
  return h + ' h ' + m + ' min'
}

export default function BoostStatsModal({ campaignId, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const r = await boostApi.stats(campaignId)
        if (alive) setData(r)
      } catch (e) { if (alive) setError(e.message || 'Chargement impossible') }
      if (alive) setLoading(false)
    })()
    return () => { alive = false }
  }, [campaignId])

  const s = data?.stats || {}
  const metrics = [
    { key: 'impressions', label: 'Impressions', icon: BarChart3, val: s.impressions, color: 'bg-blue-500' },
    { key: 'views', label: 'Vues', icon: Eye, val: s.views, color: 'bg-indigo-500' },
    { key: 'likes', label: "J'aime", icon: ThumbsUp, val: s.likes, color: 'bg-pink-500' },
    { key: 'comments', label: 'Commentaires', icon: MessageCircle, val: s.comments, color: 'bg-teal-500' },
    { key: 'shares', label: 'Partages', icon: Share2, val: s.shares, color: 'bg-amber-500' },
    { key: 'clicks', label: 'Clics', icon: MousePointerClick, val: s.clicks, color: 'bg-violet-500' },
    { key: 'newFollowers', label: 'Nouveaux abonnés', icon: UserPlus, val: s.newFollowers, color: 'bg-emerald-500' },
  ]
  const max = Math.max(1, ...metrics.map((m) => Number(m.val) || 0))

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3.5 flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2"><BarChart3 size={18} className="text-blue-600" /> Statistiques du boost</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="text-center py-12"><Loader2 size={22} className="animate-spin mx-auto text-blue-600" /></div>
          ) : error ? (
            <p className="text-center text-sm text-red-600 py-8">{error}</p>
          ) : (
            <>
              {/* Tuiles clés */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <Tile label="Coût" value={fmt(data.cost) + ' ' + (data.currency || '')} icon={Coins} />
                <Tile label="Engagement" value={(data.stats?.engagementRate ?? 0) + ' %'} icon={ThumbsUp} />
                <Tile label="Temps restant" value={remaining(data.timeRemainingMs)} icon={Clock} />
              </div>

              {/* Barres par métrique */}
              <div className="space-y-2.5">
                {metrics.map((m) => (
                  <div key={m.key}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="flex items-center gap-1.5 text-gray-600"><m.icon size={13} /> {m.label}</span>
                      <span className="font-semibold text-gray-900">{fmt(m.val)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className={`h-full ${m.color} rounded-full transition-all`} style={{ width: Math.round(((Number(m.val) || 0) / max) * 100) + '%' }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Dates */}
              <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500 space-y-1">
                <div className="flex justify-between"><span>Début</span><span>{data.startsAt ? new Date(data.startsAt).toLocaleString('fr-FR') : '—'}</span></div>
                <div className="flex justify-between"><span>Fin</span><span>{data.endsAt ? new Date(data.endsAt).toLocaleString('fr-FR') : '—'}</span></div>
                <div className="flex justify-between"><span>Statut</span><span className="font-medium text-gray-700">{data.status}</span></div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Tile({ label, value, icon: Icon }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 text-center">
      <Icon size={16} className="mx-auto text-blue-600 mb-1" />
      <p className="text-sm font-bold text-gray-900 leading-tight">{value}</p>
      <p className="text-[11px] text-gray-500">{label}</p>
    </div>
  )
}
