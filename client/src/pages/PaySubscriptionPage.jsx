import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CreditCard, Loader2, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { paymentsApi, authApi } from '../lib/api'
import { COUNTRIES } from '../constants/countries'

const fmt = (n) => (Number(n) || 0).toLocaleString('fr-FR')

// Page de paiement d'abonnement pour un directeur DÉJÀ inscrit (après essai) : réutilise l'école
// existante — aucun formulaire à re-remplir. Paiement Direct Charge Mobile Money (API H2H Server-to-Server).
export default function PaySubscriptionPage() {
  const { school, setSchool } = useAuth()
  const navigate = useNavigate()
  const sub = school?.subscription
  const schoolId = school?._id || school?.id

  const [plan, setPlan] = useState(sub?.plan || 'annual')
  const [country, setCountry] = useState('CM')
  const [operator, setOperator] = useState('mtn')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)

  const currentCountry = COUNTRIES.find((c) => c.code === country) || COUNTRIES[0]
  const currentOperators = currentCountry.operators || []

  // Interroge le statut jusqu'à confirmation (le webhook Ikeepay active l'abonnement côté serveur).
  const pollUntilPaid = async (reference) => {
    setStatus('Confirmation du paiement auprès du réseau Mobile Money…')
    let ok = false
    for (let i = 0; i < 45 && !ok; i++) {
      await new Promise((res) => setTimeout(res, 3000))
      try {
        const st = await paymentsApi.status(reference)
        if (st.status === 'approved' || st.fulfilled) ok = true
        else if (st.status === 'rejected') throw new Error(st.reason || 'Paiement rejeté par l\'opérateur')
      } catch (e) {
        if (/rejet|refus|annul/i.test(e.message || '')) throw e
      }
    }
    if (!ok) throw new Error("Paiement non confirmé à temps. Si vous avez validé le débit sur votre téléphone, l'activation se fera dès notification réseau.")
  }

  const pay = async (e) => {
    e?.preventDefault()
    setErr('')
    if (!schoolId) return setErr("Aucune école associée à votre compte.")

    const rawPhone = String(phone || '').trim().replace(/[^0-9]/g, '')
    if (!rawPhone) return setErr("Veuillez saisir le numéro Mobile Money pour le débit.")
    if (!operator) return setErr("Veuillez sélectionner votre opérateur Mobile Money.")

    const isOrangeBurkina = country === 'BF' && String(operator).toLowerCase().includes('orange')
    if (isOrangeBurkina && !String(otp || '').trim()) {
      return setErr("Pour Orange Money Burkina Faso, veuillez renseigner le code d'autorisation (OTP).")
    }

    setBusy(true)
    setStatus("Initialisation du débit direct auprès d'Ikeepay…")
    try {
      const r = await paymentsApi.initiateSubscription({
        schoolId,
        plan,
        phone: rawPhone,
        operator,
        country,
        otp: String(otp || '').trim(),
      })

      if (r.payment_link) {
        setStatus('Redirection vers la page de paiement sécurisée…')
        window.location.href = r.payment_link
        return
      }

      setStatus(`Demande envoyée au +${currentCountry.dial} ${rawPhone} ! Confirmez le débit avec votre code PIN Mobile Money sur votre téléphone…`)
      await pollUntilPaid(r.reference)

      setStatus('')
      setDone(true)
      try {
        const me = await authApi.me()
        if (me?.school) {
          setSchool(me.school)
          localStorage.setItem('katd_school', JSON.stringify(me.school))
        }
      } catch { /* best-effort */ }
    } catch (e) {
      const msg = e.message || 'Erreur lors du paiement'
      setErr(msg)
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto py-16 text-center animate-fade-in">
        <CheckCircle2 size={56} className="mx-auto text-green-500 mb-4" />
        <h1 className="text-xl font-bold text-gray-900">Abonnement activé 🎉</h1>
        <p className="text-sm text-gray-500 mt-2">L'accès complet de <b>{school?.name}</b> est réactivé.</p>
        <button onClick={() => navigate('/dashboard')} className="btn-primary mt-6 mx-auto">Retour au tableau de bord</button>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-5 animate-fade-in">
      <button onClick={() => navigate(-1)} className="text-sm text-gray-500 flex items-center gap-1 hover:text-gray-800"><ArrowLeft size={16} /> Retour</button>

      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><CreditCard size={22} className="text-blue-600" /> Payer mon abonnement</h1>
        <p className="text-sm text-gray-500 mt-0.5">{school?.name || 'Mon école'}{sub?.cycle ? ` · Cycle ${sub.cycle}` : ''}</p>
      </div>

      {!schoolId && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">Aucune école associée à votre compte. Contactez le support.</p>
        </div>
      )}

      {err && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{err}</div>}

      <form onSubmit={pay} className="card p-5 space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Formule d'abonnement</label>
          <select value={plan} onChange={(e) => setPlan(e.target.value)} className="input w-full font-medium">
            <option value="annual">Annuel</option>
            <option value="trimestriel">Trimestriel</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Pays</label>
          <select
            value={country}
            onChange={(e) => {
              const c = e.target.value
              const cObj = COUNTRIES.find((x) => x.code === c) || COUNTRIES[0]
              setCountry(c)
              setOperator(cObj.operators[0]?.value || 'mtn')
              setOtp('')
            }}
            className="input w-full font-medium"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Opérateur de débit ({currentCountry.currency})</label>
          <select
            value={operator}
            onChange={(e) => {
              setOperator(e.target.value)
              setOtp('')
            }}
            className="input w-full"
          >
            {currentOperators.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Numéro Mobile Money à débiter</label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-xs text-gray-400 font-mono font-medium">+{currentCountry.dial}</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input w-full pl-14"
              placeholder={currentCountry.placeholder}
              required
            />
          </div>
        </div>

        {country === 'BF' && String(operator).toLowerCase().includes('orange') && (
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 flex items-center justify-between">
              <span>Code d'autorisation Orange Money (OTP) <span className="text-red-500">*</span></span>
              <span className="text-[10px] font-mono font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">Orange BF</span>
            </label>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="input w-full font-mono font-bold tracking-widest text-center text-lg"
              placeholder="Ex: 123456"
              maxLength={6}
              required
            />
            <p className="text-[11px] text-amber-900 bg-amber-50 rounded-lg p-2.5 mt-1.5 border border-amber-200 leading-snug">
              👉 Renseignez le code d'autorisation (OTP) généré sur votre mobile Orange Burkina Faso.
            </p>
          </div>
        )}

        {status && (
          <p className="text-xs text-blue-700 bg-blue-50 rounded-lg p-2.5 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin shrink-0" />
            <span>{status}</span>
          </p>
        )}

        <button type="submit" disabled={busy || !schoolId} className="btn-primary w-full justify-center">
          {busy ? <><Loader2 size={16} className="animate-spin" /> Traitement…</> : 'Payer maintenant'}
        </button>

        <div className="text-xs text-emerald-800 bg-emerald-50 rounded-xl p-3 border border-emerald-100 flex items-start gap-2">
          <span className="text-base">📲</span>
          <span className="leading-relaxed text-[11px]">
            <b>Direct Charge H2H :</b> Le débit direct est initié de serveur à serveur. Vous recevrez une notification ou une invite sur votre téléphone pour valider l'opération avec votre code secret Mobile Money.
          </span>
        </div>
      </form>
    </div>
  )
}
