import { useState } from 'react'
import {
  CreditCard, CheckCircle2, Clock, Loader2, DollarSign,
  FileText, Download, Wallet, X,
} from 'lucide-react'
import { parentApi, feesApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'

const STATUS_LABELS = {
  paid: { label: 'Payé', cls: 'bg-green-100 text-green-700' },
  partial: { label: 'Partiel', cls: 'bg-amber-100 text-amber-700' },
  pending: { label: 'En attente', cls: 'bg-gray-100 text-gray-500' },
  overdue: { label: 'En retard', cls: 'bg-red-100 text-red-700' },
}

export default function ParentFinancesPage() {
  const [downloading, setDownloading] = useState(null) // feeId:paymentIndex
  const [payFee, setPayFee] = useState(null) // frais en cours de paiement portefeuille

  const feesQ = useCachedFetch(
    '/parent/fees',
    async () => {
      const r = await parentApi.fees()
      return { list: r.data || [], summary: r.summary || {} }
    },
    [],
  )

  const fees = feesQ.data?.list || []
  const summary = feesQ.data?.summary || {}
  const loading = feesQ.loading

  const downloadReceipt = async (feeId, paymentIndex) => {
    const key = `${feeId}:${paymentIndex}`
    setDownloading(key)
    try {
      const { blob, filename } = await feesApi.downloadReceipt(feeId, paymentIndex)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (e) { alert(e.message) }
    setDownloading(null)
  }

  // Paiement effectué depuis le portefeuille -> rafraîchit la liste + télécharge le reçu
  const onPaid = async (feeId, paymentIndex) => {
    setPayFee(null)
    feesQ.refetch?.()
    if (paymentIndex !== undefined && paymentIndex !== null) {
      await downloadReceipt(feeId, paymentIndex)
    }
  }

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><CreditCard size={22} className="text-blue-600" /> Finances & Paiements</h1>
        <p className="text-sm text-gray-500">Gérez les frais scolaires de vos enfants</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
          <DollarSign size={20} className="mb-2 opacity-80" />
          <p className="text-2xl font-bold">{(summary.totalDue || 0).toLocaleString()} F</p>
          <p className="text-xs text-blue-200">Total des frais</p>
        </div>
        <div className="card p-4 bg-gradient-to-br from-green-600 to-emerald-600 text-white">
          <CheckCircle2 size={20} className="mb-2 opacity-80" />
          <p className="text-2xl font-bold">{(summary.totalPaid || 0).toLocaleString()} F</p>
          <p className="text-xs text-green-200">Total payé</p>
        </div>
        <div className="card p-4 bg-gradient-to-br from-orange-500 to-red-500 text-white">
          <Clock size={20} className="mb-2 opacity-80" />
          <p className="text-2xl font-bold">{(summary.remaining || 0).toLocaleString()} F</p>
          <p className="text-xs text-orange-200">Restant à payer</p>
        </div>
      </div>

      {/* Fees list */}
      {fees.length === 0 ? (
        <div className="text-center py-12 text-gray-400"><FileText size={36} className="mx-auto mb-3 opacity-30" /><p>Aucun frais enregistré</p></div>
      ) : (
        <div className="space-y-3">
          {fees.map((f) => {
            const st = STATUS_LABELS[f.status] || STATUS_LABELS.pending
            const remaining = f.amount - f.paid
            return (
              <div key={f._id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-gray-900">{f.label}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {f.student?.firstName} {f.student?.lastName} · {f.type} · {f.term || ''}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs">
                      <span className="text-gray-600">Total: <strong>{f.amount?.toLocaleString()} F</strong></span>
                      <span className="text-green-600">Payé: <strong>{f.paid?.toLocaleString()} F</strong></span>
                      {remaining > 0 && <span className="text-red-600">Reste: <strong>{remaining.toLocaleString()} F</strong></span>}
                    </div>

                    {/* Payment history */}
                    {f.payments?.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-gray-100">
                        <p className="text-[10px] font-bold text-gray-500 mb-1">Historique des paiements</p>
                        {f.payments.map((p, i) => (
                          <div key={i} className="flex items-center justify-between text-[11px] py-1 border-b border-gray-50 last:border-0">
                            <span className="text-gray-500">{new Date(p.date).toLocaleDateString('fr-FR')}</span>
                            <span className="text-gray-500 capitalize">{p.method?.replace('_', ' ')}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-green-600">+{p.amount?.toLocaleString()} F</span>
                              <button title="Télécharger le reçu" onClick={() => downloadReceipt(f._id, i)} className="p-1 rounded hover:bg-gray-100 text-gray-500">
                                <Download size={14} className={downloading === `${f._id}:${i}` ? 'animate-pulse' : ''} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {remaining > 0 && (
                      <button onClick={() => setPayFee(f)} className="mt-3 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors">
                        <Wallet size={14} /> Payer avec mon portefeuille
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {payFee && <PayWalletModal fee={payFee} onClose={() => setPayFee(null)} onPaid={onPaid} />}
    </div>
  )
}

// Modale de paiement d'un frais depuis le portefeuille du parent (montant + code PIN)
function PayWalletModal({ fee, onClose, onPaid }) {
  const remaining = Math.max(0, (fee.amount || 0) - (fee.paid || 0))
  const [amount, setAmount] = useState(String(remaining))
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    setErr('')
    const amt = Number(amount)
    if (!amt || amt <= 0) return setErr('Montant invalide')
    if (amt > remaining) return setErr(`Le montant dépasse le reste à payer (${remaining.toLocaleString('fr-FR')} F)`)
    if (!pin) return setErr('Code PIN requis')
    setBusy(true)
    try {
      const r = await feesApi.payWallet(fee._id, { amount: amt, pin })
      await onPaid(fee._id, r.paymentIndex)
    } catch (e) { setErr(e.message); setBusy(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !busy && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 flex items-center gap-2"><Wallet size={18} className="text-blue-600" /> Payer avec mon portefeuille</h3>
          <button onClick={() => !busy && onClose()} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="text-sm text-gray-600">
          <p className="font-medium text-gray-900">{fee.label}</p>
          <p className="text-xs">{fee.student?.firstName} {fee.student?.lastName} — reste à payer : <b>{remaining.toLocaleString('fr-FR')} F</b></p>
        </div>
        {err && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-2 text-xs">{err}</div>}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Montant (FCFA)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="input w-full" placeholder="Montant" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Code PIN du portefeuille</label>
          <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} className="input w-full" placeholder="••••" />
        </div>
        <button onClick={submit} disabled={busy} className="btn-primary w-full justify-center">
          {busy ? <><Loader2 size={16} className="animate-spin" /> Traitement...</> : 'Confirmer le paiement'}
        </button>
      </div>
    </div>
  )
}
