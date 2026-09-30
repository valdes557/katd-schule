import { useState } from 'react'
import { Link } from 'react-router-dom'
import { aiApi, walletApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'
import { useInlineCheckout } from '../components/payments/useInlineCheckout'
import {
  Bot, Sparkles, Loader2, Upload, CheckCircle2, Clock, XCircle, Ban,
  Users, UserCheck, BarChart2, MessageSquare, Send, Wallet, Smartphone,
  ShieldCheck, AlertCircle, ArrowRight,
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
  const walletQ = useCachedFetch('/wallet/me', async () => {
    const r = await walletApi.me()
    return r.data || r
  }, [])

  const inlineCheckout = useInlineCheckout()

  const sub = q.data
  const packages = pkgQ.data || []
  const walletData = walletQ.data || {}
  const [packageId, setPackageId] = useState('')
  const [method, setMethod] = useState('wallet') // 'wallet' | 'mobile_money' | 'manual'
  const [pin, setPin] = useState('')
  const [screenshot, setScreenshot] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const refresh = () => {
    cache.invalidate('/ai/subscription/status')
    cache.invalidate('/wallet/me')
    q.refetch()
    walletQ.refetch()
  }

  const selectedPkg = packages.find((p) => p._id === packageId)
  const userBalance = Number(walletData.balance) || 0
  const pkgPrice = Number(selectedPkg?.price) || 0
  const canPayWallet = userBalance >= pkgPrice && pkgPrice > 0

  // Paiement immédiat via le Solde Portefeuille
  const handleWalletSubmit = async (e) => {
    e.preventDefault()
    if (!packageId) { setErrorMsg('Choisissez une offre IA.'); return }
    if (!pin) { setErrorMsg('Veuillez entrer votre code PIN portefeuille.'); return }
    setSubmitting(true)
    setErrorMsg('')
    try {
      const res = await aiApi.subscribeWallet({ packageId, pin })
      setMsg(res.message || 'Souscription IA activée avec succès !')
      setPin('')
      refresh()
    } catch (err) {
      setErrorMsg(err.message || 'Échec du paiement avec le portefeuille.')
    }
    setSubmitting(false)
  }

  // Paiement via Mobile Money (Ikeepay H2H)
  const handleMobileSubmit = (e) => {
    e?.preventDefault()
    if (!selectedPkg) { setErrorMsg('Choisissez une offre IA.'); return }
    setErrorMsg('')
    inlineCheckout.start(
      async (momoData) => {
        return await aiApi.subscribeMobile({
          packageId: selectedPkg._id,
          ...momoData,
        })
      },
      async () => {
        refresh()
        setMsg('Paiement Mobile Money validé ! Votre souscription IA est maintenant active.')
      },
      {
        amount: selectedPkg.price,
        currency: selectedPkg.currency || 'XAF',
        title: `Souscription IA — ${selectedPkg.name}`,
      }
    )
  }

  // Demande manuelle avec capture
  const handleManualSubmit = async (e) => {
    e.preventDefault()
    if (!packageId) { setErrorMsg('Choisissez une offre IA.'); return }
    setSubmitting(true)
    setErrorMsg('')
    try {
      await aiApi.requestSubscription({ packageId, paymentScreenshot: screenshot })
      setMsg('Demande enregistrée ! Elle sera validée par l\'administrateur après vérification.')
      setScreenshot(null)
      refresh()
    } catch (err) {
      setErrorMsg(err.message || 'Échec de l\'envoi de la demande.')
    }
    setSubmitting(false)
  }

  if (q.loading) return <div className="py-12 text-center"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div>

  // Formulaire affiché s'il n'y a pas de souscription ou si elle est rejetée/épuisée
  const showForm = !sub || ['rejected', 'expired'].includes(sub.status)

  return (
    <div className="space-y-4">
      {/* Dialogue de paiement Mobile Money H2H */}
      {inlineCheckout.element}

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
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Progression d'utilisation</span>
                <span>{Math.round((sub.usedQuestions / Math.max(1, sub.totalQuestions)) * 100)}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${Math.min(100, (sub.usedQuestions / Math.max(1, sub.totalQuestions)) * 100)}%` }} />
              </div>
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
        <div className="card p-5 space-y-5">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Sparkles size={18} className="text-indigo-600" /> Souscrire au service d'Assistant IA
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Activez l'intelligence artificielle pour votre établissement. Choisissez votre forfait et réglez soit avec votre solde, soit par Mobile Money.
            </p>
          </div>

          {msg && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700 flex items-center gap-2">
              <CheckCircle2 size={18} className="flex-shrink-0" />
              <span>{msg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Sélection de l'offre */}
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-2">1. Choisissez un forfait</label>
            {packages.length === 0 ? (
              <p className="text-sm text-gray-400">Aucune offre disponible pour le moment. Contactez l'administrateur.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {packages.map((p) => {
                  const isSelected = packageId === p._id
                  return (
                    <label
                      key={p._id}
                      className={`border rounded-xl p-4 cursor-pointer transition-all ${
                        isSelected ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-200 shadow-sm' : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="pkg"
                        value={p._id}
                        checked={isSelected}
                        onChange={() => { setPackageId(p._id); setErrorMsg('') }}
                        className="sr-only"
                      />
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-gray-900">{p.name}</p>
                        {isSelected && <CheckCircle2 size={16} className="text-indigo-600" />}
                      </div>
                      {p.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.description}</p>}
                      <div className="mt-3 flex items-baseline gap-1">
                        <span className="text-xl font-bold text-indigo-600">{Number(p.price).toLocaleString()}</span>
                        <span className="text-xs font-medium text-gray-500">{p.currency}</span>
                      </div>
                      <p className="text-xs text-indigo-700 font-medium mt-1">✨ {p.totalQuestions} questions incluses</p>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {selectedPkg && (
            <>
              {/* 2. Mode de paiement */}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-2">2. Mode de règlement</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Option Solde Portefeuille */}
                  <button
                    type="button"
                    onClick={() => { setMethod('wallet'); setErrorMsg('') }}
                    className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all ${
                      method === 'wallet' ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-200' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600">
                      <Wallet size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">Solde Portefeuille</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">Débit immédiat avec code PIN</p>
                      <p className="text-[11px] font-semibold text-indigo-700 mt-1">
                        Dispo : {userBalance.toLocaleString()} FCFA
                      </p>
                    </div>
                  </button>

                  {/* Option Mobile Money */}
                  <button
                    type="button"
                    onClick={() => { setMethod('mobile_money'); setErrorMsg('') }}
                    className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all ${
                      method === 'mobile_money' ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-200' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600">
                      <Smartphone size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">Mobile Money</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">Orange, MTN, Moov, Wave...</p>
                      <p className="text-[11px] font-semibold text-emerald-700 mt-1">Débit direct H2H</p>
                    </div>
                  </button>

                  {/* Option Virement / Manuel */}
                  <button
                    type="button"
                    onClick={() => { setMethod('manual'); setErrorMsg('') }}
                    className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all ${
                      method === 'manual' ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-200' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-gray-100 text-gray-600">
                      <Upload size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">Reçu / Virement</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">Validation manuelle</p>
                      <p className="text-[11px] text-gray-500 mt-1">Téléverser une capture</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Formulaire spécifique selon le mode choisi */}
              {method === 'wallet' && (
                <form onSubmit={handleWalletSubmit} className="bg-gray-50 p-4 rounded-xl space-y-3 border border-gray-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Montant à débiter :</span>
                    <span className="font-bold text-gray-900">{pkgPrice.toLocaleString()} {selectedPkg.currency}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Votre solde actuel :</span>
                    <span className={`font-semibold ${userBalance >= pkgPrice ? 'text-green-600' : 'text-red-600'}`}>
                      {userBalance.toLocaleString()} FCFA
                    </span>
                  </div>

                  {!canPayWallet ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-2">
                      <p>Votre solde est insuffisant pour activer ce forfait.</p>
                      <Link to="/portefeuille?tab=deposit" className="btn-secondary text-xs inline-flex items-center gap-1.5 py-1 px-2.5">
                        <Wallet size={13} /> Recharger mon portefeuille
                      </Link>
                    </div>
                  ) : !walletData.hasPin ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-2">
                      <p>Vous n'avez pas encore configuré votre code PIN de sécurité.</p>
                      <Link to="/portefeuille" className="btn-secondary text-xs inline-flex items-center gap-1.5 py-1 px-2.5">
                        <ShieldCheck size={13} /> Créer mon code PIN dans Portefeuille
                      </Link>
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1">
                        Code PIN Portefeuille (4 chiffres)
                      </label>
                      <input
                        type="password"
                        maxLength={6}
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="••••"
                        className="input max-w-xs text-center text-lg tracking-widest"
                        required
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting || !canPayWallet || !walletData.hasPin || !pin}
                    className="btn-primary w-full sm:w-auto text-sm justify-center gap-2"
                  >
                    {submitting ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                    Payer {pkgPrice.toLocaleString()} {selectedPkg.currency} et activer l'IA
                  </button>
                </form>
              )}

              {method === 'mobile_money' && (
                <div className="bg-emerald-50/50 p-4 rounded-xl space-y-3 border border-emerald-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Montant :</span>
                    <span className="font-bold text-gray-900">{pkgPrice.toLocaleString()} {selectedPkg.currency}</span>
                  </div>
                  <p className="text-xs text-gray-600">
                    Débit direct Mobile Money sécurisé par Ikeepay. Vous recevrez une demande d'autorisation sur votre téléphone.
                  </p>
                  <button
                    type="button"
                    onClick={handleMobileSubmit}
                    disabled={inlineCheckout.busy}
                    className="btn-primary w-full sm:w-auto text-sm justify-center bg-emerald-600 hover:bg-emerald-700 gap-2"
                  >
                    {inlineCheckout.busy ? <Loader2 size={15} className="animate-spin" /> : <Smartphone size={15} />}
                    Payer {pkgPrice.toLocaleString()} {selectedPkg.currency} par Mobile Money
                  </button>
                </div>
              )}

              {method === 'manual' && (
                <form onSubmit={handleManualSubmit} className="bg-gray-50 p-4 rounded-xl space-y-3 border border-gray-100">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Capture de paiement (reçu ou bordereau)</label>
                    <label className="mt-1 flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-3 py-2.5 cursor-pointer hover:border-indigo-400 text-sm text-gray-500 bg-white">
                      <Upload size={16} />
                      <span className="truncate">{screenshot ? screenshot.name : 'Téléverser le reçu (PNG, JPG)'}</span>
                      <input type="file" accept="image/*" onChange={(e) => setScreenshot(e.target.files?.[0] || null)} className="hidden" />
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary w-full sm:w-auto text-sm justify-center gap-2"
                  >
                    {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                    Envoyer la demande pour validation
                  </button>
                </form>
              )}
            </>
          )}
        </div>
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
