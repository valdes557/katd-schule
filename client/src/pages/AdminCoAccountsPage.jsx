// pages/AdminCoAccountsPage.jsx — Gestion des comptes administrateurs associés (60% / 40%)
import { useState, useEffect } from 'react'
import {
  Shield, Lock, Unlock, Mail, ArrowUpRight, Coins, Wallet, History,
  RefreshCw, CheckCircle2, AlertCircle, X, Loader2, Landmark, TrendingDown,
  PieChart, CreditCard, Sparkles, Store, UserCheck, Smartphone, Send, ArrowDownToLine
} from 'lucide-react'
import { adminCoAccountsApi } from '../lib/api'
import SavedMomoSelector from '../components/SavedMomoSelector'

const fmt = (n) => (Number(n) || 0).toLocaleString('fr-FR')

const CATEGORY_ICONS = {
  withdrawal_fee: ArrowUpRight,
  transfer_fee: ArrowDownToLine,
  maintenance_fee: Shield,
  subscription: Landmark,
  ai_subscription: Sparkles,
  collect_fee: Coins,
  merchant_signup: Store,
  agent_signup: UserCheck,
  client_signup: UserCheck,
  shareholder_subscription: PieChart,
}

const CATEGORY_COLORS = {
  withdrawal_fee: 'from-amber-500/10 to-amber-600/5 text-amber-700 border-amber-200',
  transfer_fee: 'from-blue-500/10 to-blue-600/5 text-blue-700 border-blue-200',
  maintenance_fee: 'from-purple-500/10 to-purple-600/5 text-purple-700 border-purple-200',
  subscription: 'from-emerald-500/10 to-emerald-600/5 text-emerald-700 border-emerald-200',
  ai_subscription: 'from-fuchsia-500/10 to-fuchsia-600/5 text-fuchsia-700 border-fuchsia-200',
  collect_fee: 'from-teal-500/10 to-teal-600/5 text-teal-700 border-teal-200',
  merchant_signup: 'from-indigo-500/10 to-indigo-600/5 text-indigo-700 border-indigo-200',
  agent_signup: 'from-rose-500/10 to-rose-600/5 text-rose-700 border-rose-200',
  client_signup: 'from-cyan-500/10 to-cyan-600/5 text-cyan-700 border-cyan-200',
  shareholder_subscription: 'from-amber-500/10 to-yellow-600/5 text-amber-800 border-amber-300',
}

export default function AdminCoAccountsPage() {
  const [summary, setSummary] = useState(null)
  const [loadingSummary, setLoadingSummary] = useState(true)

  // Comptes déverrouillés en mémoire locale (sessions actives par accountKey)
  const [unlockedAccounts, setUnlockedAccounts] = useState({}) // { account_1: accountData, account_2: accountData }
  const [activeAccountKey, setActiveAccountKey] = useState('account_1')

  // Modale OTP
  const [otpModal, setOtpModal] = useState({ open: false, accountKey: '', email: '', code: '', sending: false, verifying: false, error: '', success: '' })

  // Modale Retrait
  const [withdrawModal, setWithdrawModal] = useState({
    open: false,
    accountKey: '',
    amount: '',
    method: 'momo',
    phone: '',
    operator: 'mtn',
    accountName: '',
    targetWalletAccountNo: '',
    notes: '',
    submitting: false,
    error: '',
  })

  // État suppression code secours
  const [disablingPin, setDisablingPin] = useState(false)

  // Bannière notification
  const [banner, setBanner] = useState({ text: '', type: 'success' })

  const showBanner = (text, type = 'success') => {
    setBanner({ text, type })
    setTimeout(() => setBanner({ text: '', type: 'success' }), 6000)
  }

  const loadSummary = async () => {
    try {
      setLoadingSummary(true)
      const res = await adminCoAccountsApi.getSummary()
      setSummary(res)
    } catch (err) {
      showBanner(err.message || 'Erreur lors du chargement des données', 'error')
    } finally {
      setLoadingSummary(false)
    }
  }

  useEffect(() => {
    loadSummary()
  }, [])

  // Demander un code OTP par email
  const handleOpenAccount = async (accountKey, email) => {
    setOtpModal({
      open: true,
      accountKey,
      email,
      code: '',
      sending: true,
      verifying: false,
      error: '',
      success: '',
    })

    try {
      const res = await adminCoAccountsApi.requestOtp(accountKey)
      setOtpModal((prev) => ({
        ...prev,
        sending: false,
        success: res.message || `Code de vérification envoyé à ${email}`,
      }))
    } catch (err) {
      setOtpModal((prev) => ({
        ...prev,
        sending: false,
        error: err.message || "Erreur lors de l'envoi du code",
      }))
    }
  }

  // Suppression définitive du code d'urgence 19970 (Compte 2)
  const handleDisableEmergencyPin = async () => {
    const ok = window.confirm(
      "Êtes-vous sûr de vouloir supprimer définitivement le mot de passe d'urgence 19970 ? Vous devrez obligatoirement utiliser le code reçu par email pour vos prochaines connexions."
    )
    if (!ok) return

    try {
      setDisablingPin(true)
      const res = await adminCoAccountsApi.disableEmergencyPin()
      if (res.account) {
        setUnlockedAccounts((prev) => ({
          ...prev,
          account_2: res.account,
        }))
      }
      showBanner(res.message || 'Code de secours supprimé définitivement avec succès.', 'success')
    } catch (err) {
      showBanner(err.message || 'Erreur lors de la suppression du code.', 'error')
    } finally {
      setDisablingPin(false)
    }
  }

  // Vérifier le code OTP saisi
  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    if (!otpModal.code || otpModal.code.trim().length < 4) {
      setOtpModal((prev) => ({ ...prev, error: 'Veuillez saisir le code reçu par email.' }))
      return
    }

    setOtpModal((prev) => ({ ...prev, verifying: true, error: '' }))
    try {
      const res = await adminCoAccountsApi.verifyOtp(otpModal.accountKey, otpModal.code.trim())
      setUnlockedAccounts((prev) => ({
        ...prev,
        [otpModal.accountKey]: res.account,
      }))
      setActiveAccountKey(otpModal.accountKey)
      setOtpModal({ open: false, accountKey: '', email: '', code: '', sending: false, verifying: false, error: '', success: '' })
      showBanner(`Compte déverrouillé avec succès !`, 'success')
    } catch (err) {
      setOtpModal((prev) => ({ ...prev, verifying: false, error: err.message || 'Code invalide ou expiré' }))
    }
  }

  // Verrouiller un compte
  const handleLockAccount = (accountKey) => {
    setUnlockedAccounts((prev) => {
      const next = { ...prev }
      delete next[accountKey]
      return next
    })
    showBanner(`Le compte a été reverrouillé.`, 'success')
  }

  // Ouvrir la modale de retrait
  const handleOpenWithdraw = (accountKey) => {
    const acc = unlockedAccounts[accountKey]
    if (!acc) return
    setWithdrawModal({
      open: true,
      accountKey,
      amount: '',
      method: 'momo',
      phone: '',
      operator: 'mtn',
      accountName: '',
      targetWalletAccountNo: '',
      notes: '',
      submitting: false,
      error: '',
    })
  }

  // Soumettre le retrait
  const handleSubmitWithdraw = async (e) => {
    e.preventDefault()
    const amt = Number(withdrawModal.amount)
    const acc = unlockedAccounts[withdrawModal.accountKey]
    if (!amt || amt <= 0) {
      setWithdrawModal((prev) => ({ ...prev, error: 'Veuillez saisir un montant valide.' }))
      return
    }
    if (amt > (acc?.balance || 0)) {
      setWithdrawModal((prev) => ({ ...prev, error: `Le montant dépasse le solde disponible (${fmt(acc?.balance || 0)} FCFA).` }))
      return
    }
    if (withdrawModal.method === 'momo' && !withdrawModal.phone.trim()) {
      setWithdrawModal((prev) => ({ ...prev, error: 'Numéro de téléphone requis pour le retrait Mobile Money.' }))
      return
    }

    setWithdrawModal((prev) => ({ ...prev, submitting: true, error: '' }))
    try {
      const res = await adminCoAccountsApi.withdraw({
        accountKey: withdrawModal.accountKey,
        amount: amt,
        method: withdrawModal.method,
        phone: withdrawModal.phone.trim(),
        operator: withdrawModal.operator,
        accountName: withdrawModal.accountName.trim(),
        targetWalletAccountNo: withdrawModal.targetWalletAccountNo.trim(),
        notes: withdrawModal.notes.trim(),
      })

      // Mise à jour de l'état déverrouillé
      if (res.account) {
        setUnlockedAccounts((prev) => ({
          ...prev,
          [withdrawModal.accountKey]: res.account,
        }))
      }
      setWithdrawModal({ open: false, accountKey: '', amount: '', method: 'momo', phone: '', operator: 'mtn', accountName: '', targetWalletAccountNo: '', notes: '', submitting: false, error: '' })
      showBanner(res.message || `Retrait de ${fmt(amt)} FCFA effectué avec succès !`, 'success')
      loadSummary()
    } catch (err) {
      setWithdrawModal((prev) => ({ ...prev, submitting: false, error: err.message || 'Erreur lors du retrait' }))
    }
  }

  const shareStats = summary?.shareStats
  const totalExt = shareStats?.totalExternalShares || 0
  const activeAccount = unlockedAccounts[activeAccountKey]

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
              <Shield size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                Gestion des comptes administrateur
              </h1>
              <p className="text-xs sm:text-sm text-gray-500">
                Comptes associés officiels (60% / 40%), classification des 8 flux de frais et sécurité OTP par email
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={loadSummary}
          disabled={loadingSummary}
          className="btn-secondary text-xs self-start sm:self-auto flex items-center gap-2 py-2 px-3.5 rounded-xl"
        >
          <RefreshCw size={14} className={loadingSummary ? 'animate-spin' : ''} />
          <span>Actualiser</span>
        </button>
      </div>

      {banner.text && (
        <div className={`p-4 rounded-2xl text-sm font-medium flex items-center gap-3 border shadow-sm ${
          banner.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
        }`}>
          {banner.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{banner.text}</span>
        </div>
      )}

      {/* Bannière de déduction dynamique des actions (Associés / Actionnaires) */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-xl border border-indigo-900/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                Actionnariat & Dilution Automatique
              </span>
              <span className="text-xs text-indigo-300 font-medium">10% d'actions mises en vente</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
              Répartition dynamique des parts administratives
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Pour chaque 1% d'action souscrit par un associé, le Compte 1 cède automatiquement <b>0,60%</b> et le Compte 2 cède <b>0,40%</b>.
              Les pourcentages nets ci-dessous s'ajustent en temps réel.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 bg-white/5 border border-white/10 rounded-2xl p-3.5 text-center">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Actions Associés</span>
              <span className="text-lg sm:text-xl font-black text-amber-400">{totalExt}%</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">sur 10% max</span>
            </div>
            <div className="border-x border-white/10 px-2">
              <span className="text-[10px] uppercase font-bold text-indigo-300 block">Compte 1 Net</span>
              <span className="text-lg sm:text-xl font-black text-emerald-400">
                {shareStats ? `${shareStats.compte1.currentPercent}%` : '60%'}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {shareStats ? `- ${shareStats.compte1.deductionPercent}%` : '- 0%'}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-indigo-300 block">Compte 2 Net</span>
              <span className="text-lg sm:text-xl font-black text-emerald-400">
                {shareStats ? `${shareStats.compte2.currentPercent}%` : '40%'}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {shareStats ? `- ${shareStats.compte2.deductionPercent}%` : '- 0%'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Cartes d'accès aux 2 comptes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* COMPTE 1 */}
        <div className={`card p-5 sm:p-6 rounded-3xl border transition-all ${
          unlockedAccounts.account_1
            ? 'border-emerald-300 bg-gradient-to-br from-emerald-50/40 via-white to-white shadow-md ring-2 ring-emerald-500/20'
            : 'border-gray-200 bg-white hover:border-indigo-300 shadow-sm'
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm ${
                unlockedAccounts.account_1 ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white'
              }`}>
                60%
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-gray-900">Compte 1 (Principal)</h3>
                  {unlockedAccounts.account_1 ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                      <Unlock size={10} /> Déverrouillé
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-gray-100 text-gray-600 border border-gray-200 flex items-center gap-1">
                      <Lock size={10} /> Verrouillé
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                  <Mail size={12} className="text-gray-400" />
                  <span className="font-mono font-medium">tankoujohnson@gmail.com</span>
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-gray-400 block">Part nette actuelle</span>
              <span className="text-base font-black text-indigo-700">
                {shareStats ? `${shareStats.compte1.currentPercent}%` : '60.00%'}
              </span>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
            {unlockedAccounts.account_1 ? (
              <>
                <div>
                  <span className="text-[11px] font-bold text-gray-500 block">Solde disponible</span>
                  <span className="text-xl font-black text-emerald-600">
                    {fmt(unlockedAccounts.account_1.balance)} <span className="text-xs font-normal">FCFA</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setActiveAccountKey('account_1'); handleOpenWithdraw('account_1') }}
                    className="btn-primary text-xs py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5"
                  >
                    <ArrowUpRight size={14} /> Retirer
                  </button>
                  <button
                    onClick={() => handleLockAccount('account_1')}
                    className="btn-secondary text-xs py-2 px-3 text-gray-600 hover:text-red-600 rounded-xl font-bold"
                    title="Verrouiller ce compte"
                  >
                    <Lock size={14} />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
                <p className="text-xs text-gray-500">
                  Validation obligatoire par <b>code OTP</b> envoyé par email.
                </p>
                <button
                  onClick={() => handleOpenAccount('account_1', 'tankoujohnson@gmail.com')}
                  className="btn-primary text-xs py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-1.5 shrink-0"
                >
                  <Unlock size={14} /> Ouvrir le compte
                </button>
              </div>
            )}
          </div>
        </div>

        {/* COMPTE 2 */}
        <div className={`card p-5 sm:p-6 rounded-3xl border transition-all ${
          unlockedAccounts.account_2
            ? 'border-emerald-300 bg-gradient-to-br from-emerald-50/40 via-white to-white shadow-md ring-2 ring-emerald-500/20'
            : 'border-gray-200 bg-white hover:border-purple-300 shadow-sm'
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm ${
                unlockedAccounts.account_2 ? 'bg-emerald-600 text-white' : 'bg-purple-600 text-white'
              }`}>
                40%
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-gray-900">Compte 2 (Associé)</h3>
                  {unlockedAccounts.account_2 ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                      <Unlock size={10} /> Déverrouillé
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-gray-100 text-gray-600 border border-gray-200 flex items-center gap-1">
                      <Lock size={10} /> Verrouillé
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                  <Mail size={12} className="text-gray-400" />
                  <span className="font-mono font-medium">valdeslando15@gmail.com</span>
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-gray-400 block">Part nette actuelle</span>
              <span className="text-base font-black text-purple-700">
                {shareStats ? `${shareStats.compte2.currentPercent}%` : '40.00%'}
              </span>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
            {unlockedAccounts.account_2 ? (
              <>
                <div>
                  <span className="text-[11px] font-bold text-gray-500 block">Solde disponible</span>
                  <span className="text-xl font-black text-emerald-600">
                    {fmt(unlockedAccounts.account_2.balance)} <span className="text-xs font-normal">FCFA</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setActiveAccountKey('account_2'); handleOpenWithdraw('account_2') }}
                    className="btn-primary text-xs py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5"
                  >
                    <ArrowUpRight size={14} /> Retirer
                  </button>
                  <button
                    onClick={() => handleLockAccount('account_2')}
                    className="btn-secondary text-xs py-2 px-3 text-gray-600 hover:text-red-600 rounded-xl font-bold"
                    title="Verrouiller ce compte"
                  >
                    <Lock size={14} />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
                <p className="text-xs text-gray-500">
                  Validation par <b>code OTP</b> (ou mot de passe d'urgence).
                </p>
                <button
                  onClick={() => handleOpenAccount('account_2', 'valdeslando15@gmail.com')}
                  className="btn-primary text-xs py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold flex items-center gap-1.5 shrink-0"
                >
                  <Unlock size={14} /> Ouvrir le compte
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Switcher de compte déverrouillé si les deux ou l'un d'eux est ouvert */}
      {(unlockedAccounts.account_1 || unlockedAccounts.account_2) && (
        <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
          {unlockedAccounts.account_1 && (
            <button
              onClick={() => setActiveAccountKey('account_1')}
              className={`text-xs font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
                activeAccountKey === 'account_1'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Unlock size={12} /> Vue Compte 1 (tankoujohnson@gmail.com)
            </button>
          )}
          {unlockedAccounts.account_2 && (
            <button
              onClick={() => setActiveAccountKey('account_2')}
              className={`text-xs font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
                activeAccountKey === 'account_2'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Unlock size={12} /> Vue Compte 2 (valdeslando15@gmail.com)
            </button>
          )}
        </div>
      )}

      {/* ESPACE DU COMPTE ACTIF DÉVERROUILLÉ */}
      {activeAccount ? (
        <div className="space-y-6">
          {/* Alerte & Suppression du mot de passe de secours 19970 (Compte 2) */}
          {activeAccountKey === 'account_2' && activeAccount?.emergencyPinActive && (
            <div className="card p-4 sm:p-5 rounded-3xl border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-amber-50/40 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Shield size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-gray-900">Mot de passe de secours d'urgence actif</h4>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 border border-amber-300 font-mono tracking-wider">
                      19970
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 max-w-2xl leading-relaxed">
                    Ce mot de passe d'urgence à 5 chiffres vous permet d'accéder à ce compte en l'absence de réception d'emails OTP. Une fois que vous commencez de nouveau à recevoir le code OTP par email, vous pouvez supprimer ce code ci-contre.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDisableEmergencyPin}
                disabled={disablingPin}
                className="btn-secondary text-xs py-2 px-3.5 rounded-xl border-amber-300 text-amber-900 hover:bg-amber-100 font-bold shrink-0 self-start sm:self-center flex items-center gap-1.5 transition-all shadow-2xs"
                title="Supprimer définitivement ce code de secours"
              >
                {disablingPin ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                <span>Supprimer le code 19970</span>
              </button>
            </div>
          )}

          {/* Cartes de synthèse financière */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-200">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">Solde disponible</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl sm:text-3xl font-black text-emerald-700">{fmt(activeAccount.balance)}</span>
                <span className="text-xs font-bold text-emerald-600">FCFA</span>
              </div>
              <button
                onClick={() => handleOpenWithdraw(activeAccountKey)}
                className="mt-3 w-full py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
              >
                <ArrowUpRight size={14} /> Effectuer un retrait
              </button>
            </div>

            <div className="card p-5 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border border-blue-200">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 block">Total cumulé perçu</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl sm:text-3xl font-black text-blue-700">{fmt(activeAccount.totalEarned)}</span>
                <span className="text-xs font-bold text-blue-600">FCFA</span>
              </div>
              <p className="text-[11px] text-blue-600/80 mt-3 flex items-center gap-1 font-medium">
                <PieChart size={13} /> Part attribuée : {activeAccount.baseSharePercent}% des revenus
              </p>
            </div>

            <div className="card p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-200">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 block">Total retraits effectués</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl sm:text-3xl font-black text-amber-700">{fmt(activeAccount.totalWithdrawn)}</span>
                <span className="text-xs font-bold text-amber-600">FCFA</span>
              </div>
              <p className="text-[11px] text-amber-600/80 mt-3 flex items-center gap-1 font-medium">
                <History size={13} /> {(activeAccount.withdrawals || []).length} retrait(s) validé(s)
              </p>
            </div>
          </div>

          {/* CLASSIFICATION DES 10 CATÉGORIES DE FRAIS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Ventilation des 10 flux de frais plateforme ({activeAccount.baseSharePercent}%)
                </h3>
                <p className="text-xs text-gray-500">
                  Tous les flux de frais prélevés sur la plateforme sont classés et répartis automatiquement.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {(activeAccount.categories || []).map((cat, idx) => {
                const IconComponent = CATEGORY_ICONS[cat.key] || Coins
                const colorCls = CATEGORY_COLORS[cat.key] || 'from-gray-500/10 to-gray-600/5 text-gray-700 border-gray-200'

                return (
                  <div
                    key={cat.key}
                    className={`card p-4 rounded-2xl border bg-gradient-to-br ${colorCls} transition-all hover:shadow-xs`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-8 h-8 rounded-xl bg-white/80 shadow-2xs flex items-center justify-center shrink-0">
                        <IconComponent size={16} />
                      </div>
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-white/80 border border-current">
                        #{idx + 1}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-gray-900 mt-2.5 line-clamp-2 min-h-[32px]">
                      {cat.label}
                    </h4>

                    <div className="mt-3 pt-2.5 border-t border-current/10 flex items-baseline justify-between">
                      <div>
                        <span className="text-[10px] text-gray-500 block">Part {activeAccount.baseSharePercent}%</span>
                        <span className="text-sm font-black text-gray-900">{fmt(cat.totalAmount)} FCFA</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-gray-500 block">Opérations</span>
                        <span className="text-xs font-bold text-gray-700">{cat.count}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* TABLEAUX : MOUVEMENTS ET RETRAITS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Grand Livre des Revenus */}
            <div className="card p-5 rounded-2xl border border-gray-200 bg-white shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Coins size={16} className="text-indigo-600" />
                  Dernières écritures reçues ({activeAccount.baseSharePercent}%)
                </h4>
                <span className="text-[11px] text-gray-400">50 dernières opérations</span>
              </div>

              <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-gray-50 text-gray-500 uppercase text-[10px] font-bold border-b border-gray-200">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Catégorie</th>
                      <th className="py-2.5 px-3 text-right">Plateforme</th>
                      <th className="py-2.5 px-3 text-right">Part reçue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(activeAccount.recentLedger || []).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-gray-400 text-xs">
                          Aucun revenu enregistré pour l'instant.
                        </td>
                      </tr>
                    ) : (
                      (activeAccount.recentLedger || []).map((entry, i) => (
                        <tr key={i} className="hover:bg-gray-50/80">
                          <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">
                            {new Date(entry.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-gray-800 block truncate max-w-[150px]" title={entry.description}>
                              {entry.description || entry.category}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right text-gray-500 whitespace-nowrap">
                            {fmt(entry.totalPlatformAmount)} F
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-600 whitespace-nowrap">
                            +{fmt(entry.accountShareAmount)} F
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Historique des Retraits */}
            <div className="card p-5 rounded-2xl border border-gray-200 bg-white shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <History size={16} className="text-amber-600" />
                  Historique des retraits de ce compte
                </h4>
                <button
                  onClick={() => handleOpenWithdraw(activeAccountKey)}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                >
                  <ArrowUpRight size={13} /> Nouveau retrait
                </button>
              </div>

              <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-gray-50 text-gray-500 uppercase text-[10px] font-bold border-b border-gray-200">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Mode</th>
                      <th className="py-2.5 px-3">Bénéficiaire / Compte</th>
                      <th className="py-2.5 px-3 text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(activeAccount.withdrawals || []).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-gray-400 text-xs">
                          Aucun retrait effectué pour le moment.
                        </td>
                      </tr>
                    ) : (
                      (activeAccount.withdrawals || []).map((w, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/80">
                          <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">
                            {new Date(w.withdrawnAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-gray-100 text-gray-700">
                              {w.method === 'momo' ? `Momo ${w.operator || ''}` : 'Portefeuille'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-gray-700">
                            {w.method === 'momo' ? (
                              <div>
                                <span className="font-semibold">{w.phone}</span>
                                {w.accountName && <span className="text-gray-400 text-[11px] block">{w.accountName}</span>}
                                {w.providerRef && <span className="text-[10px] font-mono text-emerald-600 block">Réf : {w.providerRef}</span>}
                              </div>
                            ) : (
                              <div>
                                <span className="font-semibold">
                                  {w.targetWalletAccountNo ? `Compte ${w.targetWalletAccountNo}` : 'Portefeuille Admin'}
                                </span>
                                {w.targetUserName && <span className="text-gray-400 text-[11px] block">{w.targetUserName}</span>}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-rose-600 whitespace-nowrap">
                            -{fmt(w.amount)} FCFA
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-12 text-center rounded-3xl border border-gray-200 bg-gray-50/50 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-inner">
            <Lock size={28} />
          </div>
          <h3 className="text-base font-bold text-gray-800">
            Comptes verrouillés par mesure de sécurité
          </h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
            Pour consulter le grand livre des frais, le détail des flux et effectuer un retrait, cliquez sur <b>« Ouvrir le compte »</b> ci-dessus. Un code de sécurité unique sera immédiatement envoyé par email.
          </p>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODALE : VALIDATION OTP PAR EMAIL */}
      {/* ───────────────────────────────────────────────────────────── */}
      {otpModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-5 animate-scale-up">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <Mail size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Vérification de sécurité</h3>
                  <p className="text-xs text-gray-500">Accès au {otpModal.accountKey === 'account_1' ? 'Compte 1 (60%)' : 'Compte 2 (40%)'}</p>
                </div>
              </div>
              <button
                onClick={() => setOtpModal({ open: false, accountKey: '', email: '', code: '', sending: false, verifying: false, error: '', success: '' })}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-900 space-y-1">
              <p>Un code de validation à 6 chiffres a été expédié à l'adresse :</p>
              <p className="font-mono font-bold text-indigo-700">{otpModal.email}</p>
              <p className="text-[11px] text-indigo-600/80">Ce code est valable pendant 10 minutes.</p>
            </div>

            {otpModal.error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{otpModal.error}</span>
              </div>
            )}

            {otpModal.success && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 flex items-center gap-2">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{otpModal.success}</span>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Code de sécurité {otpModal.accountKey === 'account_2' ? '(OTP ou mot de passe d\'urgence)' : 'à 6 chiffres'}
                </label>
                <input
                  type="text"
                  maxLength={8}
                  placeholder="Code de validation"
                  value={otpModal.code}
                  onChange={(e) => setOtpModal((prev) => ({ ...prev, code: e.target.value.replace(/[^0-9]/g, '') }))}
                  className="input text-center text-2xl tracking-[8px] font-mono font-black w-full py-3"
                  autoFocus
                />
                {otpModal.accountKey === 'account_2' ? (
                  <p className="text-[11px] text-gray-500 mt-1.5 text-center">
                    Saisissez le code reçu par email ou votre mot de passe d'urgence à 5 chiffres (<b>19970</b>).
                  </p>
                ) : (
                  <p className="text-[11px] text-gray-500 mt-1.5 text-center">
                    Saisissez le code à 6 chiffres envoyé par email à <b>tankoujohnson@gmail.com</b>.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-gray-400">Code non reçu ?</span>
                <button
                  type="button"
                  disabled={otpModal.sending || otpModal.verifying}
                  onClick={() => handleOpenAccount(otpModal.accountKey, otpModal.email)}
                  className="text-indigo-600 hover:underline font-bold"
                >
                  {otpModal.sending ? 'Envoi en cours...' : 'Renvoyer un code'}
                </button>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOtpModal({ open: false, accountKey: '', email: '', code: '', sending: false, verifying: false, error: '', success: '' })}
                  className="btn-secondary text-xs flex-1 py-2.5 rounded-xl font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={otpModal.verifying || otpModal.code.length < 4}
                  className="btn-primary text-xs flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5"
                >
                  {otpModal.verifying ? <Loader2 size={15} className="animate-spin" /> : <Unlock size={15} />}
                  <span>Valider et Déverrouiller</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODALE : EFFECTUER UN RETRAIT */}
      {/* ───────────────────────────────────────────────────────────── */}
      {withdrawModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4 animate-scale-up">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <ArrowUpRight size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Nouveau retrait</h3>
                  <p className="text-xs text-gray-500">
                    Depuis le {withdrawModal.accountKey === 'account_1' ? 'Compte 1 (60%)' : 'Compte 2 (40%)'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setWithdrawModal({ open: false, accountKey: '', amount: '', method: 'momo', phone: '', operator: 'mtn', accountName: '', targetWalletAccountNo: '', notes: '', submitting: false, error: '' })}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-xs flex items-center justify-between">
              <span className="text-emerald-900 font-medium">Solde disponible :</span>
              <span className="text-emerald-800 font-black text-sm">
                {fmt(unlockedAccounts[withdrawModal.accountKey]?.balance || 0)} FCFA
              </span>
            </div>

            {withdrawModal.error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{withdrawModal.error}</span>
              </div>
            )}

            <form onSubmit={handleSubmitWithdraw} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Montant à retirer (FCFA) *</label>
                <input
                  type="number"
                  min="100"
                  step="100"
                  placeholder="Ex : 50000"
                  value={withdrawModal.amount}
                  onChange={(e) => setWithdrawModal((prev) => ({ ...prev, amount: e.target.value }))}
                  className="input text-xs w-full font-bold"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Mode de retrait</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setWithdrawModal((prev) => ({ ...prev, method: 'momo' }))}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                      withdrawModal.method === 'momo'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-gray-200 bg-white text-gray-600'
                    }`}
                  >
                    <Smartphone size={14} /> Mobile Money
                  </button>
                  <button
                    type="button"
                    onClick={() => setWithdrawModal((prev) => ({ ...prev, method: 'wallet' }))}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                      withdrawModal.method === 'wallet'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-gray-200 bg-white text-gray-600'
                    }`}
                  >
                    <Wallet size={14} /> Portefeuille
                  </button>
                </div>
              </div>

              {withdrawModal.method === 'wallet' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      Numéro de compte portefeuille destinataire (optionnel)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex : KS616522 ou email/téléphone de l'utilisateur"
                      value={withdrawModal.targetWalletAccountNo}
                      onChange={(e) => setWithdrawModal((prev) => ({ ...prev, targetWalletAccountNo: e.target.value }))}
                      className="input text-xs w-full font-mono"
                    />
                    <p className="text-[11px] text-gray-500 mt-1">
                      Laissez vide pour créditer automatiquement le compte administrateur (<b>{unlockedAccounts[withdrawModal.accountKey]?.email}</b>).
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-indigo-800">
                      <Wallet size={14} /> Destination du virement :
                    </div>
                    <p className="text-gray-600 text-[11px] leading-relaxed">
                      {withdrawModal.targetWalletAccountNo.trim()
                        ? `Les fonds seront immédiatement virés sur le portefeuille du compte « ${withdrawModal.targetWalletAccountNo.trim()} ».`
                        : `Les fonds seront crédités directement sur le portefeuille KATD de l'administrateur (${unlockedAccounts[withdrawModal.accountKey]?.email}).`}
                    </p>
                  </div>
                </div>
              )}

              {withdrawModal.method === 'momo' && (
                <>
                  <SavedMomoSelector
                    selectedPhone={withdrawModal.phone}
                    onSelectAccount={(acc) => {
                      setWithdrawModal((prev) => ({
                        ...prev,
                        operator: acc.operator || 'mtn',
                        phone: acc.phone || '',
                        accountName: acc.accountName || prev.accountName || '',
                      }))
                    }}
                  />

                  <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-100 text-[11px] text-emerald-900 flex items-center gap-2">
                    <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
                    <span>Décaissement direct connecté à la passerelle Mobile Money (MTN / Orange Money).</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">Opérateur</label>
                      <select
                        value={withdrawModal.operator}
                        onChange={(e) => setWithdrawModal((prev) => ({ ...prev, operator: e.target.value }))}
                        className="input text-xs w-full font-bold"
                      >
                        <option value="mtn">MTN Mobile Money</option>
                        <option value="orange">Orange Money</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">Numéro Mobile Money *</label>
                      <input
                        type="tel"
                        placeholder="6XXXXXXXX"
                        value={withdrawModal.phone}
                        onChange={(e) => setWithdrawModal((prev) => ({ ...prev, phone: e.target.value }))}
                        className="input text-xs w-full font-bold"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Nom du titulaire du compte</label>
                    <input
                      type="text"
                      placeholder="Nom complet"
                      value={withdrawModal.accountName}
                      onChange={(e) => setWithdrawModal((prev) => ({ ...prev, accountName: e.target.value }))}
                      className="input text-xs w-full"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Note / Motif (optionnel)</label>
                <input
                  type="text"
                  placeholder="Ex : Versement dividende mensuel"
                  value={withdrawModal.notes}
                  onChange={(e) => setWithdrawModal((prev) => ({ ...prev, notes: e.target.value }))}
                  className="input text-xs w-full"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setWithdrawModal({ open: false, accountKey: '', amount: '', method: 'momo', phone: '', operator: 'mtn', accountName: '', targetWalletAccountNo: '', notes: '', submitting: false, error: '' })}
                  className="btn-secondary text-xs flex-1 py-2.5 rounded-xl font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={withdrawModal.submitting}
                  className="btn-primary text-xs flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5"
                >
                  {withdrawModal.submitting ? <Loader2 size={15} className="animate-spin" /> : <ArrowUpRight size={15} />}
                  <span>Confirmer le retrait</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
