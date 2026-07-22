// pages/user/UserShareholdersPage.jsx — Programme actionnaires (espace utilisateur /u).
// Au clic sur le bouton « Actions » de la barre : un POP-UP présente les plans par zone
// (1% arrondissement / régional / national / international) avec un petit carreau
// « J'accepte les conditions » dont le lien bleu ouvre les termes complets à lire.
// Après validation du paiement, l'utilisateur est orienté vers son PORTEFEUILLE
// D'ACTIONNAIRE : utilisateurs de sa zone, transactions (agrégats uniquement — jamais
// les montants individuels ni les soldes des autres), frais, ses gains, et les
// publications du super admin (dépenses, sommes à payer, réunions…).
import { useState, useEffect } from 'react'
import {
  Landmark, Loader2, X, CheckCircle2, MapPin, Users, ArrowLeftRight, Coins,
  TrendingUp, Crown, Megaphone, CalendarClock, Video, Banknote, Receipt, Wallet,
} from 'lucide-react'
import { shareholdersApi, paymentsApi, walletApi } from '../../lib/api'

const fmt = (n) => (Number(n) || 0).toLocaleString('fr-FR')
const OPERATORS = [
  { value: 'mtn', label: 'MTN Mobile Money' },
  { value: 'orange', label: 'Orange Money' },
]
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
const POST_META = {
  depense: { label: 'Dépense', icon: Receipt, cls: 'bg-orange-100 text-orange-700' },
  paiement: { label: 'Somme à payer', icon: Banknote, cls: 'bg-red-100 text-red-700' },
  reunion: { label: 'Réunion', icon: CalendarClock, cls: 'bg-blue-100 text-blue-700' },
  info: { label: 'Info', icon: Megaphone, cls: 'bg-gray-100 text-gray-600' },
}

export default function UserShareholdersPage() {
  const [cfg, setCfg] = useState(null)
  const [dash, setDash] = useState(null)          // portefeuille actionnaire (403 si pas actionnaire)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [showPlans, setShowPlans] = useState(false) // pop-up des plans

  const load = async () => {
    setLoading(true)
    try {
      const c = await shareholdersApi.config()
      setCfg(c)
      try {
        const d = await shareholdersApi.dashboard()
        setDash(d)
        setShowPlans(false)
      } catch {
        // Pas encore actionnaire → le pop-up des plans s'ouvre directement
        setDash(null)
        setShowPlans(true)
      }
    } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-600" /></div>

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Landmark className="text-indigo-600" size={26} />
          <h1 className="text-xl font-bold text-gray-900">{dash ? "Portefeuille d'actionnaire" : 'Actionnaires'}</h1>
        </div>
        {dash && (
          <button onClick={() => setShowPlans(true)} className="btn-ghost text-xs border border-gray-200">
            Autres plans
          </button>
        )}
      </div>

      {err && <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-sm">{err}</div>}

      {dash ? <ShareholderWallet dash={dash} /> : (
        !showPlans && (
          <div className="text-center py-16 text-gray-400">
            <Landmark size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Vous n'êtes pas encore actionnaire.</p>
            <button onClick={() => setShowPlans(true)} className="btn-primary mt-4 mx-auto">Voir les plans</button>
          </div>
        )
      )}

      {showPlans && cfg && (
        <PlansPopup
          cfg={cfg}
          ownedKeys={new Set((dash?.shareholdings || []).map((s) => s.planKey))}
          onClose={() => setShowPlans(false)}
          onDone={async () => { setShowPlans(false); await load() }}
        />
      )}
    </div>
  )
}

// ── Portefeuille d'actionnaire ──
// CONFIDENTIALITÉ : uniquement des agrégats — pas de transferts individuels ni de soldes.
function ShareholderWallet({ dash }) {
  const { stats, zone, posts, shareholdings } = dash
  return (
    <div className="space-y-5">
      {/* Zone d'attribution */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-2xl p-5 shadow-lg">
        <div className="flex items-center gap-2 opacity-90"><Crown size={16} /><span className="text-xs font-semibold uppercase">Zone d'attribution</span></div>
        <p className="text-xl font-bold mt-1">{zone.label || zone.planKey}</p>
        {zone.zone && <p className="text-sm opacity-85 flex items-center gap-1 mt-0.5"><MapPin size={13} /> {zone.zone}</p>}
        <div className="flex flex-wrap gap-2 mt-3">
          {shareholdings.map((s) => (
            <span key={s._id} className="text-[10px] font-semibold bg-white/20 rounded-full px-2.5 py-1">
              {s.planLabel || s.planKey} · {s.percent}% · jusqu'au {s.endAt ? new Date(s.endAt).toLocaleDateString('fr-FR') : '—'}
            </span>
          ))}
        </div>
      </div>

      {/* Statistiques agrégées de la zone */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Users} color="text-blue-600" border="border-blue-500" label="Utilisateurs de la zone" value={fmt(stats.userCount)} />
        <StatCard icon={ArrowLeftRight} color="text-indigo-600" border="border-indigo-500" label="Transactions effectuées" value={fmt(stats.txCount)} />
        <StatCard icon={Wallet} color="text-amber-600" border="border-amber-500" label="Transferts + retraits" value={fmt(stats.movementsTotal) + ' F'} />
        <StatCard icon={Coins} color="text-emerald-600" border="border-emerald-500" label="Frais de transactions" value={fmt(stats.feesTotal) + ' F'} />
      </div>

      {/* Gains accumulés */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-emerald-600">
          <TrendingUp size={18} />
          <div>
            <p className="text-xs font-semibold uppercase text-gray-500">Mes gains accumulés</p>
            <p className="text-[11px] text-gray-400">{fmt(stats.gainsCount)} versement{stats.gainsCount > 1 ? 's' : ''} reçu{stats.gainsCount > 1 ? 's' : ''}</p>
          </div>
        </div>
        <p className="text-2xl font-bold text-emerald-600">{fmt(stats.gainsTotal)} <span className="text-sm">F</span></p>
      </div>

      {/* Publications du super admin */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <Megaphone size={16} className="text-indigo-600" />
          <h2 className="font-semibold text-gray-900 text-sm">Publications de l'administration</h2>
        </div>
        <div className="divide-y divide-gray-50 max-h-[28rem] overflow-y-auto">
          {(posts || []).length === 0 && <p className="p-6 text-center text-sm text-gray-400">Aucune publication pour le moment.</p>}
          {(posts || []).map((p) => {
            const m = POST_META[p.category] || POST_META.info
            const Icon = m.icon
            return (
              <div key={p._id} className="p-4 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${m.cls}`}><Icon size={11} /> {m.label}</span>
                  <span className="text-[11px] text-gray-400">{new Date(p.createdAt).toLocaleDateString('fr-FR')}</span>
                </div>
                <p className="font-semibold text-gray-900 text-sm">{p.title}</p>
                {p.body && <p className="text-xs text-gray-600 whitespace-pre-line leading-relaxed">{p.body}</p>}
                {p.amount != null && <p className="text-sm font-bold text-gray-800">{fmt(p.amount)} F</p>}
                {p.meetingAt && (
                  <p className="text-xs text-blue-700 flex items-center gap-1">
                    <CalendarClock size={12} /> {new Date(p.meetingAt).toLocaleString('fr-FR')}
                    {p.meetingPlace && <> · <MapPin size={12} /> {p.meetingPlace}</>}
                  </p>
                )}
                {p.meetingLink && (
                  <a href={p.meetingLink} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline flex items-center gap-1">
                    <Video size={12} /> Rejoindre la réunion en ligne
                  </a>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, color, border, label, value }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 border-l-4 ${border}`}>
      <div className={`flex items-center gap-1.5 ${color}`}><Icon size={14} /><span className="text-[10px] font-semibold uppercase text-gray-500">{label}</span></div>
      <p className="text-lg font-bold text-gray-900 mt-1">{value}</p>
    </div>
  )
}

// ── POP-UP des plans (s'ouvre au clic sur le bouton « Actions ») ──
function PlansPopup({ cfg, ownedKeys, onClose, onDone }) {
  const [selected, setSelected] = useState(null)   // plan choisi
  const [showTerms, setShowTerms] = useState(false) // lecture des conditions
  const [accepted, setAccepted] = useState(false)
  const [method, setMethod] = useState('wallet')   // 'wallet' (portefeuille) | 'momo' (Mobile Money)
  const [balance, setBalance] = useState(null)      // solde du portefeuille
  const [f, setF] = useState({ zone: '', phone: '', operator: 'mtn', pin: '' })
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [err, setErr] = useState('')

  const needZone = selected && selected.key !== 'international'

  // Charge le solde du portefeuille à l'ouverture (pour le paiement par portefeuille)
  useEffect(() => {
    walletApi.me().then((w) => setBalance(Number(w?.balance) || 0)).catch(() => setBalance(0))
  }, [])

  const submit = async () => {
    setErr('')
    if (!selected) { setErr('Sélectionnez un plan'); return }
    if (needZone && !f.zone.trim()) { setErr(ZONE_LABELS[selected.key] + ' requis'); return }
    if (!accepted) { setErr('Veuillez cocher « J\'accepte les conditions »'); return }

    // ── Paiement depuis le solde du portefeuille ──
    if (method === 'wallet') {
      if (!f.pin) { setErr('Code PIN requis'); return }
      if (balance != null && balance < selected.price) { setErr('Solde insuffisant. Effectuez d\'abord un dépôt sur votre portefeuille.'); return }
      setBusy(true)
      setStatus('Paiement depuis votre portefeuille...')
      try {
        await shareholdersApi.subscribeWallet({ planKey: selected.key, zone: f.zone.trim(), pin: f.pin })
        onDone()
      } catch (e) { setErr(e.message); setStatus('') } finally { setBusy(false) }
      return
    }

    // ── Paiement Mobile Money (SebPay) ──
    if (!f.phone) { setErr('Numéro Mobile Money requis'); return }
    setBusy(true)
    setStatus('Validez le paiement sur votre téléphone...')
    try {
      const r = await shareholdersApi.subscribe({ planKey: selected.key, zone: f.zone.trim(), phone: f.phone, operator: f.operator })
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
      // Après validation → orientation directe vers le portefeuille d'actionnaire
      onDone()
    } catch (e) { setErr(e.message); setStatus('') } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !busy && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between rounded-t-2xl">
          <h3 className="font-bold text-gray-900 flex items-center gap-2"><Landmark size={18} className="text-indigo-600" /> Devenez actionnaire</h3>
          <button onClick={() => !busy && onClose()} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* Plans par zone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(cfg.plans || []).map((p) => {
              const owned = ownedKeys.has(p.key)
              const isSel = selected?.key === p.key
              return (
                <button
                  key={p.key}
                  type="button"
                  disabled={owned}
                  onClick={() => setSelected(p)}
                  className={`text-left rounded-xl overflow-hidden border-2 transition-all ${
                    owned ? 'opacity-50 cursor-not-allowed border-gray-100'
                      : isSel ? 'border-indigo-600 ring-2 ring-indigo-200 scale-[1.02]' : 'border-gray-100 hover:border-indigo-200'
                  }`}
                >
                  <div className={`bg-gradient-to-br ${PLAN_GRADIENTS[p.key]} text-white p-3`}>
                    <p className="text-[11px] font-semibold uppercase opacity-90">{p.label}</p>
                    <p className="text-lg font-bold">{fmt(p.price)} <span className="text-xs">F</span></p>
                    <p className="text-[10px] opacity-80">{p.percent}% · {p.durationYears} ans · non remboursable</p>
                  </div>
                  {isSel && !owned && (
                    <div className="p-1.5 text-center text-[11px] font-semibold text-indigo-600 flex items-center justify-center gap-1">
                      <CheckCircle2 size={12} /> Plan sélectionné
                    </div>
                  )}
                  {owned && <div className="p-1.5 text-center text-[11px] text-gray-400">Déjà souscrit</div>}
                </button>
              )
            })}
          </div>

          {/* Formulaire (zone + mode de paiement) — visible dès qu'un plan est choisi */}
          {selected && (
            <div className="space-y-3 border-t border-gray-100 pt-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">{ZONE_LABELS[selected.key]}{needZone ? ' *' : ''}</label>
                <input value={f.zone} onChange={(e) => setF({ ...f, zone: e.target.value })} className="input w-full" placeholder={ZONE_LABELS[selected.key]} />
              </div>

              {/* Choix du mode de paiement */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Mode de paiement</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setMethod('wallet')}
                    className={`flex items-center gap-2 rounded-xl border-2 p-2.5 text-left transition-all ${method === 'wallet' ? 'border-indigo-600 ring-2 ring-indigo-100' : 'border-gray-200 hover:border-indigo-200'}`}>
                    <Wallet size={16} className="text-indigo-600 flex-shrink-0" />
                    <span className="text-xs font-semibold text-gray-800">Mon portefeuille</span>
                  </button>
                  <button type="button" onClick={() => setMethod('momo')}
                    className={`flex items-center gap-2 rounded-xl border-2 p-2.5 text-left transition-all ${method === 'momo' ? 'border-indigo-600 ring-2 ring-indigo-100' : 'border-gray-200 hover:border-indigo-200'}`}>
                    <Banknote size={16} className="text-emerald-600 flex-shrink-0" />
                    <span className="text-xs font-semibold text-gray-800">Mobile Money</span>
                  </button>
                </div>
              </div>

              {/* Champs selon le mode choisi */}
              {method === 'wallet' ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-indigo-50 rounded-lg px-3 py-2">
                    <span className="text-xs text-gray-600">Solde disponible</span>
                    <span className={`text-sm font-bold ${balance != null && balance < selected.price ? 'text-red-600' : 'text-indigo-700'}`}>
                      {balance == null ? '…' : fmt(balance) + ' F'}
                    </span>
                  </div>
                  {balance != null && balance < selected.price && (
                    <p className="text-[11px] text-red-600">Solde insuffisant pour ce plan ({fmt(selected.price)} F). Rechargez votre portefeuille.</p>
                  )}
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Code PIN du portefeuille *</label>
                    <input type="password" inputMode="numeric" value={f.pin} onChange={(e) => setF({ ...f, pin: e.target.value })} className="input w-full" placeholder="••••" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
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
                </div>
              )}
            </div>
          )}

          {/* Petit carreau + mini lien bleu « J'accepte les conditions » */}
          <label className="flex items-start gap-2 text-xs text-gray-700 cursor-pointer border-t border-gray-100 pt-3">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 w-4 h-4 accent-indigo-600 flex-shrink-0" />
            <span>
              J'accepte les{' '}
              <button type="button" onClick={(e) => { e.preventDefault(); setShowTerms(true) }} className="text-blue-600 underline font-medium">
                conditions
              </button>
              {' '}de souscription d'actionnaires.
            </span>
          </label>

          {err && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">{err}</p>}
          {status && <p className="text-xs text-blue-700 bg-blue-50 rounded-lg p-2 flex items-center gap-2"><Loader2 size={12} className="animate-spin" />{status}</p>}

          <button onClick={submit} disabled={busy || !selected} className="btn-primary w-full justify-center">
            {busy ? <><Loader2 size={16} className="animate-spin" /> Traitement...</>
              : !selected ? <>Sélectionnez un plan</>
              : method === 'wallet' ? <>Payer {fmt(selected.price)} F depuis mon portefeuille</>
              : <>Valider — Payer {fmt(selected.price)} F</>}
          </button>
        </div>
      </div>

      {/* Lecture complète des conditions (ouvre par le lien bleu) */}
      {showTerms && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => setShowTerms(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between rounded-t-2xl">
              <h4 className="font-bold text-gray-900 text-sm">Conditions de souscription</h4>
              <button onClick={() => setShowTerms(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-4 text-xs text-gray-700 leading-relaxed">
              <TermSection title="Termes et conditions" text={cfg.terms} />
              <TermSection title="Avantages de l'actionnaire" text={cfg.advantages} />
              <TermSection title="Responsabilités" text={cfg.responsibilities} />
              <TermSection title="Droits et obligations" text={cfg.rights} />
            </div>
            <div className="sticky bottom-0 bg-white border-t border-gray-100 p-3">
              <button onClick={() => { setAccepted(true); setShowTerms(false) }} className="btn-primary w-full justify-center text-sm">
                <CheckCircle2 size={15} /> J'ai lu et j'accepte
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TermSection({ title, text }) {
  if (!text) return null
  return (
    <div>
      <h5 className="font-semibold text-gray-900 mb-1">{title}</h5>
      <p className="whitespace-pre-line">{text}</p>
    </div>
  )
}
