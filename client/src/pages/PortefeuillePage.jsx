import { useState, useEffect } from 'react'
import { Wallet, Lock, ArrowDownToLine, ArrowUpFromLine, Send, KeyRound, RefreshCw, X, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { walletApi } from '../lib/api'

const fmt = (n) => (Number(n) || 0).toLocaleString('fr-FR')
const OPERATORS = [
  { value: 'mtn', label: 'MTN Mobile Money' },
  { value: 'moov', label: 'Moov Money' },
  { value: 'celtiis', label: 'Celtiis Cash' },
]

export default function PortefeuillePage() {
  const { user } = useAuth()
  const isDirector = user?.role === 'directeur'
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [modal, setModal] = useState(null) // 'deposit' | 'withdraw' | 'transfer' | 'pin' | 'forgotPin'
  const [teachers, setTeachers] = useState([])
  const [busy, setBusy] = useState(false)

  const load = async () => {
    try { setLoading(true); const d = await walletApi.me(); setData(d) }
    catch (e) { setErr(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  useEffect(() => { if (modal === 'transfer') walletApi.teachers().then(r => setTeachers(r.teachers || [])).catch(() => {}) }, [modal])

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" /></div>

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="flex items-center gap-3">
        <Wallet className="text-blue-600" size={26} />
        <h1 className="text-xl font-bold text-gray-900">Mon portefeuille</h1>
      </div>

      {msg && <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-3 text-sm">{msg}</div>}
      {err && <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-sm">{err}</div>}

      {/* Solde */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl p-6 shadow-lg">
        <p className="text-sm opacity-80">Solde disponible</p>
        <p className="text-4xl font-bold mt-1">{fmt(data?.balance)} <span className="text-lg font-medium">FCFA</span></p>
        {data?.locked > 0 && <p className="text-xs opacity-80 mt-2 flex items-center gap-1"><Lock size={12} /> {fmt(data.locked)} FCFA en cours de retrait</p>}
        <div className="flex gap-4 mt-4 text-xs opacity-90">
          <span>Total reçu : {fmt(data?.totalIn)} F</span>
          <span>Total sorti : {fmt(data?.totalOut)} F</span>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {isDirector && <button onClick={() => setModal('deposit')} className="btn-secondary flex flex-col items-center gap-1 py-4"><ArrowDownToLine size={20} /><span className="text-xs">Dépôt</span></button>}
        <button onClick={() => setModal('withdraw')} className="btn-secondary flex flex-col items-center gap-1 py-4"><ArrowUpFromLine size={20} /><span className="text-xs">Retrait</span></button>
        {isDirector && <button onClick={() => setModal('transfer')} className="btn-secondary flex flex-col items-center gap-1 py-4"><Send size={20} /><span className="text-xs">Salaire</span></button>}
        {isDirector && <button onClick={() => setModal(data?.hasPin ? 'forgotPin' : 'pin')} className="btn-secondary flex flex-col items-center gap-1 py-4"><KeyRound size={20} /><span className="text-xs">{data?.hasPin ? 'Modifier PIN' : 'Créer PIN'}</span></button>}
      </div>

      {/* Historique */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-sm">Historique des opérations</h2>
          <button onClick={load} className="text-gray-400 hover:text-gray-600"><RefreshCw size={16} /></button>
        </div>
        <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
          {(data?.transactions || []).length === 0 && <p className="p-6 text-center text-sm text-gray-400">Aucune opération</p>}
          {(data?.transactions || []).map((t) => (
            <div key={t._id} className="flex items-center justify-between p-3 text-sm">
              <div>
                <p className="font-medium text-gray-800">{t.description || t.type}</p>
                <p className="text-xs text-gray-400">{new Date(t.createdAt).toLocaleString('fr-FR')}</p>
              </div>
              <span className={t.direction === 'credit' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                {t.direction === 'credit' ? '+' : '−'}{fmt(t.amount)} F
              </span>
            </div>
          ))}
        </div>
      </div>

      {modal && <ActionModal type={modal} setModal={setModal} teachers={teachers} hasPin={data?.hasPin} busy={busy} setBusy={setBusy} onDone={(m) => { setModal(null); flash(m); load() }} onError={setErr} />}
    </div>
  )
}

function ActionModal({ type, setModal, teachers, hasPin, busy, setBusy, onDone, onError }) {
  const [f, setF] = useState({ amount: '', phone: '', operator: 'mtn', momoNumber: '', momoOperator: 'mtn', pin: '', confirmPin: '', teacherUserId: '', code: '', newPin: '' })
  const [status, setStatus] = useState('')
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const submit = async () => {
    onError('')
    setBusy(true)
    try {
      if (type === 'deposit') {
        setStatus('Validez le dépôt sur votre téléphone...')
        const r = await walletApi.initiateDeposit({ amount: Number(f.amount), phone: f.phone, operator: f.operator })
        let ok = false
        for (let i = 0; i < 45 && !ok; i++) {
          await new Promise((res) => setTimeout(res, 4000))
          try { const st = await (await import('../lib/api')).paymentsApi.status(r.reference); if (st.status === 'approved') ok = true; else if (st.status === 'rejected') throw new Error('Dépôt rejeté') } catch (e) { if (e.message === 'Dépôt rejeté') throw e }
        }
        if (!ok) throw new Error("Dépôt non confirmé à temps")
        onDone('Dépôt effectué avec succès')
      } else if (type === 'withdraw') {
        await walletApi.withdraw({ amount: Number(f.amount), momoNumber: f.momoNumber, momoOperator: f.momoOperator, pin: f.pin })
        onDone('Demande de retrait enregistrée. Traitement sous 24h.')
      } else if (type === 'transfer') {
        await walletApi.transfer({ teacherUserId: f.teacherUserId, amount: Number(f.amount), pin: f.pin })
        onDone('Salaire transféré avec succès')
      } else if (type === 'pin') {
        await walletApi.setPin({ pin: f.pin, confirmPin: f.confirmPin })
        onDone('Code PIN créé')
      } else if (type === 'forgotPin') {
        await walletApi.resetPin({ code: f.code, newPin: f.newPin, confirmPin: f.confirmPin })
        onDone('Code PIN modifié')
      }
    } catch (e) { onError(e.message); setStatus('') } finally { setBusy(false) }
  }

  const sendForgotCode = async () => { try { await walletApi.forgotPin(); setStatus('Code envoyé à votre email') } catch (e) { onError(e.message) } }

  const titles = { deposit: 'Effectuer un dépôt', withdraw: 'Demande de retrait', transfer: 'Transférer un salaire', pin: 'Créer un code PIN', forgotPin: 'Modifier le code PIN' }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !busy && setModal(null)}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">{titles[type]}</h3>
          <button onClick={() => !busy && setModal(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {(type === 'deposit' || type === 'withdraw' || type === 'transfer') && (
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Montant (FCFA)</label>
            <input type="number" value={f.amount} onChange={up('amount')} className="input w-full" placeholder="Ex: 50000" />
          </div>
        )}

        {type === 'deposit' && (<>
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Opérateur</label><select value={f.operator} onChange={up('operator')} className="input w-full">{OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Numéro Mobile Money</label><input type="tel" value={f.phone} onChange={up('phone')} className="input w-full" placeholder="01 97 00 00 00" /></div>
        </>)}

        {type === 'withdraw' && (<>
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Opérateur de réception</label><select value={f.momoOperator} onChange={up('momoOperator')} className="input w-full">{OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Numéro Mobile Money</label><input type="tel" value={f.momoNumber} onChange={up('momoNumber')} className="input w-full" placeholder="01 97 00 00 00" /></div>
          {hasPin && <div><label className="text-xs font-medium text-gray-600 mb-1 block">Code PIN</label><input type="password" value={f.pin} onChange={up('pin')} className="input w-full" placeholder="••••" /></div>}
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2">Les retraits sont traités et reçus sous 24h.</p>
        </>)}

        {type === 'transfer' && (<>
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Enseignant</label><select value={f.teacherUserId} onChange={up('teacherUserId')} className="input w-full"><option value="">— Choisir —</option>{teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Code PIN</label><input type="password" value={f.pin} onChange={up('pin')} className="input w-full" placeholder="••••" /></div>
        </>)}

        {type === 'pin' && (<>
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Nouveau code PIN (4-6 chiffres)</label><input type="password" value={f.pin} onChange={up('pin')} className="input w-full" placeholder="••••" /></div>
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Confirmer le code PIN</label><input type="password" value={f.confirmPin} onChange={up('confirmPin')} className="input w-full" placeholder="••••" /></div>
        </>)}

        {type === 'forgotPin' && (<>
          <button onClick={sendForgotCode} type="button" className="btn-secondary w-full text-sm">Recevoir un code par email</button>
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Code reçu par email</label><input value={f.code} onChange={up('code')} className="input w-full" placeholder="Collez le code" /></div>
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Nouveau code PIN</label><input type="password" value={f.newPin} onChange={up('newPin')} className="input w-full" placeholder="••••" /></div>
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Confirmer le nouveau PIN</label><input type="password" value={f.confirmPin} onChange={up('confirmPin')} className="input w-full" placeholder="••••" /></div>
        </>)}

        {status && <p className="text-xs text-blue-700 bg-blue-50 rounded-lg p-2 flex items-center gap-2"><Loader2 size={12} className="animate-spin" />{status}</p>}

        <button onClick={submit} disabled={busy} className="btn-primary w-full justify-center">
          {busy ? <><Loader2 size={16} className="animate-spin" /> Traitement...</> : 'Confirmer'}
        </button>
      </div>
    </div>
  )
}
