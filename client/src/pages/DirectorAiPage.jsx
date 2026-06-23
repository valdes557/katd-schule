import { useState } from 'react'
import { Link } from 'react-router-dom'
import { aiApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'
import {
  Bot, Sparkles, Loader2, Upload, CheckCircle2, Clock, XCircle, Ban,
  Users, UserCheck, BarChart2, MessageSquare, Send,
} from 'lucide-react'

const STATUS_BADGE = {
  pending: { label: 'En attente', cls: 'bg-amber-100 text-amber-700', icon: Clock },
  approved: { label: 'Active', cls: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  rejected: { label: 'Rejetée', cls: 'bg-red-100 text-red-700', icon: XCircle },
  expired: { label: 'Épuisée', cls: 'bg-gray-100 text-gray-600', icon: Ban },
  suspended: { label: 'Suspendue', cls: 'bg-red-100 text-red-700', icon: Ban },
}

function StatusBadge({ status }) {
  const s = STATUS_BADGE[status] || STATUS_BADGE.pending
  const Icon = s.icon
  return <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${s.cls}`}><Icon size={12} /> {s.label}</span>
}

export default function DirectorAiPage() {
  const [tab, setTab] = useState('subscription')

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Bot size={22} className="text-indigo-600" /> Assistant IA</h1>
          <p className="text-sm text-gray-500">Souscription, accès des membres et statistiques d'utilisation.</p>
        </div>
        <Link to="/dashboard/ia-chat" className="btn-primary text-sm justify-center"><MessageSquare size={15} /> Ouvrir le chat</Link>
      </div>

      <div className="flex gap-1 border-b border-gray-100">
        {[
          { id: 'subscription', label: 'Souscription' },
          { id: 'access', label: 'Accès des membres' },
          { id: 'stats', label: 'Statistiques' },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'subscription' && <SubscriptionTab />}
      {tab === 'access' && <AccessTab />}
      {tab === 'stats' && <StatsTab />}
    </div>
  )
}

// ── Onglet Souscription ───────────────────────────────────────────────────────
function SubscriptionTab() {
  const q = useCachedFetch('/ai/subscription/status', async () => {
    const r = await aiApi.subscriptionStatus()
    return r.data
  }, [])
  const pkgQ = useCachedFetch('/ai/packages', async () => {
    const r = await aiApi.listPackages()
    return r.data || []
  }, [])

  const sub = q.data
  const packages = pkgQ.data || []
  const [packageId, setPackageId] = useState('')
  const [screenshot, setScreenshot] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState('')

  const refresh = () => { cache.invalidate('/ai/subscription/status'); q.refetch() }

  const submit = async (e) => {
    e.preventDefault()
    if (!packageId) { setMsg('Choisissez une offre.'); return }
    setSubmitting(true)
    setMsg('')
    try {
      await aiApi.requestSubscription({ packageId, paymentScreenshot: screenshot })
      setMsg('ok')
      setScreenshot(null)
      setPackageId('')
      refresh()
    } catch (err) { setMsg(err.message) }
    setSubmitting(false)
  }

  if (q.loading) return <div className="py-12 text-center"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div>

  // Souscription active → afficher le quota
  const showForm = !sub || ['rejected', 'expired'].includes(sub.status)
  const selectedPkg = packages.find((p) => p._id === packageId)

  return (
    <div className="space-y-4">
      {sub && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900">Souscription actuelle</h3>
            <StatusBadge status={sub.status} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Kpi label="Offre" value={sub.packageName} />
            <Kpi label="Total" value={sub.totalQuestions} />
            <Kpi label="Utilisées" value={sub.usedQuestions} />
            <Kpi label="Restantes" value={sub.remainingQuestions} tone={sub.remainingQuestions > 0 ? 'text-green-600' : 'text-red-600'} />
          </div>
          {sub.status === 'approved' && (
            <div className="mt-4 h-2 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, (sub.usedQuestions / Math.max(1, sub.totalQuestions)) * 100)}%` }} />
            </div>
          )}
          {sub.status === 'rejected' && sub.rejectedReason && (
            <p className="mt-3 text-xs text-red-600">Motif du rejet : {sub.rejectedReason}</p>
          )}
          {sub.status === 'pending' && (
            <p className="mt-3 text-xs text-amber-600 flex items-center gap-1"><Clock size={13} /> Votre demande est en cours d'examen par l'administrateur.</p>
          )}
        </div>
      )}

      {showForm && (
        <form onSubmit={submit} className="card p-5 space-y-4">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><Sparkles size={16} className="text-indigo-600" /> Demander l'activation de l'IA</h3>

          {msg === 'ok' ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700 flex items-center gap-2">
              <CheckCircle2 size={18} /> Votre demande a été envoyée. Vous recevrez un email dès qu'elle sera traitée.
            </div>
          ) : (
            <>
              {packages.length === 0 ? (
                <p className="text-sm text-gray-400">Aucune offre disponible pour le moment. Contactez l'administrateur.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {packages.map((p) => (
                    <label key={p._id} className={`border rounded-xl p-4 cursor-pointer transition-all ${packageId === p._id ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="radio" name="pkg" value={p._id} checked={packageId === p._id} onChange={() => setPackageId(p._id)} className="sr-only" />
                      <p className="text-sm font-bold text-gray-900">{p.name}</p>
                      {p.description && <p className="text-xs text-gray-500 mt-1">{p.description}</p>}
                      <div className="mt-3 flex items-baseline gap-1">
                        <span className="text-lg font-bold text-indigo-600">{Number(p.price).toLocaleString()}</span>
                        <span className="text-xs text-gray-400">{p.currency}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{p.totalQuestions} questions incluses</p>
                    </label>
                  ))}
                </div>
              )}

              {selectedPkg && (
                <div className="bg-indigo-50 rounded-lg p-3 text-sm text-indigo-800 flex flex-wrap gap-x-4 gap-y-1">
                  <span><strong>{selectedPkg.totalQuestions}</strong> questions</span>
                  <span>Prix à payer : <strong>{Number(selectedPkg.price).toLocaleString()} {selectedPkg.currency}</strong></span>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-600">Capture de paiement</label>
                <label className="mt-1 flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-3 py-2.5 cursor-pointer hover:border-indigo-400 text-sm text-gray-500">
                  <Upload size={16} />
                  <span className="truncate">{screenshot ? screenshot.name : 'Téléverser la capture (image)'}</span>
                  <input type="file" accept="image/*" onChange={(e) => setScreenshot(e.target.files?.[0] || null)} className="hidden" />
                </label>
              </div>

              {msg && msg !== 'ok' && <p className="text-xs text-red-600">{msg}</p>}

              <button type="submit" disabled={submitting || packages.length === 0} className="btn-primary justify-center text-sm">
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Envoyer la demande
              </button>
            </>
          )}
        </form>
      )}
    </div>
  )
}

// ── Onglet Accès des membres ──────────────────────────────────────────────────
function AccessTab() {
  const q = useCachedFetch('/ai/access', async () => {
    const r = await aiApi.listAccess()
    return r.data || []
  }, [])
  const [busy, setBusy] = useState(null)
  const users = q.data || []

  const toggle = async (u) => {
    setBusy(u._id)
    try {
      if (u.aiAccess) await aiApi.revokeAccess(u._id)
      else await aiApi.grantAccess(u._id)
      cache.invalidate('/ai/access'); q.refetch()
    } catch (err) { alert(err.message) }
    setBusy(null)
  }

  if (q.loading) return <div className="py-12 text-center"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div>

  const teachers = users.filter((u) => u.role === 'enseignant')
  const parents = users.filter((u) => u.role === 'parent')

  const Section = ({ title, icon: Icon, list }) => (
    <div className="card p-5">
      <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-4"><Icon size={16} className="text-indigo-600" /> {title} <span className="text-gray-400 font-normal">({list.length})</span></h3>
      {list.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">Aucun membre.</p>
      ) : (
        <div className="space-y-2">
          {list.map((u) => (
            <div key={u._id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{(u.name || '?')[0]?.toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                <p className="text-xs text-gray-400 truncate">{u.email}</p>
              </div>
              <button onClick={() => toggle(u)} disabled={busy === u._id}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${u.aiAccess ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${u.aiAccess ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">Activez l'accès à l'assistant IA pour vos enseignants et parents. Le quota est partagé par l'établissement.</p>
      <Section title="Enseignants" icon={UserCheck} list={teachers} />
      <Section title="Parents" icon={Users} list={parents} />
    </div>
  )
}

// ── Onglet Statistiques ───────────────────────────────────────────────────────
function StatsTab() {
  const q = useCachedFetch('/ai/stats', async () => {
    const r = await aiApi.stats()
    return r.data
  }, [])
  if (q.loading) return <div className="py-12 text-center"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div>
  const d = q.data || {}
  const users = d.users || []

  return (
    <div className="space-y-4">
      {d.subscription && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kpi label="Offre" value={d.subscription.packageName} />
          <Kpi label="Total" value={d.subscription.totalQuestions} />
          <Kpi label="Utilisées" value={d.subscription.usedQuestions} />
          <Kpi label="Restantes" value={d.subscription.remainingQuestions} tone="text-green-600" />
        </div>
      )}
      <div className="card p-5">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-4"><BarChart2 size={16} className="text-indigo-600" /> Utilisation par membre</h3>
        {users.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Aucune utilisation enregistrée.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[400px]">
              <thead><tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                <th className="pb-2 font-medium">Membre</th><th className="pb-2 font-medium">Rôle</th>
                <th className="pb-2 font-medium text-right">Questions</th><th className="pb-2 font-medium text-right">Tokens</th>
              </tr></thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2 text-gray-900">{u.name || '—'}</td>
                    <td className="py-2 text-gray-500 capitalize">{u.role}</td>
                    <td className="py-2 text-right font-semibold text-gray-900">{u.questions}</td>
                    <td className="py-2 text-right text-gray-400">{u.tokens?.toLocaleString() || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function Kpi({ label, value, tone = 'text-gray-900' }) {
  return (
    <div className="card p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-base font-bold ${tone} truncate`}>{value}</p>
    </div>
  )
}
