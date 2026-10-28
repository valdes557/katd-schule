import { useState, useEffect } from 'react'
import {
  Store, Loader2, Coins, Wallet, X, CheckCircle2, TrendingUp, Sparkles, Gift,
  Copy, Check, Users, Send, Search, ArrowUpRight, AlertCircle, Phone, MapPin, User,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { merchantApi, authApi } from '../../lib/api'
import { useInlineCheckout } from '../../components/payments/useInlineCheckout'

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
  const [showTransferCollect, setShowTransferCollect] = useState(false)
  const [successBanner, setSuccessBanner] = useState('')

  const load = async () => {
    try {
      setLoading(true)
      const d = await merchantApi.me()
      setData(d)
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const showMsg = (msg) => {
    setSuccessBanner(msg)
    setTimeout(() => setSuccessBanner(''), 5000)
  }

  // Rafraîchit l'utilisateur global (isMerchant) après activation
  const refreshUser = async () => {
    try {
      const res = await authApi.me()
      if (res?.user) {
        setUser(res.user)
        localStorage.setItem('katd_user', JSON.stringify(res.user))
      }
    } catch (_) {}
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-orange-600" /></div>

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Store className="text-orange-600" size={26} />
          <h1 className="text-xl font-bold text-gray-900">Compte marchand</h1>
        </div>
        {data?.isMerchant && (
          <button
            onClick={() => setShowTransferCollect(true)}
            className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 rounded-xl shadow-xs"
          >
            <Send size={14} /> Transférer vers compte client
          </button>
        )}
      </div>

      {successBanner && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 text-xs sm:text-sm flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{successBanner}</span>
        </div>
      )}

      {err && <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-sm">{err}</div>}

      {data?.referralCode && <ReferralCard code={data.referralCode} count={data.referralCount} earned={data.referralEarned} />}

      {!data?.isMerchant ? (
        /* ── Non marchand : proposition d'activation ── */
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 text-orange-700">
            <Sparkles size={20} /><h2 className="font-bold">Devenez marchand</h2>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            En tant que marchand, vous gagnez automatiquement <b>0,20% de commission</b> sur chaque transfert que vous
            effectuez vers un utilisateur standard, et vous êtes <b>exonéré des frais de transfert de 0,25%</b>.
            (Règle : aucune commission n'est générée lors d'une transaction entre deux comptes marchands).
            L'administration peut également approvisionner votre portefeuille.
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
              <div className="flex items-center gap-2 opacity-90"><Wallet size={16} /><span className="text-xs font-semibold uppercase">Solde Marchand</span></div>
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

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <Send size={16} className="text-orange-600" /> Transfert vers compte client (Collecte ou Portefeuille)
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Alimentez directement le compte d'un client par son numéro de collecte (CL-XXXXXX), compte KATD (KS-XXXXXX), téléphone ou email.
              </p>
            </div>
            <button
              onClick={() => setShowTransferCollect(true)}
              className="btn-primary text-xs py-2 px-4 rounded-xl shrink-0 w-full sm:w-auto justify-center"
            >
              Effectuer un transfert
            </button>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800">
            💡 Vous gagnez <b>0,20%</b> sur chaque transfert ou dépôt vers/depuis un utilisateur standard. Note : lors d'une transaction entre deux comptes marchands, aucune commission n'est générée.
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

      {showTransferCollect && (
        <MerchantTransferToCollectModal
          merchantBalance={data?.balance || 0}
          onClose={() => setShowTransferCollect(false)}
          onSuccess={(msg) => {
            setShowTransferCollect(false)
            showMsg(msg)
            load()
          }}
        />
      )}
    </div>
  )
}

// Modal pour transférer depuis le solde marchand vers le compte d'un client (collecte ou utilisateur)
function MerchantTransferToCollectModal({ merchantBalance, onClose, onSuccess }) {
  const [accountNumber, setAccountNumber] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [clientInfo, setClientInfo] = useState(null)
  const [clientType, setClientType] = useState('')
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')

  const handleLookup = async (accToSearch) => {
    const acc = (accToSearch || accountNumber).trim()
    if (!acc) return null
    setSearching(true)
    setErr('')
    try {
      const res = await merchantApi.lookupCollectClient(acc)
      setClientInfo(res.client)
      setClientType(res.type || 'collect')
      return res.client
    } catch (e) {
      setClientInfo(null)
      setClientType('')
      setErr(e.message || 'Numéro de compte, téléphone ou email introuvable.')
      return null
    } finally {
      setSearching(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErr('')
    const amt = Math.round(Number(amount) || 0)
    if (!accountNumber.trim()) {
      setErr('Veuillez renseigner le numéro de compte, téléphone ou email du client.')
      return
    }

    let targetClient = clientInfo
    if (!targetClient) {
      targetClient = await handleLookup(accountNumber.trim())
      if (!targetClient) return
    }

    if (!amt || amt <= 0) {
      setErr('Veuillez saisir un montant supérieur à 0 FCFA.')
      return
    }
    if (amt > merchantBalance) {
      setErr(`Solde marchand insuffisant (${fmt(merchantBalance)} FCFA disponibles).`)
      return
    }

    setSubmitting(true)
    try {
      const res = await merchantApi.transferToCollectClient({
        accountNumber: accountNumber.trim(),
        amount: amt,
        notes: notes.trim(),
      })
      onSuccess(res.message || 'Transfert effectué avec succès !')
    } catch (e) {
      setErr(e.message || 'Erreur lors du transfert.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <Send size={18} className="text-orange-600" /> Transfert vers compte client
            </h3>
            <p className="text-xs text-gray-500">Débit direct de votre solde marchand</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {err && (
          <div className="p-3 bg-red-50 text-red-800 text-xs rounded-xl flex items-start gap-2 border border-red-200">
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-600" />
            <span>{err}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">
              Numéro de compte client (CL-XXXXXX, KS-XXXXXX, Téléphone ou Email) *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => {
                  setAccountNumber(e.target.value)
                  setClientInfo(null)
                  setClientType('')
                  setErr('')
                }}
                onBlur={() => {
                  if (accountNumber.trim() && !clientInfo && !searching) {
                    handleLookup()
                  }
                }}
                placeholder="Ex: CL-849201, KS930021 ou 690..."
                className="input text-xs w-full font-mono font-bold"
              />
              <button
                type="button"
                onClick={() => handleLookup()}
                disabled={searching || !accountNumber.trim()}
                className="btn-secondary text-xs px-3 py-2 flex items-center gap-1 rounded-xl shrink-0"
              >
                {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                <span>Vérifier</span>
              </button>
            </div>
          </div>

          {clientInfo && (
            <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs space-y-1.5 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                  <CheckCircle2 size={15} className="text-emerald-600" /> Client identifié :
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  clientType === 'collect'
                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}>
                  {clientType === 'collect' ? 'Compte Épargne Collecte' : 'Compte Utilisateur KATD'}
                </span>
              </div>
              <div className="font-black text-gray-900 text-sm flex items-center gap-1.5">
                <User size={14} className="text-gray-500" /> {clientInfo.fullName}
              </div>
              <div className="text-gray-600 font-mono text-[11px]">
                N° Compte : <b>{clientInfo.accountNumber}</b>
              </div>
              {clientInfo.neighborhood && (
                <div className="text-gray-600 flex items-center gap-1.5">
                  <MapPin size={13} className="text-gray-400" /> Quartier : <b>{clientInfo.neighborhood}</b>
                </div>
              )}
              {clientInfo.phone && (
                <div className="text-gray-600 flex items-center gap-1.5">
                  <Phone size={13} className="text-gray-400" /> Contact : <b>{clientInfo.phone}</b>
                </div>
              )}
              {clientInfo.agencyName && (
                <div className="text-[11px] text-gray-500">
                  Agence de collecte : <b>{clientInfo.agencyName}</b>
                </div>
              )}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-gray-700">Montant à transférer (XAF) *</label>
              <span className="text-[11px] text-gray-500">
                Solde : <b className="text-orange-700">{fmt(merchantBalance)} F</b>
              </span>
            </div>
            <input
              type="number"
              min="100"
              step="50"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Ex: 5000"
              className="input text-xs w-full font-bold"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Note ou motif (optionnel)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex : Versement pour collecte journalière"
              className="input text-xs w-full"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn-secondary text-xs py-2 px-4 rounded-xl"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting || searching || !accountNumber.trim() || !amount || Number(amount) <= 0}
              className="btn-primary text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              <span>Confirmer le transfert</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Carte de parrainage : lien partageable .../login?ref=CODE + bonus reçus (70 F/filleul au 1er dépôt).
function ReferralCard({ code, count, earned }) {
  const [copied, setCopied] = useState(false)
  const link = (typeof window !== 'undefined' ? window.location.origin : '') + '/login?ref=' + code
  const copy = () => {
    navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }).catch(() => {})
  }
  return (
    <div className="bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white rounded-2xl p-5 shadow-lg space-y-3">
      <div className="flex items-center gap-2"><Gift size={20} /><h2 className="font-bold">Parrainez et gagnez 70 F</h2></div>
      <p className="text-sm opacity-90 leading-relaxed">
        Partagez votre lien. À chaque premier dépôt d'un filleul, vous recevez <b>70 F</b> sur votre portefeuille.
      </p>
      <div className="bg-white/15 rounded-xl p-3 flex items-center gap-2">
        <span className="text-xs font-mono truncate flex-1">{link}</span>
        <button onClick={copy} className="shrink-0 bg-white text-violet-700 rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1">
          {copied ? <><Check size={14} /> Copié</> : <><Copy size={14} /> Copier</>}
        </button>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <span className="flex items-center gap-1.5"><Users size={15} className="opacity-80" /> {fmt(count)} filleul{Number(count) > 1 ? 's' : ''}</span>
        <span className="flex items-center gap-1.5"><Coins size={15} className="opacity-80" /> {fmt(earned)} F gagnés</span>
      </div>
    </div>
  )
}

function PayModal({ fee, onClose, onDone }) {
  const { start, element, busy, status, error } = useInlineCheckout()
  const pay = () => start((momo = {}) => merchantApi.initiate(momo), async () => { onDone() }, { amount: fee, title: 'Activation compte marchand' })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !busy && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Activation marchand — {fmt(fee)} F</h3>
          <button onClick={() => !busy && onClose()} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-sm text-gray-500">Réglez {fmt(fee)} F par Mobile Money direct (API H2H). Le débit sera validé directement depuis votre numéro Mobile Money.</p>
        {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">{error}</p>}
        {status && <p className="text-xs text-blue-700 bg-blue-50 rounded-lg p-2 flex items-center gap-2"><Loader2 size={12} className="animate-spin" />{status}</p>}
        <button onClick={pay} disabled={busy} className="btn-primary w-full justify-center">
          {busy ? <><Loader2 size={16} className="animate-spin" /> Traitement...</> : <>Payer {fmt(fee)} F</>}
        </button>
      </div>
      {element}
    </div>
  )
}
