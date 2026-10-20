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

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')

export default function ClientCollectDashboard({ clientInfo, isAlsoAgent, onSwitchToAgent }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [navTab, setNavTab] = useState('home') // 'home' | 'stats' | 'history' | 'profile'
  const [payModal, setPayModal] = useState(false)
  const [withdrawModal, setWithdrawModal] = useState(false)
  const [userWalletBalance, setUserWalletBalance] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState({ text: '', type: '' })

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
        walletApi.getBalance().catch(() => ({ balance: 0 })),
      ])
      setData(dashRes)
      setUserWalletBalance(walRes?.balance || 0)
      if (dashRes?.stats?.dailyTarget && !payAmount) {
        setPayAmount(String(dashRes.stats.dailyTarget))
      }
      if (dashRes?.client?.phone && !momoPhone) {
        setMomoPhone(dashRes.client.phone)
        setWithdrawPhone(dashRes.client.phone)
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

    try {
      setSubmitting(true)
      const res = await collectApi.clientPay({
        amount: amt,
        paymentMethod: payMethod,
        phone: momoPhone,
        operator: momoOperator,
        country: 'CM',
      })
      showToast(res.message || 'Paiement effectué avec succès ! Votre agent a été notifié par email.')
      setPayModal(false)
      await loadData()
    } catch (err) {
      showToast(err.message || 'Erreur lors du paiement.', 'error')
    } finally {
      setSubmitting(false)
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
    if (withdrawMethod === 'momo' && !withdrawPhone) {
      showToast('Veuillez saisir le numéro Mobile Money de réception.', 'error')
      return
    }

    try {
      setSubmitting(true)
      const res = await collectApi.clientWithdraw({
        amount: amt,
        payoutMethod: withdrawMethod,
        momoNumber: withdrawPhone,
        momoOperator: withdrawOperator,
        accountName: withdrawName,
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

      {/* Switcher Espace Agent si l'utilisateur possède les deux rôles */}
      {isAlsoAgent && (
        <div className="mx-4 mb-3 p-2 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-between shadow-2xs">
          <span className="text-[11px] font-bold text-indigo-900">Mode Épargnant Client</span>
          <button
            onClick={onSwitchToAgent}
            className="text-[11px] font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1 rounded-xl shadow-2xs transition-all"
          >
            Accéder à l'Espace Agent ➔
          </button>
        </div>
      )}

      {/* ONGLET 1 : ACCUEIL (CAPTURE EXACTE) */}
      {navTab === 'home' && (
        <div className="px-4 space-y-3.5 animate-fade-in">
          {/* CARTE 1 : CAGNOTTE TOTALE */}
          <div className="bg-white rounded-[26px] p-5 shadow-[0_2px_14px_rgba(0,0,0,0.03)] border border-gray-150/70 text-center">
            <div className="flex justify-center mb-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-100">
                <PiggyBank size={14} className="text-emerald-600" />
                <span>Cagnotte Totale</span>
              </div>
            </div>

            <div className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight my-2">
              {fmt(stats.totalBalance)}F / {fmt(stats.monthlyTarget)}F
            </div>

            {/* Barre de progression */}
            <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden my-3">
              <div
                className="h-full bg-[#0f9755] rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, Math.max(0, stats.progressPercent))}%` }}
              />
            </div>

            {/* Sous-indicateurs */}
            <div className="flex items-center justify-between text-xs text-gray-500 font-semibold px-0.5">
              <span>{stats.paidDaysCount} jours sur {stats.daysInMonth}</span>
              <span>{stats.progressPercent}% • {stats.daysRemaining} jours restants</span>
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
              {stats.todayStatus === 'paye' ? (
                <span className="px-3 py-1 rounded-xl text-xs font-bold border border-emerald-300 bg-emerald-50 text-emerald-700">
                  Payé
                </span>
              ) : (
                <span className="px-3 py-1 rounded-xl text-xs font-bold border border-amber-300 bg-amber-50 text-amber-700">
                  En attente
                </span>
              )}
            </div>

            <div className="text-3xl font-black text-gray-900 tracking-tight mt-2 mb-1">
              {fmt(stats.todayPaid)}F / {fmt(stats.dailyTarget)}F
            </div>

            <div className="text-xs text-gray-500 font-medium mb-4">
              Objectif quotidien • Aujourd'hui, {todayFormatted}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPayModal(true)}
                className="bg-[#0f9755] hover:bg-[#0c7c45] active:scale-95 text-white font-black py-3.5 px-3 rounded-2xl flex items-center justify-center gap-1.5 text-[11px] sm:text-xs uppercase tracking-tight shadow-sm transition-all"
              >
                <Wallet size={15} />
                <span>PAYER MA COLLECTE</span>
              </button>
              <button
                onClick={() => setWithdrawModal(true)}
                className="bg-[#e24438] hover:bg-[#c9362b] active:scale-95 text-white font-black py-3.5 px-3 rounded-2xl flex items-center justify-center gap-1.5 text-[11px] sm:text-xs uppercase tracking-tight shadow-sm transition-all"
              >
                <ArrowDownCircle size={15} />
                <span>RETIRER MON ARGENT</span>
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
                        ? `Payé (${fmt(item.amount)}F)`
                        : item.status === 'manque'
                        ? 'Manqué'
                        : item.status === 'en_attente'
                        ? "Aujourd'hui (en attente de paiement)"
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
                <span>Payé</span>
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
                <div className="text-gray-500 font-medium text-[10px]">Jours Payés</div>
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
                        onClick={() => setMomoOperator('mtn')}
                        className={`py-2 px-3 rounded-xl font-bold border text-xs ${
                          momoOperator === 'mtn' ? 'bg-[#ffcc00] text-black border-amber-500' : 'bg-white text-gray-600 border-gray-200'
                        }`}
                      >
                        MTN MoMo
                      </button>
                      <button
                        type="button"
                        onClick={() => setMomoOperator('orange')}
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

              {/* Paramètres Momo */}
              {withdrawMethod === 'momo' && (
                <div className="space-y-3 p-3 bg-red-50/40 border border-red-200 rounded-2xl animate-fade-in">
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Opérateur</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setWithdrawOperator('mtn')}
                        className={`py-2 px-3 rounded-xl font-bold border text-xs ${
                          withdrawOperator === 'mtn' ? 'bg-[#ffcc00] text-black border-amber-500' : 'bg-white text-gray-600 border-gray-200'
                        }`}
                      >
                        MTN MoMo
                      </button>
                      <button
                        type="button"
                        onClick={() => setWithdrawOperator('orange')}
                        className={`py-2 px-3 rounded-xl font-bold border text-xs ${
                          withdrawOperator === 'orange' ? 'bg-[#ff6600] text-white border-orange-600' : 'bg-white text-gray-600 border-gray-200'
                        }`}
                      >
                        Orange Money
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Numéro de réception</label>
                    <input
                      type="tel"
                      required
                      value={withdrawPhone}
                      onChange={(e) => setWithdrawPhone(e.target.value)}
                      placeholder="Ex: 6XXXXXXXX"
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#e24438] bg-white"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Nom du titulaire</label>
                    <input
                      type="text"
                      required
                      value={withdrawName}
                      onChange={(e) => setWithdrawName(e.target.value)}
                      placeholder="Nom complet"
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#e24438] bg-white"
                    />
                  </div>
                </div>
              )}

              <div className="p-3 bg-gray-50 border border-gray-200 rounded-2xl text-[11px] text-gray-600">
                <b>Sanctuarisation des fonds :</b> En tant que client, vous disposez de la pleine propriété de votre épargne et pouvez la débloquer à tout moment.
              </div>

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
    </div>
  )
}
