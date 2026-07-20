// pages/AdminShareholdersPage.jsx — Super admin : gestion des actionnaires.
// - Configuration : termes & conditions, avantages, responsabilités, droits + plans.
// - Actionnaires : liste, ACTIVER / MODIFIER / ÉDITER / SUPPRIMER le plan de chaque
//   actionnaire, versement de gains (dividendes).
// - Publications : dépenses à faire/faites, sommes exigées, réunions physiques/en ligne
//   (affichées dans le portefeuille des actionnaires).
import { useState, useEffect } from 'react'
import {
  Landmark, Loader2, Save, Users, Coins, MapPin, Ban, RefreshCw, Pencil, Trash2,
  CheckCircle2, X, Megaphone, Plus, Banknote, CalendarClock, Receipt, Gift,
} from 'lucide-react'
import { shareholdersApi } from '../lib/api'

const fmt = (n) => (Number(n) || 0).toLocaleString('fr-FR')
const PLAN_NAMES = { arrondissement: 'Arrondissement', regional: 'Régional', national: 'National', international: 'International' }
const POST_CATEGORIES = [
  { value: 'depense', label: 'Dépense (à faire ou faite)', icon: Receipt },
  { value: 'paiement', label: 'Somme exigée à payer', icon: Banknote },
  { value: 'reunion', label: 'Réunion (physique / en ligne)', icon: CalendarClock },
  { value: 'info', label: 'Information', icon: Megaphone },
]

export default function AdminShareholdersPage() {
  const [tab, setTab] = useState('config')
  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Landmark size={22} className="text-indigo-600" /> Gestion des actionnaires
        </h1>
        <p className="text-sm text-gray-500">Termes, plans, liste des actionnaires et publications qui leur sont destinées.</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {[['config', 'Configuration'], ['list', 'Actionnaires'], ['posts', 'Publications']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`text-sm px-4 py-2 rounded-xl font-medium ${tab === k ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>{l}</button>
        ))}
      </div>
      {tab === 'config' && <ConfigPanel />}
      {tab === 'list' && <ListPanel />}
      {tab === 'posts' && <PostsPanel />}
    </div>
  )
}

// ── Onglet configuration : textes + plans ──
function ConfigPanel() {
  const [cfg, setCfg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    shareholdersApi.adminConfig()
      .then((r) => setCfg(r.config))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true); setMsg(''); setErr('')
    try {
      const r = await shareholdersApi.adminUpdateConfig({
        terms: cfg.terms, advantages: cfg.advantages,
        responsibilities: cfg.responsibilities, rights: cfg.rights, plans: cfg.plans,
      })
      setCfg(r.config)
      setMsg('Configuration enregistrée.')
    } catch (e) { setErr(e.message) } finally { setSaving(false) }
  }

  const setPlan = (i, patch) =>
    setCfg({ ...cfg, plans: cfg.plans.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) })

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-indigo-600" /></div>
  if (!cfg) return <div className="text-sm text-red-600">{err || 'Configuration introuvable'}</div>

  return (
    <div className="space-y-5">
      {msg && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 text-sm">{msg}</div>}
      {err && <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-sm">{err}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[
          ['terms', 'Termes et conditions de souscription'],
          ['advantages', "Avantages de l'actionnaire"],
          ['responsibilities', 'Responsabilités'],
          ['rights', 'Droits et obligations'],
        ].map(([key, label]) => (
          <div key={key} className="card p-4">
            <label className="text-xs font-semibold text-gray-700 mb-1.5 block">{label}</label>
            <textarea
              value={cfg[key] || ''}
              onChange={(e) => setCfg({ ...cfg, [key]: e.target.value })}
              rows={5}
              className="input text-sm w-full resize-y"
            />
          </div>
        ))}
      </div>

      <div className="card p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 text-sm">Plans de souscription (1% d'action)</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="py-2 pr-3">Palier</th>
                <th className="py-2 pr-3">Libellé</th>
                <th className="py-2 pr-3">Prix (F)</th>
                <th className="py-2 pr-3">%</th>
                <th className="py-2 pr-3">Durée (ans)</th>
                <th className="py-2">Actif</th>
              </tr>
            </thead>
            <tbody>
              {(cfg.plans || []).map((p, i) => (
                <tr key={p.key} className="border-b border-gray-50">
                  <td className="py-2 pr-3 font-medium text-gray-700">{PLAN_NAMES[p.key] || p.key}</td>
                  <td className="py-2 pr-3"><input value={p.label} onChange={(e) => setPlan(i, { label: e.target.value })} className="input text-xs w-full" /></td>
                  <td className="py-2 pr-3"><input type="number" min="1" value={p.price} onChange={(e) => setPlan(i, { price: Number(e.target.value) })} className="input text-xs w-28" /></td>
                  <td className="py-2 pr-3"><input type="number" min="0.01" step="0.01" value={p.percent} onChange={(e) => setPlan(i, { percent: Number(e.target.value) })} className="input text-xs w-16" /></td>
                  <td className="py-2 pr-3"><input type="number" min="1" value={p.durationYears} onChange={(e) => setPlan(i, { durationYears: Number(e.target.value) })} className="input text-xs w-16" /></td>
                  <td className="py-2"><input type="checkbox" checked={p.isActive !== false} onChange={(e) => setPlan(i, { isActive: e.target.checked })} className="w-4 h-4 accent-indigo-600" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-gray-400">La description affichée à l'utilisateur peut aussi être modifiée :</p>
        {(cfg.plans || []).map((p, i) => (
          <div key={p.key}>
            <label className="text-[11px] font-medium text-gray-500">{PLAN_NAMES[p.key] || p.key}</label>
            <input value={p.description || ''} onChange={(e) => setPlan(i, { description: e.target.value })} className="input text-xs w-full mt-0.5" />
          </div>
        ))}
      </div>

      <button onClick={save} disabled={saving} className="btn-primary">
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer la configuration
      </button>
    </div>
  )
}

// ── Onglet liste : activer / modifier / éditer / supprimer le plan de chaque actionnaire ──
function ListPanel() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [planKey, setPlanKey] = useState('')
  const [editing, setEditing] = useState(null)   // souscription en cours d'édition
  const [paying, setPaying] = useState(null)     // souscription pour versement de gain

  const load = async () => {
    setLoading(true); setErr('')
    try { setData(await shareholdersApi.adminList(planKey ? { planKey } : {})) }
    catch (e) { setErr(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [planKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const activate = async (s) => {
    try { await shareholdersApi.adminUpdate(s._id, { status: 'active' }); load() } catch (e) { alert(e.message) }
  }
  const revoke = async (s) => {
    if (!window.confirm('Révoquer cette souscription d\'actionnaire ?')) return
    try { await shareholdersApi.adminRevoke(s._id); load() } catch (e) { alert(e.message) }
  }
  const remove = async (s) => {
    if (!window.confirm('SUPPRIMER définitivement cette souscription ? Cette action est irréversible.')) return
    try { await shareholdersApi.adminDelete(s._id); load() } catch (e) { alert(e.message) }
  }

  const stats = data?.stats
  const rows = data?.shareholdings || []

  return (
    <div className="space-y-4">
      {err && <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-sm">{err}</div>}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card p-4 border-l-4 border-indigo-500">
          <div className="flex items-center gap-2 text-indigo-600"><Users size={15} /><span className="text-xs font-semibold uppercase">Actionnaires</span></div>
          <p className="text-xl font-bold text-gray-900 mt-1">{stats?.total ?? '—'}</p>
        </div>
        <div className="card p-4 border-l-4 border-emerald-500">
          <div className="flex items-center gap-2 text-emerald-600"><Coins size={15} /><span className="text-xs font-semibold uppercase">Total encaissé</span></div>
          <p className="text-xl font-bold text-gray-900 mt-1">{stats ? fmt(stats.totalAmount) : '—'} <span className="text-xs text-gray-400">F</span></p>
        </div>
        <div className="card p-4 col-span-2 sm:col-span-1">
          <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Filtrer par palier</label>
          <select value={planKey} onChange={(e) => setPlanKey(e.target.value)} className="input text-sm w-full">
            <option value="">Tous</option>
            {Object.entries(PLAN_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between p-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-sm">Liste des actionnaires</h2>
          <button onClick={load} className="btn-ghost text-xs border border-gray-200"><RefreshCw size={13} /> Actualiser</button>
        </div>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-600" /></div>
        ) : (
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 bg-gray-50 border-b border-gray-100">
                <th className="px-3 py-2.5">Date</th>
                <th className="px-3 py-2.5">Actionnaire</th>
                <th className="px-3 py-2.5">Palier</th>
                <th className="px-3 py-2.5">Zone</th>
                <th className="px-3 py-2.5">Montant</th>
                <th className="px-3 py-2.5">Échéance</th>
                <th className="px-3 py-2.5">Statut</th>
                <th className="px-3 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400 text-sm">Aucun actionnaire pour le moment.</td></tr>
              )}
              {rows.map((s) => (
                <tr key={s._id} className="border-b border-gray-50">
                  <td className="px-3 py-2.5 text-xs text-gray-500">{new Date(s.createdAt).toLocaleDateString('fr-FR')}</td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-gray-800">{s.user?.name || '—'}</p>
                    <p className="text-xs text-gray-400">{s.user?.email || ''} {s.user?.walletAccountNo ? '· ' + s.user.walletAccountNo : ''}</p>
                  </td>
                  <td className="px-3 py-2.5"><span className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{PLAN_NAMES[s.planKey] || s.planKey} {s.percent}%</span></td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">{s.zone ? <span className="flex items-center gap-1"><MapPin size={11} /> {s.zone}</span> : '—'}</td>
                  <td className="px-3 py-2.5 font-semibold text-gray-900">{fmt(s.amount)} F</td>
                  <td className="px-3 py-2.5 text-xs text-gray-500">{s.endAt ? new Date(s.endAt).toLocaleDateString('fr-FR') : '—'}</td>
                  <td className="px-3 py-2.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      s.status === 'active' ? 'bg-emerald-100 text-emerald-700'
                        : s.status === 'revoked' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                    }`}>{s.status === 'active' ? 'Active' : s.status === 'revoked' ? 'Révoquée' : 'Expirée'}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setEditing(s)} className="text-indigo-600 hover:text-indigo-800" title="Modifier / éditer le plan"><Pencil size={14} /></button>
                      <button onClick={() => setPaying(s)} className="text-emerald-600 hover:text-emerald-800" title="Verser un gain"><Gift size={14} /></button>
                      {s.status === 'active'
                        ? <button onClick={() => revoke(s)} className="text-amber-600 hover:text-amber-800" title="Révoquer"><Ban size={14} /></button>
                        : <button onClick={() => activate(s)} className="text-emerald-600 hover:text-emerald-800" title="Activer"><CheckCircle2 size={14} /></button>}
                      <button onClick={() => remove(s)} className="text-red-500 hover:text-red-700" title="Supprimer définitivement"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && <EditModal s={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
      {paying && <PayGainModal s={paying} onClose={() => setPaying(null)} onDone={() => { setPaying(null); load() }} />}
    </div>
  )
}

// Modale : modifier/éditer le plan d'un actionnaire (palier, zone, %, durée, montant, statut)
function EditModal({ s, onClose, onSaved }) {
  const [f, setF] = useState({
    planKey: s.planKey, planLabel: s.planLabel || '', percent: s.percent,
    zone: s.zone || '', durationYears: s.durationYears, amount: s.amount, status: s.status,
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    setBusy(true); setErr('')
    try { await shareholdersApi.adminUpdate(s._id, f); onSaved() }
    catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !busy && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Modifier le plan — {s.user?.name || 'Actionnaire'}</h3>
          <button onClick={() => !busy && onClose()} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Palier</label>
            <select value={f.planKey} onChange={(e) => setF({ ...f, planKey: e.target.value })} className="input text-sm w-full">
              {Object.entries(PLAN_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Statut</label>
            <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className="input text-sm w-full">
              <option value="active">Active</option>
              <option value="revoked">Révoquée</option>
              <option value="expired">Expirée</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Libellé</label>
          <input value={f.planLabel} onChange={(e) => setF({ ...f, planLabel: e.target.value })} className="input text-sm w-full" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Zone d'attribution</label>
          <input value={f.zone} onChange={(e) => setF({ ...f, zone: e.target.value })} className="input text-sm w-full" placeholder="Arrondissement / région / pays" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">%</label>
            <input type="number" min="0.01" step="0.01" value={f.percent} onChange={(e) => setF({ ...f, percent: Number(e.target.value) })} className="input text-sm w-full" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Durée (ans)</label>
            <input type="number" min="1" value={f.durationYears} onChange={(e) => setF({ ...f, durationYears: Number(e.target.value) })} className="input text-sm w-full" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Montant (F)</label>
            <input type="number" min="1" value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} className="input text-sm w-full" />
          </div>
        </div>
        {err && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">{err}</p>}
        <div className="flex gap-3 pt-2">
          <button onClick={() => !busy && onClose()} className="btn-ghost flex-1 justify-center border border-gray-200">Annuler</button>
          <button onClick={save} disabled={busy} className="btn-primary flex-1 justify-center">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}

// Modale : verser un gain (dividende) à l'actionnaire — crédite son portefeuille
function PayGainModal({ s, onClose, onDone }) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const pay = async () => {
    setErr('')
    if (!(Number(amount) > 0)) { setErr('Montant invalide'); return }
    setBusy(true)
    try {
      const r = await shareholdersApi.adminPayGain(s._id, Number(amount), note)
      alert(r.message || 'Gain versé.')
      onDone()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !busy && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 flex items-center gap-2"><Gift size={17} className="text-emerald-600" /> Verser un gain</h3>
          <button onClick={() => !busy && onClose()} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500">{s.user?.name || 'Actionnaire'} — {PLAN_NAMES[s.planKey] || s.planKey} {s.zone ? '(' + s.zone + ')' : ''}</p>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Montant (F) *</label>
          <input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} className="input w-full" placeholder="Ex. 25000" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Note (optionnel)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="input w-full" placeholder="Dividende T3 2026" />
        </div>
        {err && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">{err}</p>}
        <button onClick={pay} disabled={busy} className="btn-primary w-full justify-center">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Gift size={14} />} Verser le gain
        </button>
      </div>
    </div>
  )
}

// ── Onglet publications : dépenses / sommes à payer / réunions pour les actionnaires ──
function PostsPanel() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState(null)   // null = fermé, {} = création, {…} = édition

  const load = async () => {
    setLoading(true); setErr('')
    try { const r = await shareholdersApi.adminPosts(); setPosts(r.posts || []) }
    catch (e) { setErr(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const remove = async (p) => {
    if (!window.confirm('Supprimer cette publication ?')) return
    try { await shareholdersApi.adminDeletePost(p._id); load() } catch (e) { alert(e.message) }
  }
  const togglePublish = async (p) => {
    try { await shareholdersApi.adminUpdatePost(p._id, { isPublished: !p.isPublished }); load() } catch (e) { alert(e.message) }
  }

  return (
    <div className="space-y-4">
      {err && <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-sm">{err}</div>}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Visibles dans le portefeuille de tous les actionnaires actifs.</p>
        <button onClick={() => setEditing({})} className="btn-primary text-sm"><Plus size={15} /> Nouvelle publication</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-600" /></div>
      ) : (
        <div className="space-y-3">
          {posts.length === 0 && <p className="text-center py-10 text-gray-400 text-sm">Aucune publication.</p>}
          {posts.map((p) => {
            const cat = POST_CATEGORIES.find((c) => c.value === p.category) || POST_CATEGORIES[3]
            const Icon = cat.icon
            return (
              <div key={p._id} className="card p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full flex items-center gap-1"><Icon size={11} /> {cat.label}</span>
                    {!p.isPublished && <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Brouillon</span>}
                    <span className="text-[11px] text-gray-400">{new Date(p.createdAt).toLocaleDateString('fr-FR')}</span>
                  </div>
                  <p className="font-semibold text-gray-900 text-sm mt-1">{p.title}</p>
                  {p.body && <p className="text-xs text-gray-600 line-clamp-2">{p.body}</p>}
                  {p.amount != null && <p className="text-sm font-bold text-gray-800 mt-0.5">{fmt(p.amount)} F</p>}
                  {p.meetingAt && <p className="text-xs text-blue-700 mt-0.5">📅 {new Date(p.meetingAt).toLocaleString('fr-FR')} {p.meetingPlace && '· 📍 ' + p.meetingPlace}</p>}
                  {p.meetingLink && <p className="text-xs text-blue-600 truncate">🔗 {p.meetingLink}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => togglePublish(p)} className={`text-xs px-2 py-1 rounded-lg border ${p.isPublished ? 'border-amber-200 text-amber-700' : 'border-emerald-200 text-emerald-700'}`}>
                    {p.isPublished ? 'Dépublier' : 'Publier'}
                  </button>
                  <button onClick={() => setEditing(p)} className="text-indigo-600 hover:text-indigo-800" title="Modifier"><Pencil size={15} /></button>
                  <button onClick={() => remove(p)} className="text-red-500 hover:text-red-700" title="Supprimer"><Trash2 size={15} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editing !== null && (
        <PostModal post={editing._id ? editing : null} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
      )}
    </div>
  )
}

// Modale de création/édition d'une publication
function PostModal({ post, onClose, onSaved }) {
  const [f, setF] = useState({
    title: post?.title || '', body: post?.body || '', category: post?.category || 'info',
    amount: post?.amount ?? '', meetingAt: post?.meetingAt ? new Date(post.meetingAt).toISOString().slice(0, 16) : '',
    meetingLink: post?.meetingLink || '', meetingPlace: post?.meetingPlace || '',
    isPublished: post ? post.isPublished !== false : true,
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    setErr('')
    if (!f.title.trim()) { setErr('Titre requis'); return }
    setBusy(true)
    try {
      const payload = { ...f, amount: f.amount === '' ? null : Number(f.amount), meetingAt: f.meetingAt || null }
      if (post) await shareholdersApi.adminUpdatePost(post._id, payload)
      else await shareholdersApi.adminCreatePost(payload)
      onSaved()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  const isMeeting = f.category === 'reunion'
  const hasAmount = f.category === 'depense' || f.category === 'paiement'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !busy && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">{post ? 'Modifier la publication' : 'Nouvelle publication'}</h3>
          <button onClick={() => !busy && onClose()} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Type</label>
          <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className="input text-sm w-full">
            {POST_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Titre *</label>
          <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="input text-sm w-full" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Détails</label>
          <textarea value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} rows={4} className="input text-sm w-full resize-y" />
        </div>
        {hasAmount && (
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Montant (F)</label>
            <input type="number" min="0" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} className="input text-sm w-full" />
          </div>
        )}
        {isMeeting && (
          <>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Date et heure</label>
              <input type="datetime-local" value={f.meetingAt} onChange={(e) => setF({ ...f, meetingAt: e.target.value })} className="input text-sm w-full" />
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Lieu (réunion physique)</label>
                <input value={f.meetingPlace} onChange={(e) => setF({ ...f, meetingPlace: e.target.value })} className="input text-sm w-full" placeholder="Ex. Siège, Douala" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Lien (réunion en ligne)</label>
                <input value={f.meetingLink} onChange={(e) => setF({ ...f, meetingLink: e.target.value })} className="input text-sm w-full" placeholder="https://meet.google.com/…" />
              </div>
            </div>
          </>
        )}
        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
          <input type="checkbox" checked={f.isPublished} onChange={(e) => setF({ ...f, isPublished: e.target.checked })} className="w-4 h-4 accent-indigo-600" />
          Publier immédiatement (visible par les actionnaires)
        </label>
        {err && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">{err}</p>}
        <div className="flex gap-3 pt-1">
          <button onClick={() => !busy && onClose()} className="btn-ghost flex-1 justify-center border border-gray-200">Annuler</button>
          <button onClick={save} disabled={busy} className="btn-primary flex-1 justify-center">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}
