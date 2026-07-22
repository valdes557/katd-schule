import { useState } from 'react'
import {
  CreditCard, CheckCircle2, Clock, Loader2, DollarSign,
  FileText, Download, Wallet, X, Layers, GraduationCap,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { parentApi, feesApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'

const FMT = (n) => Number(n || 0).toLocaleString('fr-FR')
const STATUS_LABELS = {
  paid: { label: 'Payé', cls: 'bg-green-100 text-green-700' },
  partial: { label: 'Partiel', cls: 'bg-amber-100 text-amber-700' },
  pending: { label: 'En attente', cls: 'bg-gray-100 text-gray-500' },
  overdue: { label: 'En retard', cls: 'bg-red-100 text-red-700' },
}

export default function ParentFinancesPage() {
  const [downloading, setDownloading] = useState(null) // feeId:paymentIndex
  const [payCtx, setPayCtx] = useState(null) // { fee, student, installmentIndex? }

  const feesQ = useCachedFetch(
    '/parent/fees',
    async () => {
      const r = await parentApi.fees()
      return { list: r.data || [], summary: r.summary || {} }
    },
    [],
  )
  const modalitiesQ = useCachedFetch(
    '/parent/pension-modalities',
    async () => (await parentApi.pensionModalities()).data || [],
    [],
  )

  const fees = feesQ.data?.list || []
  const summary = feesQ.data?.summary || {}
  const modalities = modalitiesQ.data || []
  const loading = feesQ.loading

  // Regroupe les frais par enfant (nom + matricule mis en avant)
  const byChild = {}
  for (const f of fees) {
    const sid = f.student?._id || 'inconnu'
    if (!byChild[sid]) byChild[sid] = { student: f.student, fees: [] }
    byChild[sid].fees.push(f)
  }
  const children = Object.values(byChild)

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
    setPayCtx(null)
    feesQ.refetch?.()
    if (paymentIndex !== undefined && paymentIndex !== null) {
      await downloadReceipt(feeId, paymentIndex)
    }
  }

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><CreditCard size={22} className="text-blue-600" /> Pension & Paiements</h1>
          <p className="text-sm text-gray-500">Payez la pension de vos enfants, par tranche, depuis votre portefeuille</p>
        </div>
        <Link to="/dashboard/paiements" className="btn-ghost text-xs border border-gray-200 whitespace-nowrap">Historique complet</Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
          <DollarSign size={20} className="mb-2 opacity-80" />
          <p className="text-2xl font-bold">{FMT(summary.totalDue)} F</p>
          <p className="text-xs text-blue-200">Total des pensions</p>
        </div>
        <div className="card p-4 bg-gradient-to-br from-green-600 to-emerald-600 text-white">
          <CheckCircle2 size={20} className="mb-2 opacity-80" />
          <p className="text-2xl font-bold">{FMT(summary.totalPaid)} F</p>
          <p className="text-xs text-green-200">Total payé</p>
        </div>
        <div className="card p-4 bg-gradient-to-br from-orange-500 to-red-500 text-white">
          <Clock size={20} className="mb-2 opacity-80" />
          <p className="text-2xl font-bold">{FMT(summary.remaining)} F</p>
          <p className="text-xs text-orange-200">Restant à payer</p>
        </div>
      </div>

      {/* Barèmes de pension par classe (lecture) */}
      {modalities.length > 0 && (
        <div className="card p-4">
          <p className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-2"><Layers size={16} className="text-indigo-600" /> Pensions par classe</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {modalities.map((m) => (
              <div key={m._id} className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-800">{m.className}</p>
                  <p className="text-sm font-bold text-indigo-700">{FMT(m.totalAmount)} F</p>
                </div>
                {m.installments?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {m.installments.map((i, idx) => (
                      <span key={idx} className="text-[10px] bg-white border border-gray-100 text-gray-600 rounded-full px-2 py-0.5">{i.label} · {FMT(i.amount)} F</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pensions groupées par enfant */}
      {children.length === 0 ? (
        <div className="text-center py-12 text-gray-400"><FileText size={36} className="mx-auto mb-3 opacity-30" /><p>Aucune pension enregistrée pour vos enfants</p></div>
      ) : (
        <div className="space-y-4">
          {children.map(({ student, fees: childFees }) => (
            <div key={student?._id || 'inconnu'} className="card p-4">
              {/* En-tête enfant : nom + matricule */}
              <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <GraduationCap size={18} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{student?.firstName} {student?.lastName}</p>
                  <p className="text-xs text-gray-500">Matricule : <span className="font-mono font-semibold">{student?.matricule || '—'}</span></p>
                </div>
              </div>

              <div className="space-y-3 mt-3">
                {childFees.map((f) => {
                  const st = STATUS_LABELS[f.status] || STATUS_LABELS.pending
                  const remaining = f.amount - f.paid
                  const isTranches = f.paymentMode === 'tranches' && f.installments?.length > 0
                  return (
                    <div key={f._id} className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-800">{f.label}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs">
                        <span className="text-gray-600">Total : <strong>{FMT(f.amount)} F</strong></span>
                        <span className="text-green-600">Payé : <strong>{FMT(f.paid)} F</strong></span>
                        {remaining > 0 && <span className="text-red-600">Reste : <strong>{FMT(remaining)} F</strong></span>}
                      </div>

                      {/* Tranches : paiement tranche par tranche */}
                      {isTranches && (
                        <div className="mt-2 space-y-1">
                          <p className="text-[10px] font-bold text-gray-500 uppercase">Tranches</p>
                          {f.installments.map((inst, idx) => (
                            <div key={idx} className={`flex items-center gap-2 py-1.5 px-2 rounded-lg ${inst.paid ? 'bg-green-50' : new Date(inst.dueDate) < new Date() ? 'bg-red-50' : 'bg-white border border-gray-100'}`}>
                              <span className="text-[11px]">{inst.paid ? '✅' : '⏳'}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-700">{inst.label}</p>
                                <p className="text-[10px] text-gray-400">{FMT(inst.amount)} F · Échéance : {new Date(inst.dueDate).toLocaleDateString('fr-FR')}</p>
                              </div>
                              {inst.paid ? (
                                <span className="text-[10px] text-green-600 font-semibold">Payée</span>
                              ) : (
                                <button onClick={() => setPayCtx({ fee: f, student, installmentIndex: idx })} className="text-[11px] bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded-lg font-medium flex items-center gap-1">
                                  <Wallet size={11} /> Payer
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Historique des paiements + reçus */}
                      {f.payments?.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <p className="text-[10px] font-bold text-gray-500 mb-1">Historique & reçus</p>
                          {f.payments.map((p, i) => (
                            <div key={i} className="flex items-center justify-between text-[11px] py-1 border-b border-gray-100 last:border-0">
                              <span className="text-gray-500">{new Date(p.date).toLocaleDateString('fr-FR')}</span>
                              <span className="text-gray-500 capitalize">{p.method?.replace('_', ' ')}</span>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-green-600">+{FMT(p.amount)} F</span>
                                <button title="Télécharger le reçu" onClick={() => downloadReceipt(f._id, i)} className="p-1 rounded hover:bg-gray-100 text-gray-500">
                                  <Download size={14} className={downloading === `${f._id}:${i}` ? 'animate-pulse' : ''} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Paiement libre (frais sans tranches) */}
                      {!isTranches && remaining > 0 && (
                        <button onClick={() => setPayCtx({ fee: f, student })} className="mt-2 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors">
                          <Wallet size={14} /> Payer avec mon portefeuille
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {payCtx && <PayWalletModal ctx={payCtx} onClose={() => setPayCtx(null)} onPaid={onPaid} />}
    </div>
  )
}

// Modale de paiement depuis le portefeuille du parent.
// - Tranche : montant figé = celui de la tranche (installmentIndex fourni).
// - Frais libre : le parent saisit le montant.
function PayWalletModal({ ctx, onClose, onPaid }) {
  const { fee, student, installmentIndex } = ctx
  const isTranche = installmentIndex !== undefined && installmentIndex !== null
  const tranche = isTranche ? fee.installments[installmentIndex] : null
  const remaining = Math.max(0, (fee.amount || 0) - (fee.paid || 0))
  const [amount, setAmount] = useState(isTranche ? String(tranche.amount) : String(remaining))
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    setErr('')
    if (!pin) return setErr('Code PIN requis')
    if (!isTranche) {
      const amt = Number(amount)
      if (!amt || amt <= 0) return setErr('Montant invalide')
      if (amt > remaining) return setErr(`Le montant dépasse le reste à payer (${remaining.toLocaleString('fr-FR')} F)`)
    }
    setBusy(true)
    try {
      const payload = isTranche ? { pin, installmentIndex } : { pin, amount: Number(amount) }
      const r = await feesApi.payWallet(fee._id, payload)
      await onPaid(fee._id, r.paymentIndex)
    } catch (e) { setErr(e.message); setBusy(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !busy && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 flex items-center gap-2"><Wallet size={18} className="text-blue-600" /> Payer la pension</h3>
          <button onClick={() => !busy && onClose()} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="bg-indigo-50 rounded-xl p-3 text-sm">
          <p className="font-semibold text-gray-900">{student?.firstName} {student?.lastName}</p>
          <p className="text-xs text-gray-600">Matricule : <span className="font-mono font-semibold">{student?.matricule || '—'}</span></p>
          <p className="text-xs text-gray-600 mt-1">{fee.label}{isTranche ? ` — ${tranche.label}` : ''}</p>
          {isTranche
            ? <p className="text-sm font-bold text-indigo-700 mt-1">Montant de la tranche : {FMT(tranche.amount)} F</p>
            : <p className="text-xs text-gray-600">Reste à payer : <b>{FMT(remaining)} F</b></p>}
        </div>
        {err && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-2 text-xs">{err}</div>}
        {!isTranche && (
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Montant (FCFA)</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="input w-full" placeholder="Montant" />
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Code PIN du portefeuille</label>
          <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} className="input w-full" placeholder="••••" />
        </div>
        <button onClick={submit} disabled={busy} className="btn-primary w-full justify-center">
          {busy ? <><Loader2 size={16} className="animate-spin" /> Traitement...</> : isTranche ? `Payer ${FMT(tranche.amount)} F` : 'Confirmer le paiement'}
        </button>
        <Link to="/dashboard/portefeuille" className="block text-center text-xs text-indigo-600 hover:underline">
          Recharger / gérer mon portefeuille
        </Link>
      </div>
    </div>
  )
}
