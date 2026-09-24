import { useEffect, useState, useRef } from 'react'
import { X, Loader2, Info, AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react'

// Paiement « inline » Ikeepay : ouvre le checkout officiel dans une iframe (méthode pk_live de la doc).
// L'utilisateur paie dans l'iframe (opérateur Mobile Money, etc.), Ikeepay confirme au backend via webhook.
// Props : publicKey (pk_…), amount, currency, orderId (= référence PaymentIntent), onSuccess(), onClose(), redirectUrl?
export default function IkeepayCheckout({ publicKey, amount, currency = 'XAF', orderId, redirectUrl, onSuccess, onClose }) {
  const [ready, setReady] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const errorRef = useRef('')

  useEffect(() => {
    errorRef.current = ''
    setErrorMsg('')
    setReady(false)

    const handler = (e) => {
      // Signaux émis par le checkout Ikeepay (string ou objet).
      const d = e.data
      let act = ''
      let detailMsg = ''
      if (typeof d === 'string') {
        act = d.toLowerCase().trim()
      } else if (d && typeof d === 'object') {
        act = String(d.event || d.type || d.status || d.action || '').toLowerCase().trim()
        detailMsg = String(d.message || d.error || '')
      }

      // Interception des erreurs de la passerelle Ikeepay (ex: { type: "ikeepay-error", message: "Invalid API Keys" })
      if (act === 'ikeepay-error' || (d && d.type === 'ikeepay-error') || (typeof d === 'string' && d.includes('ikeepay-error'))) {
        const readable = detailMsg || (typeof d === 'string' ? d : 'Erreur passerelle Ikeepay')
        errorRef.current = readable
        setErrorMsg(readable)
        setReady(true)
        return
      }

      if (act === 'ikeepay-ready' || act === 'ready') {
        setReady(true)
      } else if (
        act === 'ikeepay-success' ||
        act === 'success' ||
        act === 'approved' ||
        act === 'completed' ||
        act === 'paid' ||
        act.includes('ikeepay-success')
      ) {
        onSuccess?.()
      } else if (
        act === 'ikeepay-close' ||
        act === 'ikeepay-cancel' ||
        act === 'cancel' ||
        act === 'cancelled'
      ) {
        // IMPORTANT : Si une erreur a été émise par l'iframe (ex: Invalid API Keys),
        // Ikeepay envoie immédiatement "ikeepay-close". On ne doit PAS fermer la fenêtre
        // silencieusement pour laisser l'utilisateur lire le problème et choisir une alternative.
        if (!errorRef.current) {
          onClose?.()
        }
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [onSuccess, onClose, reloadKey])

  const origin = (typeof window !== 'undefined' && window.location?.origin) ? window.location.origin : 'https://katdschool.com'
  const webhookUrl = `${origin}/api/webhook`
  const returnUrl = redirectUrl || `${origin}/api/payments/return?reference=${encodeURIComponent(orderId)}`

  const params = new URLSearchParams({
    pk: publicKey,
    amount: String(amount),
    currency,
    order_id: orderId,
    callback_url: webhookUrl,
    webhook_url: webhookUrl,
    notify_url: webhookUrl,
    redirect_url: returnUrl,
    return_url: returnUrl,
  })
  const src = `https://ikeepay.com/checkout/v1/inline?${params.toString()}`

  const handleCloseClick = () => {
    onClose?.(errorMsg || errorRef.current || null)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-3">
      <div className="relative w-full max-w-[450px] h-[92vh] flex flex-col">
        <button onClick={handleCloseClick} aria-label="Fermer"
          className="absolute -top-3 -right-3 z-10 w-9 h-9 rounded-full bg-white shadow-lg flex items-center justify-center text-gray-600 hover:text-gray-900 border border-gray-100">
          <X size={18} />
        </button>

        {/* Bannière de guidage pour l'indicatif téléphonique */}
        {!errorMsg && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs px-3 py-2 rounded-xl mb-2 flex items-center gap-2 shadow-sm shrink-0">
            <Info size={16} className="text-amber-600 shrink-0" />
            <span><b>Important :</b> Sélectionnez le drapeau de votre pays ou saisissez l'indicatif (ex : <b>+237</b> ou <b>+225</b>).</span>
          </div>
        )}

        <div className="relative flex-1 w-full min-h-0 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          {errorMsg ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-white space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-inner">
                <AlertTriangle size={30} />
              </div>
              <div>
                <h4 className="font-bold text-gray-900 text-base">Passerelle de paiement Ikeepay</h4>
                <p className="text-xs text-red-600 font-semibold mt-1 bg-red-50 py-1 px-2.5 rounded-lg inline-block border border-red-200">
                  Message Ikeepay : {errorMsg}
                </p>
              </div>
              <div className="text-xs text-gray-600 leading-relaxed bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-left space-y-2">
                <p>
                  <b>Que se passe-t-il ?</b>
                  <br />
                  L'interface web hébergée de la passerelle Ikeepay rencontre une indisponibilité technique temporaire sur son guichet en ligne.
                </p>
                <p className="text-blue-700 font-medium">
                  💡 <b>Solution immédiate :</b>
                  <br />
                  Fermez cette fenêtre et choisissez l'onglet <b>Débit direct (API)</b> pour valider directement votre paiement depuis votre numéro Mobile Money.
                </p>
              </div>
              <div className="w-full flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCloseClick}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-xs transition flex items-center justify-center gap-2 shadow-sm"
                >
                  <ArrowLeft size={16} /> Fermer et utiliser le Débit Direct Mobile Money
                </button>
                <button
                  type="button"
                  onClick={() => setReloadKey(k => k + 1)}
                  className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium text-xs transition flex items-center justify-center gap-1.5"
                >
                  <RefreshCw size={14} /> Réessayer le chargement
                </button>
              </div>
            </div>
          ) : (
            <>
              {!ready && (
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-white/90 z-10 p-4 text-center">
                  <Loader2 size={32} className="animate-spin text-blue-600 mb-3" />
                  <p className="text-xs font-medium text-gray-700">Ouverture de la fenêtre sécurisée Ikeepay…</p>
                  <p className="text-[11px] text-gray-400 mt-1">Connexion aux serveurs bancaires...</p>
                </div>
              )}
              <iframe
                key={reloadKey}
                src={src}
                title="Paiement Ikeepay"
                allow="payment"
                className="w-full h-full border-none bg-white rounded-2xl"
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

