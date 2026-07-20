// pages/user/UserShareholdersPage.jsx — Programme actionnaires (espace utilisateur /u).
// Affiche les plans (1% arrondissement / régional / national / international), les
// termes & conditions, avantages, responsabilités et droits définis par le super admin,
// puis permet de souscrire via Mobile Money (SEBPay).
import { useState, useEffect } from 'react'
import { Landmark, Loader2, X, CheckCircle2, MapPin, ShieldCheck, Award, Scale, ScrollText, Crown } from 'lucide-react'
import { shareholdersApi, paymentsApi } from '../../lib/api'

const fmt = (n) => (Number(n) || 0).toLocaleString('fr-FR')
const OPERATORS = [
  { value: 'mtn', label: 'MTN Mobile Money' },
  { value: 'orange', label: 'Orange Money' },
]
// Libellé de la délimitation géographique demandée selon le plan
const ZONE_LABELS = {
  arrondissement: "Nom de l'arrondissement",
  regional: 'Nom de la région',
  national: 'Pays',
  international: 'Zone internationale (optionnel)',
}
const PLAN_GRADIENTS = {
  arrondissement: 'from-emerald-500 to-teal-600',
  regional: 'from-blue-500 to-indigo-600',
  national: 'from-amber-500 to-orange-600',
  international: 'from-purple-600 to-fuchsia-600',
}

export default function UserShareholdersPage() {
  const [cfg, setCfg] = useState(null)
  const [mine, setMine] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [selectedPlan, setSelectedPlan] = useState(null)

  const load = async () => {
    try {
      setLoading(true)
      const [c, m] = await Promise.all([shareholdersApi.config(), shareholdersApi.me()])
      setCfg(c)
      setMine(m.shareholdings || [])
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-600" /></div>

  const activeKeys = new Set(mine.filter((s) => s.status === 'active').map((s) => s.planKey))

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Landmark className="text-indigo-600" size={26} />
        <h1 className="text-xl font-bold text-gray-900">Actionnaires</h1>
      </div>

      {err && <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-sm">{err}</div>}

      {/* Mes souscriptions actives */}
      {mine.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <Crown size={16} className="text-amber-500" />
            <h2 className="font-semibold text-gray-900 text-sm">Mes actions</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {mine.map((s) => (
              <div key={s._id} className="p-4 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-gray-800">{s.planLabel || s.planKey} — {s.percent}%</p>
                  {s.zone && <p className="text-xs text-gray-500 flex items-center gap-1"><MapPin size={11} /> {s.zone}</p>}
                  <p className="text-xs text-gray-400">
                    Du {new Date(s.startAt).toLocaleDateString('fr-FR')} au {s.endAt ? new Date(s.endAt).toLocaleDateString('fr-FR') : '—'} ({s.durationYears} ans)
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{fmt(s.amount)} F</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    s.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                  }`}>{s.status === 'active' ? 'Active' : s.status === 'revoked' ? 'Révoquée' : 'Expirée'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plans de souscription */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(cfg?.plans || []).map((p) => {
          const owned = activeKeys.has(p.key)
          return (
            <div key={p.key} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
              <div className={`bg-gradient-to-br ${PLAN_GRADIENTS[p.key] || 'from-gray-500 to-gray-600'} text-white p-4`}>
                <p className="text-xs font-semibold uppercase opacity-90">{p.label}</p>
                <p className="text-2xl font-bold mt-1">{fmt(p.price)} <span className="text-sm">FCFA</span></p>
                <p className="text-xs opacity-80 mt-0.5">{p.percent}% d'action · {p.durationYears} ans · non remboursable</p>
              </div>
              <div className="p-4 flex-1 flex flex-col gap-3">
                {p.description && <p className="text-xs text-gray-600 leading-relaxed flex-1">{p.description}</p>}
                <button
                  onClick={() => setSelectedPlan(p)}
                  disabled={owned}
                  className={`w-full justify-center text-sm ${owned ? 'btn-ghost border border-gray-200 opacity-60 cursor-not-allowed' : 'btn-primary'}`}
                >
                  {owned ? <><CheckCircle2 size={15} /> Déjà souscrit</> : <>Souscrire</>}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Termes / avantages / responsabilités / droits (édités par le super admin) */}
      <div className="space-y-3">
        <InfoBlock icon={ScrollText} color="text-indigo-600" title="Termes et conditions" text={cfg?.terms} />
        <InfoBlock icon={Award} color="text-emerald-600" title="Avantages de l'actionnaire" text={cfg?.advantages} />
        <InfoBlock icon={ShieldCheck} color="text-amber-600" title="Responsabilités" text={cfg?.responsibilities} />
        <InfoBlock icon={Scale} color="text-blue-600" title="Droits et obligations" text={cfg?.rights} />
      </div>

      {selectedPlan && (
        <SubscribeModal
          plan={selectedPlan}
          onClose={() => setSelectedPlan(null)}
          onDone={() => { setSelectedPlan(null); load() }}
        />
      )}
    </div>
  )
}

function InfoBlock({ icon: Icon, color, title, text }) {
  if (!text) return null
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className={`flex items-center gap-2 ${color} mb-2`}>
        <Icon size={16} /><h3 className="font-semibold text-sm text-gray-900">{title}</h3>
      </div>
      <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{text}</p>
    </div>
  )
}

// Modale de souscription : délimitation (zone) + Mobile Money + polling du paiement
function SubscribeModal({ plan, onClose, onDone }) {
  const [f, setF] = useState({ zone: '', phone: '', operator: 'mtn' })
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [err, setErr] = useState('')

  const needZone = plan.key !== 'international'

  const submit = async () => {
    setErr('')
    if (needZone && !f.zone.trim()) { setErr(ZONE_LABELS[plan.key] + ' requis'); return }
    if (!f.phone) { setErr('Numéro Mobile Money requis'); return }
    if (!accepted) { setErr('Veuillez accepter les termes et conditions'); return }
    setBusy(true)
    setStatus('Validez le paiement sur votre téléphone...')
    try {
      const r = await shareholdersApi.subscribe({ planKey: plan.key, zone: f.zone.trim(), phone: f.phone, operator: f.operator })
      let ok = false
      for (let i = 0; i < 45 && !ok; i++) {
        await new Promise((res) => setTimeout(res, 4000))
        try {
          const st = await paymentsApi.status(r.reference)
          if (st.status === 'approved') ok = true
          else if (st.status === 'rejected') throw new Error('Paiement rejeté')
        } catch (e) { if (e.message === 'Paiement rejeté') throw e }
      }
      if (!ok) throw new Error('Paiement non confirmé à temps')
      onDone()
    } catch (e) { setErr(e.message); setStatus('') } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !busy && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">{plan.label} — {fmt(plan.price)} F</h3>
          <button onClick={() => !busy && onClose()} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2">
          Somme <b>non remboursable</b> · {plan.percent}% d'action · durée {plan.durationYears} ans.
        </p>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">{ZONE_LABELS[plan.key]}{needZone ? ' *' : ''}</label>
          <input value={f.zone} onChange={(e) => setF({ ...f, zone: e.target.value })} className="input w-full" placeholder={ZONE_LABELS[plan.key]} />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Opérateur</label>
          <select value={f.operator} onChange={(e) => setF({ ...f, operator: e.target.value })} className="input w-full">
            {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Numéro Mobile Money</label>
          <input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className="input w-full" placeholder="6XX XXX XXX" />
        </div>
        <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 w-4 h-4 accent-indigo-600" />
          <span>J'accepte les termes et conditions de souscription d'actionnaires (somme non remboursable).</span>
        </label>
        {err && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">{err}</p>}
        {status && <p className="text-xs text-blue-700 bg-blue-50 rounded-lg p-2 flex items-center gap-2"><Loader2 size={12} className="animate-spin" />{status}</p>}
        <button onClick={submit} disabled={busy} className="btn-primary w-full justify-center">
          {busy ? <><Loader2 size={16} className="animate-spin" /> Traitement...</> : <>Payer {fmt(plan.price)} F</>}
        </button>
      </div>
    </div>
  )
}
