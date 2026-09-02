import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CreditCard, Loader2, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { paymentsApi, authApi } from '../lib/api'
import IkeepayCheckout from '../components/payments/IkeepayCheckout'

// Page de paiement d'abonnement pour un directeur DÉJÀ inscrit (après essai) : réutilise l'école
// existante — aucun formulaire à re-remplir. Paiement via le checkout INLINE Ikeepay (iframe pk_…) :
// Ikeepay affiche l'écran de paiement (opérateur, numéro), puis confirme au backend via webhook.
export default function PaySubscriptionPage() {
  const { school, setSchool } = useAuth()
  const navigate = useNavigate()
  const sub = school?.subscription
  const schoolId = school?._id || school?.id

  const [plan, setPlan] = useState(sub?.plan || 'annual')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)
  const [checkout, setCheckout] = useState(null) // { publicKey, amount, currency, reference }

  // Étape 1 : crée l'intention de paiement (référence + clé publique), puis ouvre l'iframe.
  const pay = async () => {
    setErr('')
    if (!schoolId) return setErr("Aucune école associée à votre compte.")
    setBusy(true)
    try {
      const r = await paymentsApi.initiateSubscription({ schoolId, plan })
      if (!r.publicKey) throw new Error("Paiement indisponible : la clé publique Ikeepay n'est pas configurée. Contactez l'administrateur.")
      setCheckout({ publicKey: r.publicKey, amount: r.amount, currency: r.currency || 'XOF', reference: r.reference })
    } catch (e) { setErr(e.message); setBusy(false) }
  }

  // Interroge le statut jusqu'à confirmation (le webhook Ikeepay active l'abonnement côté serveur).
  const pollUntilPaid = async (reference) => {
    setStatus('Confirmation du paiement…')
    let ok = false
    for (let i = 0; i < 45 && !ok; i++) {
      await new Promise((res) => setTimeout(res, 4000))
      try {
        const st = await paymentsApi.status(reference)
        if (st.status === 'approved') ok = true
        else if (st.status === 'rejected') throw new Error('Paiement rejeté')
      } catch (e) { if (e.message === 'Paiement rejeté') throw e }
    }
    if (!ok) throw new Error("Paiement non confirmé à temps. Si vous avez été débité, l'activation se fera sous peu.")
  }

  // Étape 2 : l'iframe signale « success » → on confirme côté serveur puis on rafraîchit l'école.
  const onPaid = async () => {
    const reference = checkout?.reference
    setCheckout(null)
    try {
      await pollUntilPaid(reference)
      setStatus(''); setDone(true)
      try {
        const me = await authApi.me()
        if (me?.school) { setSchool(me.school); localStorage.setItem('katd_school', JSON.stringify(me.school)) }
      } catch { /* best-effort */ }
    } catch (e) { setErr(e.message); setStatus('') } finally { setBusy(false) }
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

      <div className="card p-5 space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Formule</label>
          <select value={plan} onChange={(e) => setPlan(e.target.value)} className="input w-full">
            <option value="annual">Annuel</option>
            <option value="trimestriel">Trimestriel</option>
          </select>
        </div>

        {status && <p className="text-xs text-blue-700 bg-blue-50 rounded-lg p-2 flex items-center gap-2"><Loader2 size={12} className="animate-spin" />{status}</p>}

        <button onClick={pay} disabled={busy || !schoolId} className="btn-primary w-full justify-center">
          {busy ? <><Loader2 size={16} className="animate-spin" /> Traitement…</> : 'Payer maintenant'}
        </button>
        <p className="text-[11px] text-gray-400 text-center">Paiement sécurisé Ikeepay. Choisissez votre opérateur Mobile Money dans la fenêtre de paiement. L'abonnement est activé automatiquement après confirmation.</p>
      </div>

      {checkout && (
        <IkeepayCheckout
          publicKey={checkout.publicKey}
          amount={checkout.amount}
          currency={checkout.currency}
          orderId={checkout.reference}
          onSuccess={onPaid}
          onClose={() => { setCheckout(null); setBusy(false) }}
        />
      )}
    </div>
  )
}
