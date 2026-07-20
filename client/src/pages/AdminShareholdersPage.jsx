// pages/AdminShareholdersPage.jsx — Super admin : gestion des actionnaires.
// Modifie les termes & conditions, avantages, responsabilités, droits et obligations,
// ainsi que les plans (prix, libellés, activation). Liste les actionnaires souscrits.
import { useState, useEffect } from 'react'
import { Landmark, Loader2, Save, Users, Coins, MapPin, Ban, RefreshCw } from 'lucide-react'
import { shareholdersApi } from '../lib/api'

const fmt = (n) => (Number(n) || 0).toLocaleString('fr-FR')
const PLAN_NAMES = { arrondissement: 'Arrondissement', regional: 'Régional', national: 'National', international: 'International' }

export default function AdminShareholdersPage() {
  const [tab, setTab] = useState('config')
  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Landmark size={22} className="text-indigo-600" /> Gestion des actionnaires
        </h1>
        <p className="text-sm text-gray-500">Termes, avantages, droits, plans de souscription et liste des actionnaires.</p>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setTab('config')} className={`text-sm px-4 py-2 rounded-xl font-medium ${tab === 'config' ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>Configuration</button>
        <button onClick={() => setTab('list')} className={`text-sm px-4 py-2 rounded-xl font-medium ${tab === 'list' ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>Actionnaires</button>
      </div>
      {tab === 'config' ? <ConfigPanel /> : <ListPanel />}
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

      {/* Textes libres */}
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

      {/* Plans */}
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

// ── Onglet liste : actionnaires souscrits ──
function ListPanel() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [planKey, setPlanKey] = useState('')

  const load = async () => {
    setLoading(true); setErr('')
    try { setData(await shareholdersApi.adminList(planKey ? { planKey } : {})) }
    catch (e) { setErr(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [planKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const revoke = async (id) => {
    if (!window.confirm('Révoquer cette souscription d\'actionnaire ?')) return
    try { await shareholdersApi.adminRevoke(id); load() } catch (e) { alert(e.message) }
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
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 bg-gray-50 border-b border-gray-100">
                <th className="px-3 py-2.5">Date</th>
                <th className="px-3 py-2.5">Actionnaire</th>
                <th className="px-3 py-2.5">Palier</th>
                <th className="px-3 py-2.5">Zone</th>
                <th className="px-3 py-2.5">Montant</th>
                <th className="px-3 py-2.5">Échéance</th>
                <th className="px-3 py-2.5">Statut</th>
                <th className="px-3 py-2.5"></th>
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
                    {s.status === 'active' && (
                      <button onClick={() => revoke(s._id)} className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1" title="Révoquer">
                        <Ban size={13} /> Révoquer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
