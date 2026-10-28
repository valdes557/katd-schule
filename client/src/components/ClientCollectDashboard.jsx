// client/src/components/ClientCollectDashboard.jsx — Espace Collecte Journalière Client (« Épargnez au Quotidien »)
// Reproduction fidèle de la capture d'écran fournie par l'utilisateur
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, Bell, Calendar, Wallet, ArrowDownCircle, Home, BarChart3,
  History, User, Coins, Smartphone, CheckCircle2, AlertCircle, Loader2,
  X, ShieldCheck, PiggyBank,
} from 'lucide-react'
import { collectApi, walletApi } from '../lib/api'
import SavedMomoSelector from './SavedMomoSelector'
import CagnotteLockModal from './CagnotteLockModal'
import CagnotteLockProofModal from './CagnotteLockProofModal'
import { Lock, Unlock, MessageSquare, FileText } from 'lucide-react'
import { useInlineCheckout } from './payments/useInlineCheckout'

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')

export default function ClientCollectDashboard({ clientInfo, isAlsoAgent, onSwitchToAgent, onOpenAgentOptIn }) {
  const inlineCheckout = useInlineCheckout()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [navTab, setNavTab] = useState('home') // 'home' | 'stats' | 'history' | 'profile'
  const [payModal, setPayModal] = useState(false)
  const [withdrawModal, setWithdrawModal] = useState(false)
  const [userWalletBalance, setUserWalletBalance] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState({ text: '', type: '' })
  const [lockModalOpen, setLockModalOpen] = useState(false)
  const [proofModalOpen, setProofModalOpen] = useState(false)
  const [transferringWallet, setTransferringWallet] = useState(false)

  // Formulaire de versement / paiement
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('wallet') // 'wallet' | 'momo'
  const [momoOperator, setMomoOperator] = useState('mtn')
  const [momoPhone, setMomoPhone] = useState('')

  // Formulaire de retrait
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawMethod, setWithdrawMethod] = useState('wallet') // 'wallet' | 'momo'
  const [withdrawOperator, setWithdrawOperator] = useState('mtn')
  const [withdrawPhone, setWithdrawPhone] = useState('')
  const [withdrawName, setWithdrawName] = useState('')

  const loadData = async () => {
    try {
      setLoading(true)
      const [dashRes, walRes] = await Promise.all([
        collectApi.getClientDashboard(),
        walletApi.me().catch(() => ({ wallet: { balance: 0 } })),
      ])
      setData(dashRes)
      setUserWalletBalance(walRes?.wallet?.balance ?? walRes?.balance ?? 0)
      if (dashRes?.stats?.dailyTarget && !payAmount) {
        setPayAmount(String(dashRes.stats.dailyTarget))
      }
      const initialMoMo = (momoOperator === 'orange' ? dashRes?.client?.momoOrange : dashRes?.client?.momoMtn) || dashRes?.client?.momoMtn || dashRes?.client?.phone || ''
      if (initialMoMo) {
        setMomoPhone(initialMoMo)
        setWithdrawPhone(initialMoMo)
      }
      if (dashRes?.client?.fullName && !withdrawName) {
        setWithdrawName(dashRes.client.fullName)
      }
    } catch (e) {
      setToast({ text: e.message || 'Erreur lors du chargement des données', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const showToast = (text, type = 'success') => {
    setToast({ text, type })
    setTimeout(() => setToast({ text: '', type: '' }), 5000)
  }

  const handlePay = async (e) => {
    e.preventDefault()
    const amt = Number(payAmount)
    if (!amt || amt <= 0) {
      showToast('Veuillez saisir un montant valide.', 'error')
      return
    }
    if (payMethod === 'wallet' && amt > userWalletBalance) {
      showToast(`Solde insuffisant dans votre Portefeuille KATD (${fmt(userWalletBalance)} FCFA).`, 'error')
      return
    }
    if (payMethod === 'momo' && !momoPhone) {
      showToast('Veuillez saisir le numéro Mobile Money.', 'error')
      return
    }

    if (payMethod === 'wallet') {
      try {
        setSubmitting(true)
        const res = await collectApi.clientPay({
          amount: amt,
          paymentMethod: 'wallet',
        })
        showToast(res.message || 'Paiement effectué avec succès depuis votre portefeuille !', 'success')
        setPayModal(false)
        await loadData()
      } catch (err) {
        showToast(err.message || 'Erreur lors du paiement.', 'error')
      } finally {
        setSubmitting(false)
      }
      return
    }

    // PAIEMENT VIA MOBILE MONEY DIRECT (H2H AVEC VALIDATION SUR TÉLÉPHONE)
    inlineCheckout.start(
      (momoData) => collectApi.clientPay({
        amount: amt,
        paymentMethod: 'momo',
        phone: momoData.phone || momoPhone,
        operator: momoData.operator || momoOperator,
        otp: momoData.otp,
        country: momoData.country || 'CM',
      }),
      async (reference, status) => {
        setPayModal(false)
        await loadData()
        showToast('Collecte validée avec succès via Mobile Money ! Votre compte a été crédité.', 'success')
      },
      { amount: amt, title: 'Paiement collecte journalière — ' + fmt(amt) + ' FCFA' }
    )
  }

  
  const handleTransferToWallet = async () => {
    const isEarly = data?.cagnotte?.isLocked
    const msg = isEarly
      ? `Attention : Votre cagnotte est dans sa période d'épargne. Le transfert anticipé déduira 3% de frais. Confirmez-vous le transfert vers votre portefeuille ?`
      : `Confirmez-vous le transfert de votre cagnotte (${fmt(stats.totalBalance)} FCFA) vers votre portefeuille KATD (0% frais) ?`
    if (!window.confirm(msg)) return

    try {
      setTransferringWallet(true)
      const res = await collectApi.transferCagnotteToWallet()
      showToast(res.message || 'Cagnotte transférée avec succès vers votre portefeuille !')
      await loadData()
    } catch (err) {
      showToast(err.message || 'Erreur lors du transfert.', 'error')
    } finally {
      setTransferringWallet(false)
    }
  }

  const handleWithdraw = async (e) => {
    e.preventDefault()
    const amt = Number(withdrawAmount)
    const curBalance = data?.stats?.totalBalance || 0
    if (!amt || amt <= 0) {
      showToast('Veuillez saisir un montant valide.', 'error')
      return
    }
    if (amt > curBalance) {
      showToast(`Le montant dépasse votre solde d'épargne disponible (${fmt(curBalance)} FCFA).`, 'error')
      return
    }

    let finalPhone = ''
    if (withdrawMethod === 'momo') {
      finalPhone = withdrawOperator === 'mtn'
        ? (data?.client?.momoMtn || data?.client?.phone || '')
        : (data?.client?.momoOrange || data?.client?.phone || '')

      if (!finalPhone) {
        showToast(`Aucun numéro ${withdrawOperator === 'mtn' ? 'MTN MoMo' : 'Orange Money'} n'a été enregistré pour votre compte. Veuillez choisir l'autre opérateur ou contacter votre agent.`, 'error')
        return
      }
    }

    try {
      setSubmitting(true)
      const res = await collectApi.clientWithdraw({
        amount: amt,
        payoutMethod: withdrawMethod,
        momoNumber: finalPhone,
        momoOperator: withdrawOperator,
        accountName: data?.client?.fullName || withdrawName,
        country: 'CM',
      })
      showToast(res.message || 'Retrait effectué avec succès !')
      setWithdrawModal(false)
      setWithdrawAmount('')
      await loadData()
    } catch (err) {
      showToast(err.message || 'Erreur lors du retrait.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-gray-500 space-y-3">
        <Loader2 className="animate-spin text-[#0f9755]" size={36} />
        <p className="text-xs font-semibold">Chargement de votre espace d'épargne...</p>
      </div>
    )
  }

  const stats = data?.stats || {
    totalBalance: 0,
    monthlyTarget: 0,
    dailyTarget: 1000,
    paidDaysCount: 0,
    daysInMonth: 31,
    daysRemaining: 0,
    progressPercent: 0,
    todayPaid: 0,
    todayStatus: 'en_attente',
  }
  const calendar = data?.calendar || []
  const client = data?.client || clientInfo || {}
  const agent = data?.agent || {}
  const history = data?.history || []

  const todayFormatted = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f3f4f7] pb-24 text-gray-900 font-sans select-none antialiased">
      {/* Toast de notification */}
      {toast.text && (
        <div className={`fixed top-4 inset-x-4 max-w-sm mx-auto z-50 p-3.5 rounded-2xl text-xs font-bold shadow-lg flex items-center gap-2.5 transition-all ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-700 text-white'
        }`}>
          {toast.type === 'error' ? <AlertCircle size={18} className="shrink-0" /> : <CheckCircle2 size={18} className="shrink-0" />}
          <span className="flex-1">{toast.text}</span>
          <button onClick={() => setToast({ text: '', type: '' })} className="opacity-80 hover:opacity-100">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Barre supérieure identique à la capture */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-white/80 hover:bg-white border border-gray-200/60 flex items-center justify-center text-gray-800 shadow-2xs active:scale-95 transition-all"
          aria-label="Retour"
        >
          <ChevronLeft size={20} />
        </button>

        <h1 className="text-base sm:text-lg font-black tracking-tight text-gray-900">
          Épargnez au Quotidien
        </h1>

        <button
          onClick={() => showToast('Toutes vos notifications sont à jour.')}
          className="w-9 h-9 rounded-full bg-white/80 hover:bg-white border border-gray-200/60 flex items-center justify-center text-gray-800 shadow-2xs active:scale-95 transition-all relative"
          aria-label="Notifications"
        >
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-600 ring-2 ring-white" />
        </button>
      </div>

      {/* Switcher Espace Agent si l'utilisateur possède les deux rôles ou proposition de devenir agent */}
      {isAlsoAgent ? (
        <div className="mx-4 mb-3 p-2.5 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-between shadow-2xs">
          <span className="text-[11px] font-bold text-indigo-900">Mode Épargnant Client</span>
          <button
            onClick={onSwitchToAgent}
            className="text-[11px] font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-xl shadow-2xs transition-all"
          >
            Accéder à l'Espace Agent ➔
          </button>
        </div>
      ) : onOpenAgentOptIn ? (
        <div className="mx-4 mb-3 p-2.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl flex items-center justify-between shadow-2xs">
          <div className="text-[11px] font-bold text-emerald-950">
            <span>Devenir également Agent de Collecte</span>
            <span className="block text-[10px] font-medium text-emerald-700">Percevez 70% de commissions</span>
          </div>
          <button
            onClick={onOpenAgentOptIn}
            className="text-[11px] font-black text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 px-3 py-1.5 rounded-xl shadow-2xs transition-all"
          >
            Devenir Agent ➔
          </button>
        </div>
      ) : null}

      {/* ONGLET 1 : ACCUEIL (CAPTURE EXACTE) */}
      {navTab === 'home' && (
        <div className="px-4 space-y-3.5 animate-fade-in">
          {/* CARTE 1 : CAGNOTTE TOTALE */}
          <div className="bg-white rounded-[26px] p-5 shadow-[0_2px_14px_rgba(0,0,0,0.03)] border border-gray-150/70 text-center space-y-3">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-100">
                <PiggyBank size={14} className="text-emerald-600" />
                <span>Cagnotte Totale</span>
              </div>

              {/* Badge de statut cagnotte */}
              {data?.cagnotte?.isLocked ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-black uppercase border border-amber-200">
                  <Lock size={10} /> Bloquée jusqu'au {fmtDate(data.cagnotte.lockUntil)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase border border-emerald-300">
                  <Unlock size={10} /> Débloquée (0% frais)
                </span>
              )}
            </div>

            <div className="text-3xl font-black text-gray-900 tracking-tight my-1">
              {fmt(stats.totalBalance || stats.currentMonthTotal || 0)} FCFA
            </div>

            <div className="text-xs text-gray-500 font-medium">
              Cumul des cotisations journalières ({stats.paidDaysCount || 0} jour{(stats.paidDaysCount || 0) > 1 ? 's' : ''} cotisé{(stats.paidDaysCount || 0) > 1 ? 's' : ''})
            </div>

            {/* Note d'information cycle et frais */}
            <div className={`p-2.5 rounded-2xl text-[11px] text-left leading-relaxed border ${
              data?.cagnotte?.isLocked
                ? 'bg-amber-50/70 border-amber-200/80 text-amber-950'
                : 'bg-emerald-50/70 border-emerald-200/80 text-emerald-950'
            }`}>
              {data?.cagnotte?.isLocked ? (
                <div>
                  <span className="font-bold flex items-center gap-1 text-amber-900">
                    <Lock size={12} /> Cycle d'épargne en cours (Échéance : {fmtDate(data.cagnotte.lockUntil)})
                  </span>
                  <p className="text-[10px] text-amber-800/90 mt-0.5">
                    Retrait à échéance à <b>0% de frais</b>. Retrait anticipé avant échéance : <b>3% de frais réglementaires</b>.
                  </p>
                </div>
              ) : (
                <div>
                  <span className="font-bold flex items-center gap-1 text-emerald-900">
                    <CheckCircle2 size={12} /> Échéance atteinte — Retrait 0% de frais
                  </span>
                  <p className="text-[10px] text-emerald-800/90 mt-0.5">
                    Votre cagnotte est disponible au retrait sans frais. Vous pouvez également la transférer vers votre portefeuille.
                  </p>
                </div>
              )}
            </div>

            {/* Boutons d'action sur la cagnotte */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => setWithdrawModal(true)}
                className="bg-[#e24438] hover:bg-[#c9362b] active:scale-95 text-white font-black py-3 px-2 rounded-2xl flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-tight shadow-sm transition-all"
              >
                <ArrowDownCircle size={14} />
                <span>RETIRER MA CAGNOTTE</span>
              </button>

              <button
                onClick={() => setLockModalOpen(true)}
                className="bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-black py-3 px-2 rounded-2xl flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-tight shadow-sm transition-all"
              >
                <Lock size={14} />
                <span>BLOQUER MA CAGNOTTE</span>
              </button>
            </div>

            {/* Liens secondaires : Preuve contrat, virement portefeuille & messagerie */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 border-t border-gray-100">
              {data?.cagnotte?.lockContract?.contractNumber && (
                <button
                  type="button"
                  onClick={() => setProofModalOpen(true)}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 py-1 px-2.5 rounded-xl hover:bg-indigo-50 transition-colors"
                >
                  <FileText size={13} />
                  <span>Preuve de blocage ({data.cagnotte.lockContract.contractNumber})</span>
                </button>
              )}

              {stats.totalBalance > 0 && (
                <button
                  type="button"
                  disabled={transferringWallet}
                  onClick={handleTransferToWallet}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 py-1 px-2.5 rounded-xl hover:bg-emerald-50 transition-colors"
                >
                  {transferringWallet ? <Loader2 size={13} className="animate-spin" /> : <Wallet size={13} />}
                  <span>Virer vers mon portefeuille</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => navigate('/u/messages')}
                className="text-[11px] font-bold text-gray-600 hover:text-gray-900 flex items-center gap-1 py-1 px-2.5 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <MessageSquare size={13} className="text-indigo-500" />
                <span>Contacter mon agent ({agent?.agencyName || 'Messagerie'})</span>
              </button>
            </div>
          </div>

          {/* CARTE 2 : SOLDE DU JOUR */}
          <div className="bg-white rounded-[24px] p-5 shadow-[0_2px_14px_rgba(0,0,0,0.03)] border border-gray-150/70">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 font-bold text-gray-900 text-base">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <Calendar size={16} />
                </div>
                <span>Solde du jour</span>
              </div>
              {(stats.todayStatus === 'paye' || stats.todayPaid > 0) ? (
                <span className="px-3 py-1 rounded-xl text-xs font-bold border border-emerald-300 bg-emerald-50 text-emerald-700">
                  Collecté
                </span>
              ) : (
                <span className="px-3 py-1 rounded-xl text-xs font-bold border border-amber-300 bg-amber-50 text-amber-700">
                  Non collecté
                </span>
              )}
            </div>

            <div className="text-3xl font-black text-gray-900 tracking-tight mt-2 mb-1">
              {fmt(stats.todayPaid || 0)} FCFA
            </div>

            <div className="text-xs text-gray-500 font-medium mb-4">
              Aujourd'hui, {todayFormatted}
            </div>

            <div>
              <button
                onClick={() => setPayModal(true)}
                className="w-full bg-[#0f9755] hover:bg-[#0c7c45] active:scale-95 text-white font-black py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 text-xs uppercase tracking-tight shadow-sm transition-all"
              >
                <Wallet size={16} />
                <span>PAYER MA COLLECTE DU JOUR</span>
              </button>
            </div>
          </div>

          {/* CARTE 3 : CALENDRIER DU MOIS */}
          <div className="bg-white rounded-[24px] p-5 shadow-[0_2px_14px_rgba(0,0,0,0.03)] border border-gray-150/70">
            <h3 className="text-base font-bold text-gray-900 mb-4">
              Calendrier {data?.month?.label || 'du mois'}
            </h3>

            {/* En-tête des jours */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-gray-500 mb-3">
              <span>Lu</span>
              <span>Ma</span>
              <span>Me</span>
              <span>Je</span>
              <span>Ve</span>
              <span>Sa</span>
              <span>Di</span>
            </div>

            {/* Grille des cercles de jours */}
            <div className="grid grid-cols-7 gap-y-3 gap-x-1 justify-items-center items-center">
              {Array.from({ length: Math.max(0, (data?.month?.firstDayOfWeek || 1) - 1) }).map((_, i) => (
                <div key={`empty-${i}`} className="w-9 h-9 sm:w-10 sm:h-10" />
              ))}

              {calendar.map((item) => {
                let bgClass = 'bg-[#e5e7eb] text-gray-600'
                if (item.status === 'paye') {
                  bgClass = 'bg-[#0f9755] text-white shadow-2xs'
                } else if (item.status === 'manque') {
                  bgClass = 'bg-[#e24438] text-white shadow-2xs'
                } else if (item.status === 'en_attente') {
                  bgClass = 'bg-amber-100 text-amber-900 ring-2 ring-amber-400 font-black'
                }

                return (
                  <div
                    key={item.day}
                    title={`${item.date} : ${
                      item.status === 'paye'
                        ? `Collecté (${fmt(item.amount)}F)`
                        : item.status === 'manque'
                        ? 'Manqué'
                        : item.status === 'en_attente'
                        ? "Aujourd'hui (en attente de collecte)"
                        : 'À venir'
                    }`}
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold transition-transform hover:scale-105 cursor-default ${bgClass}`}
                  >
                    {item.day}
                  </div>
                )
              })}
            </div>

            {/* Légende */}
            <div className="flex items-center justify-center gap-5 mt-5 text-xs font-semibold text-gray-700">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0f9755]" />
                <span>Collecté</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#e24438]" />
                <span>Manqué</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#e5e7eb]" />
                <span>À venir</span>
              </div>
            </div>
          </div>

          {/* CARTE 4 : MÉTHODES DE PAIEMENT MOBILE */}
          <div className="bg-white rounded-[24px] p-4 shadow-[0_2px_14px_rgba(0,0,0,0.03)] border border-gray-150/70 text-center">
            <div className="text-xs sm:text-sm font-bold text-gray-800 mb-3">
              Méthodes de paiement mobile
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* MTN MoMo */}
              <div className="flex items-center justify-center gap-2.5 p-3 rounded-2xl border border-gray-200/90 bg-gray-50/50 shadow-2xs">
                <div className="w-8 h-5 rounded-full bg-[#ffcc00] flex items-center justify-center font-black text-[9px] text-black tracking-tighter shadow-2xs">
                  MTN
                </div>
                <span className="text-xs font-bold text-gray-800">MTN MoMo</span>
              </div>

              {/* Orange Money */}
              <div className="flex items-center justify-center gap-2.5 p-3 rounded-2xl border border-gray-200/90 bg-gray-50/50 shadow-2xs">
                <div className="w-6 h-6 rounded-md bg-[#ff6600] flex items-center justify-center font-black text-[8px] text-white tracking-tighter shadow-2xs">
                  orange
                </div>
                <span className="text-xs font-bold text-gray-800">Orange Money</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ONGLET 2 : STATS & BILAN */}
      {navTab === 'stats' && (
        <div className="px-4 space-y-4 animate-fade-in">
          <div className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-150/80 space-y-4">
            <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
              <BarChart3 className="text-[#0f9755]" size={20} />
              <span>Statistiques de mon Épargne</span>
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-150">
                <span className="text-[11px] font-bold text-emerald-800 uppercase block">Total épargné</span>
                <span className="text-xl font-black text-emerald-950 mt-1 block">{fmt(stats.totalBalance)} F</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-150">
                <span className="text-[11px] font-bold text-indigo-800 uppercase block">Objectif mensuel</span>
                <span className="text-xl font-black text-indigo-950 mt-1 block">{fmt(stats.monthlyTarget)} F</span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-xs font-semibold text-gray-600">
                <span>Taux de respect de l'épargne</span>
                <span className="font-bold text-gray-900">{stats.progressPercent}%</span>
              </div>
              <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden">
                <div className="h-full bg-[#0f9755] rounded-full" style={{ width: `${stats.progressPercent}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs">
              <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-150">
                <div className="text-emerald-600 font-black text-base">{stats.paidDaysCount}</div>
                <div className="text-gray-500 font-medium text-[10px]">Jours Collectés</div>
              </div>
              <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-150">
                <div className="text-red-500 font-black text-base">
                  {calendar.filter((d) => d.status === 'manque').length}
                </div>
                <div className="text-gray-500 font-medium text-[10px]">Jours Manqués</div>
              </div>
              <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-150">
                <div className="text-gray-700 font-black text-base">{stats.daysRemaining}</div>
                <div className="text-gray-500 font-medium text-[10px]">Jours Restants</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ONGLET 3 : HISTORIQUE DES TRANSACTIONS */}
      {navTab === 'history' && (
        <div className="px-4 space-y-3 animate-fade-in">
          {/* Cumul des collectes journalières par mois (Supervision & Suivi) */}
          {(data?.monthlyHistory || []).length > 0 && (
            <div className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-150/80">
              <h2 className="text-base font-black text-gray-900 mb-1 flex items-center gap-2">
                <Calendar className="text-[#0f9755]" size={18} />
                <span>Cumul des collectes par mois</span>
              </h2>
              <p className="text-xs text-gray-400 mb-3">Supervision et suivi mensuel de votre cagnotte.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {data.monthlyHistory.map((mh) => (
                  <div key={mh._id} className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-gray-900 block font-mono">{mh._id}</span>
                      <span className="text-[11px] text-emerald-800 font-semibold">{mh.daysCount} jour(s) collecté(s)</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-emerald-950 block">{fmt(mh.totalAmount)} F</span>
                      <span className="text-[10px] text-gray-400">Dernier versement : {fmtDate(mh.lastPaymentDate)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-150/80">
            <h2 className="text-base font-black text-gray-900 mb-3 flex items-center gap-2">
              <History className="text-[#0f9755]" size={20} />
              <span>Historique des versements & retraits</span>
            </h2>

            {history.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">Aucune transaction enregistrée pour le moment.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {history.map((tx) => {
                  const isRetrait = tx.type === 'retrait' || tx.status === 'retrait'
                  return (
                    <div key={tx._id} className="py-3 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                            isRetrait ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                          }`}
                        >
                          {isRetrait ? <ArrowDownCircle size={16} /> : <Coins size={16} />}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900">
                            {isRetrait ? "Retrait d'épargne" : 'Collecte journalière'}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            {fmtDate(tx.datetime || tx.date)} • {tx.paymentMethod === 'wallet' ? 'Portefeuille' : 'Mobile Money'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`font-black text-sm block ${
                            isRetrait ? 'text-red-600' : 'text-emerald-700'
                          }`}
                        >
                          {isRetrait ? '-' : '+'} {fmt(tx.amount)} F
                        </span>
                        <span className="text-[10px] text-gray-400 uppercase font-bold">
                          {tx.status}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ONGLET 4 : PROFIL & AGENT ASSIGNÉ */}
      {navTab === 'profile' && (
        <div className="px-4 space-y-3.5 animate-fade-in">
          <div className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-150/80 space-y-3">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-lg">
                {client.fullName ? client.fullName.charAt(0).toUpperCase() : 'C'}
              </div>
              <div>
                <h2 className="font-black text-gray-900 text-base">{client.fullName}</h2>
                <span className="text-xs text-gray-500 font-mono">Compte N° {client.accountNumber}</span>
              </div>
            </div>

            <div className="divide-y divide-gray-100 text-xs">
              <div className="py-2.5 flex justify-between">
                <span className="text-gray-500">Téléphone</span>
                <span className="font-bold text-gray-900">{client.phone}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-gray-500">Quartier / Ville</span>
                <span className="font-bold text-gray-900">{client.neighborhood} {client.city ? `(${client.city})` : ''}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-gray-500">Objectif journalier</span>
                <span className="font-bold text-emerald-700">{fmt(client.dailyTarget)} FCFA / jour</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-150/80 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-emerald-600" />
              <span>Agence & Agent Responsable</span>
            </h3>
            <div className="text-xs space-y-1.5 text-gray-700">
              <p><b>Agence :</b> {agent.agencyName || 'Non assigné'}</p>
              <p><b>Agent :</b> {agent.user?.name || 'Agent de collecte agréé'}</p>
              <p><b>Contact :</b> {agent.phone || 'Non renseigné'}</p>
              <p><b>Secteur :</b> {agent.neighborhood || 'Quartier général'}</p>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-150 text-[11px] text-gray-500 leading-relaxed">
              <b>Garantie de protection :</b> Conformément aux règles strictes de la plateforme, ni l'agent ni l'administrateur n'ont l'autorisation de retirer votre argent. Vos fonds sont sanctuarisés et retirables uniquement par vous-même.
            </div>
          </div>

          {/* Rôle Agent de collecte */}
          <div className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-150/80 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <Coins size={16} className="text-amber-600" />
              <span>Rôle Agent de Collecte</span>
            </h3>
            {isAlsoAgent ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-600">Vous êtes également enregistré comme Agent de Collecte.</p>
                <button
                  onClick={onSwitchToAgent}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all"
                >
                  Basculer sur mon Tableau de bord Agent
                </button>
              </div>
            ) : onOpenAgentOptIn ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-600">
                  Vous souhaitez collecter l'épargne d'autres clients et percevoir <b>70% de commissions</b> mensuelles ?
                </p>
                <button
                  onClick={onOpenAgentOptIn}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
                >
                  <Coins size={15} />
                  <span>Devenir également Agent de Collecte</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* DOCK DE NAVIGATION INFÉRIEUR IDENTIQUE À LA CAPTURE */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-gray-200/90 z-30 max-w-md mx-auto py-2 px-3 shadow-[0_-4px_16px_rgba(0,0,0,0.05)]">
        <div className="grid grid-cols-4 text-center">
          {[
            { key: 'home', label: 'Accueil', icon: Home },
            { key: 'stats', label: 'Stats', icon: BarChart3 },
            { key: 'history', label: 'Historique', icon: History },
            { key: 'profile', label: 'Profil', icon: User },
          ].map((item) => {
            const active = navTab === item.key
            return (
              <button
                key={item.key}
                onClick={() => setNavTab(item.key)}
                className={`flex flex-col items-center justify-center py-1 transition-colors ${
                  active ? 'text-[#0f9755] font-black' : 'text-gray-400 hover:text-gray-600 font-medium'
                }`}
              >
                <item.icon size={20} className={active ? 'stroke-[2.5]' : 'stroke-[1.8]'} />
                <span className="text-[11px] mt-0.5">{item.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* MODAL 1 : PAYER MA COLLECTE */}
      {payModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-t-[28px] sm:rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Wallet size={20} />
                </div>
                <div>
                  <h3 className="font-black text-gray-900 text-base">Payer ma Collecte</h3>
                  <p className="text-xs text-gray-500">Versement pour aujourd'hui ({todayFormatted})</p>
                </div>
              </div>
              <button onClick={() => setPayModal(false)} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePay} className="space-y-4 text-xs">
              {/* Montant */}
              <div>
                <label className="font-bold text-gray-700 block mb-1.5">
                  Montant à verser (FCFA) *
                </label>
                <input
                  type="number"
                  min="100"
                  step="100"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="Ex: 1000"
                  className="w-full px-4 py-3 text-base font-black rounded-2xl border border-gray-300 focus:ring-2 focus:ring-[#0f9755] focus:outline-none"
                />
                {/* Raccourcis montants */}
                <div className="flex gap-2 mt-2 overflow-x-auto py-1">
                  {[500, 1000, 2000, 5000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setPayAmount(String(preset))}
                      className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all ${
                        Number(payAmount) === preset
                          ? 'bg-[#0f9755] text-white border-[#0f9755]'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {fmt(preset)} F
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode de règlement */}
              <div>
                <label className="font-bold text-gray-700 block mb-1.5">Mode de règlement *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPayMethod('wallet')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      payMethod === 'wallet'
                        ? 'border-[#0f9755] bg-emerald-50/60 ring-2 ring-[#0f9755]'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-black text-gray-900 text-xs flex items-center gap-1.5">
                      <Wallet size={14} className="text-[#0f9755]" />
                      <span>Portefeuille KATD</span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1">
                      Solde : <b>{fmt(userWalletBalance)} F</b>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPayMethod('momo')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      payMethod === 'momo'
                        ? 'border-[#0f9755] bg-emerald-50/60 ring-2 ring-[#0f9755]'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-black text-gray-900 text-xs flex items-center gap-1.5">
                      <Smartphone size={14} className="text-amber-500" />
                      <span>Mobile Money</span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1">MTN & Orange</div>
                  </button>
                </div>
              </div>

              {/* Champs Mobile Money si sélectionné */}
              {payMethod === 'momo' && (
                <div className="space-y-3 p-3 bg-amber-50/60 border border-amber-200 rounded-2xl animate-fade-in">
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Opérateur</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setMomoOperator('mtn')
                          const p = data?.client?.momoMtn || data?.client?.phone || ''
                          if (p) setMomoPhone(p)
                        }}
                        className={`py-2 px-3 rounded-xl font-bold border text-xs ${
                          momoOperator === 'mtn' ? 'bg-[#ffcc00] text-black border-amber-500' : 'bg-white text-gray-600 border-gray-200'
                        }`}
                      >
                        MTN MoMo
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMomoOperator('orange')
                          const p = data?.client?.momoOrange || data?.client?.phone || ''
                          if (p) setMomoPhone(p)
                        }}
                        className={`py-2 px-3 rounded-xl font-bold border text-xs ${
                          momoOperator === 'orange' ? 'bg-[#ff6600] text-white border-orange-600' : 'bg-white text-gray-600 border-gray-200'
                        }`}
                      >
                        Orange Money
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Numéro de téléphone</label>
                    <input
                      type="tel"
                      required
                      value={momoPhone}
                      onChange={(e) => setMomoPhone(e.target.value)}
                      placeholder="Ex: 6XXXXXXXX"
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0f9755] bg-white"
                    />
                  </div>
                </div>
              )}

              <p className="text-[11px] text-gray-500 leading-snug">
                Dès validation, votre calendrier sera immédiatement mis à jour au vert et votre agent responsable recevra un email de confirmation instantané.
              </p>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-2xl bg-[#0f9755] hover:bg-[#0c7c45] text-white font-black text-sm uppercase tracking-tight shadow-md flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                <span>Confirmer le Versement ({fmt(payAmount || 0)} F)</span>
              </button>
            </form>
          </div>
        </div>
      )}

      
      {/* MODALE DE BLOCAGE DE CAGNOTTE AVEC TERMES ET SIGNATURE NUMÉRIQUE */}
      <CagnotteLockModal
        client={client}
        currentBalance={stats.totalBalance}
        isOpen={lockModalOpen}
        onClose={() => setLockModalOpen(false)}
        onSuccess={(res) => {
          showToast(res.message || 'Cagnotte bloquée avec succès !')
          loadData()
        }}
      />

      {/* MODALE DE VISUALISATION DU CONTRAT / PREUVE DE BLOCAGE */}
      {proofModalOpen && data?.cagnotte?.lockContract && (
        <CagnotteLockProofModal
          isOpen={proofModalOpen}
          contract={data?.cagnotte?.lockContract}
          client={client}
          onClose={() => setProofModalOpen(false)}
        />
      )}

      {/* MODAL 2 : RETIRER MON ARGENT */}
      {withdrawModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-t-[28px] sm:rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                  <ArrowDownCircle size={20} />
                </div>
                <div>
                  <h3 className="font-black text-gray-900 text-base">Retirer mon Argent</h3>
                  <p className="text-xs text-gray-500">Solde disponible : <b>{fmt(stats.totalBalance)} FCFA</b></p>
                </div>
              </div>
              <button onClick={() => setWithdrawModal(false)} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleWithdraw} className="space-y-4 text-xs">
              {/* Montant */}
              <div>
                <label className="font-bold text-gray-700 block mb-1.5">
                  Montant à retirer (FCFA) *
                </label>
                <input
                  type="number"
                  min="100"
                  max={stats.totalBalance}
                  step="100"
                  required
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Ex: 5000"
                  className="w-full px-4 py-3 text-base font-black rounded-2xl border border-gray-300 focus:ring-2 focus:ring-[#e24438] focus:outline-none"
                />
                {/* Raccourcis pourcentage */}
                <div className="flex gap-2 mt-2">
                  {[
                    { label: '25%', factor: 0.25 },
                    { label: '50%', factor: 0.5 },
                    { label: '100% (Tout)', factor: 1 },
                  ].map((preset) => {
                    const presetVal = Math.floor((stats.totalBalance || 0) * preset.factor)
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setWithdrawAmount(String(presetVal))}
                        className="px-3 py-1 rounded-xl text-xs font-bold border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 transition-all"
                      >
                        {preset.label} ({fmt(presetVal)} F)
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Destination */}
              <div>
                <label className="font-bold text-gray-700 block mb-1.5">Destination du retrait *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setWithdrawMethod('wallet')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      withdrawMethod === 'wallet'
                        ? 'border-[#e24438] bg-red-50/60 ring-2 ring-[#e24438]'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-black text-gray-900 text-xs flex items-center gap-1.5">
                      <Wallet size={14} className="text-[#e24438]" />
                      <span>Vers Portefeuille</span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1">Crédit immédiat</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWithdrawMethod('momo')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      withdrawMethod === 'momo'
                        ? 'border-[#e24438] bg-red-50/60 ring-2 ring-[#e24438]'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-black text-gray-900 text-xs flex items-center gap-1.5">
                      <Smartphone size={14} className="text-amber-500" />
                      <span>Vers Mobile Money</span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1">MTN & Orange</div>
                  </button>
                </div>
              </div>

              {/* Paramètres Momo avec sélection automatique du numéro enregistré */}
              {withdrawMethod === 'momo' && (
                <div className="space-y-3.5 p-3.5 bg-red-50/40 border border-red-200 rounded-2xl animate-fade-in">
                  <SavedMomoSelector
                    selectedOperator={withdrawOperator}
                    selectedPhone={withdrawPhone}
                    selectedName={withdrawName}
                    onSelect={({ operator, phone, accountName }) => {
                      setWithdrawOperator(operator)
                      setWithdrawPhone(phone)
                      setWithdrawName(accountName)
                    }}
                  />

                  <div>
                    <label className="font-bold text-gray-700 block mb-1.5">Opérateur Mobile Money *</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setWithdrawOperator('mtn')}
                        className={`py-2 px-3 rounded-xl font-bold border text-xs text-left transition-all ${
                          withdrawOperator === 'mtn' ? 'bg-[#ffcc00] text-black border-amber-500 ring-2 ring-amber-400/40' : 'bg-white text-gray-600 border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>MTN MoMo</span>
                          {data?.client?.momoMtn && <span className="text-[10px] bg-black/10 px-1.5 py-0.2 rounded font-mono">Lié</span>}
                        </div>
                        <div className="text-[10px] opacity-75 font-mono truncate mt-0.5">
                          {data?.client?.momoMtn || 'Non renseigné'}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setWithdrawOperator('orange')}
                        className={`py-2 px-3 rounded-xl font-bold border text-xs text-left transition-all ${
                          withdrawOperator === 'orange' ? 'bg-[#ff6600] text-white border-orange-600 ring-2 ring-orange-400/40' : 'bg-white text-gray-600 border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>Orange Money</span>
                          {data?.client?.momoOrange && <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded font-mono">Lié</span>}
                        </div>
                        <div className="text-[10px] opacity-90 font-mono truncate mt-0.5">
                          {data?.client?.momoOrange || 'Non renseigné'}
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Numéro automatiquement sélectionné (aucun remplissage manuel requis) */}
                  {(() => {
                    const activePhone = withdrawOperator === 'mtn'
                      ? (data?.client?.momoMtn || data?.client?.phone || '')
                      : (data?.client?.momoOrange || data?.client?.phone || '')

                    if (!activePhone) {
                      return (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px] space-y-1">
                          <p className="font-bold">⚠️ Numéro {withdrawOperator === 'mtn' ? 'MTN MoMo' : 'Orange Money'} non enregistré</p>
                          <p className="text-gray-600">
                            Votre agent n'a pas renseigné ce numéro lors de votre inscription. Veuillez basculer sur l'autre opérateur ou demander à votre agent de mettre à jour votre profil.
                          </p>
                        </div>
                      )
                    }

                    return (
                      <div className="p-3 bg-white border border-gray-200 rounded-xl space-y-1.5 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            Numéro de réception automatique
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={11} /> Compte certifié
                          </span>
                        </div>
                        <div className="flex items-center justify-between font-mono font-black text-sm text-gray-900">
                          <span>📱 {activePhone}</span>
                          <span className="text-[11px] font-sans font-bold text-gray-500">
                            {withdrawOperator === 'mtn' ? 'MTN Cameroon' : 'Orange Cameroun'}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500 border-t border-gray-100 pt-1 flex items-center justify-between">
                          <span>Titulaire enregistré :</span>
                          <strong className="text-gray-800">{data?.client?.fullName}</strong>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}

              <div className="p-3 bg-gray-50 border border-gray-200 rounded-2xl text-[11px] text-gray-600">
                <b>Sanctuarisation des fonds :</b> En tant que client, vous disposez de la pleine propriété de votre épargne et pouvez la débloquer à tout moment.
              </div>

              {data?.cagnotte?.isLocked && Number(withdrawAmount) > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-900 space-y-1">
                  <div className="flex justify-between font-bold">
                    <span>Frais de retrait anticipé (3%) :</span>
                    <span className="text-amber-800">-{fmt(Math.round(Number(withdrawAmount) * 0.03))} FCFA</span>
                  </div>
                  <div className="flex justify-between font-black text-xs text-gray-900 pt-1 border-t border-amber-200/60">
                    <span>Montant net que vous recevrez :</span>
                    <span className="text-emerald-700">{fmt(Number(withdrawAmount) - Math.round(Number(withdrawAmount) * 0.03))} FCFA</span>
                  </div>
                </div>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-2xl bg-[#e24438] hover:bg-[#c9362b] text-white font-black text-sm uppercase tracking-tight shadow-md flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowDownCircle size={16} />}
                <span>Valider le Retrait ({fmt(withdrawAmount || 0)} F)</span>
              </button>
            </form>
          </div>
        </div>
      )}
      {inlineCheckout.element}
    </div>
  )
}
