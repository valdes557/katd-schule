import { useEffect, useState } from 'react'
import { X, Loader2 } from 'lucide-react'

// Paiement « inline » Ikeepay : ouvre le checkout officiel dans une iframe (méthode pk_live de la doc).
// L'utilisateur paie dans l'iframe (opérateur Mobile Money, etc.), Ikeepay confirme au backend via webhook.
// Props : publicKey (pk_…), amount, currency, orderId (= référence PaymentIntent), onSuccess(), onClose(), redirectUrl?
export default function IkeepayCheckout({ publicKey, amount, currency = 'XOF', orderId, redirectUrl, onSuccess, onClose }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const handler = (e) => {
      // Signaux émis par le checkout Ikeepay.
      if (e.data === 'ikeepay-ready') setReady(true)
      else if (e.data === 'ikeepay-success') onSuccess?.()
      else if (e.data === 'ikeepay-close') onClose?.()
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [onSuccess, onClose])

  const params = new URLSearchParams({
    pk: publicKey,
    amount: String(amount),
    currency,
    order_id: orderId,
  })
  if (redirectUrl) params.set('redirect_url', redirectUrl)
  const src = `https://ikeepay.com/checkout/v1/inline?${params.toString()}`

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-3">
      <div className="relative w-full max-w-[450px] h-[90vh]">
        <button onClick={onClose} aria-label="Fermer"
          className="absolute -top-3 -right-3 z-10 w-9 h-9 rounded-full bg-white shadow-lg flex items-center justify-center text-gray-600 hover:text-gray-900">
          <X size={18} />
        </button>
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80">
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
  )
}
