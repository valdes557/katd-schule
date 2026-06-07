import { useState } from 'react'
import {
  CreditCard, CheckCircle2, Clock, AlertCircle, Loader2, DollarSign,
  FileText, Download, X,
} from 'lucide-react'
import { parentApi, feesApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'

const STATUS_LABELS = {
  paid: { label: 'Payé', cls: 'bg-green-100 text-green-700' },
  partial: { label: 'Partiel', cls: 'bg-amber-100 text-amber-700' },
  pending: { label: 'En attente', cls: 'bg-gray-100 text-gray-500' },
  overdue: { label: 'En retard', cls: 'bg-red-100 text-red-700' },
}

export default function ParentFinancesPage() {
  const [payModal, setPayModal] = useState(null)
  const [payForm, setPayForm] = useState({ amount: '', method: 'cash', reference: '' })
  const [paying, setPaying] = useState(false)
  const [downloading, setDownloading] = useState(null) // feeId:paymentIndex

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

  const handlePay = async () => {
    if (!payForm.amount || Number(payForm.amount) <= 0) return
    setPaying(true)
    try {
      await parentApi.payFee(payModal._id, { amount: Number(payForm.amount), method: payForm.method, reference: payForm.reference })
      setPayModal(null)
      setPayForm({ amount: '', method: 'cash', reference: '' })
      cache.invalidate('/parent/fees')
      feesQ.refetch()
    } catch (e) {
      alert(e.message)
    }
    setPaying(false)
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
                  </div>
                  {f.status !== 'paid' && (
                    <button onClick={() => { setPayModal(f); setPayForm({ amount: String(remaining), method: 'cash', reference: '' }) }} className="btn-primary text-xs py-1.5 px-3 flex-shrink-0">
                      Payer
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Payment modal */}
      {payModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Effectuer un paiement</h3>
              <button onClick={() => setPayModal(null)} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">{payModal.label} — {payModal.student?.firstName} {payModal.student?.lastName}</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Montant (F CFA)</label>
                <input type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} className="input text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Méthode</label>
                <select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })} className="input text-sm">
                  <option value="cash">Espèces</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="bank">Virement bancaire</option>
                  <option value="online">Paiement en ligne</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Référence (optionnel)</label>
                <input value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} className="input text-sm" placeholder="N° transaction" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setPayModal(null)} className="btn-ghost flex-1 justify-center border border-gray-200">Annuler</button>
              <button onClick={handlePay} disabled={paying} className="btn-primary flex-1 justify-center">
                {paying ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
