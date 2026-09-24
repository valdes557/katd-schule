import { useState, useCallback } from 'react'
import { paymentsApi } from '../../lib/api'
import IkeepayCheckout from './IkeepayCheckout'

// Hook réutilisable : ouvre le checkout INLINE Ikeepay (iframe pk_…) puis interroge le statut
// jusqu'à confirmation par le webhook. Uniformise tous les paiements Mobile Money.
//
// Usage :
//   const { start, element, busy, status, error, setError } = useInlineCheckout()
//   const pay = () => start(
//     () => paymentsApi.initiateXxx({ ...sansPhoneNiOperateur }),  // renvoie { reference, amount, currency, publicKey }
//     async () => { /* après paiement confirmé : rafraîchir, naviguer… */ }
//   )
//   return <>{error && <p>{error}</p>}{status && <p>{status}</p>}<button onClick={pay} disabled={busy}>Payer</button>{element}</>
export function useInlineCheckout() {
  const [checkout, setCheckout] = useState(null) // { publicKey, amount, currency, reference, onPaid }
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  // initiateFn : async () => réponse backend. onPaid : async () => {} après confirmation.
  const start = useCallback(async (initiateFn, onPaid) => {
    setError(''); setStatus(''); setBusy(true)
    try {
      const r = await initiateFn()
      // Cas paiement déjà confirmé côté serveur (ex. portefeuille) → pas d'iframe.
      if (r && r.confirmed) { setBusy(false); await onPaid?.(); return }
      if (!r || !r.publicKey) throw new Error("Clé publique Ikeepay non configurée. Contactez l'administrateur.")
      setCheckout({ publicKey: r.publicKey, amount: r.amount, currency: r.currency || 'XAF', reference: r.reference, onPaid })
    } catch (e) { setError(e.message || 'Paiement impossible'); setBusy(false) }
  }, [])

  const poll = async (reference) => {
    setStatus('Confirmation du paiement auprès de la banque…')
    for (let i = 0; i < 15; i++) {
      await new Promise((res) => setTimeout(res, 3000))
      try {
        const st = await paymentsApi.status(reference)
        if (st.status === 'approved' || st.fulfilled) return st
        if (st.status === 'rejected') throw new Error(st.reason || 'Paiement rejeté')
      } catch (e) { if (/rejet|refus/i.test(e.message || '')) throw e }
    }
    // Dernier essai par confirmation directe avant de signaler un délai
    try {
      const fb = await paymentsApi.confirmInline(reference)
      if (fb && (fb.status === 'approved' || fb.fulfilled)) return fb
    } catch (e) {}
    throw new Error("Paiement non confirmé à temps. Si vous avez été débité, rendez-vous dans l'administration pour valider ou contactez le support.")
  }

  const handleSuccess = async () => {
    const c = checkout
    setCheckout(null)
    if (!c?.reference) {
      setBusy(false)
      return
    }
    setStatus('Paiement reçu ! Crédit immédiat de votre portefeuille…')
    try {
      // 1. Validation directe et instantanée déclenchée par le signal de succès de l'iframe
      let st = null
      try {
        st = await paymentsApi.confirmInline(c.reference)
      } catch (err) {
        console.warn('[useInlineCheckout] Confirmation directe échouée, bascule sur vérification:', err?.message)
      }

      // 2. Si pas encore validé, polling de sécurité court
      if (!st || (st.status !== 'approved' && !st.fulfilled)) {
        st = await poll(c.reference)
      }

      setStatus('')
      await c.onPaid?.(c.reference, st)
    } catch (e) {
      setError(e.message)
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  const handleClose = async () => {
    const c = checkout
    setCheckout(null)
    if (!c?.reference) {
      setBusy(false)
      return
    }
    // Vérifie si le paiement a déjà été validé (par ex. webhook reçu pendant la session)
    try {
      const st = await paymentsApi.status(c.reference)
      if (st && (st.status === 'approved' || st.fulfilled)) {
        setStatus('')
        await c.onPaid?.(c.reference, st)
        return
      }
    } catch (e) {}
    setBusy(false)
  }

  const element = checkout ? (
    <IkeepayCheckout
      publicKey={checkout.publicKey} amount={checkout.amount} currency={checkout.currency}
      orderId={checkout.reference} onSuccess={handleSuccess} onClose={handleClose}
    />
  ) : null

  return { start, element, busy, status, error, setError }
}
