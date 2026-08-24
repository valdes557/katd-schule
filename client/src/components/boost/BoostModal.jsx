import { useState, useEffect } from 'react'
import {
  Rocket, X, Eye, ThumbsUp, MessageCircle, Share2, Target, Users, Clock, Wallet,
  Smartphone, Loader2, Check, ChevronRight, ChevronLeft, AlertCircle, Sparkles, Megaphone,
} from 'lucide-react'
import { boostApi, walletApi, paymentsApi } from '../../lib/api'

// Modal « 🚀 Booster une publication » — flux : Objectif → Audience → Durée → Résumé →
// Paiement (Portefeuille ou Mobile Money) → Confirmation. Style Tailwind + lucide, états
// inline (le projet n'utilise ni shadcn/ui ni librairie de toast).

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')

// Miniature d'une vidéo Cloudinary (1re frame) — cohérent avec SocialTab.
function videoThumb(url) {
  if (!url || typeof url !== 'string' || !url.includes('/upload/')) return ''
  return url.replace('/upload/', '/upload/so_0/').replace(/\.(mp4|mov|webm|avi|mkv|m4v|ogv)(\?.*)?$/i, '.jpg$2')
}

const OBJECTIVES = [
  { key: 'views', label: 'Plus de vues', desc: 'Toucher un maximum de personnes', icon: Eye },
  { key: 'engagement', label: "Plus d'engagement", desc: 'Likes, commentaires, partages', icon: ThumbsUp },
  { key: 'visibility', label: 'Plus de visibilité', desc: 'Renforcer votre présence', icon: Sparkles },
]

const STEPS = ['objective', 'audience', 'duration', 'summary', 'payment', 'done']

export default function BoostModal({ post, onClose, onActivated }) {
  const [step, setStep] = useState('objective')
  const [pricing, setPricing] = useState([])
  const [objectives, setObjectives] = useState(OBJECTIVES.map((o) => o.key))
  const [objective, setObjective] = useState('views')
  const [audienceMode, setAudienceMode] = useState('auto')
  const [audience, setAudience] = useState({ country: '', region: '', ageRange: '', interests: '' })
  const [durationKey, setDurationKey] = useState('')
  const [preview, setPreview] = useState(null)
  const [provider, setProvider] = useState('wallet')
  const [wallet, setWallet] = useState(null)
  const [pin, setPin] = useState('')
  const [operators, setOperators] = useState([])
  const [operator, setOperator] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [polling, setPolling] = useState(false)
  const [doneCampaign, setDoneCampaign] = useState(null)

  const selectedPricing = pricing.find((p) => p.durationKey === durationKey)
  const price = preview?.price ?? selectedPricing?.price ?? 0
  const currency = preview?.currency ?? selectedPricing?.currency ?? 'XOF'

  // Charge la grille tarifaire (prix officiels serveur) à l'ouverture.
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const r = await boostApi.pricing()
        if (!alive) return
        setPricing(r.pricing || [])
        if (Array.isArray(r.objectives) && r.objectives.length) setObjectives(r.objectives)
        if (r.pricing?.[0]) setDurationKey(r.pricing[0].durationKey)
      } catch (e) { if (alive) setError(e.message || 'Chargement impossible') }
    })()
    return () => { alive = false }
  }, [])

  const thumb = post?.thumbnail || post?.images?.[0] || videoThumb(post?.videoUrl) || ''
  const likeCount = Array.isArray(post?.likes) ? post.likes.length : (post?.likes || 0)
  const commentCount = Array.isArray(post?.comments) ? post.comments.length : (post?.comments || 0)

  // Passe au résumé : demande au serveur le prix + l'aperçu officiels (valide aussi l'éligibilité).
  const goToSummary = async () => {
    setError(''); setLoading(true)
    try {
      const r = await boostApi.preview({ postId: post._id, durationKey })
      setPreview(r)
      setStep('summary')
    } catch (e) { setError(e.message || 'Vérification impossible') }
    setLoading(false)
  }

  // Entrée dans l'étape paiement : précharge solde du portefeuille + opérateurs Mobile Money.
  const goToPayment = async () => {
    setError(''); setStep('payment')
    walletApi.me().then((r) => setWallet(r.data || r.wallet || r)).catch(() => {})
    paymentsApi.operators().then((r) => {
      setOperators(r.operators || [])
      if (r.operators?.[0]) setOperator(r.operators[0].code)
    }).catch(() => {})
  }

  const buildAudience = () => audienceMode === 'auto'
    ? { mode: 'auto' }
    : {
        mode: 'custom', country: audience.country, region: audience.region, ageRange: audience.ageRange,
        interests: (audience.interests || '').split(',').map((s) => s.trim()).filter(Boolean),
      }

  // Paiement portefeuille : confirmé côté serveur → activation immédiate.
  const payWallet = async () => {
    setError(''); setLoading(true)
    try {
      const r = await boostApi.create({
        postId: post._id, durationKey, objective, audience: buildAudience(), provider: 'wallet', pin,
      })
      if (r.confirmed) { setDoneCampaign(r.campaign); setStep('done'); onActivated?.(post._id, r.campaign) }
      else { setError('Paiement non confirmé.') }
    } catch (e) { setError(e.message || 'Paiement impossible') }
    setLoading(false)
  }

  // Paiement Mobile Money : initiation → polling du statut (aucun boost tant que non approuvé).
  const payMomo = async () => {
    setError(''); setLoading(true)
    try {
      const r = await boostApi.create({
        postId: post._id, durationKey, objective, audience: buildAudience(),
        provider: 'ikeepay', phone, operator,
      })
      setLoading(false)
      if (r.confirmed) { setDoneCampaign(r.campaign); setStep('done'); onActivated?.(post._id, r.campaign); return }
      if (!r.reference) { setError('Initiation du paiement échouée.'); return }
      // Polling du statut (~2 min max).
      setPolling(true)
      const ref = r.reference
      let tries = 0
      const timer = setInterval(async () => {
        tries++
        try {
          const s = await paymentsApi.status(ref)
          if (s.status === 'approved') {
            clearInterval(timer); setPolling(false)
            setStep('done'); onActivated?.(post._id, null)
          } else if (s.status === 'rejected') {
            clearInterval(timer); setPolling(false)
            setError(s.reason || 'Paiement refusé.')
          }
        } catch (_) { /* on continue à interroger */ }
        if (tries >= 30) { clearInterval(timer); setPolling(false); setError("Le paiement n'a pas été confirmé à temps. Vérifiez « Mes boosts » plus tard.") }
      }, 4000)
    } catch (e) { setLoading(false); setError(e.message || 'Paiement impossible') }
  }

  const stepIndex = STEPS.indexOf(step)
  const insufficient = provider === 'wallet' && wallet && Number(wallet.balance) < price

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* En-tête */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3.5 flex items-center justify-between z-10">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Rocket size={18} className="text-blue-600" /> Booster la publication
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>

        {/* Barre de progression */}
        {step !== 'done' && (
          <div className="flex gap-1 px-5 pt-3">
            {STEPS.slice(0, 5).map((s, i) => (
              <div key={s} className={`h-1 flex-1 rounded-full ${i <= stepIndex ? 'bg-blue-600' : 'bg-gray-200'}`} />
            ))}
          </div>
        )}

        <div className="p-5">
          {error && (
            <div className="mb-3 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /> <span>{error}</span>
            </div>
          )}

          {/* Aperçu de la publication (toujours visible) */}
          <div className="flex gap-3 mb-4 p-2.5 bg-gray-50 rounded-xl">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
              {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" /> : <Megaphone size={20} className="text-gray-400" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 line-clamp-1">{post?.title || post?.content || 'Publication'}</p>
              <p className="text-xs text-gray-500 line-clamp-1">{post?.type === 'video' ? 'Vidéo' : post?.type === 'audio' ? 'Audio' : post?.images?.length ? 'Image' : 'Texte'}</p>
              <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500">
                <span className="flex items-center gap-0.5"><Eye size={11} /> {fmt(post?.views)}</span>
                <span className="flex items-center gap-0.5"><ThumbsUp size={11} /> {fmt(likeCount)}</span>
                <span className="flex items-center gap-0.5"><MessageCircle size={11} /> {fmt(commentCount)}</span>
                <span className="flex items-center gap-0.5"><Share2 size={11} /> {fmt(post?.shares)}</span>
              </div>
            </div>
          </div>

          {/* ── Étape Objectif ── */}
          {step === 'objective' && (
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5"><Target size={15} /> Objectif</p>
              <div className="space-y-2">
                {OBJECTIVES.filter((o) => objectives.includes(o.key)).map((o) => (
                  <button key={o.key} onClick={() => setObjective(o.key)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${objective === o.key ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${objective === o.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}><o.icon size={18} /></span>
                    <span className="min-w-0"><span className="block text-sm font-semibold text-gray-900">{o.label}</span><span className="block text-xs text-gray-500">{o.desc}</span></span>
                    {objective === o.key && <Check size={16} className="ml-auto text-blue-600" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Étape Audience ── */}
          {step === 'audience' && (
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5"><Users size={15} /> Audience</p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button onClick={() => setAudienceMode('auto')} className={`p-3 rounded-xl border text-left ${audienceMode === 'auto' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <span className="block text-sm font-semibold text-gray-900">Automatique</span>
                  <span className="block text-xs text-gray-500">KATD choisit une audience pertinente</span>
                </button>
                <button onClick={() => setAudienceMode('custom')} className={`p-3 rounded-xl border text-left ${audienceMode === 'custom' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <span className="block text-sm font-semibold text-gray-900">Personnalisée</span>
                  <span className="block text-xs text-gray-500">Vous ciblez vous-même</span>
                </button>
              </div>
              {audienceMode === 'custom' && (
                <div className="space-y-2">
                  <input value={audience.country} onChange={(e) => setAudience({ ...audience, country: e.target.value })} placeholder="Pays (optionnel)" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400" />
                  <input value={audience.region} onChange={(e) => setAudience({ ...audience, region: e.target.value })} placeholder="Ville / région (optionnel)" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400" />
                  <input value={audience.ageRange} onChange={(e) => setAudience({ ...audience, ageRange: e.target.value })} placeholder="Tranche d'âge, ex. 18-35 (optionnel)" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400" />
                  <input value={audience.interests} onChange={(e) => setAudience({ ...audience, interests: e.target.value })} placeholder="Centres d'intérêt, séparés par des virgules" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400" />
                  <p className="text-[11px] text-gray-400">Le boost fonctionne même si certaines données de ciblage sont absentes.</p>
                </div>
              )}
            </div>
          )}

          {/* ── Étape Durée ── */}
          {step === 'duration' && (
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5"><Clock size={15} /> Durée</p>
              <div className="space-y-2">
                {pricing.length === 0 && <div className="text-center py-6"><Loader2 size={20} className="animate-spin mx-auto text-blue-600" /></div>}
                {pricing.map((p) => (
                  <button key={p.durationKey} onClick={() => setDurationKey(p.durationKey)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors ${durationKey === p.durationKey ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <span className="text-sm font-semibold text-gray-900">{p.label || p.durationKey}</span>
                    <span className="text-sm font-bold text-blue-600">{fmt(p.price)} {p.currency}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Étape Résumé ── */}
          {step === 'summary' && (
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-gray-800 mb-1">Résumé</p>
              <Row label="Objectif" value={OBJECTIVES.find((o) => o.key === objective)?.label || objective} />
              <Row label="Audience" value={audienceMode === 'auto' ? 'Automatique' : 'Personnalisée'} />
              <Row label="Durée" value={preview?.durationLabel || selectedPricing?.label || durationKey} />
              <div className="flex items-center justify-between pt-2 mt-1 border-t border-gray-100">
                <span className="font-semibold text-gray-900">Budget</span>
                <span className="text-lg font-bold text-blue-600">{fmt(price)} {currency}</span>
              </div>
            </div>
          )}

          {/* ── Étape Paiement ── */}
          {step === 'payment' && (
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-2">Paiement — {fmt(price)} {currency}</p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button onClick={() => setProvider('wallet')} className={`p-3 rounded-xl border flex items-center gap-2 ${provider === 'wallet' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <Wallet size={18} className="text-blue-600" /> <span className="text-sm font-semibold">Portefeuille</span>
                </button>
                <button onClick={() => setProvider('ikeepay')} className={`p-3 rounded-xl border flex items-center gap-2 ${provider === 'ikeepay' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <Smartphone size={18} className="text-orange-500" /> <span className="text-sm font-semibold">Mobile Money</span>
                </button>
              </div>

              {provider === 'wallet' ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-gray-600">Solde disponible</span>
                    <span className="font-bold text-gray-900">{wallet ? fmt(wallet.balance) + ' ' + (wallet.currency || currency) : '…'}</span>
                  </div>
                  {insufficient && (
                    <p className="text-[12px] text-red-600">Solde insuffisant. Rechargez votre portefeuille depuis l'onglet Portefeuille.</p>
                  )}
                  {(!wallet || wallet.hasPin) && (
                    <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} type="password" inputMode="numeric"
                      placeholder="Code PIN du portefeuille" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 tracking-widest focus:outline-none focus:border-blue-400" />
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <select value={operator} onChange={(e) => setOperator(e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-blue-400">
                    {operators.length === 0 && <option value="">Chargement des opérateurs…</option>}
                    {operators.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
                  </select>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Numéro Mobile Money" inputMode="tel" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400" />
                  {polling && (
                    <p className="text-[12px] text-blue-600 flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> Validez le paiement sur votre téléphone…</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Étape Confirmation ── */}
          {step === 'done' && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3"><Check size={28} className="text-green-600" /></div>
              <p className="text-base font-bold text-gray-900">{doneCampaign ? 'Publication boostée !' : 'Paiement confirmé !'}</p>
              <p className="text-sm text-gray-500 mt-1">
                {doneCampaign
                  ? 'Votre publication est maintenant sponsorisée dans le fil.'
                  : 'Votre boost sera actif dès confirmation. Suivez-le dans « Mes boosts ».'}
              </p>
            </div>
          )}
        </div>

        {/* Pied : navigation */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3 flex items-center justify-between gap-2">
          {step === 'done' ? (
            <button onClick={onClose} className="ml-auto bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg px-5 py-2.5">Terminer</button>
          ) : (
            <>
              <button
                onClick={() => { setError(''); const i = stepIndex; if (i <= 0) onClose(); else setStep(STEPS[i - 1]) }}
                className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-100">
                <ChevronLeft size={15} /> {stepIndex <= 0 ? 'Annuler' : 'Retour'}
              </button>
              {step === 'objective' && <NextBtn onClick={() => setStep('audience')} />}
              {step === 'audience' && <NextBtn onClick={() => setStep('duration')} />}
              {step === 'duration' && <NextBtn disabled={!durationKey || loading} loading={loading} label="Continuer" onClick={goToSummary} />}
              {step === 'summary' && <NextBtn label="Vers le paiement" onClick={goToPayment} />}
              {step === 'payment' && (
                <button
                  disabled={loading || polling || (provider === 'wallet' && insufficient) || (provider === 'ikeepay' && (!phone || !operator))}
                  onClick={provider === 'wallet' ? payWallet : payMomo}
                  className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg px-5 py-2.5">
                  {(loading || polling) && <Loader2 size={15} className="animate-spin" />} Payer {fmt(price)} {currency}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  )
}

function NextBtn({ onClick, disabled, loading, label = 'Suivant' }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg px-5 py-2.5">
      {loading && <Loader2 size={15} className="animate-spin" />} {label} <ChevronRight size={15} />
    </button>
  )
}
