import { useEffect, useState } from 'react'
import { X, Loader2, Info } from 'lucide-react'

// Paiement « inline » Ikeepay : ouvre le checkout officiel dans une iframe (méthode pk_live de la doc).
// L'utilisateur paie dans l'iframe (opérateur Mobile Money, etc.), Ikeepay confirme au backend via webhook.
// Props : publicKey (pk_…), amount, currency, orderId (= référence PaymentIntent), onSuccess(), onClose(), redirectUrl?
export default function IkeepayCheckout({ publicKey, amount, currency = 'XAF', orderId, redirectUrl, onSuccess, onClose }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const handler = (e) => {
      // Signaux émis par le checkout Ikeepay (string ou objet).
      const d = e.data
      let act = ''
      if (typeof d === 'string') {
        act = d.toLowerCase().trim()
      } else if (d && typeof d === 'object') {
        act = String(d.event || d.type || d.status || d.action || d.message || '').toLowerCase().trim()
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
        onClose?.()
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [onSuccess, onClose])

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

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-3">
      <div className="relative w-full max-w-[450px] h-[92vh] flex flex-col">
        <button onClick={onClose} aria-label="Fermer"
          className="absolute -top-3 -right-3 z-10 w-9 h-9 rounded-full bg-white shadow-lg flex items-center justify-center text-gray-600 hover:text-gray-900 border border-gray-100">
          <X size={18} />
        </button>

        {/* Bannière de guidage pour l'indicatif téléphonique */}
        <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs px-3 py-2 rounded-xl mb-2 flex items-center gap-2 shadow-sm shrink-0">
          <Info size={16} className="text-amber-600 shrink-0" />
          <span><b>Important :</b> Sélectionnez le drapeau de votre pays ou saisissez l'indicatif (ex : <b>+237</b> ou <b>+225</b>).</span>
        </div>

        <div className="relative flex-1 w-full min-h-0">
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80 z-10">
              <Loader2 size={26} className="animate-spin text-blue-600" />
            </div>
          )}
          <iframe
            src={src}
            title="Paiement Ikeepay"
            allow="payment"
            className="w-full h-full border-none bg-white rounded-2xl shadow-2xl"
          />
        </div>
      </div>
    </div>
  )
}

