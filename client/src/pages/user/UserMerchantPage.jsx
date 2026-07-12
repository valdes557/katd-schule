import { useState, useEffect } from 'react'
import { Store, Loader2, Coins, Wallet, X, CheckCircle2, TrendingUp, Sparkles } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { merchantApi, paymentsApi, authApi } from '../../lib/api'

const fmt = (n) => (Number(n) || 0).toLocaleString('fr-FR')
const OPERATORS = [
  { value: 'mtn', label: 'MTN Mobile Money' },
  { value: 'orange', label: 'Orange Money' },
]

export default function UserMerchantPage() {
  const { setUser } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [showPay, setShowPay] = useState(false)

  const load = async () => {
    try { setLoading(true); const d = await merchantApi.me(); setData(d) }
    catch (e) { setErr(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  // Rafraîchit l'utilisateur global (isMerchant) après activation
  const refreshUser = async () => {
    try { const res = await authApi.me(); if (res?.user) { setUser(res.user); localStorage.setItem('katd_user', JSON.stringify(res.user)) } } catch (_) {}
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-orange-600" /></div>

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Store className="text-orange-600" size={26} />
        <h1 className="text-xl font-bold text-gray-900">Compte marchand</h1>
      </div>

      {err && <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-sm">{err}</div>}

      {!data?.isMerchant ? (
        /* ── Non marchand : proposition d'activation ── */
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 text-orange-700">
            <Sparkles size={20} /><h2 className="font-bold">Devenez marchand</h2>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            En tant que marchand, vous gagnez automatiquement <b>0,20% de commission</b> sur chaque transfert que vous
            effectuez vers un autre utilisateur, et vous êtes <b>exonéré des frais de transfert de 0,25%</b>. L'administration
            peut également approvisionner votre portefeuille.
          </p>
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 flex items-center justify-between">
            <span className="text-sm text-orange-800">Frais d'activation unique</span>
            <span className="text-2xl font-bold text-orange-700">{fmt(data?.fee)} <span className="text-sm">FCFA</span></span>
          </div>
          <button onClick={() => setShowPay(true)} className="btn-primary w-full justify-center">
            <Store size={16} /> Devenir marchand ({fmt(data?.fee)} F)
          </button>
        </div>
      ) : (
        /* ── Marchand : tableau de bord ── */
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-orange-600 to-amber-600 text-white rounded-2xl p-5 shadow-lg sm:col-span-1">
              <div className="flex items-center gap-2 opacity-90"><Wallet size={16} /><span className="text-xs font-semibold uppercase">Solde</span></div>
              <p className="text-2xl font-bold mt-1">{fmt(data.balance)} <span className="text-sm">F</span></p>
              {data.accountNo && <p className="text-xs opacity-80 mt-1 font-mono">{data.accountNo}</p>}
            </div>
            <div className="card p-5 border-l-4 border-emerald-500">
              <div className="flex items-center gap-2 text-emerald-600"><Coins size={16} /><span className="text-xs font-semibold uppercase">Commissions totales</span></div>
              <p className="text-2xl font-bold text-gray-900 mt-1">{fmt(data.commissionTotal)} <span className="text-sm text-gray-400">F</span></p>
            </div>
            <div className="card p-5 border-l-4 border-blue-500">
              <div className="flex items-center gap-2 text-blue-600"><TrendingUp size={16} /><span className="text-xs font-semibold uppercase">Ce mois</span></div>
              <p className="text-2xl font-bold text-gray-900 mt-1">{fmt(data.commissionThisMonth)} <span className="text-sm text-gray-400">F</span></p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800">
            💡 Vous gagnez <b>0,20%</b> sur chaque transfert que vous effectuez depuis votre <a href="/u/portefeuille" className="underline font-medium">portefeuille</a> vers un autre utilisateur. La commission est automatique.
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 text-sm">Historique des commissions</h2>
            </div>
            <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
              {(data.transactions || []).length === 0 && <p className="p-6 text-center text-sm text-gray-400">Aucune commission pour le moment</p>}
              {(data.transactions || []).map((t) => (
                <div key={t._id} className="flex items-center justify-between p-3 text-sm">
                  <div>
                    <p className="font-medium text-gray-800">{t.description || 'Commission marchand'}</p>
                    {t.counterpartyName && <p className="text-xs text-gray-500">Transfert vers <b>{t.counterpartyName}</b></p>}
                    <p className="text-xs text-gray-400">{new Date(t.createdAt).toLocaleString('fr-FR')}</p>
                  </div>
                  <span className="text-emerald-600 font-semibold">+{fmt(t.amount)} F</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {showPay && <PayModal fee={data?.fee} onClose={() => setShowPay(false)} onDone={async () => { setShowPay(false); await refreshUser(); load() }} />}
    </div>
  )
}

function PayModal({ fee, onClose, onDone }) {
  const [f, setF] = useState({ phone: '', operator: 'mtn' })
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [err, setErr] = useState('')

  const submit = async () => {
    setErr('')
    if (!f.phone) { setErr('Numéro Mobile Money requis'); return }
    setBusy(true)
    setStatus('Validez le paiement sur votre téléphone...')
    try {
      const r = await merchantApi.initiate({ phone: f.phone, operator: f.operator })
      let ok = false
      for (let i = 0; i < 45 && !ok; i++) {
        await new Promise((res) => setTimeout(res, 4000))
        try {
          const st = await paymentsApi.status(r.reference)
          if (st.status === 'approved') ok = true
          else if (st.status === 'rejected') throw new Error('Paiement rejeté')
        } catch (e) { if (e.message === 'Paiement rejeté') throw e }
      }
      if (!ok) throw new Error("Paiement non confirmé à temps")
      onDone()
    } catch (e) { setErr(e.message); setStatus('') } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !busy && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Activation marchand — {fmt(fee)} F</h3>
          <button onClick={() => !busy && onClose()} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div><label className="text-xs font-medium text-gray-600 mb-1 block">Opérateur</label>
          <select value={f.operator} onChange={(e) => setF({ ...f, operator: e.target.value })} className="input w-full">
            {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div><label className="text-xs font-medium text-gray-600 mb-1 block">Numéro Mobile Money</label>
          <input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className="input w-full" placeholder="6XX XXX XXX" />
        </div>
        {err && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">{err}</p>}
        {status && <p className="text-xs text-blue-700 bg-blue-50 rounded-lg p-2 flex items-center gap-2"><Loader2 size={12} className="animate-spin" />{status}</p>}
        <button onClick={submit} disabled={busy} className="btn-primary w-full justify-center">
          {busy ? <><Loader2 size={16} className="animate-spin" /> Traitement...</> : <>Payer {fmt(fee)} F</>}
        </button>
      </div>
    </div>
  )
}
