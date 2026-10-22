// pages/user/UserCollectPage.jsx — Espace Collecte Journalière (Agent & Utilisateur).
import { useState, useEffect } from 'react'
import {
  Coins, Loader2, Users, CheckCircle2, AlertCircle, X, Plus, Calendar,
  TrendingUp, Clock, AlertTriangle, ArrowUpRight, Wallet, Smartphone,
  FileText, Send, ShieldCheck, Edit2, Trash2, MapPin, RefreshCw, ChevronRight, Mail, Lock, PlusCircle, ArrowDownCircle, Check,
} from 'lucide-react'
import { collectApi, walletApi } from '../../lib/api'
import ClientCollectDashboard from '../../components/ClientCollectDashboard'
import SignaturePad from '../../components/SignaturePad'
import ClientContractModal from '../../components/ClientContractModal'
import { useInlineCheckout } from '../../components/payments/useInlineCheckout'

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')

export default function UserCollectPage() {
  const [loading, setLoading] = useState(true)
  const [agentStatus, setAgentStatus] = useState(null)
  const [viewMode, setViewMode] = useState('auto') // 'client' | 'agent' | 'auto'
  const [tab, setTab] = useState('dashboard') // dashboard | clients | reports | settings
  const [banner, setBanner] = useState({ type: '', text: '' })

  const loadStatus = async () => {
    try {
      setLoading(true)
      const res = await collectApi.getMyAgentStatus()
      setAgentStatus(res)
    } catch (e) {
      setBanner({ type: 'error', text: e.message || 'Erreur lors du chargement.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  const showBanner = (text, type = 'success') => {
    setBanner({ text, type })
    setTimeout(() => setBanner({ text: '', type: '' }), 5000)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    )
  }

  const isClient = !!agentStatus?.isClient
  const isAgent = !!agentStatus?.isAgent
  const currentView = viewMode === 'auto' ? (isClient ? 'client' : 'agent') : viewMode

  // Si le mode est client et que l'utilisateur est client, afficher le dashboard client ("Épargnez au Quotidien")
  if (currentView === 'client' && isClient) {
    return (
      <ClientCollectDashboard
        clientInfo={agentStatus.client}
        isAlsoAgent={isAgent}
        onSwitchToAgent={() => setViewMode('agent')}
      />
    )
  }

  // 1. Si l'utilisateur n'est pas encore agent ou n'a pas accepté les termes
  if (!agentStatus?.isAgent || !agentStatus?.termsAccepted) {
    return (
      <OptInScreen
        config={agentStatus}
        onSuccess={() => {
          showBanner('Votre compte Agent de Collecte a été activé avec succès !')
          loadStatus()
        }}
      />
    )
  }

  // 2. Si l'agent est suspendu ou révoqué
  if (agentStatus?.status !== 'active') {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-red-200 shadow-sm text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <AlertTriangle size={32} />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Compte d'agent suspendu</h2>
        <p className="text-sm text-gray-600">
          Votre compte d'agent de collecte a été suspendu ou révoqué par l'administrateur de la plateforme.
        </p>
        {agentStatus?.agent?.statusReason && (
          <div className="bg-red-50 text-red-800 p-3 rounded-xl text-xs font-medium">
            Motif : {agentStatus.agent.statusReason}
          </div>
        )}
        <p className="text-xs text-gray-400">Pour toute réclamation, veuillez contacter le support administratif.</p>
      </div>
    )
  }

  // 3. Espace Agent de Collecte actif
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-fade-in">
      {/* Switcher si l'agent est aussi client */}
      {isClient && (
        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-2xl shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
            <Coins size={16} className="text-emerald-600" />
            <span>Vous avez également un compte d'épargne client actif</span>
          </div>
          <button
            onClick={() => setViewMode('client')}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-2xs"
          >
            Voir mon Épargne Client ➔
          </button>
        </div>
      )}

      {/* En-tête de l'agence */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-indigo-800 rounded-3xl p-6 text-white shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 rounded-2xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center text-white shrink-0 shadow-inner">
              <Coins size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight">{agentStatus.agent?.agencyName}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-400 text-emerald-950">
                  Agent Agréé
                </span>
              </div>
              <p className="text-xs text-emerald-100 mt-0.5 flex items-center gap-1.5">
                <MapPin size={13} /> {agentStatus.agent?.neighborhood || 'Secteur non spécifié'} • {agentStatus.agent?.phone}
              </p>
            </div>
          </div>
          <div className="text-right sm:border-l sm:border-white/20 sm:pl-5">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-200 block">Frais de tenue</span>
            <span className="text-lg font-bold">1 000 FCFA <span className="text-xs font-normal text-emerald-200">/ client / mois</span></span>
          </div>
        </div>

        {/* Rappel sanctuarisation des fonds */}
        <div className="mt-4 pt-3.5 border-t border-white/15 flex items-center gap-2 text-xs text-emerald-100">
          <ShieldCheck size={16} className="text-emerald-300 shrink-0" />
          <span><b>Règle de sécurité stricte :</b> Les fonds collectés sont sanctuarisés et réservés au client. Aucun retrait arbitraire par l'agent ou l'administration n'est permis.</span>
        </div>
      </div>

      {banner.text && (
        <div className={`p-4 rounded-2xl text-sm font-medium flex items-center gap-3 border shadow-sm ${
          banner.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
        }`}>
          {banner.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{banner.text}</span>
        </div>
      )}

      {/* Barre d'onglets */}
      <div className="flex gap-2 p-1.5 bg-gray-100/80 rounded-2xl border border-gray-200/60 overflow-x-auto">
        {[
          { key: 'dashboard', label: 'Tableau de bord', icon: TrendingUp },
          { key: 'commissions', label: 'Portefeuille Commissions (70%)', icon: Wallet },
          { key: 'clients', label: 'Clients & Comptes', icon: Users },
          { key: 'reports', label: 'Rapports journaliers', icon: FileText },
          { key: 'settings', label: 'Paramètres Agence', icon: ShieldCheck },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              tab === t.key
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
            }`}
          >
            <t.icon size={16} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <AgentDashboardTab showBanner={showBanner} agent={agentStatus.agent} onGoCommissions={() => setTab('commissions')} />}
      {tab === 'commissions' && <AgentCommissionWalletTab showBanner={showBanner} agent={agentStatus.agent} />}
      {tab === 'clients' && <AgentClientsTab showBanner={showBanner} agent={agentStatus.agent} />}
      {tab === 'reports' && <AgentReportsTab showBanner={showBanner} agent={agentStatus.agent} />}
      {tab === 'settings' && <AgentSettingsTab showBanner={showBanner} agent={agentStatus.agent} onUpdate={loadStatus} />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. ÉCRAN D'ADHÉSION & ACCEPTATION DES CONDITIONS (OPT-IN)
// ─────────────────────────────────────────────────────────────────────────────
function OptInScreen({ config, onSuccess }) {
  const [accepted, setAccepted] = useState(false)
  const [agencyName, setAgencyName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleOptIn = async (e) => {
    e.preventDefault()
    if (!accepted) {
      setError("Vous devez cocher la case d'acceptation des termes et conditions pour continuer.")
      return
    }
    if (!agencyName.trim() || !phone.trim() || !neighborhood.trim()) {
      setError("Veuillez renseigner le nom de l'agence, le numéro de téléphone et le quartier.")
      return
    }

    setSubmitting(true)
    setError('')
    try {
      await collectApi.optIn({
        agencyName: agencyName.trim(),
        phone: phone.trim(),
        city: city.trim(),
        neighborhood: neighborhood.trim(),
      })
      onSuccess()
    } catch (err) {
      setError(err.message || "Erreur lors de l'activation de votre compte.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12 animate-fade-in">
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center shrink-0 shadow-md">
            <Coins size={28} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Devenir Agent de Collecte</h1>
            <p className="text-xs text-gray-500 mt-0.5">Collecte journalière, gestion d'épargne locale & approvisionnement sécurisé</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 text-xs font-medium flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Cadre des termes et conditions rédigés par l'admin */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-700 block">
            Termes & Conditions d'adhésion rédigés par la Direction
          </label>
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl text-xs text-gray-700 max-h-60 overflow-y-auto whitespace-pre-line leading-relaxed font-sans">
            {config?.termsAndConditions || 'Veuillez lire attentivement les termes et conditions du service de collecte journalière.'}
          </div>
        </div>

        <form onSubmit={handleOptIn} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Nom de votre Agence / Point de collecte *</label>
              <input
                type="text"
                required
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="Ex : Agence Prospérité, Point Relais Paul"
                className="input text-sm w-full"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Numéro de téléphone officiel *</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ex : 690000000"
                className="input text-sm w-full"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Ville de rattachement</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ex : Douala, Yaoundé, Bafoussam"
                className="input text-sm w-full"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Quartier / Secteur de collecte *</label>
              <input
                type="text"
                required
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                placeholder="Ex : Akwa, Bonabéri, Bastos"
                className="input text-sm w-full"
              />
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/70 text-amber-900 text-xs flex items-start gap-2.5">
            <Coins size={16} className="text-amber-700 shrink-0 mt-0.5" />
            <div>
              <b>Frais de gestion :</b> Une somme forfaitaire de <b>1 000 FCFA</b> sera prélevée chaque mois sur le compte de chaque client que vous enregistrez (70% reversés dans votre portefeuille de commissions).
            </div>
          </div>

          <label className="flex items-start gap-3 p-3.5 bg-gray-50 border border-gray-200 rounded-2xl cursor-pointer hover:bg-gray-100/60 transition-colors">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
            />
            <span className="text-xs font-semibold text-gray-800">
              J'ai lu, compris et j'accepte sans réserve les termes et conditions d'adhésion pour devenir Agent de Collecte Journalière.
            </span>
          </label>

          <button
            type="submit"
            disabled={submitting || !accepted}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <Coins size={18} />}
            <span>Activer mon compte Agent de Collecte</span>
          </button>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ONGLET 1 : TABLEAU DE BORD (STATISTIQUES & COLLECTE DU JOUR)
// ─────────────────────────────────────────────────────────────────────────────
function AgentDashboardTab({ showBanner, onGoCommissions }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [collections, setCollections] = useState([])
  const [clients, setClients] = useState([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [editItem, setEditItem] = useState(null)

  const loadDashboard = async (date) => {
    try {
      setLoading(true)
      const [dashRes, dailyRes, clientsRes] = await Promise.all([
        collectApi.getAgentDashboard(),
        collectApi.getDailyCollections(date),
        collectApi.getClients(),
      ])
      setData(dashRes)
      setCollections(dailyRes.collections || [])
      setClients(clientsRes.clients || [])
    } catch (e) {
      showBanner(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard(selectedDate)
  }, [selectedDate])

  const handleDelete = async (id) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cette ligne de collecte ? Le solde du client sera ajusté si payé.')) return
    try {
      await collectApi.deleteDailyCollection(id)
      showBanner('Collecte supprimée avec succès.')
      loadDashboard(selectedDate)
    } catch (e) {
      showBanner(e.message, 'error')
    }
  }

  const stats = data?.stats || {}

  return (
    <div className="space-y-6">
      {/* 4 Cartes de statistiques clés */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4.5 rounded-2xl border border-gray-100 shadow-sm border-l-4 border-emerald-500">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">Collecte du jour</span>
          <div className="text-xl sm:text-2xl font-black text-gray-900 mt-1">
            {fmt(stats.totalCollectedToday)} <span className="text-xs font-semibold text-emerald-600">XAF</span>
          </div>
          <span className="text-[11px] text-gray-500 mt-0.5 block">{stats.paidClientsCount || 0} versement(s) payé(s)</span>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-gray-100 shadow-sm border-l-4 border-indigo-500">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">Collecte du mois</span>
          <div className="text-xl sm:text-2xl font-black text-gray-900 mt-1">
            {fmt(stats.totalCollectedMonth)} <span className="text-xs font-semibold text-indigo-600">XAF</span>
          </div>
          <span className="text-[11px] text-gray-500 mt-0.5 block">Cumul mensuel</span>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-gray-100 shadow-sm border-l-4 border-blue-500">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">Clients actifs</span>
          <div className="text-xl sm:text-2xl font-black text-gray-900 mt-1">
            {stats.activeClientsCount || 0} <span className="text-xs font-normal text-gray-400">/ {stats.totalClients || 0}</span>
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold mt-0.5 block">
            {stats.paidClientsCount || 0} ont payé aujourd'hui
          </span>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-gray-100 shadow-sm border-l-4 border-amber-500">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">Clients en retard</span>
          <div className="text-xl sm:text-2xl font-black text-amber-700 mt-1">
            {stats.lateClientsCount || 0}
          </div>
          <span className="text-[11px] text-gray-500 mt-0.5 block">À relancer ce jour</span>
        </div>
      </div>

      {/* Carte Portefeuille Commissions (70%) */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-emerald-800 text-white rounded-3xl p-5 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-emerald-200" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">
              Portefeuille Commissions Dédié (70%)
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black">
            {fmt(data?.commissionWallet?.balance || 0)} <span className="text-sm font-semibold text-emerald-200">XAF</span>
          </div>
          <p className="text-xs text-emerald-100">
            70% des frais de collecte mensuels déduits · {data?.commissionWallet?.canWithdraw ? '✅ Retrait disponible' : ('⏳ Prochain retrait dans ' + (data?.commissionWallet?.daysRemaining || 0) + ' jour(s)')}
          </p>
        </div>
        {onGoCommissions && (
          <button
            onClick={onGoCommissions}
            className="bg-white text-emerald-800 hover:bg-emerald-50 text-xs font-bold py-2.5 px-4 rounded-xl shadow-xs shrink-0 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <ArrowUpRight size={15} /> Gérer mon portefeuille
          </button>
        )}
      </div>

      {/* Section Tableau de la collecte du jour */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-gray-100">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
              <Calendar size={18} className="text-emerald-600" /> Collecte du jour
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Enregistrez, modifiez ou ajustez les collectes journalières de vos clients.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="input text-xs py-1.5 px-3 rounded-xl"
            />
            <button
              onClick={() => { setEditItem(null); setShowAddModal(true) }}
              className="btn-primary text-xs py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center gap-1.5"
            >
              <Plus size={15} /> Ajouter une collecte
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-400 flex flex-col items-center justify-center gap-2">
            <Loader2 size={24} className="animate-spin text-emerald-600" />
            <span className="text-xs">Chargement des données...</span>
          </div>
        ) : collections.length === 0 ? (
          <div className="py-16 text-center text-gray-400 space-y-2">
            <Coins size={36} className="mx-auto opacity-30 text-gray-400" />
            <p className="text-sm font-medium text-gray-600">Aucune collecte enregistrée pour le {fmtDate(selectedDate)}.</p>
            <p className="text-xs text-gray-400">Cliquez sur « Ajouter une collecte » pour enregistrer les versements de vos clients.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  <th className="py-3 px-3">Client</th>
                  <th className="py-3 px-3">Quartier</th>
                  <th className="py-3 px-3 text-right">Montant</th>
                  <th className="py-3 px-3 text-center">Statut</th>
                  <th className="py-3 px-3">Mode</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {collections.map((col) => {
                  const isUncollected = col.status === 'non_collecte' || col.isPending
                  return (
                    <tr key={col._id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-3 px-3 font-semibold text-gray-900">
                        <div>{col.clientName}</div>
                        {col.clientPhone && <div className="text-[11px] text-gray-400 font-normal">📱 {col.clientPhone}</div>}
                      </td>
                      <td className="py-3 px-3 text-gray-600">{col.neighborhood || '—'}</td>
                      <td className="py-3 px-3 text-right font-black text-gray-900 whitespace-nowrap">
                        {isUncollected ? (
                          <span className="text-gray-400 text-xs font-normal">0 XAF</span>
                        ) : (
                          <>{fmt(col.amount)} <span className="text-[11px] font-normal text-gray-400">XAF</span></>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {col.status === 'paye' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 size={12} /> Collecté
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock size={12} /> Non collecté
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-gray-500 capitalize">{col.paymentMethod || '—'}</td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        {isUncollected ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditItem({
                                client: col.client,
                                clientName: col.clientName,
                                neighborhood: col.neighborhood,
                                amount: '',
                              })
                              setShowAddModal(true)
                            }}
                            className="btn-primary text-xs py-1 px-2.5 rounded-lg inline-flex items-center gap-1 shadow-2xs"
                          >
                            <PlusCircle size={12} /> Collecter
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                            <Lock size={11} className="text-emerald-600" /> Enregistré
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && (
        <DailyCollectModal
          item={editItem}
          clients={clients}
          defaultDate={selectedDate}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false)
            showBanner(editItem ? 'Collecte mise à jour !' : 'Collecte enregistrée !')
            loadDashboard(selectedDate)
          }}
        />
      )}
    </div>
  )
}

// Modal d'ajout / modification d'une ligne de collecte du jour (Paiement en argent réel)
function DailyCollectModal({ item, clients, defaultDate, onClose, onSuccess }) {
  const inlineCheckout = useInlineCheckout()
  const [clientId, setClientId] = useState(item?.client || (clients[0]?._id || ''))
  const [amount, setAmount] = useState(item?.amount ?? (clients[0]?.dailyTarget || 1000))
  const [neighborhood, setNeighborhood] = useState(item?.neighborhood || '')
  const [status, setStatus] = useState(item?.status || 'paye')
  const [paymentMethod, setPaymentMethod] = useState(item?.paymentMethod || 'wallet') // 'wallet' | 'mtn' | 'orange'
  const [momoPhone, setMomoPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [notes, setNotes] = useState(item?.notes || '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [walletBalance, setWalletBalance] = useState(0)
  const [loadingWallet, setLoadingWallet] = useState(true)

  useEffect(() => {
    walletApi.me()
      .then((res) => setWalletBalance(res?.balance ?? res?.wallet?.balance ?? 0))
      .catch(() => {})
      .finally(() => setLoadingWallet(false))
  }, [])

  const selectedClient = clients.find((c) => c._id === clientId)

  useEffect(() => {
    if (selectedClient && !momoPhone) {
      if (paymentMethod === 'mtn') setMomoPhone(selectedClient.momoMtn || selectedClient.phone || '')
      else if (paymentMethod === 'orange') setMomoPhone(selectedClient.momoOrange || selectedClient.phone || '')
    }
  }, [clientId, paymentMethod])

  // Mise à jour automatique du quartier et du montant prévu lors de la sélection du client
  const handleClientChange = (id) => {
    setClientId(id)
    const selected = clients.find((c) => c._id === id)
    if (selected) {
      if (selected.neighborhood) setNeighborhood(selected.neighborhood)
      if (selected.dailyTarget) setAmount(selected.dailyTarget)
      if (paymentMethod === 'mtn') setMomoPhone(selected.momoMtn || selected.phone || '')
      else if (paymentMethod === 'orange') setMomoPhone(selected.momoOrange || selected.phone || '')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!clientId) {
      setErr('Veuillez sélectionner un client.')
      return
    }

    const amt = Number(amount)
    if (status === 'paye') {
      if (!amt || amt <= 0) {
        setErr('Veuillez saisir un montant de collecte supérieur à 0.')
        return
      }
      if (paymentMethod === 'wallet' && amt > walletBalance) {
        setErr(`Solde de votre portefeuille insuffisant (${fmt(walletBalance)} FCFA). Veuillez recharger votre portefeuille ou régler par Mobile Money.`)
        return
      }
      if ((paymentMethod === 'mtn' || paymentMethod === 'orange') && !momoPhone.trim()) {
        setErr('Veuillez saisir le numéro de téléphone Mobile Money pour débiter le paiement.')
        return
      }
    }

    // PAIEMENT VIA MOBILE MONEY PAR L'AGENT : VALIDATION STRICTE SUR LE TÉLÉPHONE
    if (status === 'paye' && (paymentMethod === 'mtn' || paymentMethod === 'orange' || paymentMethod === 'momo')) {
      inlineCheckout.start(
        (momoData) => collectApi.addDailyCollection({
          clientId,
          amount: amt,
          neighborhood,
          status,
          paymentMethod: momoData.operator === 'orange' ? 'orange' : 'mtn',
          momoPhone: momoData.phone || momoPhone.trim(),
          momoOperator: momoData.operator || (paymentMethod === 'orange' ? 'orange' : 'mtn'),
          otp: momoData.otp || otp,
          notes,
          date: defaultDate,
        }),
        async (reference, st) => {
          onSuccess()
          onClose()
        },
        { amount: amt, title: 'Collecte journalière — ' + (selectedClient?.fullName || '') + ' (' + fmt(amt) + ' FCFA)' }
      )
      return
    }

    setSaving(true)
    setErr('')
    try {
      if (item?._id) {
        await collectApi.updateDailyCollection(item._id, {
          amount: amt,
          neighborhood,
          status,
          paymentMethod,
          momoPhone: momoPhone.trim(),
          momoOperator: paymentMethod === 'orange' ? 'orange' : 'mtn',
          otp,
          notes,
        })
      } else {
        await collectApi.addDailyCollection({
          clientId,
          amount: amt,
          neighborhood,
          status,
          paymentMethod,
          notes,
          date: defaultDate,
        })
      }
      onSuccess()
      onClose()
    } catch (e) {
      setErr(e.message || "Erreur lors de l'enregistrement.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-gray-100 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900 text-base">
              {item ? 'Modifier la collecte' : 'Encaisser la collecte journalière'}
            </h3>
            <p className="text-xs text-gray-500">Paiement en argent réel débité de votre compte</p>
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
            <label className="text-xs font-bold text-gray-700 block mb-1">Client de la zone *</label>
            <select
              value={clientId}
              onChange={(e) => handleClientChange(e.target.value)}
              disabled={!!item}
              className="input text-xs w-full"
            >
              <option value="">Sélectionner un client...</option>
              {clients.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.fullName} ({c.neighborhood || 'Zone non spécifiée'}) — Solde : {fmt(c.balance)} F {c.isOwnClient === false ? '• [Zone Partagée]' : ''}
                </option>
              ))}
            </select>
            {selectedClient && (
              <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px] text-gray-500">
                {selectedClient.momoMtn && <span className="bg-yellow-50 text-yellow-800 px-1.5 py-0.5 rounded border border-yellow-200 font-mono">MTN: {selectedClient.momoMtn}</span>}
                {selectedClient.momoOrange && <span className="bg-orange-50 text-orange-800 px-1.5 py-0.5 rounded border border-orange-200 font-mono">Orange: {selectedClient.momoOrange}</span>}
                {selectedClient.email && <span className="text-gray-500">✉️ {selectedClient.email}</span>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Montant journalier (XAF) *</label>
              <input
                type="number"
                min="0"
                step="50"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input text-xs w-full font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Quartier / Zone</label>
              <input
                type="text"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                placeholder="Quartier..."
                className="input text-xs w-full"
              />
            </div>
          </div>

          {/* Le statut est automatiquement Collecté dès l'encaissement */}
          <div className="p-3 bg-emerald-50/70 rounded-2xl border border-emerald-200 flex items-center justify-between text-xs">
            <span className="font-semibold text-emerald-900 flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-emerald-600" /> Statut après encaissement :
            </span>
            <span className="font-black text-emerald-700 bg-white px-2.5 py-0.5 rounded-full border border-emerald-200">
              Collecté (Automatique)
            </span>
          </div>

          {true ? (
            <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
              <label className="text-xs font-bold text-gray-800 block">
                Mode de paiement en argent réel de l'agent *
              </label>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('wallet')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    paymentMethod === 'wallet'
                      ? 'border-emerald-500 bg-white ring-2 ring-emerald-500/20'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1 text-emerald-700 font-bold text-xs">
                    <Wallet size={14} /> Portefeuille
                  </div>
                  <div className="text-[10px] text-gray-500 truncate">
                    Solde: {loadingWallet ? '...' : fmt(walletBalance)} F
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('mtn')
                    if (selectedClient?.momoMtn) setMomoPhone(selectedClient.momoMtn)
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    paymentMethod === 'mtn'
                      ? 'border-yellow-500 bg-white ring-2 ring-yellow-500/20'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1 text-yellow-700 font-bold text-xs">
                    <Smartphone size={14} /> MTN MoMo
                  </div>
                  <div className="text-[10px] text-gray-500">Mobile Money</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('orange')
                    if (selectedClient?.momoOrange) setMomoPhone(selectedClient.momoOrange)
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    paymentMethod === 'orange'
                      ? 'border-orange-500 bg-white ring-2 ring-orange-500/20'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1 text-orange-700 font-bold text-xs">
                    <Smartphone size={14} /> Orange Money
                  </div>
                  <div className="text-[10px] text-gray-500">Mobile Money</div>
                </button>
              </div>

              {paymentMethod === 'wallet' && (
                <div className={`p-2.5 rounded-xl text-xs ${
                  Number(amount) > walletBalance
                    ? 'bg-rose-50 text-rose-800 border border-rose-200'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}>
                  {Number(amount) > walletBalance ? (
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle size={14} className="shrink-0 text-rose-600" />
                      <span>Solde portefeuille insuffisant ({fmt(walletBalance)} FCFA). Veuillez recharger votre portefeuille ou choisir Mobile Money.</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
                      <span>La somme de <strong>{fmt(amount)} FCFA</strong> sera déduite immédiatement de votre portefeuille. Solde restant estimé : {fmt(walletBalance - Number(amount))} FCFA.</span>
                    </div>
                  )}
                </div>
              )}

              {(paymentMethod === 'mtn' || paymentMethod === 'orange') && (
                <div className="space-y-2 pt-1">
                  <div>
                    <label className="text-[11px] font-bold text-gray-700 block mb-1">
                      Numéro Mobile Money {paymentMethod === 'orange' ? 'Orange Money' : 'MTN'} à débiter *
                    </label>
                    <input
                      type="tel"
                      required
                      value={momoPhone}
                      onChange={(e) => setMomoPhone(e.target.value)}
                      placeholder={paymentMethod === 'orange' ? 'Ex : 690000000' : 'Ex : 670000000'}
                      className="input text-xs w-full font-mono"
                    />
                  </div>
                  {paymentMethod === 'orange' && (
                    <div>
                      <label className="text-[11px] font-bold text-gray-700 block mb-1">
                        Code d'autorisation / OTP (Tapez #150*4*4# sur Orange)
                      </label>
                      <input
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder="Ex : 1234"
                        className="input text-xs w-full font-mono"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0 text-rose-600" />
              <span>
                Le client sera enregistré avec le statut <strong>Non payé</strong> pour cette journée. Aucun argent ne sera débité.
              </span>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Remarques / Notes (optionnel)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex : Collecté sur le lieu de commerce"
              className="input text-xs w-full"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary text-xs">
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving || (status === 'paye' && paymentMethod === 'wallet' && Number(amount) > walletBalance)}
              className="btn-primary text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 font-bold disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              <span>{item ? 'Mettre à jour' : 'Valider le paiement de la collecte'}</span>
            </button>
          </div>
        </form>
        {inlineCheckout.element}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ONGLET 2 : CLIENTS & COMPTES (LISTE, NOUVEAU CLIENT, APPROVISIONNEMENT)
// ─────────────────────────────────────────────────────────────────────────────
function AgentClientsTab({ showBanner }) {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddClient, setShowAddClient] = useState(false)
  const [showActivateEmail, setShowActivateEmail] = useState(false)
  const [depositClient, setDepositClient] = useState(null)
  const [historyClient, setHistoryClient] = useState(null)
  const [contractClient, setContractClient] = useState(null)

  const loadClients = async () => {
    try {
      setLoading(true)
      const res = await collectApi.getClients()
      setClients(res.clients || [])
    } catch (e) {
      showBanner(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClients()
  }, [])

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-gray-100">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
              <Users size={18} className="text-emerald-600" /> Répertoire des clients enregistrés & Zone
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Consultez tous les clients de votre agence et de votre zone, leurs soldes et approvisionnez leurs comptes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowActivateEmail(true)}
              className="btn-secondary text-xs py-2 px-3.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl flex items-center gap-1.5 font-bold transition-all shadow-2xs"
            >
              <Mail size={15} /> Activer par Email
            </button>
            <button
              onClick={() => setShowAddClient(true)}
              className="btn-primary text-xs py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center gap-1.5 font-bold shadow-2xs"
            >
              <Plus size={15} /> Nouveau client
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-400"><Loader2 size={24} className="animate-spin text-emerald-600 mx-auto" /></div>
        ) : clients.length === 0 ? (
          <div className="py-16 text-center text-gray-400 space-y-2">
            <Users size={36} className="mx-auto opacity-30 text-gray-400" />
            <p className="text-sm font-medium text-gray-600">Aucun client enregistré pour l'instant dans votre zone.</p>
            <p className="text-xs text-gray-400">Cliquez sur « Nouveau client » ou « Activer par Email » pour commencer.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  <th className="py-3 px-3">N° Compte</th>
                  <th className="py-3 px-3">Nom & Coordonnées Mobile Money</th>
                  <th className="py-3 px-3">Quartier & Zone</th>
                  <th className="py-3 px-3 text-right">Collecte Prévue</th>
                  <th className="py-3 px-3 text-right">Solde Collecte</th>
                  <th className="py-3 px-3 text-center">Statut Aujourd'hui</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {clients.map((c) => (
                  <tr key={c._id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-gray-700 whitespace-nowrap">
                      {c.accountNumber}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-gray-900">{c.fullName}</span>
                        {c.isOwnClient === false ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                            Zone {c.neighborhood}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                            Mon client
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        {c.momoMtn && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-yellow-50 text-yellow-800 border border-yellow-200 font-mono font-medium">
                            MTN: {c.momoMtn}
                          </span>
                        )}
                        {c.momoOrange && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-orange-50 text-orange-800 border border-orange-200 font-mono font-medium">
                            Orange: {c.momoOrange}
                          </span>
                        )}
                        {c.phone && !c.momoMtn && !c.momoOrange && (
                          <span className="text-[11px] text-gray-500">📱 {c.phone}</span>
                        )}
                        {c.email && (
                          <span className="text-[10px] text-gray-500 block truncate" title={c.email}>
                            ✉️ {c.email}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-gray-600">
                      <div className="font-medium text-gray-800">{c.neighborhood}</div>
                      {c.city && <div className="text-[11px] text-gray-400">{c.city}</div>}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-gray-600 whitespace-nowrap">
                      {fmt(c.dailyTarget)} <span className="text-[10px] text-gray-400">XAF/j</span>
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <span className="font-black text-sm text-emerald-700">{fmt(c.balance)}</span>{' '}
                      <span className="text-[10px] text-gray-400">XAF</span>
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {c.todayStatus === 'paye' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 size={11} /> Collecté
                        </span>
                      ) : c.todayStatus === 'non_paye' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          <X size={11} /> Non payé
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          <Clock size={11} /> En attente
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setContractClient(c)}
                          className="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                          title="Voir et imprimer le contrat officiel signé"
                        >
                          <FileText size={13} /> Contrat
                        </button>
                        <button
                          onClick={() => setDepositClient(c)}
                          className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                          title="Approvisionner le compte collecte de ce client"
                        >
                          <Wallet size={13} /> Approvisionner
                        </button>
                        <button
                          onClick={() => setHistoryClient(c)}
                          className="px-2 py-1 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg text-xs transition-colors"
                          title="Historique des versements"
                        >
                          Historique
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddClient && (
        <AddClientModal
          onClose={() => setShowAddClient(false)}
          onSuccess={() => {
            setShowAddClient(false)
            showBanner('Nouveau client enregistré avec succès avec contrat signé !')
            loadClients()
          }}
        />
      )}

      {showActivateEmail && (
        <ActivateByEmailModal
          onClose={() => setShowActivateEmail(false)}
          onSuccess={() => {
            setShowActivateEmail(false)
            showBanner('Compte collecte activé avec succès par email !')
            loadClients()
          }}
        />
      )}

      {depositClient && (
        <DepositModal
          client={depositClient}
          onClose={() => setDepositClient(null)}
          onSuccess={() => {
            setDepositClient(null)
            showBanner('Compte client approvisionné avec succès !')
            loadClients()
          }}
        />
      )}

      {historyClient && (
        <ClientHistoryModal
          client={historyClient}
          onClose={() => setHistoryClient(null)}
        />
      )}

      {contractClient && (
        <ClientContractModal
          client={contractClient}
          onClose={() => setContractClient(null)}
        />
      )}
    </div>
  )
}

// Modal d'enregistrement d'un nouveau client avec numéros Mobile Money, Termes & Conditions et Signatures au doigt
function AddClientModal({ onClose, onSuccess }) {
  const [step, setStep] = useState(1) // 1 = Coordonnées, 2 = Termes & Signatures au doigt
  const [fullName, setFullName] = useState('')
  const [momoMtn, setMomoMtn] = useState('')
  const [momoOrange, setMomoOrange] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [dailyTarget, setDailyTarget] = useState(1000)
  const [cni, setCni] = useState('')

  // Étape 2 : Termes & Signatures
  const [termsText, setTermsText] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [loadingTerms, setLoadingTerms] = useState(false)
  const [agentSignature, setAgentSignature] = useState('')
  const [clientSignature, setClientSignature] = useState('')

  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  // Charger les Termes & Conditions officiels fixés par le Super Admin
  const loadTerms = async () => {
    try {
      setLoadingTerms(true)
      const res = await collectApi.getConfig()
      if (res?.termsAndConditions) {
        setTermsText(res.termsAndConditions)
      } else {
        setTermsText(`1. Objet du Service : Le service de collecte journalière et d'épargne permet aux clients de confier un montant quotidien à un agent certifié KATD SCHULE pour constitution d'une épargne sécurisée.
2. Déduction mensuelle : Des frais de tenue de compte de 1 000 FCFA sont prélevés mensuellement sur le compte de collecte du client (si solde >= 2 000 FCFA).
3. Disponibilité des fonds : Le client et le super administrateur peuvent ordonner le retrait des fonds vers les numéros Mobile Money enregistrés.
4. Immuabilité et Transparence : Chaque versement quotidien enregistré donne lieu à une traçabilité inviolable sur la plateforme.`)
      }
    } catch {
      setTermsText(`Termes et Conditions de Collecte Journalière KATD SCHULE :
1. Dépôts quotidiens sécurisés et enregistrés en temps réel.
2. Frais mensuels de gestion de 1 000 FCFA déduits chaque mois du solde client.
3. Retraits disponibles via Mobile Money (MTN / Orange Money).`)
    } finally {
      setLoadingTerms(false)
    }
  }

  const handleGoToStep2 = (e) => {
    e?.preventDefault?.()
    const mtnVal = momoMtn.trim()
    const orangeVal = momoOrange.trim()

    if (!fullName.trim()) {
      setErr('Nom et prénom du client requis.')
      return
    }
    if (!mtnVal && !orangeVal) {
      setErr('Veuillez obligatoirement renseigner au moins un numéro Mobile Money (MTN MoMo ou Orange Money) pour le client.')
      return
    }
    if (!neighborhood.trim()) {
      setErr('Le quartier est obligatoire.')
      return
    }

    setErr('')
    loadTerms()
    setStep(2)
  }

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    const mtnVal = momoMtn.trim()
    const orangeVal = momoOrange.trim()

    if (!termsAccepted) {
      setErr('Veuillez cocher la case confirmant la prise de connaissance et l\'approbation des Termes & Conditions.')
      return
    }
    if (!agentSignature) {
      setErr('Veuillez apposer la signature numérique au doigt de l\'Agent de collecte.')
      return
    }
    if (!clientSignature) {
      setErr('Veuillez faire signer numériquement le Client avec son doigt sur l\'écran tactile.')
      return
    }

    setSaving(true)
    setErr('')
    try {
      await collectApi.addClient({
        fullName: fullName.trim(),
        phone: phone.trim() || mtnVal || orangeVal,
        momoMtn: mtnVal,
        momoOrange: orangeVal,
        email: email.trim().toLowerCase(),
        neighborhood: neighborhood.trim(),
        city: city.trim(),
        dailyTarget: Number(dailyTarget),
        cni: cni.trim(),
        agentSignature,
        clientSignature,
        termsContent: termsText,
      })
      onSuccess()
    } catch (e) {
      setErr(e.message || "Erreur lors de l'enregistrement.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-2xl border border-gray-100 space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                Étape {step} / 2
              </span>
              <h3 className="font-bold text-gray-900 text-base">
                {step === 1 ? 'Enregistrer un nouveau client' : 'Termes & Conditions et Signatures Numériques'}
              </h3>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {step === 1
                ? 'Coordonnées Mobile Money pour les retraits sécurisés'
                : 'Signature obligatoire au doigt de l\'agent et du client pour officialiser le contrat'}
            </p>
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

        {step === 1 ? (
          <form onSubmit={handleGoToStep2} className="space-y-3.5">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Nom et Prénom du client *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex : Amina Bello"
                className="input text-xs w-full"
              />
            </div>

            {/* Section Mobile Money obligatoire */}
            <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                <Smartphone size={15} className="text-amber-700" />
                <span>Numéros Mobile Money du client (Obligatoire : au moins un) *</span>
              </div>
              <p className="text-[11px] text-amber-800">
                Ces numéros apparaîtront automatiquement lors des retraits ordonnés par le client ou le Super Administrateur.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">Numéro MTN MoMo</label>
                  <input
                    type="tel"
                    value={momoMtn}
                    onChange={(e) => setMomoMtn(e.target.value)}
                    placeholder="Ex : 670000000"
                    className="input text-xs w-full font-mono bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">Numéro Orange Money</label>
                  <input
                    type="tel"
                    value={momoOrange}
                    onChange={(e) => setMomoOrange(e.target.value)}
                    placeholder="Ex : 690000000"
                    className="input text-xs w-full font-mono bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Téléphone d'appel (Optionnel)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex : 690000000"
                  className="input text-xs w-full"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Quartier *</label>
                <input
                  type="text"
                  required
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  placeholder="Ex : Marché Central"
                  className="input text-xs w-full"
                />
              </div>
            </div>

            {/* Email utilisateur */}
            <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-2xl space-y-1.5">
              <label className="text-xs font-bold text-blue-900 block flex items-center gap-1.5">
                <Mail size={14} className="text-blue-700" /> Email Utilisateur KATD (Optionnel)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ex : client@gmail.com"
                className="input text-xs w-full bg-white font-mono"
              />
              <p className="text-[11px] text-blue-800">
                Si le client a déjà un compte utilisateur KATD, son dashboard d'épargne dédié sera activé automatiquement. S'il n'en a pas encore, l'email sera associé dès sa future inscription.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Ville</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ex : Douala"
                  className="input text-xs w-full"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">CNI (Optionnel)</label>
                <input
                  type="text"
                  value={cni}
                  onChange={(e) => setCni(e.target.value)}
                  placeholder="Ex : 100234567"
                  className="input text-xs w-full"
                />
              </div>
            </div>

            <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[11px] text-gray-500">
              💡 Frais mensuels de gestion : 1 000 FCFA déduits chaque mois du solde de ce client (70% reversés dans votre portefeuille de commissions).
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button type="button" onClick={onClose} className="btn-secondary text-xs">
                Annuler
              </button>
              <button
                type="submit"
                className="btn-primary text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 font-bold"
              >
                <span>Continuer vers les Termes & Signatures</span>
                <ChevronRight size={15} />
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 animate-fade-in">
            {/* Boîte des termes et conditions */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <ShieldCheck size={15} className="text-emerald-600" />
                  Termes & Conditions définis par le Super Administrateur
                </label>
                <span className="text-[10px] text-gray-400 font-mono">Contrat KATD SCHULE</span>
              </div>
              <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl max-h-36 overflow-y-auto text-xs text-gray-700 whitespace-pre-line leading-relaxed shadow-inner">
                {loadingTerms ? (
                  <div className="py-4 text-center text-gray-400 flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin text-emerald-600" />
                    <span>Chargement des termes contractuels...</span>
                  </div>
                ) : (
                  termsText
                )}
              </div>
            </div>

            {/* Case à cocher d'approbation */}
            <label className="flex items-start gap-2.5 p-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 cursor-pointer">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 mt-0.5"
              />
              <span className="text-xs text-emerald-950 font-medium">
                Nous (l'Agent et le Client <strong>{fullName}</strong>) déclarons avoir pris connaissance et accepté sans réserve l'intégralité des termes et conditions contractuels régissant la collecte journalière KATD SCHULE.
              </span>
            </label>

            {/* Signatures numériques tactiles au doigt */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1">
                <SignaturePad
                  label="1. Signature de l'Agent (au doigt)"
                  onSave={(data) => setAgentSignature(data)}
                  onChange={(data) => setAgentSignature(data)}
                />
                <span className="text-[10px] text-gray-400 block px-1">
                  Tracé tactile de l'agent certifié en charge du compte
                </span>
              </div>

              <div className="space-y-1">
                <SignaturePad
                  label={`2. Signature du Client (${fullName || 'Client'})`}
                  onSave={(data) => setClientSignature(data)}
                  onChange={(data) => setClientSignature(data)}
                />
                <span className="text-[10px] text-gray-400 block px-1">
                  Tracé tactile du client validant l'ouverture de son compte
                </span>
              </div>
            </div>

            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900 flex items-center gap-2">
              <FileText size={16} className="shrink-0 text-blue-600" />
              <span>
                Une copie officielle signée de ce contrat sera immédiatement transmise à l'Administrateur pour téléchargement et impression.
              </span>
            </div>

            {/* Boutons d'action */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn-secondary text-xs flex items-center gap-1.5"
              >
                ← Modifier les coordonnées
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="btn-secondary text-xs">
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving || !termsAccepted || !agentSignature || !clientSignature}
                  className="btn-primary text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  <span>Valider et Signer le Contrat</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Modal d'activation directe d'un compte collecte par Email utilisateur
function ActivateByEmailModal({ onClose, onSuccess }) {
  const [email, setEmail] = useState('')
  const [momoMtn, setMomoMtn] = useState('')
  const [momoOrange, setMomoOrange] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [dailyTarget, setDailyTarget] = useState(1000)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    const cleanEmail = email.trim().toLowerCase()
    const mtnVal = momoMtn.trim()
    const orangeVal = momoOrange.trim()

    if (!cleanEmail) {
      setErr("L'adresse email du compte utilisateur KATD est requise.")
      return
    }
    if (!mtnVal && !orangeVal) {
      setErr('Veuillez obligatoirement renseigner au moins un numéro Mobile Money (MTN ou Orange) pour sécuriser le compte.')
      return
    }

    setSaving(true)
    setErr('')
    try {
      await collectApi.agentActivateByEmail({
        email: cleanEmail,
        momoMtn: mtnVal,
        momoOrange: orangeVal,
        neighborhood: neighborhood.trim(),
        dailyTarget: Number(dailyTarget),
      })
      onSuccess()
    } catch (e) {
      setErr(e.message || "Erreur lors de l'activation.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900 text-base">Activer un compte collecte par Email</h3>
            <p className="text-xs text-gray-500">Active immédiatement l'espace Épargne d'un utilisateur KATD</p>
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

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">
              Email Utilisateur KATD du client *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Ex : utilisateur@gmail.com"
              className="input text-xs w-full font-mono"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              L'email qu'il a utilisé (ou utilisera) pour se connecter à son compte KATD.
            </p>
          </div>

          <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-2.5">
            <label className="text-xs font-bold text-amber-900 block flex items-center gap-1">
              <Smartphone size={14} className="text-amber-700" /> Numéros Mobile Money du client *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-gray-600 block mb-1">MTN MoMo</label>
                <input
                  type="tel"
                  value={momoMtn}
                  onChange={(e) => setMomoMtn(e.target.value)}
                  placeholder="670000000"
                  className="input text-xs w-full font-mono bg-white"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-600 block mb-1">Orange Money</label>
                <input
                  type="tel"
                  value={momoOrange}
                  onChange={(e) => setMomoOrange(e.target.value)}
                  placeholder="690000000"
                  className="input text-xs w-full font-mono bg-white"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Quartier / Zone</label>
              <input
                type="text"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                placeholder="Ex : Akwa"
                className="input text-xs w-full"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Objectif journalier (XAF)</label>
              <input
                type="number"
                min="100"
                step="100"
                value={dailyTarget}
                onChange={(e) => setDailyTarget(e.target.value)}
                className="input text-xs w-full font-bold"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary text-xs">
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary text-xs bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 font-bold"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
              <span>Activer le compte collecte</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Modal d'approvisionnement (Momo ou Wallet)
function DepositModal({ client, onClose, onSuccess }) {
  const [method, setMethod] = useState('wallet') // wallet | momo
  const [amount, setAmount] = useState(1000)
  const [operator, setOperator] = useState('mtn')
  const [phone, setPhone] = useState(client.momoMtn || client.phone || '')
  const [walletBalance, setWalletBalance] = useState(0)
  const [loadingBalance, setLoadingBalance] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    walletApi.me()
      .then((res) => setWalletBalance(res?.balance ?? res?.wallet?.balance ?? 0))
      .catch(() => {})
      .finally(() => setLoadingBalance(false))
  }, [])

  const handleDeposit = async (e) => {
    e.preventDefault()
    const amt = Number(amount)
    if (!amt || amt <= 0) {
      setErr('Montant invalide.')
      return
    }

    setProcessing(true)
    setErr('')
    try {
      if (method === 'wallet') {
        if (walletBalance < amt) {
          throw new Error(`Solde de votre portefeuille insuffisant (${fmt(walletBalance)} FCFA).`)
        }
        await collectApi.depositWallet(client._id, { amount: amt })
        onSuccess()
      } else {
        await collectApi.depositMomo(client._id, {
          amount: amt,
          phone,
          operator,
          country: 'CM',
        })
        onSuccess()
      }
    } catch (e) {
      setErr(e.message || "Erreur lors de l'approvisionnement.")
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900 text-base">Approvisionner le compte</h3>
            <p className="text-xs text-gray-500">{client.fullName} ({client.accountNumber})</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {err && <div className="p-3 bg-red-50 text-red-800 text-xs rounded-xl">{err}</div>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMethod('wallet')}
            className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              method === 'wallet' ? 'bg-emerald-50 border-emerald-500 text-emerald-800' : 'bg-gray-50 border-gray-200 text-gray-600'
            }`}
          >
            <Wallet size={14} /> Mon Portefeuille
          </button>
          <button
            type="button"
            onClick={() => setMethod('momo')}
            className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              method === 'momo' ? 'bg-emerald-50 border-emerald-500 text-emerald-800' : 'bg-gray-50 border-gray-200 text-gray-600'
            }`}
          >
            <Smartphone size={14} /> Mobile Money
          </button>
        </div>

        <form onSubmit={handleDeposit} className="space-y-3.5">
          {method === 'wallet' && (
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
              <span>Solde disponible dans votre wallet :</span>
              <span className="font-black">{loadingBalance ? '...' : fmt(walletBalance)} XAF</span>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Montant à créditer (XAF) *</label>
            <input
              type="number"
              min="100"
              step="100"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input text-sm w-full font-bold"
            />
          </div>

          {method === 'momo' && (
            <>
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Opérateur</label>
                <select
                  value={operator}
                  onChange={(e) => {
                    const op = e.target.value
                    setOperator(op)
                    if (op === 'mtn') setPhone(client.momoMtn || client.phone || '')
                    else if (op === 'orange') setPhone(client.momoOrange || client.phone || '')
                  }}
                  className="input text-xs w-full"
                >
                  <option value="mtn">MTN Mobile Money</option>
                  <option value="orange">Orange Money</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Numéro Mobile Money *</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex : 690000000"
                  className="input text-xs w-full font-mono font-bold"
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary text-xs">
              Annuler
            </button>
            <button
              type="submit"
              disabled={processing}
              className="btn-primary text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
            >
              {processing ? <Loader2 size={14} className="animate-spin" /> : <Coins size={14} />}
              <span>Valider l'approvisionnement</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Modal d'historique des collectes d'un client
function ClientHistoryModal({ client, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    collectApi.getClient(client._id)
      .then((res) => setData(res))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [client._id])

  const monthlySummary = data?.monthlySummary || []
  const collections = data?.collections || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-2xl border border-gray-100 space-y-4 max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <Users size={18} className="text-emerald-600" />
              <span>Suivi & Historique personnalisé — {client.fullName}</span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Compte N° <span className="font-mono font-bold text-gray-700">{client.accountNumber}</span> • Quartier : <b>{client.neighborhood}</b> • Solde actuel : <b className="text-emerald-700">{fmt(client.balance)} XAF</b>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {loading ? (
            <div className="py-16 text-center text-gray-400"><Loader2 size={24} className="animate-spin mx-auto text-emerald-600" /></div>
          ) : (
            <>
              {/* Cumul des collectes journalières par mois */}
              {monthlySummary.length > 0 && (
                <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 rounded-2xl border border-emerald-100 space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-900 block flex items-center gap-1.5">
                    <Calendar size={13} /> Cumul des collectes par mois (Supervision)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {monthlySummary.map((m) => (
                      <div key={m._id} className="p-2.5 bg-white rounded-xl border border-emerald-200/60 shadow-2xs">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-gray-800 font-mono">{m._id}</span>
                          <span className="text-[10px] text-gray-400">{m.daysCount} jour(s)</span>
                        </div>
                        <div className="text-base font-black text-emerald-800 mt-0.5">
                          {fmt(m.totalAmount)} <span className="text-[10px] font-normal text-gray-500">XAF</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Détail de chaque versement journalier */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Historique journalier détaillé ({collections.length} versement(s))
                </h4>
                {collections.length === 0 ? (
                  <div className="py-8 text-center text-gray-400 text-xs bg-gray-50 rounded-2xl">
                    Aucun versement enregistré pour ce client.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {collections.map((col) => {
                      const isClientSelf = col.notes?.toLowerCase().includes('client') || col.notes?.toLowerCase().includes('espace') || col.notes?.toLowerCase().includes('ligne')
                      return (
                        <div key={col._id} className="p-3 bg-gray-50 hover:bg-gray-100/70 transition-colors rounded-2xl border border-gray-150 flex items-center justify-between">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-gray-900">{fmtDate(col.date)}</span>
                              {isClientSelf ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                                  👤 Payé par le client (en ligne)
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  🧑‍💼 Collecté par l'agent
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-gray-500 block">
                              Mode : <b>{col.paymentMethod === 'wallet' ? 'Portefeuille KATD' : (col.paymentMethod === 'momo' || col.paymentMethod === 'mtn' || col.paymentMethod === 'orange' ? 'Mobile Money' : col.paymentMethod)}</b>
                              {col.notes ? ` • ${col.notes}` : ''}
                            </span>
                          </div>
                          <div className="text-right">
                            <div className="font-black text-sm text-gray-900">+{fmt(col.amount)} XAF</div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              col.status === 'paye' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {col.status === 'paye' ? 'Collecté' : 'Non collecté'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="pt-2 border-t border-gray-100 flex justify-end">
          <button onClick={onClose} className="btn-secondary text-xs">
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. ONGLET 3 : RAPPORTS JOURNALIERS (ENVOI À L'ADMINISTRATEUR)
// ─────────────────────────────────────────────────────────────────────────────
function AgentReportsTab({ showBanner }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [notes, setNotes] = useState('')

  const loadReports = async () => {
    try {
      setLoading(true)
      const res = await collectApi.getAgentReports()
      setReports(res.reports || [])
    } catch (e) {
      showBanner(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReports()
  }, [])

  const handleSendTodayReport = async () => {
    setSubmitting(true)
    try {
      await collectApi.submitDailyReport({ notes })
      showBanner("Rapport du jour transmis à l'administrateur avec succès !")
      setNotes('')
      loadReports()
    } catch (e) {
      showBanner(e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 sm:p-6 space-y-4">
        <div className="pb-3 border-b border-gray-100">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
            <FileText size={18} className="text-emerald-600" /> Transmission du rapport journalier
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Votre rapport quotidien est compilé automatiquement et transmis à l'administration de la plateforme.
          </p>
        </div>

        <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
            <Send size={15} /> Envoyer le rapport d'aujourd'hui ({fmtDate(new Date())})
          </div>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observations ou notes particulières de la journée..."
            className="input text-xs w-full bg-white"
          />
          <button
            onClick={handleSendTodayReport}
            disabled={submitting}
            className="btn-primary text-xs py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center gap-1.5"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            <span>Transmettre le rapport du jour à l'administrateur</span>
          </button>
        </div>

        <div className="pt-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Historique des rapports envoyés</h3>
          {loading ? (
            <div className="py-12 text-center text-gray-400"><Loader2 size={20} className="animate-spin mx-auto" /></div>
          ) : reports.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-xs">Aucun rapport envoyé pour l'instant.</div>
          ) : (
            <div className="space-y-2">
              {reports.map((rep) => (
                <div key={rep._id} className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-black text-gray-900">Rapport du {fmtDate(rep.date)}</span>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      {rep.totalClients} client(s) • {rep.paidClientsCount} payé(s) • {rep.unpaidClientsCount} en retard
                    </div>
                    {rep.notes && <div className="text-[11px] text-gray-400 italic mt-0.5">« {rep.notes} »</div>}
                  </div>
                  <div className="text-right">
                    <div className="font-black text-sm text-emerald-700">{fmt(rep.totalCollected)} XAF</div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Transmis à l'admin
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. ONGLET 4 : PARAMÈTRES DE L'AGENCE
// ─────────────────────────────────────────────────────────────────────────────
function AgentSettingsTab({ agent, onUpdate, showBanner }) {
  const [agencyName, setAgencyName] = useState(agent?.agencyName || '')
  const [phone, setPhone] = useState(agent?.phone || '')
  const [city, setCity] = useState(agent?.city || '')
  const [neighborhood, setNeighborhood] = useState(agent?.neighborhood || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await collectApi.optIn({
        agencyName: agencyName.trim(),
        phone: phone.trim(),
        city: city.trim(),
        neighborhood: neighborhood.trim(),
      })
      showBanner('Paramètres de votre agence mis à jour avec succès !')
      onUpdate()
    } catch (e) {
      showBanner(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-gray-900">Paramètres de votre Agence</h2>
          <p className="text-xs text-gray-500 mt-0.5">Mettez à jour vos informations de contact et votre quartier d'intervention.</p>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Nom de l'Agence *</label>
            <input
              type="text"
              required
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              className="input text-sm w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Téléphone *</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input text-sm w-full"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Quartier *</label>
              <input
                type="text"
                required
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="input text-sm w-full"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Ville</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="input text-sm w-full"
            />
          </div>

          <div className="p-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs text-gray-600 space-y-1">
            <div className="font-bold text-gray-900">Mentions légales & Sécurité</div>
            <p>• Date d'adhésion aux termes : {fmtDate(agent?.termsAcceptedAt)}</p>
            <p>• Frais mensuels de service : 1 000 FCFA déduits par client chaque mois (70% pour l'agent, 30% pour la plateforme).</p>
            <p>• Interdiction formelle de retrait des fonds clients par l'agent ou l'administration.</p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="btn-primary text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            <span>Enregistrer les modifications</span>
          </button>
        </form>
      </div>
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANT : PORTEFEUILLE COMMISSIONS SÉPARÉ (70%) DE L'AGENT
// ─────────────────────────────────────────────────────────────────────────────
function AgentCommissionWalletTab({ showBanner, agent }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)

  const loadWallet = async () => {
    try {
      setLoading(true)
      const res = await collectApi.getCommissionWallet()
      setData(res)
    } catch (e) {
      showBanner(e.message || 'Erreur lors du chargement des commissions.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWallet()
  }, [])

  if (loading) {
    return (
      <div className="py-20 text-center">
        <Loader2 size={24} className="animate-spin text-emerald-600 mx-auto" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-800 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-white/15 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-xs">
              <Wallet size={14} /> Portefeuille Commissions Dédié (70%)
            </div>
            <h2 className="text-3xl sm:text-4xl font-black">
              {fmt(data?.balance)} <span className="text-lg font-bold text-emerald-200">XAF</span>
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100 max-w-md">
              Vous percevez automatiquement <b>70% de commission (700 FCFA / client)</b> sur les frais mensuels prélevés dès que le solde du client atteint au moins 2 000 FCFA.
            </p>
          </div>

          <div className="flex flex-col items-start sm:items-end gap-3">
            {data?.canWithdraw ? (
              <button
                onClick={() => setShowWithdrawModal(true)}
                disabled={!data?.balance || data.balance <= 0}
                className="bg-white text-emerald-800 hover:bg-emerald-50 disabled:opacity-50 text-xs sm:text-sm font-bold py-3 px-6 rounded-2xl shadow-lg flex items-center gap-2 transition-all cursor-pointer"
              >
                <ArrowDownCircle size={16} /> Retirer mes commissions
              </button>
            ) : (
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-3.5 text-left text-xs max-w-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-300">
                  <Clock size={14} /> Retrait bloqué temporairement
                </div>
                <p className="text-emerald-100 text-[11px] leading-relaxed">
                  Conformément aux règles de la plateforme, les retraits de commissions sont autorisés après chaque intervalle d'<b>un (1) mois</b>.
                </p>
                <p className="text-white font-bold text-[11px] pt-1">
                  Prochain retrait dans : <span className="text-amber-300">{data?.daysRemaining || 0} jour(s)</span> ({fmtDate(data?.nextWithdrawalDate)})
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cartes de synthèse */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4.5 border-l-4 border-emerald-500">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">Commissions cumulées</span>
          <div className="text-xl sm:text-2xl font-black text-gray-900 mt-1">
            {fmt(data?.totalEarned)} <span className="text-xs text-gray-400 font-normal">FCFA</span>
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold mt-0.5 block">70% de tous les frais mensuels</span>
        </div>

        <div className="card p-4.5 border-l-4 border-blue-500">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">Total déjà retiré</span>
          <div className="text-xl sm:text-2xl font-black text-gray-900 mt-1">
            {fmt(data?.totalWithdrawn)} <span className="text-xs text-gray-400 font-normal">FCFA</span>
          </div>
          <span className="text-[11px] text-gray-500 mt-0.5 block">Vers portefeuille ou Mobile Money</span>
        </div>

        <div className="card p-4.5 border-l-4 border-amber-500">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">Compte Collecte ouvert le</span>
          <div className="text-lg sm:text-xl font-black text-gray-900 mt-1">
            {fmtDate(data?.accountOpenedAt)}
          </div>
          <span className="text-[11px] text-gray-500 mt-0.5 block">
            Dernier retrait : {data?.lastWithdrawalAt ? fmtDate(data.lastWithdrawalAt) : 'Aucun retrait'}
          </span>
        </div>
      </div>

      {/* Historique des retraits de commissions */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900 text-base">Historique des retraits de commissions</h3>
            <p className="text-xs text-gray-500">Consultez tous vos décaissements de commissions mensuelles.</p>
          </div>
          <button
            onClick={loadWallet}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
            title="Actualiser"
          >
            <RefreshCw size={15} />
          </button>
        </div>

        {(!data?.withdrawals || data.withdrawals.length === 0) ? (
          <div className="py-12 text-center text-xs text-gray-400">
            Aucun retrait de commission effectué pour le moment.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3 text-right">Montant</th>
                  <th className="py-3 px-3">Destination</th>
                  <th className="py-3 px-3">Coordonnées</th>
                  <th className="py-3 px-3 text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.withdrawals.map((w, idx) => (
                  <tr key={w._id || idx} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-3 px-3 font-semibold text-gray-900">{fmtDate(w.withdrawnAt)}</td>
                    <td className="py-3 px-3 text-right font-black text-gray-900 whitespace-nowrap">
                      {fmt(w.amount)} <span className="text-[11px] font-normal text-gray-400">FCFA</span>
                    </td>
                    <td className="py-3 px-3 font-medium text-gray-700 capitalize">
                      {w.destination === 'wallet' ? 'Portefeuille KATD' : ('Mobile Money (' + (w.operator || 'MTN') + ')')}
                    </td>
                    <td className="py-3 px-3 text-gray-500 font-mono text-xs">
                      {w.phone || w.accountName || '—'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 size={12} /> Validé
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showWithdrawModal && (
        <AgentCommissionWithdrawModal
          maxAmount={data?.balance || 0}
          agentPhone={agent?.phone || ''}
          agentName={agent?.agencyName || ''}
          onClose={() => setShowWithdrawModal(false)}
          onSuccess={(msg) => {
            setShowWithdrawModal(false)
            showBanner(msg)
            loadWallet()
          }}
        />
      )}
    </div>
  )
}

function AgentCommissionWithdrawModal({ maxAmount, agentPhone, agentName, onClose, onSuccess }) {
  const [amount, setAmount] = useState(maxAmount)
  const [destination, setDestination] = useState('wallet') // 'wallet' | 'momo'
  const [operator, setOperator] = useState('mtn')
  const [phone, setPhone] = useState(agentPhone || '')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErr('')
    const amt = Number(amount)
    if (!amt || amt <= 0) {
      setErr('Veuillez saisir un montant valide.')
      return
    }
    if (amt > maxAmount) {
      setErr('Le montant ne peut pas dépasser votre solde disponible (' + fmt(maxAmount) + ' FCFA).')
      return
    }
    if (destination === 'momo' && !phone.trim()) {
      setErr('Veuillez renseigner le numéro Mobile Money.')
      return
    }

    setSubmitting(true)
    try {
      const res = await collectApi.withdrawCommissions({
        amount: amt,
        destination,
        operator,
        phone: phone.trim(),
        accountName: agentName,
      })
      onSuccess(res.message || 'Retrait de commissions effectué avec succès !')
    } catch (e) {
      setErr(e.message || 'Erreur lors du retrait de vos commissions.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <ArrowDownCircle size={18} className="text-emerald-600" /> Retirer mes commissions
            </h3>
            <p className="text-xs text-gray-500">70% de frais de collecte mensuels</p>
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
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-gray-700">Montant à retirer (FCFA) *</label>
              <button
                type="button"
                onClick={() => setAmount(maxAmount)}
                className="text-[11px] font-bold text-emerald-700 hover:underline"
              >
                Max ({fmt(maxAmount)} F)
              </button>
            </div>
            <input
              type="number"
              min="100"
              max={maxAmount}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input text-xs w-full font-bold"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Destination du retrait *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDestination('wallet')}
                className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                  destination === 'wallet'
                    ? 'border-emerald-600 bg-emerald-50/50 text-emerald-900 ring-2 ring-emerald-600/20'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Wallet size={18} className="text-emerald-600" />
                <span>Mon portefeuille</span>
              </button>
              <button
                type="button"
                onClick={() => setDestination('momo')}
                className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                  destination === 'momo'
                    ? 'border-emerald-600 bg-emerald-50/50 text-emerald-900 ring-2 ring-emerald-600/20'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Smartphone size={18} className="text-emerald-600" />
                <span>Mobile Money</span>
              </button>
            </div>
          </div>

          {destination === 'momo' && (
            <div className="space-y-3 p-3.5 bg-gray-50 rounded-2xl border border-gray-200">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Opérateur Mobile Money *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOperator('mtn')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold ${
                      operator === 'mtn' ? 'bg-yellow-500 text-white border-yellow-600' : 'bg-white text-gray-700 border-gray-200'
                    }`}
                  >
                    MTN Mobile Money
                  </button>
                  <button
                    type="button"
                    onClick={() => setOperator('orange')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold ${
                      operator === 'orange' ? 'bg-orange-500 text-white border-orange-600' : 'bg-white text-gray-700 border-gray-200'
                    }`}
                  >
                    Orange Money
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Numéro Mobile Money *</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex : 6XXXXXXXX"
                  className="input text-xs w-full font-mono"
                />
              </div>
            </div>
          )}

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
              disabled={submitting || !amount || Number(amount) <= 0}
              className="btn-primary text-xs py-2 px-4 rounded-xl flex items-center gap-1.5"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <ArrowDownCircle size={14} />}
              <span>Valider le retrait de {fmt(amount)} F</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
