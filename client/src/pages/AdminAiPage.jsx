import { useState } from 'react'
import { aiApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'
import {
  Bot, Sparkles, Loader2, Plus, Pencil, Trash2, X, CheckCircle2, XCircle, Ban, Play,
  Settings, Package, ClipboardList, BarChart2, Image as ImageIcon, Clock,
} from 'lucide-react'

const STATUS_BADGE = {
  pending: { label: 'En attente', cls: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Approuvée', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejetée', cls: 'bg-red-100 text-red-700' },
  expired: { label: 'Épuisée', cls: 'bg-gray-100 text-gray-600' },
  suspended: { label: 'Suspendue', cls: 'bg-red-100 text-red-700' },
}

export default function AdminAiPage() {
  const [tab, setTab] = useState('requests')
  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Bot size={22} className="text-indigo-600" /> Assistant IA — Administration</h1>
        <p className="text-sm text-gray-500">Offres, demandes de souscription, configuration et statistiques globales.</p>
      </div>

      <div className="flex gap-1 border-b border-gray-100 overflow-x-auto">
        {[
          { id: 'requests', label: 'Demandes', icon: ClipboardList },
          { id: 'packages', label: 'Offres', icon: Package },
          { id: 'config', label: 'Configuration', icon: Settings },
          { id: 'stats', label: 'Statistiques', icon: BarChart2 },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-1.5 whitespace-nowrap ${tab === t.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'requests' && <RequestsTab />}
      {tab === 'packages' && <PackagesTab />}
      {tab === 'config' && <ConfigTab />}
      {tab === 'stats' && <StatsTab />}
    </div>
  )
}

// ── Demandes ──────────────────────────────────────────────────────────────────
function RequestsTab() {
  const [statusFilter, setStatusFilter] = useState('')
  const q = useCachedFetch(`/ai/subscriptions?status=${statusFilter}`, async () => {
    const r = await aiApi.listSubscriptions(statusFilter)
    return r.data || []
  }, [statusFilter])
  const [busy, setBusy] = useState(null)
  const [preview, setPreview] = useState(null)
  const subs = q.data || []

  const refresh = () => { cache.invalidate('/ai/subscriptions'); q.refetch() }

  const approve = async (s) => {
    setBusy(s._id)
    try { await aiApi.approveSubscription(s._id); refresh() } catch (err) { alert(err.message) }
    setBusy(null)
  }
  const reject = async (s) => {
    const reason = window.prompt('Motif du rejet (optionnel) :')
    if (reason === null) return
    setBusy(s._id)
    try { await aiApi.rejectSubscription(s._id, reason); refresh() } catch (err) { alert(err.message) }
    setBusy(null)
  }
  const suspend = async (s) => {
    if (!window.confirm('Suspendre l\'accès IA de cet établissement ?')) return
    setBusy(s._id)
    try { await aiApi.suspendSubscription(s._id); refresh() } catch (err) { alert(err.message) }
    setBusy(null)
  }
  const reactivate = async (s) => {
    setBusy(s._id)
    try { await aiApi.reactivateSubscription(s._id); refresh() } catch (err) { alert(err.message) }
    setBusy(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {['', 'pending', 'approved', 'rejected', 'suspended', 'expired'].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium ${statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {s === '' ? 'Toutes' : (STATUS_BADGE[s]?.label || s)}
          </button>
        ))}
      </div>

      {q.loading ? (
        <div className="py-12 text-center"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div>
      ) : subs.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-12">Aucune demande.</p>
      ) : (
        <div className="space-y-3">
          {subs.map((s) => (
            <div key={s._id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900">{s.school?.name || 'École'}</p>
                  <p className="text-xs text-gray-500">{s.director?.name} · {s.director?.email}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-600">
                    <span>Offre : <strong>{s.packageName}</strong></span>
                    <span>{s.totalQuestions} questions</span>
                    <span>{Number(s.price).toLocaleString()} {s.currency}</span>
                    <span>{s.usedQuestions}/{s.totalQuestions} utilisées</span>
                  </div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_BADGE[s.status]?.cls}`}>{STATUS_BADGE[s.status]?.label}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-50">
                {s.paymentScreenshot && (
                  <button onClick={() => setPreview(s.paymentScreenshot)} className="text-xs flex items-center gap-1 text-blue-600 hover:underline"><ImageIcon size={13} /> Voir la capture</button>
                )}
                <div className="flex gap-2 ml-auto">
                  {s.status === 'pending' && (
                    <>
                      <button onClick={() => approve(s)} disabled={busy === s._id} className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white font-medium flex items-center gap-1 disabled:opacity-50"><CheckCircle2 size={13} /> Approuver</button>
                      <button onClick={() => reject(s)} disabled={busy === s._id} className="text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-700 font-medium flex items-center gap-1 disabled:opacity-50"><XCircle size={13} /> Rejeter</button>
                    </>
                  )}
                  {s.status === 'approved' && (
                    <button onClick={() => suspend(s)} disabled={busy === s._id} className="text-xs px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 font-medium flex items-center gap-1 disabled:opacity-50"><Ban size={13} /> Suspendre</button>
                  )}
                  {s.status === 'suspended' && (
                    <button onClick={() => reactivate(s)} disabled={busy === s._id} className="text-xs px-3 py-1.5 rounded-lg bg-green-100 text-green-700 font-medium flex items-center gap-1 disabled:opacity-50"><Play size={13} /> Réactiver</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <img src={preview} alt="Capture de paiement" className="max-w-full max-h-[90vh] rounded-lg" onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setPreview(null)} className="absolute top-4 right-4 text-white"><X size={24} /></button>
        </div>
      )}
    </div>
  )
}

// ── Offres ────────────────────────────────────────────────────────────────────
const EMPTY_PKG = { name: '', description: '', totalQuestions: '', price: '', currency: 'F CFA', isActive: true, sortOrder: 0 }

function PackagesTab() {
  const q = useCachedFetch('/ai/packages', async () => {
    const r = await aiApi.listPackages()
    return r.data || []
  }, [])
  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const packages = q.data || []
  const refresh = () => { cache.invalidate('/ai/packages'); q.refetch() }

  const save = async (e) => {
    e.preventDefault()
    if (!modal.name.trim() || !modal.totalQuestions || modal.price === '') return
    setSaving(true)
    try {
      const payload = {
        name: modal.name.trim(),
        description: modal.description?.trim() || '',
        totalQuestions: Number(modal.totalQuestions),
        price: Number(modal.price),
        currency: modal.currency || 'F CFA',
        isActive: modal.isActive,
        sortOrder: Number(modal.sortOrder) || 0,
      }
      if (modal._id) await aiApi.updatePackage(modal._id, payload)
      else await aiApi.createPackage(payload)
      setModal(null); refresh()
    } catch (err) { alert(err.message) }
    setSaving(false)
  }
  const remove = async (p) => {
    if (!window.confirm(`Supprimer l'offre « ${p.name} » ?`)) return
    try { await aiApi.removePackage(p._id); refresh() } catch (err) { alert(err.message) }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setModal({ ...EMPTY_PKG })} className="btn-primary text-sm justify-center"><Plus size={15} /> Nouvelle offre</button>
      </div>
      {q.loading ? (
        <div className="py-12 text-center"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div>
      ) : packages.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-12">Aucune offre. Créez la première.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {packages.map((p) => (
            <div key={p._id} className="card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-900">{p.name}</p>
                  {!p.isActive && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setModal({ ...EMPTY_PKG, ...p, totalQuestions: p.totalQuestions, price: p.price })} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-blue-600"><Pencil size={14} /></button>
                  <button onClick={() => remove(p)} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
              </div>
              {p.description && <p className="text-xs text-gray-500 mt-1">{p.description}</p>}
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-lg font-bold text-indigo-600">{Number(p.price).toLocaleString()}</span>
                <span className="text-xs text-gray-400">{p.currency}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{p.totalQuestions} questions incluses</p>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">{modal._id ? 'Modifier l\'offre' : 'Nouvelle offre'}</h3>
              <button onClick={() => setModal(null)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
            </div>
            <form onSubmit={save} className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Nom de l'offre *</label>
                <input value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} required className="input text-sm w-full mt-1" placeholder="Ex. Pack Découverte" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Description</label>
                <input value={modal.description} onChange={(e) => setModal({ ...modal, description: e.target.value })} className="input text-sm w-full mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Questions incluses *</label>
                  <input type="number" min="1" value={modal.totalQuestions} onChange={(e) => setModal({ ...modal, totalQuestions: e.target.value })} required className="input text-sm w-full mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Prix *</label>
                  <input type="number" min="0" value={modal.price} onChange={(e) => setModal({ ...modal, price: e.target.value })} required className="input text-sm w-full mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Devise</label>
                  <input value={modal.currency} onChange={(e) => setModal({ ...modal, currency: e.target.value })} className="input text-sm w-full mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Ordre</label>
                  <input type="number" value={modal.sortOrder} onChange={(e) => setModal({ ...modal, sortOrder: e.target.value })} className="input text-sm w-full mt-1" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={modal.isActive} onChange={(e) => setModal({ ...modal, isActive: e.target.checked })} /> Offre active (visible par les directeurs)
              </label>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setModal(null)} className="btn-ghost border border-gray-200 flex-1 justify-center text-sm">Annuler</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center text-sm">{saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} {modal._id ? 'Enregistrer' : 'Créer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Configuration ─────────────────────────────────────────────────────────────
function ConfigTab() {
  const q = useCachedFetch('/ai/config', async () => {
    const r = await aiApi.getConfig()
    return r.data
  }, [])
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Initialise le formulaire dès que la config arrive
  const cfg = q.data
  if (cfg && !form) setForm({ ...cfg })

  const save = async (e) => {
    e.preventDefault()
    setSaving(true); setSaved(false)
    try {
      await aiApi.updateConfig({
        enabled: form.enabled,
        model: form.model,
        systemPrompt: form.systemPrompt,
        temperature: Number(form.temperature),
        maxTokens: Number(form.maxTokens),
      })
      cache.invalidate('/ai/config')
      setSaved(true)
    } catch (err) { alert(err.message) }
    setSaving(false)
  }

  if (q.loading || !form) return <div className="py-12 text-center"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div>

  return (
    <form onSubmit={save} className="card p-5 space-y-4 max-w-2xl">
      <label className="flex items-center gap-3 text-sm">
        <button type="button" onClick={() => setForm({ ...form, enabled: !form.enabled })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.enabled ? 'bg-green-600' : 'bg-gray-300'}`}>
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
        <span className="font-medium text-gray-900">Assistant IA {form.enabled ? 'activé' : 'désactivé'}</span>
      </label>

      <div>
        <label className="text-xs font-medium text-gray-600">Modèle OpenAI</label>
        <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="input text-sm w-full mt-1" placeholder="gpt-4o-mini" />
        <p className="text-[11px] text-gray-400 mt-1">Saisissez l'identifiant exact du modèle exposé par votre compte OpenAI (ex. gpt-4o-mini, gpt-4o).</p>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-600">Consigne système (rôle & sécurité)</label>
        <textarea value={form.systemPrompt} onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })} rows={6} className="input text-sm w-full mt-1 resize-y" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600">Température (0–2)</label>
          <input type="number" step="0.1" min="0" max="2" value={form.temperature} onChange={(e) => setForm({ ...form, temperature: e.target.value })} className="input text-sm w-full mt-1" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Tokens max / réponse</label>
          <input type="number" min="50" max="4000" value={form.maxTokens} onChange={(e) => setForm({ ...form, maxTokens: e.target.value })} className="input text-sm w-full mt-1" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary justify-center text-sm">{saving ? <Loader2 size={15} className="animate-spin" /> : <Settings size={15} />} Enregistrer</button>
        {saved && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 size={14} /> Enregistré</span>}
      </div>
    </form>
  )
}

// ── Statistiques globales ─────────────────────────────────────────────────────
function StatsTab() {
  const q = useCachedFetch('/ai/stats', async () => {
    const r = await aiApi.stats()
    return r.data
  }, [])
  if (q.loading) return <div className="py-12 text-center"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div>
  const d = q.data || {}
  const perSchool = d.perSchool || []

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi icon={Sparkles} label="Écoles actives" value={d.activeSchools || 0} tone="bg-indigo-50 text-indigo-600" />
        <Kpi icon={Clock} label="Demandes en attente" value={d.pendingRequests || 0} tone="bg-amber-50 text-amber-600" />
        <Kpi icon={Bot} label="Questions posées" value={d.totalQuestionsAsked || 0} tone="bg-green-50 text-green-600" />
        <Kpi icon={BarChart2} label="Quota consommé" value={`${d.totalUsedQuota || 0}/${d.totalAllowedQuota || 0}`} tone="bg-blue-50 text-blue-600" />
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-4">Consommation par établissement</h3>
        {perSchool.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Aucune donnée.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[360px]">
              <thead><tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                <th className="pb-2 font-medium">École</th><th className="pb-2 font-medium text-right">Utilisées</th><th className="pb-2 font-medium text-right">Total</th><th className="pb-2 font-medium text-right">%</th>
              </tr></thead>
              <tbody>
                {perSchool.map((s, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2 text-gray-900">{s.schoolName || '—'}</td>
                    <td className="py-2 text-right font-semibold text-gray-900">{s.used}</td>
                    <td className="py-2 text-right text-gray-500">{s.total}</td>
                    <td className="py-2 text-right text-gray-400">{s.total ? Math.round((s.used / s.total) * 100) : 0}%</td>
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

function Kpi({ icon: Icon, label, value, tone }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tone}`}><Icon size={20} /></div>
      <div className="min-w-0"><p className="text-xs text-gray-500 truncate">{label}</p><p className="text-lg font-bold text-gray-900 truncate">{value}</p></div>
    </div>
  )
}
