import { useState, useCallback } from 'react'
import { X, Loader2, Smartphone, AlertCircle, CheckCircle2 } from 'lucide-react'
import { paymentsApi } from '../../lib/api'
import { COUNTRIES } from '../../constants/countries'

const fmt = (n) => (Number(n) || 0).toLocaleString('fr-FR')

// Hook réutilisable Direct Charge H2H (Server-to-Server) : remplace l'ancien checkout iframe.
// Ouvre une boîte de dialogue native pour saisir Pays / Opérateur / Numéro Mobile Money (+ OTP si requis),
// initie le débit direct de serveur à serveur, et interroge le statut jusqu'à validation.
export function useInlineCheckout() {
  const [checkout, setCheckout] = useState(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  // initiateFn : (momoPayload) => Promise<résultat backend>
  // onPaid : (reference, status) => Promise<void>
  // options : { amount, currency, title } (optionnel)
  const start = useCallback(async (initiateFn, onPaid, options = {}) => {
    setError('')
    setStatus('')
    setCheckout({
      initiateFn,
      onPaid,
      amount: options.amount || null,
      currency: options.currency || 'XAF',
      title: options.title || 'Paiement Mobile Money Direct (H2H)',
    })
  }, [])

  const close = () => {
    if (busy) return
    setCheckout(null)
    setStatus('')
    setError('')
  }

  const poll = async (reference) => {
    setStatus('Demande de débit transmise au réseau. En attente de votre validation...')
    let ok = null
    for (let i = 0; i < 45; i++) {
      await new Promise((res) => setTimeout(res, 3000))
      try {
        const st = await paymentsApi.status(reference)
        if (st && (st.status === 'approved' || st.fulfilled)) {
          ok = st
          break
        }
        if (st && st.status === 'rejected') {
          throw new Error(st.reason || 'Paiement rejeté ou annulé sur votre téléphone')
        }
      } catch (e) {
        if (/rejet|refus|annul/i.test(e.message || '')) throw e
      }
    }
    if (ok) return ok

    // Tentative de confirmation de secours
    try {
      const fb = await paymentsApi.confirmInline(reference)
      if (fb && (fb.status === 'approved' || fb.fulfilled)) return fb
    } catch (_) {}

    throw new Error("Paiement non confirmé à temps. Si vous avez validé le code secret sur votre téléphone, votre compte sera crédité sous peu.")
  }

  const element = checkout ? (
    <DirectChargeModal
      checkout={checkout}
      onClose={close}
      busy={busy}
      setBusy={setBusy}
      status={status}
      setStatus={setStatus}
      error={error}
      setError={setError}
      poll={poll}
      onSuccess={async (ref, st) => {
        const onPaidFn = checkout.onPaid
        setCheckout(null)
        setStatus('')
        setError('')
        await onPaidFn?.(ref, st)
      }}
    />
  ) : null

  return { start, element, busy, status, error, setError }
}

function DirectChargeModal({ checkout, onClose, busy, setBusy, status, setStatus, error, setError, poll, onSuccess }) {
  const [country, setCountry] = useState('CM')
  const [operator, setOperator] = useState('mtn')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [formErr, setFormErr] = useState('')
  const [done, setDone] = useState(false)

  const currentCountry = COUNTRIES.find((c) => c.code === country) || COUNTRIES[0]
  const currentOperators = currentCountry.operators || []

  const handleCountryChange = (cCode) => {
    setCountry(cCode)
    const cObj = COUNTRIES.find((x) => x.code === cCode) || COUNTRIES[0]
    setOperator(cObj.operators[0]?.value || 'mtn')
    setOtp('')
    setFormErr('')
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    setFormErr('')
    setError('')

    const rawPhone = String(phone || '').trim().replace(/[^0-9]/g, '')
    if (!rawPhone) {
      setFormErr('Veuillez renseigner votre numéro Mobile Money.')
      return
    }

    const isOrangeCameroon = country === 'CM' && String(operator).toLowerCase().includes('orange')
    if (isOrangeCameroon && !String(otp || '').trim()) {
      setFormErr("Pour Orange Money Cameroun, composez le #150*4*4# et saisissez ici le code d'autorisation (OTP).")
      return
    }

    setBusy(true)
    setStatus("Initialisation du débit direct auprès d'Ikeepay (API H2H)...")

    try {
      const momoData = {
        phone: rawPhone,
        operator,
        country,
        otp: String(otp || '').trim(),
      }

      // Appelle la fonction d'initiation avec les paramètres Mobile Money saisis
      const res = await checkout.initiateFn(momoData)

      // Cas 1 : Paiement direct déjà approuvé (ex. solde portefeuille)
      if (res && res.confirmed) {
        setDone(true)
        setTimeout(() => onSuccess(res.reference || 'direct', res), 1200)
        return
      }

      // Cas 2 : Lien de redirection externe (ex. Wave ou portail opérateur)
      if (res && res.payment_link) {
        setStatus('Redirection vers la page de paiement sécurisée…')
        window.location.href = res.payment_link
        return
      }

      // Cas 3 : Débit direct USSD / Push notification avec référence
      const reference = res?.reference || res?.external_reference || res?.transaction_id
      if (!reference) {
        throw new Error(res?.message || "Impossible d'initier la transaction Mobile Money.")
      }

      setStatus(`Demande envoyée au +${currentCountry.dial} ${rawPhone} ! Confirmez le débit avec votre code PIN Mobile Money sur votre téléphone…`)
      const finalStatus = await poll(reference)
      setDone(true)
      setTimeout(() => onSuccess(reference, finalStatus), 1200)
    } catch (err) {
      const msg = err.message || 'Erreur lors du débit Mobile Money'
      let friendly = msg
      if (/partenaire|rejet|failed|échec/i.test(msg)) {
        friendly = `L'opérateur Mobile Money (${operator.toUpperCase()}) a rejeté l'initialisation du débit direct (${msg}). Vérifiez votre numéro et code OTP ou réessayez dans un instant.`
      }
      setFormErr(friendly)
      setError(friendly)
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-3">
      <div className="relative w-full max-w-[440px] bg-white rounded-2xl shadow-2xl p-6 space-y-4 max-h-[92vh] overflow-y-auto animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Smartphone size={18} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">{checkout.title || 'Paiement Mobile Money Direct'}</h3>
              {checkout.amount && (
                <p className="text-xs font-semibold text-blue-600">
                  Montant : {fmt(checkout.amount)} {checkout.currency || 'FCFA'}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            aria-label="Fermer"
            className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center transition disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 size={50} className="mx-auto text-emerald-500 animate-bounce" />
            <h4 className="font-bold text-gray-900 text-base">Paiement validé avec succès !</h4>
            <p className="text-xs text-gray-500">Mise à jour de votre compte en cours...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {(formErr || error) && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2 shadow-sm">
                <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
                <span className="flex-1 font-medium">{formErr || error}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Pays</label>
              <select
                value={country}
                onChange={(e) => handleCountryChange(e.target.value)}
                className="input w-full font-medium"
                disabled={busy}
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
                onChange={(e) => { setOperator(e.target.value); setOtp(''); setFormErr('') }}
                className="input w-full"
                disabled={busy}
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
                  onChange={(e) => { setPhone(e.target.value); setFormErr('') }}
                  className="input w-full pl-14"
                  placeholder={currentCountry.placeholder}
                  disabled={busy}
                  required
                />
              </div>
            </div>

            {country === 'CM' && String(operator).toLowerCase().includes('orange') && (
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 flex items-center justify-between">
                  <span>Code d'autorisation Orange Money (OTP) <span className="text-red-500">*</span></span>
                  <span className="text-[10px] font-mono font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">#150*4*4#</span>
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => { setOtp(e.target.value); setFormErr('') }}
                  className="input w-full font-mono font-bold tracking-widest text-center text-lg"
                  placeholder="Ex: 1234"
                  maxLength={6}
                  disabled={busy}
                  required
                />
                <p className="text-[11px] text-amber-900 bg-amber-50 rounded-lg p-2.5 mt-1.5 border border-amber-200 leading-snug">
                  👉 <b>Obligatoire pour Orange Cameroun :</b> Composez <b>#150*4*4#</b> sur votre téléphone pour générer votre code d'autorisation temporaire.
                </p>
              </div>
            )}

            {status && (
              <div className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center gap-2">
                <Loader2 size={16} className="animate-spin shrink-0 text-blue-600" />
                <span className="font-medium leading-relaxed">{status}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="btn-primary w-full justify-center py-2.5 text-sm font-semibold shadow-md"
            >
              {busy ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> Traitement en cours…
                </span>
              ) : (
                `Confirmer le paiement ${checkout.amount ? `(${fmt(checkout.amount)} ${checkout.currency || 'FCFA'})` : ''}`
              )}
            </button>

            <div className="text-[11px] text-emerald-800 bg-emerald-50/80 rounded-xl p-2.5 border border-emerald-100 flex items-start gap-1.5">
              <span>🛡️</span>
              <span className="leading-snug">
                <b>Direct Charge Server-to-Server :</b> Connexion directe et sécurisée à la passerelle Mobile Money Ikeepay. Vos fonds sont crédités sans délai après confirmation.
              </span>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
