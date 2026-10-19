// pages/user/UserCollectPage.jsx — Espace Collecte Journalière (Agent & Utilisateur).
import { useState, useEffect } from 'react'
import {
  Coins, Loader2, Users, CheckCircle2, AlertCircle, X, Plus, Calendar,
  TrendingUp, Clock, AlertTriangle, ArrowUpRight, Wallet, Smartphone,
  FileText, Send, ShieldCheck, Edit2, Trash2, MapPin, RefreshCw, ChevronRight,
} from 'lucide-react'
import { collectApi, walletApi } from '../../lib/api'

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')

export default function UserCollectPage() {
  const [loading, setLoading] = useState(true)
  const [agentStatus, setAgentStatus] = useState(null)
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
            <span className="text-lg font-bold">1 100 FCFA <span className="text-xs font-normal text-emerald-200">/ client / mois</span></span>
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

      {tab === 'dashboard' && <AgentDashboardTab showBanner={showBanner} agent={agentStatus.agent} />}
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
              <b>Frais de gestion :</b> Une somme forfaitaire de <b>1 100 FCFA</b> sera prélevée chaque mois sur le compte de chaque client que vous enregistrez pour assurer la gestion et la sécurité du service.
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
function AgentDashboardTab({ showBanner }) {
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
                {collections.map((col) => (
                  <tr key={col._id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-3 px-3 font-semibold text-gray-900">
                      <div>{col.clientName}</div>
                      {col.clientPhone && <div className="text-[11px] text-gray-400 font-normal">📱 {col.clientPhone}</div>}
                    </td>
                    <td className="py-3 px-3 text-gray-600">{col.neighborhood || '—'}</td>
                    <td className="py-3 px-3 text-right font-black text-gray-900 whitespace-nowrap">
                      {fmt(col.amount)} <span className="text-[11px] font-normal text-gray-400">XAF</span>
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {col.status === 'paye' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 size={12} /> Payé
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
                          <X size={12} /> Non payé
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-gray-500 capitalize">{col.paymentMethod || 'Espèces'}</td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setEditItem(col); setShowAddModal(true) }}
                          className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Modifier"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(col._id)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={15} />
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

// Modal d'ajout / modification d'une ligne de collecte du jour
function DailyCollectModal({ item, clients, defaultDate, onClose, onSuccess }) {
  const [clientId, setClientId] = useState(item?.client || (clients[0]?._id || ''))
  const [amount, setAmount] = useState(item?.amount ?? (clients[0]?.dailyTarget || 1000))
  const [neighborhood, setNeighborhood] = useState(item?.neighborhood || '')
  const [status, setStatus] = useState(item?.status || 'paye')
  const [paymentMethod, setPaymentMethod] = useState(item?.paymentMethod || 'especes')
  const [notes, setNotes] = useState(item?.notes || '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  // Mise à jour automatique du quartier et du montant prévu lors de la sélection du client
  const handleClientChange = (id) => {
    setClientId(id)
    const selected = clients.find((c) => c._id === id)
    if (selected) {
      if (selected.neighborhood) setNeighborhood(selected.neighborhood)
      if (selected.dailyTarget) setAmount(selected.dailyTarget)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!clientId) {
      setErr('Veuillez sélectionner un client.')
      return
    }

    setSaving(true)
    setErr('')
    try {
      if (item?._id) {
        await collectApi.updateDailyCollection(item._id, {
          amount: Number(amount),
          neighborhood,
          status,
          paymentMethod,
          notes,
        })
      } else {
        await collectApi.addDailyCollection({
          clientId,
          amount: Number(amount),
          neighborhood,
          status,
          paymentMethod,
          notes,
          date: defaultDate,
        })
      }
      onSuccess()
    } catch (e) {
      setErr(e.message || "Erreur lors de l'enregistrement.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 text-base">
            {item ? 'Modifier la collecte' : 'Nouvelle collecte journalière'}
          </h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {err && <div className="p-3 bg-red-50 text-red-800 text-xs rounded-xl">{err}</div>}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Client *</label>
            <select
              value={clientId}
              onChange={(e) => handleClientChange(e.target.value)}
              disabled={!!item}
              className="input text-xs w-full"
            >
              <option value="">Sélectionner un client...</option>
              {clients.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.fullName} ({c.neighborhood || 'Sans quartier'}) — Solde : {fmt(c.balance)} F
                </option>
              ))}
            </select>
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
                className="input text-xs w-full"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Quartier</label>
              <input
                type="text"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                placeholder="Quartier..."
                className="input text-xs w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Statut *</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="input text-xs w-full"
              >
                <option value="paye">✅ Payé</option>
                <option value="non_paye">❌ Non payé</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Mode de paiement</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="input text-xs w-full"
              >
                <option value="especes">Espèces</option>
                <option value="momo">Mobile Money</option>
                <option value="wallet">Portefeuille Agent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Remarques / Notes (optionnel)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex : Réglé en matinée"
              className="input text-xs w-full"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary text-xs">
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              <span>{item ? 'Mettre à jour' : 'Enregistrer la collecte'}</span>
            </button>
          </div>
        </form>
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
  const [depositClient, setDepositClient] = useState(null)
  const [historyClient, setHistoryClient] = useState(null)

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
              <Users size={18} className="text-emerald-600" /> Répertoire des clients enregistrés
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Consultez les soldes des comptes collecte et approvisionnez les comptes par Momo ou Wallet.
            </p>
          </div>
          <button
            onClick={() => setShowAddClient(true)}
            className="btn-primary text-xs py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center gap-1.5"
          >
            <Plus size={15} /> Nouveau client
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-400"><Loader2 size={24} className="animate-spin text-emerald-600 mx-auto" /></div>
        ) : clients.length === 0 ? (
          <div className="py-16 text-center text-gray-400 space-y-2">
            <Users size={36} className="mx-auto opacity-30 text-gray-400" />
            <p className="text-sm font-medium text-gray-600">Aucun client enregistré pour l'instant.</p>
            <p className="text-xs text-gray-400">Cliquez sur « Nouveau client » pour commencer à enregistrer des collectes.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  <th className="py-3 px-3">N° Compte</th>
                  <th className="py-3 px-3">Nom du Client</th>
                  <th className="py-3 px-3">Quartier & Ville</th>
                  <th className="py-3 px-3 text-right">Collecte Prévue</th>
                  <th className="py-3 px-3 text-right">Solde Collecte</th>
                  <th className="py-3 px-3 text-center">Statut Aujourd'hui</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {clients.map((c) => (
                  <tr key={c._id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-gray-700">{c.accountNumber}</td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-gray-900">{c.fullName}</div>
                      <div className="text-[11px] text-gray-400">📱 {c.phone}</div>
                    </td>
                    <td className="py-3 px-3 text-gray-600">
                      <div>{c.neighborhood}</div>
                      {c.city && <div className="text-[11px] text-gray-400">{c.city}</div>}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-gray-600">
                      {fmt(c.dailyTarget)} <span className="text-[10px] text-gray-400">XAF/j</span>
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <span className="font-black text-sm text-emerald-700">{fmt(c.balance)}</span>{' '}
                      <span className="text-[10px] text-gray-400">XAF</span>
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {c.todayStatus === 'paye' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 size={11} /> Payé
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
                          onClick={() => setDepositClient(c)}
                          className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-semibold flex items-center gap-1"
                          title="Approvisionner le compte collecte"
                        >
                          <Wallet size={13} /> Approvisionner
                        </button>
                        <button
                          onClick={() => setHistoryClient(c)}
                          className="px-2 py-1 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg text-xs"
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
            showBanner('Nouveau client enregistré avec succès !')
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
    </div>
  )
}

// Modal d'enregistrement d'un nouveau client
function AddClientModal({ onClose, onSuccess }) {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [dailyTarget, setDailyTarget] = useState(1000)
  const [cni, setCni] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!fullName.trim() || !phone.trim() || !neighborhood.trim()) {
      setErr('Nom, téléphone et quartier sont obligatoires.')
      return
    }

    setSaving(true)
    setErr('')
    try {
      await collectApi.addClient({
        fullName: fullName.trim(),
        phone: phone.trim(),
        neighborhood: neighborhood.trim(),
        city: city.trim(),
        dailyTarget: Number(dailyTarget),
        cni: cni.trim(),
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
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 text-base">Enregistrer un nouveau client</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {err && <div className="p-3 bg-red-50 text-red-800 text-xs rounded-xl">{err}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Téléphone *</label>
              <input
                type="tel"
                required
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Collecte journalière prévue</label>
              <input
                type="number"
                min="100"
                step="100"
                value={dailyTarget}
                onChange={(e) => setDailyTarget(e.target.value)}
                className="input text-xs w-full"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Numéro CNI (optionnel)</label>
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
            💡 Les frais mensuels de gestion (1 100 FCFA) s'appliqueront chaque mois sur ce compte client.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary text-xs">
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              <span>Enregistrer le client</span>
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
  const [phone, setPhone] = useState(client.phone || '')
  const [operator, setOperator] = useState('mtn')
  const [walletBalance, setWalletBalance] = useState(0)
  const [loadingBalance, setLoadingBalance] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    walletApi.me()
      .then((res) => setWalletBalance(res?.wallet?.balance || 0))
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
                <label className="text-xs font-bold text-gray-700 block mb-1">Numéro Mobile Money *</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex : 690000000"
                  className="input text-xs w-full"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Opérateur</label>
                <select
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  className="input text-xs w-full"
                >
                  <option value="mtn">MTN Mobile Money</option>
                  <option value="orange">Orange Money</option>
                </select>
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-gray-100 space-y-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900 text-base">Historique des collectes</h3>
            <p className="text-xs text-gray-500">{client.fullName} • Solde actuel : <b>{fmt(client.balance)} XAF</b></p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {loading ? (
            <div className="py-12 text-center text-gray-400"><Loader2 size={22} className="animate-spin mx-auto" /></div>
          ) : (data?.collections || []).length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-xs">Aucun versement enregistré pour ce client.</div>
          ) : (
            <div className="space-y-2">
              {data.collections.map((col) => (
                <div key={col._id} className="p-3 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-gray-800">{fmtDate(col.date)}</span>
                    <span className="text-[11px] text-gray-400 block">{col.paymentMethod} • {col.neighborhood}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-sm text-gray-900">{fmt(col.amount)} XAF</div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      col.status === 'paye' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {col.status === 'paye' ? 'Payé' : 'Non payé'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
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
            <p>• Frais mensuels de service : 1 100 FCFA déduits par client chaque mois.</p>
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
