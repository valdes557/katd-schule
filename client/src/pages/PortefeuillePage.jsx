import { useState, useEffect } from 'react'
import { Wallet, Lock, ArrowDownToLine, ArrowUpFromLine, Send, KeyRound, RefreshCw, X, Loader2, Users, Copy, Check, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { walletApi, paymentsApi } from '../lib/api'
import { useInlineCheckout } from '../components/payments/useInlineCheckout'
import { cn } from '../lib/utils'

const fmt = (n) => (Number(n) || 0).toLocaleString('fr-FR')
const COUNTRIES = [
  {
    code: 'CM', name: 'Cameroun 🇨🇲 (+237)', dial: '237', currency: 'XAF', placeholder: '690 00 00 00',
    operators: [
      { value: 'mtn', label: 'MTN Mobile Money' },
      { value: 'orange', label: 'Orange Money' },
    ],
  },
  {
    code: 'CI', name: "Côte d'Ivoire 🇨🇮 (+225)", dial: '225', currency: 'XOF', placeholder: '07 00 00 00 00',
    operators: [
      { value: 'wave', label: 'Wave' },
      { value: 'orange', label: 'Orange Money' },
      { value: 'mtn', label: 'MTN MoMo' },
      { value: 'moov', label: 'Moov Money' },
    ],
  },
  {
    code: 'SN', name: 'Sénégal 🇸🇳 (+221)', dial: '221', currency: 'XOF', placeholder: '77 000 00 00',
    operators: [
      { value: 'wave', label: 'Wave' },
      { value: 'orange', label: 'Orange Money' },
      { value: 'free', label: 'Free Money' },
    ],
  },
  {
    code: 'BJ', name: 'Bénin 🇧🇯 (+229)', dial: '229', currency: 'XOF', placeholder: '97 00 00 00',
    operators: [
      { value: 'mtn', label: 'MTN MoMo' },
      { value: 'moov', label: 'Moov Money' },
      { value: 'celtiis', label: 'Celtiis Cash' },
    ],
  },
  {
    code: 'TG', name: 'Togo 🇹🇬 (+228)', dial: '228', currency: 'XOF', placeholder: '90 00 00 00',
    operators: [
      { value: 'tmoney', label: 'TMoney' },
      { value: 'moov', label: 'Moov Money' },
    ],
  },
  {
    code: 'GA', name: 'Gabon 🇬🇦 (+241)', dial: '241', currency: 'XAF', placeholder: '074 00 00 00',
    operators: [
      { value: 'airtel', label: 'Airtel Money' },
      { value: 'moov', label: 'Moov Money' },
    ],
  },
  {
    code: 'CG', name: 'Congo 🇨🇬 (+242)', dial: '242', currency: 'XAF', placeholder: '06 000 00 00',
    operators: [
      { value: 'airtel', label: 'Airtel Money' },
      { value: 'mtn', label: 'MTN MoMo' },
    ],
  },
  {
    code: 'BF', name: 'Burkina Faso 🇧🇫 (+226)', dial: '226', currency: 'XOF', placeholder: '70 00 00 00',
    operators: [
      { value: 'orange', label: 'Orange Money' },
      { value: 'moov', label: 'Moov Money' },
    ],
  },
  {
    code: 'ML', name: 'Mali 🇲🇱 (+223)', dial: '223', currency: 'XOF', placeholder: '70 00 00 00',
    operators: [
      { value: 'orange', label: 'Orange Money' },
      { value: 'moov', label: 'Moov Money' },
    ],
  },
  {
    code: 'CD', name: 'RD Congo 🇨🇩 (+243)', dial: '243', currency: 'USD', placeholder: '81 000 0000',
    operators: [
      { value: 'mpesa', label: 'M-Pesa' },
      { value: 'orange', label: 'Orange Money' },
      { value: 'airtel', label: 'Airtel Money' },
    ],
  },
]

export default function PortefeuillePage() {
  const { user } = useAuth()
  const isDirector = user?.role === 'directeur'
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [modal, setModal] = useState(null) // 'deposit' | 'withdraw' | 'transfer' | 'transferUser' | 'pin' | 'forgotPin'
  const [teachers, setTeachers] = useState([])
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = async () => {
    try { setLoading(true); const d = await walletApi.me(); setData(d) }
    catch (e) { setErr(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  useEffect(() => { if (modal === 'transfer') walletApi.teachers().then(r => setTeachers(r.teachers || [])).catch(() => {}) }, [modal])

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }

  const copyAccount = () => {
    if (!data?.accountNo) return
    navigator.clipboard?.writeText(data.accountNo).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }).catch(() => {})
  }

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
        {data?.accountNo && (
          <button onClick={copyAccount} title="Copier mon numéro de compte" className="mt-4 inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 transition-colors rounded-lg px-3 py-1.5">
            <span className="text-xs opacity-80">N° de compte</span>
            <span className="font-mono font-bold tracking-wider">{data.accountNo}</span>
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        )}
        <div className="flex gap-4 mt-4 text-xs opacity-90">
          <span>Total reçu : {fmt(data?.totalIn)} F</span>
          <span>Total sorti : {fmt(data?.totalOut)} F</span>
        </div>
      </div>

      {/* Actions — dépôt, transfert et PIN accessibles à tous ; transfert salaire réservé au directeur */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button onClick={() => setModal('deposit')} className="btn-secondary flex flex-col items-center gap-1 py-4"><ArrowDownToLine size={20} /><span className="text-xs">Dépôt</span></button>
        <button onClick={() => setModal('transferUser')} className="btn-secondary flex flex-col items-center gap-1 py-4"><Users size={20} /><span className="text-xs">Transfert</span></button>
        <button onClick={() => setModal('withdraw')} className="btn-secondary flex flex-col items-center gap-1 py-4"><ArrowUpFromLine size={20} /><span className="text-xs">Retrait</span></button>
        {isDirector && <button onClick={() => setModal('transfer')} className="btn-secondary flex flex-col items-center gap-1 py-4"><Send size={20} /><span className="text-xs">Salaire</span></button>}
        <button onClick={() => setModal(data?.hasPin ? 'forgotPin' : 'pin')} className="btn-secondary flex flex-col items-center gap-1 py-4"><KeyRound size={20} /><span className="text-xs">{data?.hasPin ? 'Modifier PIN' : 'Créer PIN'}</span></button>
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
                {t.counterpartyName && (
                  <p className="text-xs text-gray-500">
                    {t.direction === 'credit' ? 'De' : 'Vers'} : <b>{t.counterpartyName}</b>
                    {t.counterpartyAccountNo && <span className="font-mono text-gray-400"> ({t.counterpartyAccountNo})</span>}
                  </p>
                )}
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
  const { user } = useAuth()
  const isMerchant = user?.isMerchant === true
  const inlineCheckout = useInlineCheckout()
  const [depositMethod, setDepositMethod] = useState('direct') // 'direct' (API Payin) | 'inline' (fenêtre Ikeepay)
  const [f, setF] = useState({ amount: '', momoNumber: '', momoOperator: 'mtn', accountName: '', pin: '', confirmPin: '', teacherUserId: '', code: '', newPin: '', accountNo: '', country: 'CM', otp: '' })
  const [status, setStatus] = useState('')
  const [modalError, setModalError] = useState('')
  const [recipient, setRecipient] = useState(null) // { name, role } du destinataire résolu
  const [minWithdrawal, setMinWithdrawal] = useState(100)
  const up = (k) => (e) => { setModalError(''); setF({ ...f, [k]: e.target.value }) }

  const currentCountry = COUNTRIES.find(c => c.code === (f.country || 'CM')) || COUNTRIES[0]
  const currentOperators = currentCountry.operators || []

  useEffect(() => {
    walletApi.getConfig().then((r) => {
      if (r && r.minWithdrawal) setMinWithdrawal(r.minWithdrawal)
    }).catch(() => {})
  }, [])

  // Aperçu des frais de transfert utilisateur (0,25%, arrondi, payés en plus)
  const transferFee = Math.round((Number(f.amount) || 0) * 0.0025)
  const transferTotal = (Number(f.amount) || 0) + transferFee
  // Aperçu de la commission marchand (0,20%, bonus virtuel)
  const merchantCommission = Math.round((Number(f.amount) || 0) * 0.002)
  // Aperçu des frais de retrait (2%, arrondi, déduits du montant reçu)
  const withdrawFee = Math.round((Number(f.amount) || 0) * 0.02)
  const withdrawNet = (Number(f.amount) || 0) - withdrawFee

  // Résout le numéro de compte du destinataire (KS######) -> nom
  const lookupRecipient = async () => {
    const acc = String(f.accountNo || '').trim().toUpperCase()
    setRecipient(null)
    if (!/^KS[0-9]{6}$/i.test(acc)) return
    try { const r = await walletApi.lookup(acc); setRecipient({ name: r.name, role: r.role }) }
    catch (e) { setRecipient({ error: e.message }) }
  }

  const submit = async () => {
    setModalError('')
    onError('')
    inlineCheckout.setError('')
    if (type === 'deposit') {
      const amt = Number(f.amount)
      if (!amt || amt < 100) {
        setModalError('Montant minimum : 100 FCFA')
        onError('Montant minimum : 100 FCFA')
        return
      }

      // Mode 1 : Débit direct via l'API Payin Ikeepay (recharge le solde de décaissement)
      if (depositMethod === 'direct') {
        const rawPhone = String(f.momoNumber || '').trim().replace(/[^0-9]/g, '')
        if (!rawPhone) {
          setModalError('Veuillez saisir votre numéro Mobile Money pour le débit')
          return
        }

        const isOrangeCameroon = (f.country || 'CM') === 'CM' && String(f.momoOperator || '').toLowerCase().includes('orange')
        if (isOrangeCameroon && !String(f.otp || '').trim()) {
          const msg = "Pour Orange Money Cameroun, veuillez composer le #150*4*4# sur votre téléphone et saisir le code d'autorisation (OTP)."
          setModalError(msg)
          onError(msg)
          if (typeof window !== 'undefined' && window.innerWidth < 768) {
            alert(msg)
          }
          return
        }

        setBusy(true)
        setStatus('Envoi de la demande de débit à l\'API Payin Ikeepay…')
        try {
          const res = await walletApi.initiateDeposit({
            amount: amt,
            phone: rawPhone,
            operator: f.momoOperator,
            country: f.country || 'CM',
            otp: String(f.otp || '').trim(),
          })

          if (res.payment_link) {
            setStatus('Redirection vers la page de paiement sécurisée…')
            window.location.href = res.payment_link
            return
          }

          setStatus(`Demande de ${fmt(amt)} FCFA envoyée au +${currentCountry.dial} ${rawPhone} ! Confirmez le débit avec votre code PIN Mobile Money sur votre téléphone…`)

          // Polling automatique pour détecter la validation du débit
          let confirmed = false
          for (let i = 0; i < 40; i++) {
            await new Promise(r => setTimeout(r, 3000))
            try {
              const st = await paymentsApi.status(res.reference)
              if (st && (st.status === 'approved' || st.fulfilled)) {
                confirmed = true
                break
              }
              if (st && st.status === 'rejected') {
                throw new Error(st.reason || 'Paiement refusé ou annulé sur votre téléphone')
              }
            } catch (err) {
              if (/refus|annul|rejet/i.test(err.message)) throw err
            }
          }

          if (confirmed) {
            onDone(`Dépôt de ${fmt(amt)} FCFA validé avec succès ! Votre portefeuille a été crédité.`)
          } else {
            // Rattrapage par confirmation directe
            try {
              const fb = await paymentsApi.confirmInline(res.reference)
              if (fb && (fb.status === 'approved' || fb.fulfilled)) {
                onDone(`Dépôt de ${fmt(amt)} FCFA validé avec succès ! Votre portefeuille a été crédité.`)
                return
              }
            } catch (_) {}
            throw new Error("Paiement en cours de confirmation. Si vous avez déjà validé le code secret sur votre téléphone, votre compte sera crédité sous peu.")
          }
        } catch (e) {
          setModalError(e.message || 'Erreur lors du dépôt')
          onError(e.message || 'Erreur lors du dépôt')
          setStatus('')
          if (typeof window !== 'undefined' && window.innerWidth < 768) {
            alert("Erreur dépôt : " + (e.message || 'Échec'))
          }
        } finally {
          setBusy(false)
        }
        return
      }

      // Mode 2 : Fenêtre Inline
      inlineCheckout.start(
        () => walletApi.initiateDeposit({ amount: amt, country: f.country || 'CM' }),
        async () => { onDone('Dépôt effectué avec succès sur votre portefeuille') }
      )
      return
    }
    setBusy(true)
    try {
      if (type === 'withdraw') {
        if (!f.amount || Number(f.amount) <= 0) throw new Error('Veuillez saisir un montant valide')
        if (Number(f.amount) < minWithdrawal) throw new Error(`Le retrait minimum est de ${fmt(minWithdrawal)} FCFA`)
        if (!f.momoNumber.trim()) throw new Error('Numéro Mobile Money requis')
        if (!f.accountName.trim()) throw new Error('Le nom du titulaire du numéro est obligatoire')
        if (!f.pin) throw new Error('Code PIN requis pour valider le retrait')
        const r = await walletApi.withdraw({ amount: Number(f.amount), momoNumber: f.momoNumber, momoOperator: f.momoOperator, accountName: f.accountName, pin: f.pin, country: f.country || 'CM' })
        onDone(r?.message || 'Demande de retrait enregistrée. Traitement et envoi sous 24h par Ikeepay.')
      } else if (type === 'transfer') {
        if (!f.teacherUserId) throw new Error('Veuillez sélectionner un enseignant')
        if (!f.amount || Number(f.amount) <= 0) throw new Error('Veuillez saisir un montant')
        if (!f.pin) throw new Error('Code PIN requis')
        await walletApi.transfer({ teacherUserId: f.teacherUserId, amount: Number(f.amount), pin: f.pin })
        onDone('Salaire transféré avec succès')
      } else if (type === 'transferUser') {
        if (!f.accountNo.trim()) throw new Error('Numéro de compte destinataire requis')
        if (!f.amount || Number(f.amount) <= 0) throw new Error('Veuillez saisir un montant')
        if (!f.pin) throw new Error('Code PIN requis')
        const r = await walletApi.transferUser({ accountNo: f.accountNo, amount: Number(f.amount), pin: f.pin })
        onDone(r.commission > 0
          ? `Transfert de ${fmt(r.amount)} F effectué (commission +${fmt(r.commission)} F)`
          : `Transfert de ${fmt(r.amount)} F effectué (frais ${fmt(r.fee)} F)`)
      } else if (type === 'pin') {
        if (!f.code) throw new Error('Saisissez le code reçu par email')
        if (!f.pin || !/^[0-9]{4,6}$/.test(String(f.pin))) throw new Error('Le code PIN doit comporter 4 à 6 chiffres')
        if (String(f.pin) !== String(f.confirmPin)) throw new Error('Les codes PIN ne correspondent pas')
        await walletApi.setPin({ code: f.code, pin: f.pin, confirmPin: f.confirmPin })
        onDone('Code PIN créé avec succès')
      } else if (type === 'forgotPin') {
        if (!f.code) throw new Error('Saisissez le code reçu par email')
        if (!f.newPin || !/^[0-9]{4,6}$/.test(String(f.newPin))) throw new Error('Le code PIN doit comporter 4 à 6 chiffres')
        if (String(f.newPin) !== String(f.confirmPin)) throw new Error('Les codes PIN ne correspondent pas')
        await walletApi.resetPin({ code: f.code, newPin: f.newPin, confirmPin: f.confirmPin })
        onDone('Code PIN modifié avec succès')
      }
    } catch (e) {
      setModalError(e.message)
      onError(e.message)
      setStatus('')
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        alert("Erreur de retrait : " + e.message)
      }
    } finally {
      setBusy(false)
    }
  }

  const sendForgotCode = async () => { try { setModalError(''); await walletApi.forgotPin(); setStatus('Code envoyé à votre email') } catch (e) { setModalError(e.message); onError(e.message) } }
  const sendCreateCode = async () => { try { setModalError(''); await walletApi.requestPinCode(); setStatus('Code envoyé à votre email') } catch (e) { setModalError(e.message); onError(e.message) } }

  const titles = { deposit: 'Effectuer un dépôt', withdraw: 'Demande de retrait', transfer: 'Transférer un salaire', transferUser: 'Transférer à un utilisateur', pin: 'Créer un code PIN', forgotPin: 'Modifier le code PIN' }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !busy && setModal(null)}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">{titles[type]}</h3>
          <button onClick={() => !busy && setModal(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {modalError && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2 shadow-sm">
            <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block">Attention :</span>
              <span className="font-medium">{modalError}</span>
            </div>
          </div>
        )}

        {(type === 'deposit' || type === 'withdraw' || type === 'transfer' || type === 'transferUser') && (
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Montant (FCFA)</label>
            <input type="number" value={f.amount} onChange={up('amount')} className="input w-full" placeholder="Ex: 50000" />
          </div>
        )}

        {type === 'transferUser' && (<>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">N° de compte du destinataire (KS930021)</label>
            <input value={f.accountNo} onChange={(e) => setF({ ...f, accountNo: e.target.value.toUpperCase() })} onBlur={lookupRecipient} className="input w-full font-mono tracking-wider" placeholder="KS930021" />
            {recipient?.name && <p className="text-xs text-green-700 mt-1">Destinataire : <b>{recipient.name}</b></p>}
            {recipient?.error && <p className="text-xs text-red-600 mt-1">{recipient.error}</p>}
          </div>
          {Number(f.amount) > 0 && (isMerchant ? (
            <div className="text-xs bg-amber-50 border border-amber-100 rounded-lg p-3 space-y-1">
              <div className="flex justify-between"><span>Montant reçu par le destinataire</span><b>{fmt(Number(f.amount))} F</b></div>
              <div className="flex justify-between text-gray-500"><span>Frais</span><span>Aucun (marchand)</span></div>
              <div className="flex justify-between text-emerald-700"><span>Commission gagnée (0,20%)</span><b>+{fmt(merchantCommission)} F</b></div>
              <div className="flex justify-between border-t border-amber-100 pt-1 mt-1"><span>Total débité de votre solde</span><b>{fmt(Number(f.amount))} F</b></div>
            </div>
          ) : (
            <div className="text-xs bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-1">
              <div className="flex justify-between"><span>Montant reçu par le destinataire</span><b>{fmt(Number(f.amount))} F</b></div>
              <div className="flex justify-between text-gray-500"><span>Frais (0,25%)</span><span>{fmt(transferFee)} F</span></div>
              <div className="flex justify-between border-t border-blue-100 pt-1 mt-1"><span>Total débité de votre solde</span><b>{fmt(transferTotal)} F</b></div>
            </div>
          ))}
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Code PIN</label><input type="password" value={f.pin} onChange={up('pin')} className="input w-full" placeholder="••••" /></div>
        </>)}

        {type === 'deposit' && (<>
          {/* Choix de la méthode : Direct (API Payin) vs Fenêtre sécurisée */}
          <div className="flex bg-gray-100 p-1 rounded-xl gap-1 text-xs">
            <button
              type="button"
              onClick={() => setDepositMethod('direct')}
              className={cn("flex-1 py-1.5 px-2 rounded-lg font-semibold transition flex items-center justify-center gap-1.5", depositMethod === 'direct' ? "bg-white text-emerald-700 shadow-sm" : "text-gray-600 hover:text-gray-900")}
            >
              <span>⚡</span> Débit direct (API Payin)
            </button>
            <button
              type="button"
              onClick={() => setDepositMethod('inline')}
              className={cn("flex-1 py-1.5 px-2 rounded-lg font-semibold transition flex items-center justify-center gap-1.5", depositMethod === 'inline' ? "bg-white text-blue-700 shadow-sm" : "text-gray-600 hover:text-gray-900")}
            >
              <span>💳</span> Fenêtre Ikeepay
            </button>
          </div>

          {depositMethod === 'direct' ? (<>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Pays</label>
              <select
                value={f.country || 'CM'}
                onChange={(e) => {
                  const c = e.target.value
                  const cObj = COUNTRIES.find(x => x.code === c) || COUNTRIES[0]
                  setModalError('')
                  setF({
                    ...f,
                    country: c,
                    momoOperator: cObj.operators[0]?.value || 'mtn',
                  })
                }}
                className="input w-full font-medium"
              >
                {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Opérateur de débit ({currentCountry.currency})</label>
              <select
                value={f.momoOperator}
                onChange={(e) => {
                  setModalError('')
                  setF({ ...f, momoOperator: e.target.value, otp: '' })
                }}
                className="input w-full"
              >
                {currentOperators.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Numéro Mobile Money à débiter</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-gray-400 font-mono font-medium">+{currentCountry.dial}</span>
                <input
                  type="tel"
                  value={f.momoNumber}
                  onChange={up('momoNumber')}
                  className="input w-full pl-14"
                  placeholder={currentCountry.placeholder}
                />
              </div>
            </div>

            {(f.country || 'CM') === 'CM' && String(f.momoOperator || '').toLowerCase().includes('orange') ? (
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 flex items-center justify-between">
                  <span>Code d'autorisation Orange Money (OTP) <span className="text-red-500">*</span></span>
                  <span className="text-[10px] font-mono font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">#150*4*4#</span>
                </label>
                <input
                  type="text"
                  value={f.otp || ''}
                  onChange={up('otp')}
                  className="input w-full font-mono font-bold tracking-widest text-center text-lg"
                  placeholder="Ex: 1234"
                  maxLength={6}
                />
                <p className="text-[11px] text-amber-900 bg-amber-50 rounded-lg p-2.5 mt-1.5 border border-amber-200 leading-snug">
                  👉 <b>Obligatoire pour Orange Cameroun :</b> Composez <b>#150*4*4#</b> sur votre téléphone Orange pour générer votre code d'autorisation temporaire (4 à 6 chiffres) et renseignez-le ici.
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-gray-500 italic px-1">
                ℹ️ Pour MTN : aucune démarche préalable, une invite apparaîtra directement sur votre écran de téléphone pour valider avec votre code PIN secret.
              </p>
            )}

            <div className="text-xs text-emerald-800 bg-emerald-50 rounded-xl p-3 border border-emerald-100 flex items-start gap-2">
              <span className="text-base">📲</span>
              <span className="leading-relaxed">
                <b>Recharge via l'API Payin Ikeepay :</b> En confirmant, {String(f.momoOperator || '').toLowerCase().includes('orange') ? "le débit sera validé grâce à votre code d'autorisation" : "une invite de débit apparaîtra directement sur votre téléphone pour valider les " + (f.amount ? fmt(f.amount) : '...') + " FCFA avec votre code secret Mobile Money"}.
              </span>
            </div>
          </>) : (
            <div className="text-xs text-blue-900 bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <span>💳</span> Paiement sécurisé via portail Ikeepay
              </p>
              <p className="text-gray-600 leading-relaxed">
                Une fenêtre Ikeepay s'ouvrira pour choisir votre méthode de paiement (carte bancaire ou Mobile Money multi-pays).
              </p>
            </div>
          )}
        </>)}

        {type === 'withdraw' && (<>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Pays de retrait</label>
            <select
              value={f.country || 'CM'}
              onChange={(e) => {
                const c = e.target.value
                const cObj = COUNTRIES.find(x => x.code === c) || COUNTRIES[0]
                setModalError('')
                setF({
                  ...f,
                  country: c,
                  momoOperator: cObj.operators[0]?.value || 'mtn',
                })
              }}
              className="input w-full font-medium"
            >
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Opérateur de réception ({currentCountry.currency})</label>
            <select value={f.momoOperator} onChange={up('momoOperator')} className="input w-full">
              {currentOperators.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Numéro Mobile Money</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs text-gray-400 font-mono font-medium">+{currentCountry.dial}</span>
              <input
                type="tel"
                value={f.momoNumber}
                onChange={up('momoNumber')}
                className="input w-full pl-14"
                placeholder={currentCountry.placeholder}
              />
            </div>
          </div>
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Nom du titulaire du numéro <span className="text-red-500">*</span></label><input value={f.accountName} onChange={up('accountName')} className="input w-full" placeholder="Nom du titulaire Mobile Money" required /></div>
          {Number(f.amount) > 0 && (
            <div className="text-xs bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-1">
              <div className="flex justify-between"><span>Montant demandé</span><b>{fmt(Number(f.amount))} FCFA</b></div>
              <div className="flex justify-between text-gray-500"><span>Frais de retrait (2%)</span><span>− {fmt(withdrawFee)} FCFA</span></div>
              <div className="flex justify-between border-t border-blue-100 pt-1 mt-1">
                <span>Vous recevrez</span>
                <b className="text-green-700 font-bold">{fmt(withdrawNet)} {currentCountry.currency}</b>
              </div>
            </div>
          )}
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Code PIN</label><input type="password" value={f.pin} onChange={up('pin')} className="input w-full" placeholder="••••" /></div>
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2">
            Retrait minimum : {fmt(minWithdrawal)} FCFA. Frais de 2% déduits. Traitement et envoi sous 24h par Ikeepay.
          </p>
        </>)}

        {type === 'transfer' && (<>
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Enseignant</label><select value={f.teacherUserId} onChange={up('teacherUserId')} className="input w-full"><option value="">— Choisir —</option>{teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Code PIN</label><input type="password" value={f.pin} onChange={up('pin')} className="input w-full" placeholder="••••" /></div>
        </>)}

        {type === 'pin' && (<>
          <p className="text-xs text-gray-500">Pour votre sécurité, un code de confirmation vous est envoyé par email.</p>
          <button onClick={sendCreateCode} type="button" className="btn-secondary w-full text-sm">Recevoir le code par email</button>
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Code reçu par email</label><input value={f.code} onChange={up('code')} className="input w-full" placeholder="Collez le code" /></div>
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Nouveau code PIN (4-6 chiffres)</label><input type="password" value={f.pin} onChange={up('pin')} className="input w-full" placeholder="••••" /></div>
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Confirmer le code PIN</label><input type="password" value={f.confirmPin} onChange={up('confirmPin')} className="input w-full" placeholder="••••" /></div>
        </>)}

        {type === 'forgotPin' && (<>
          <button onClick={sendForgotCode} type="button" className="btn-secondary w-full text-sm">Recevoir un code par email</button>
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Code reçu par email</label><input value={f.code} onChange={up('code')} className="input w-full" placeholder="Collez le code" /></div>
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Nouveau code PIN</label><input type="password" value={f.newPin} onChange={up('newPin')} className="input w-full" placeholder="••••" /></div>
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Confirmer le nouveau PIN</label><input type="password" value={f.confirmPin} onChange={up('confirmPin')} className="input w-full" placeholder="••••" /></div>
        </>)}

        {modalError && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2 shadow-sm">
            <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
            <span className="flex-1 font-medium">{modalError}</span>
          </div>
        )}
        {inlineCheckout.error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2 shadow-sm">
            <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
            <span className="flex-1">{inlineCheckout.error}</span>
          </div>
        )}
        {inlineCheckout.status && <p className="text-xs text-blue-700 bg-blue-50 rounded-lg p-2 flex items-center gap-2"><Loader2 size={12} className="animate-spin" />{inlineCheckout.status}</p>}
        {status && <p className="text-xs text-blue-700 bg-blue-50 rounded-lg p-2 flex items-center gap-2"><Loader2 size={12} className="animate-spin" />{status}</p>}

        <button onClick={submit} disabled={busy || inlineCheckout.busy} className="btn-primary w-full justify-center">
          {busy || inlineCheckout.busy ? <><Loader2 size={16} className="animate-spin" /> Traitement...</> : 'Confirmer'}
        </button>
      </div>
      {inlineCheckout.element}
    </div>
  )
}
