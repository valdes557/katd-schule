import { useState, useEffect } from 'react'
import {
  Bot, Sparkles, CheckCircle2, XCircle, AlertTriangle, Search, Plus,
  CreditCard, Wallet, Users, Settings, RefreshCw, Power, ShieldAlert,
  ArrowUpRight, Coins, BarChart3, Edit, Trash2, Check, X, UserCheck, UserX,
  Gift, Layers
} from 'lucide-react'
import { aiApi } from '../lib/api'

export default function AdminUserAiPage() {
  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'packages' | 'subscriptions' | 'users'
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [message, setMessage] = useState({ text: '', type: '' })

  // Stats & Config
  const [stats, setStats] = useState(null)
  const [config, setConfig] = useState({ userFreeTrialQuota: 20, userAiGlobalEnabled: true })
  const [trialQuotaInput, setTrialQuotaInput] = useState(20)
  const [savingConfig, setSavingConfig] = useState(false)

  // Packages
  const [packages, setPackages] = useState([])
  const [showPackageModal, setShowPackageModal] = useState(false)
  const [editingPackage, setEditingPackage] = useState(null)
  const [pkgForm, setPkgForm] = useState({
    name: '',
    description: '',
    totalQuestions: 100,
    price: 1000,
    currency: 'F CFA',
    target: 'user',
    isActive: true,
  })
  const [savingPkg, setSavingPkg] = useState(false)

  // Subscriptions history
  const [subscriptions, setSubscriptions] = useState([])
  const [subStatusFilter, setSubStatusFilter] = useState('all')

  // Users management
  const [users, setUsers] = useState([])
  const [userSearch, setUserSearch] = useState('')
  const [usersLoading, setUsersLoading] = useState(false)
  const [creditModalUser, setCreditModalUser] = useState(null)
  const [creditAmount, setCreditAmount] = useState(50)
  const [creditReason, setCreditReason] = useState('')
  const [savingCredit, setSavingCredit] = useState(false)

  const showToast = (text, type = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage({ text: '', type: '' }), 5000)
  }

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const [statsRes, cfgRes, pkgsRes, subsRes] = await Promise.all([
        aiApi.getUserAiStats().catch(() => ({ data: null })),
        aiApi.getUserAiConfig().catch(() => ({ data: null })),
        aiApi.listPackages().catch(() => ({ data: [] })),
        aiApi.listUserSubscriptions().catch(() => ({ data: [] })),
      ])

      if (statsRes?.data) setStats(statsRes.data)
      if (cfgRes?.data) {
        setConfig(cfgRes.data)
        setTrialQuotaInput(cfgRes.data.userFreeTrialQuota ?? 20)
      }
      if (pkgsRes?.data) {
        setPackages(pkgsRes.data.filter((p) => ['user', 'all'].includes(p.target || 'all')))
      }
      if (subsRes?.data) setSubscriptions(subsRes.data)
    } catch (err) {
      showToast(err.message || 'Erreur de chargement des données', 'error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const loadUsers = async () => {
    setUsersLoading(true)
    try {
      const res = await aiApi.listUsersAi({ search: userSearch })
      if (res?.data) setUsers(res.data)
    } catch (err) {
      showToast(err.message || 'Erreur chargement utilisateurs', 'error')
    } finally {
      setUsersLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers()
    }
  }, [activeTab, userSearch])

  // Sauvegarder la configuration globale de l'essai gratuit
  const handleSaveConfig = async (e) => {
    e?.preventDefault()
    setSavingConfig(true)
    try {
      const val = parseInt(trialQuotaInput, 10)
      if (isNaN(val) || val < 0) {
        showToast("Le nombre de requêtes gratuites d'essai doit être supérieur ou égal à 0", 'error')
        return
      }
      const res = await aiApi.updateUserAiConfig({
        userFreeTrialQuota: val,
        userAiGlobalEnabled: config.userAiGlobalEnabled,
      })
      if (res?.data) {
        setConfig((prev) => ({ ...prev, ...res.data }))
        setTrialQuotaInput(res.data.userFreeTrialQuota)
      }
      showToast(res.message || "Nombre d'essais gratuits mis à jour avec succès !")
      loadData(true)
    } catch (err) {
      showToast(err.message || 'Erreur lors de la mise à jour', 'error')
    } finally {
      setSavingConfig(false)
    }
  }

  // Activer ou désactiver l'IA pour TOUS les utilisateurs
  const handleToggleAllUsers = async (enabled) => {
    const actionLabel = enabled ? "activer l'IA pour TOUS les utilisateurs" : "désactiver l'IA pour TOUS les utilisateurs"
    if (!window.confirm(`Confirmez-vous vouloir ${actionLabel} ?`)) return
    try {
      const res = await aiApi.toggleAllUsersAi({ enabled })
      showToast(res.message || 'Opération réussie !')
      setConfig((prev) => ({ ...prev, userAiGlobalEnabled: enabled }))
      loadData(true)
      if (activeTab === 'users') loadUsers()
    } catch (err) {
      showToast(err.message || 'Erreur lors de l’opération globale', 'error')
    }
  }

  // Activer ou désactiver l'IA pour un utilisateur individuel
  const handleToggleUser = async (user) => {
    const nextDisabled = !user.aiAccessDisabled
    try {
      const res = await aiApi.toggleUserAi(user._id, { disabled: nextDisabled })
      showToast(res.message || 'Statut utilisateur mis à jour !')
      setUsers((prev) =>
        prev.map((u) => (u._id === user._id ? { ...u, aiAccessDisabled: nextDisabled } : u))
      )
    } catch (err) {
      showToast(err.message || 'Erreur mise à jour utilisateur', 'error')
    }
  }

  // Créditer manuellement des requêtes à un utilisateur
  const handleCreditUser = async (e) => {
    e.preventDefault()
    if (!creditModalUser) return
    const qty = parseInt(creditAmount, 10)
    if (!qty || qty <= 0) {
      showToast('Veuillez saisir un nombre valide de requêtes à ajouter', 'error')
      return
    }
    setSavingCredit(true)
    try {
      const res = await aiApi.creditUserAi(creditModalUser._id, {
        amount: qty,
        reason: creditReason.trim() || `Bonus administrateur (+${qty})`,
      })
      showToast(res.message || `${qty} requêtes créditées avec succès !`)
      setCreditModalUser(null)
      setCreditReason('')
      setCreditAmount(50)
      loadUsers()
      loadData(true)
    } catch (err) {
      showToast(err.message || 'Erreur lors du crédit', 'error')
    } finally {
      setSavingCredit(false)
    }
  }

  // CRUD Forfaits Utilisateurs
  const openCreatePackage = () => {
    setEditingPackage(null)
    setPkgForm({
      name: 'Pack Découverte 100 Requêtes',
      description: 'Idéal pour le chat IA et la création de cours assistés par IA',
      totalQuestions: 100,
      price: 1000,
      currency: 'F CFA',
      target: 'user',
      isActive: true,
    })
    setShowPackageModal(true)
  }

  const openEditPackage = (pkg) => {
    setEditingPackage(pkg)
    setPkgForm({
      name: pkg.name || '',
      description: pkg.description || '',
      totalQuestions: pkg.totalQuestions || 100,
      price: pkg.price || 1000,
      currency: pkg.currency || 'F CFA',
      target: pkg.target || 'user',
      isActive: pkg.isActive !== false,
    })
    setShowPackageModal(true)
  }

  const handleSavePackage = async (e) => {
    e.preventDefault()
    if (!pkgForm.name.trim() || !pkgForm.totalQuestions || pkgForm.price === undefined) {
      showToast('Veuillez remplir tous les champs obligatoires du forfait', 'error')
      return
    }
    setSavingPkg(true)
    try {
      if (editingPackage) {
        await aiApi.updatePackage(editingPackage._id, pkgForm)
        showToast('Forfait mis à jour avec succès !')
      } else {
        await aiApi.createPackage(pkgForm)
        showToast('Nouveau forfait créé avec succès !')
      }
      setShowPackageModal(false)
      loadData(true)
    } catch (err) {
      showToast(err.message || 'Erreur enregistrement forfait', 'error')
    } finally {
      setSavingPkg(false)
    }
  }

  const handleDeletePackage = async (pkgId) => {
    if (!window.confirm('Voulez-vous vraiment supprimer ce forfait ?')) return
    try {
      await aiApi.removePackage(pkgId)
      showToast('Forfait supprimé avec succès !')
      loadData(true)
    } catch (err) {
      showToast(err.message || 'Erreur suppression forfait', 'error')
    }
  }

  const handleTogglePackageStatus = async (pkg) => {
    try {
      await aiApi.updatePackage(pkg._id, { isActive: !pkg.isActive })
      showToast(`Forfait ${!pkg.isActive ? 'activé' : 'désactivé'}`)
      loadData(true)
    } catch (err) {
      showToast(err.message || 'Erreur mise à jour forfait', 'error')
    }
  }

  const filteredSubscriptions = subscriptions.filter((s) => {
    if (subStatusFilter === 'all') return true
    return s.status === subStatusFilter
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-fade-in">
      {/* Toast Notification */}
      {message.text && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border flex items-center gap-2.5 text-sm transition-all animate-bounce ${
            message.type === 'error'
              ? 'bg-red-50 text-red-800 border-red-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          {message.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-800 text-white flex items-center justify-center shadow-lg shadow-indigo-100 shrink-0">
            <Bot size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">Gestion IA Utilisateurs</h1>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  config.userAiGlobalEnabled
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${config.userAiGlobalEnabled ? 'bg-emerald-500' : 'bg-red-500'}`} />
                {config.userAiGlobalEnabled ? 'IA Globale Activée' : 'IA Globale Désactivée'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Forfaits payants, quotas d'essai gratuit, historique des paiements et contrôle individuel ou massif des accès IA.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-1.5 transition-all"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>Actualiser</span>
          </button>

          {config.userAiGlobalEnabled ? (
            <button
              onClick={() => handleToggleAllUsers(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 flex items-center gap-1.5 transition-all shadow-sm"
              title="Désactive temporairement l'IA pour tous les utilisateurs"
            >
              <Power size={14} />
              <span>Désactiver pour tous</span>
            </button>
          ) : (
            <button
              onClick={() => handleToggleAllUsers(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1.5 transition-all shadow-md shadow-emerald-100"
              title="Active et débloque l'IA pour l'ensemble des utilisateurs"
            >
              <CheckCircle2 size={14} />
              <span>Activer pour tous les utilisateurs</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Revenus IA Utilisateurs</span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Coins size={18} />
            </span>
          </div>
          <div className="mt-3 text-xl sm:text-2xl font-black text-gray-900">
            {(stats?.totalRevenue || 0).toLocaleString('fr-FR')} <span className="text-xs font-bold text-gray-500">F CFA</span>
          </div>
          <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
            <ArrowUpRight size={13} className="text-emerald-500" />
            <span>{stats?.totalSubscriptions || 0} forfaits souscrits</span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Essai Gratuit / Utilisateur</span>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Gift size={18} />
            </span>
          </div>
          <div className="mt-3 text-xl sm:text-2xl font-black text-blue-600">
            {config.userFreeTrialQuota ?? 20} <span className="text-xs font-bold text-gray-500">requêtes</span>
          </div>
          <div className="text-[11px] text-gray-500 mt-1">Essai offert à chaque nouvel inscrit</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Utilisateurs avec Quota</span>
            <span className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Users size={18} />
            </span>
          </div>
          <div className="mt-3 text-xl sm:text-2xl font-black text-purple-600">
            {stats?.activeUsersWithQuota || 0} <span className="text-xs font-bold text-gray-400">/ {stats?.totalUsers || 0}</span>
          </div>
          <div className="text-[11px] text-gray-500 mt-1">Comptes avec requêtes IA disponibles</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Requêtes Achetées</span>
            <span className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Sparkles size={18} />
            </span>
          </div>
          <div className="mt-3 text-xl sm:text-2xl font-black text-amber-600">
            {(stats?.totalPurchasedQuestions || 0).toLocaleString('fr-FR')}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">Cumul total des packs vendus</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Settings size={16} />
          <span>Paramètres & Essai Gratuit</span>
        </button>

        <button
          onClick={() => setActiveTab('packages')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'packages'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Layers size={16} />
          <span>Plans de Paiement ({packages.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'subscriptions'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <CreditCard size={16} />
          <span>Historique des Paiements ({subscriptions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'users'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Users size={16} />
          <span>Utilisateurs & Contrôle Quotas</span>
        </button>
      </div>

      {/* TAB 1: PARAMÈTRES & ESSAI GRATUIT */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
          {/* Formulaire Essai Gratuit */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
                <Gift size={20} />
              </span>
              <div>
                <h3 className="text-base font-bold text-gray-900">Quota d'Essai Gratuit par Utilisateur</h3>
                <p className="text-xs text-gray-500">
                  Nombre de requêtes offertes automatiquement à chaque utilisateur lors de sa première utilisation.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1.5">
                  Nombre de requêtes gratuites (par défaut : 20)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    value={trialQuotaInput}
                    onChange={(e) => setTrialQuotaInput(e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="20"
                  />
                  <button
                    type="submit"
                    disabled={savingConfig}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-sm"
                  >
                    {savingConfig ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-2">
                  Ce quota s'applique immédiatement à tous les utilisateurs. Une fois ce quota atteint, l'utilisateur est invité à acheter un forfait.
                </p>
              </div>
            </form>

            <div className="pt-4 border-t border-gray-100 space-y-3">
              <h4 className="text-xs font-bold uppercase text-gray-500">Statut de l'interrupteur global</h4>
              <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-gray-800">
                    {config.userAiGlobalEnabled ? 'Accès IA ouvert aux utilisateurs' : 'Accès IA temporairement suspendu'}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    Contrôle si les utilisateurs peuvent envoyer des messages au Chat IA et générer des Cours IA.
                  </div>
                </div>
                <button
                  onClick={() => handleToggleAllUsers(!config.userAiGlobalEnabled)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    config.userAiGlobalEnabled
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {config.userAiGlobalEnabled ? 'Activé' : 'Désactivé'}
                </button>
              </div>
            </div>
          </div>

          {/* Actions Massives & Sécurité */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
                <ShieldAlert size={20} />
              </span>
              <div>
                <h3 className="text-base font-bold text-gray-900">Actions d'Activation Massive</h3>
                <p className="text-xs text-gray-500">
                  Débloquez ou suspendez les accès pour l'ensemble des utilisateurs enregistrés sur KATD-SCHÜLE.
                </p>
              </div>
            </div>

            <div className="space-y-3.5 pt-2">
              <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-2xl flex items-start gap-3">
                <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-emerald-900">Activer l'IA pour TOUS les utilisateurs</h4>
                  <p className="text-[11px] text-emerald-700">
                    Débloque instantanément tous les comptes utilisateurs ayant été désactivés individuellement et active l'interrupteur global.
                  </p>
                  <button
                    onClick={() => handleToggleAllUsers(true)}
                    className="mt-2 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all shadow-sm"
                  >
                    Exécuter l'activation pour tous
                  </button>
                </div>
              </div>

              <div className="p-4 bg-red-50/70 border border-red-100 rounded-2xl flex items-start gap-3">
                <XCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-red-900">Désactiver l'IA pour TOUS les utilisateurs</h4>
                  <p className="text-[11px] text-red-700">
                    Coupe temporairement l'accès IA pour l'ensemble des utilisateurs (par exemple en cas de maintenance ou de surcharge serveur).
                  </p>
                  <button
                    onClick={() => handleToggleAllUsers(false)}
                    className="mt-2 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-all shadow-sm"
                  >
                    Suspendre pour tous
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PLANS DE PAIEMENT */}
      {activeTab === 'packages' && (
        <div className="space-y-5 animate-fade-in">
          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">Plans de Paiement pour l'IA Utilisateur</h3>
              <p className="text-xs text-gray-500">
                L'utilisateur peut recharger ses requêtes IA en payant par Portefeuille KATD-SCHÜLE ou Mobile Money (ex: 100 requêtes = 1 000 F CFA).
              </p>
            </div>
            <button
              onClick={openCreatePackage}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs sm:text-sm font-bold hover:bg-indigo-700 flex items-center gap-1.5 transition-all shadow-sm shrink-0"
            >
              <Plus size={16} />
              <span>Nouveau Forfait</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {packages.map((pkg) => (
              <div
                key={pkg._id}
                className={`bg-white rounded-3xl p-5 border transition-all relative flex flex-col justify-between ${
                  pkg.isActive ? 'border-gray-200 shadow-sm hover:shadow-md' : 'border-gray-200 bg-gray-50 opacity-75'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        pkg.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {pkg.isActive ? 'Actif' : 'Désactivé'}
                    </span>
                    <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                      {pkg.target === 'all' ? 'Tous publics' : 'Utilisateurs'}
                    </span>
                  </div>

                  <h4 className="text-base font-black text-gray-900">{pkg.name}</h4>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{pkg.description || 'Aucune description'}</p>

                  <div className="my-5 p-4 bg-gray-50 rounded-2xl flex items-center justify-between border border-gray-100">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-gray-400">Requêtes accordées</div>
                      <div className="text-xl font-black text-indigo-600">
                        {pkg.totalQuestions} <span className="text-xs font-bold text-gray-600">requêtes</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-gray-400">Tarif</div>
                      <div className="text-xl font-black text-gray-900">
                        {pkg.price.toLocaleString('fr-FR')} <span className="text-xs font-bold text-gray-500">{pkg.currency || 'F CFA'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => handleTogglePackageStatus(pkg)}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      pkg.isActive
                        ? 'border-red-200 text-red-600 hover:bg-red-50'
                        : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                    }`}
                  >
                    {pkg.isActive ? 'Désactiver' : 'Activer'}
                  </button>
                  <button
                    onClick={() => openEditPackage(pkg)}
                    className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-all"
                    title="Modifier ce forfait"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDeletePackage(pkg._id)}
                    className="p-2 rounded-xl text-red-500 hover:bg-red-50 transition-all"
                    title="Supprimer ce forfait"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: HISTORIQUE DES PAIEMENTS */}
      {activeTab === 'subscriptions' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-900">Historique des Paiements & Activations IA</h3>
              <p className="text-xs text-gray-500">
                Paiements par portefeuille KATD-SCHÜLE et Mobile Money (Ikeepay) effectués par les utilisateurs.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400">Statut :</span>
              <select
                value={subStatusFilter}
                onChange={(e) => setSubStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 focus:outline-none"
              >
                <option value="all">Tous ({subscriptions.length})</option>
                <option value="approved">Validés / Approuvés</option>
                <option value="pending">En attente Mobile Money</option>
                <option value="failed">Échoués</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5 rounded-l-2xl">Utilisateur</th>
                  <th className="p-3.5">Forfait IA</th>
                  <th className="p-3.5">Requêtes</th>
                  <th className="p-3.5">Montant Payé</th>
                  <th className="p-3.5">Moyen de paiement</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5 rounded-r-2xl text-right">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSubscriptions.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-gray-400 text-sm">
                      Aucune transaction ou souscription enregistrée pour le moment.
                    </td>
                  </tr>
                ) : (
                  filteredSubscriptions.map((s) => (
                    <tr key={s._id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-gray-900">{s.user?.name || 'Utilisateur'}</div>
                        <div className="text-[11px] text-gray-400">{s.user?.email || s.user?.phone || '—'}</div>
                      </td>
                      <td className="p-3.5 font-semibold text-gray-800">{s.packageName}</td>
                      <td className="p-3.5 font-bold text-indigo-600">+{s.totalQuestions}</td>
                      <td className="p-3.5 font-black text-gray-900">
                        {s.price?.toLocaleString('fr-FR')} {s.currency || 'F CFA'}
                      </td>
                      <td className="p-3.5">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700">
                          {s.paymentMethod === 'wallet' && <Wallet size={12} className="text-blue-600" />}
                          {s.paymentMethod === 'mobile_money' && <CreditCard size={12} className="text-amber-600" />}
                          {s.paymentMethod === 'admin_grant' && <Gift size={12} className="text-purple-600" />}
                          <span>
                            {s.paymentMethod === 'wallet' ? 'Portefeuille' : s.paymentMethod === 'mobile_money' ? 'Mobile Money' : 'Don Admin'}
                          </span>
                        </span>
                      </td>
                      <td className="p-3.5 text-gray-500 text-[11px]">
                        {new Date(s.createdAt).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="p-3.5 text-right">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            s.status === 'approved'
                              ? 'bg-emerald-50 text-emerald-700'
                              : s.status === 'pending'
                              ? 'bg-amber-50 text-amber-700 animate-pulse'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {s.status === 'approved' ? 'Validé' : s.status === 'pending' ? 'En attente' : 'Échoué'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: UTILISATEURS & CONTRÔLE QUOTAS */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-900">Gestion des Utilisateurs Publics</h3>
              <p className="text-xs text-gray-500">
                Suivez la consommation d'essai gratuit, créditez des requêtes bonus ou désactivez l'IA d'un utilisateur spécifique.
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par nom, email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5 rounded-l-2xl">Utilisateur</th>
                  <th className="p-3.5">Essai Gratuit</th>
                  <th className="p-3.5">Quota Payé</th>
                  <th className="p-3.5">Total Disponible</th>
                  <th className="p-3.5">Statut IA</th>
                  <th className="p-3.5 rounded-r-2xl text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usersLoading ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-gray-400 text-sm">
                      <RefreshCw size={20} className="animate-spin inline-block mr-2" />
                      Chargement des utilisateurs...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-gray-400 text-sm">
                      Aucun utilisateur trouvé avec ce critère.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u._id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-gray-900">{u.name}</div>
                        <div className="text-[11px] text-gray-400">{u.email || u.phone || '—'}</div>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-700">
                            {u.aiFreeTrialUsed || 0} / {config.userFreeTrialQuota ?? 20}
                          </span>
                          <span className="text-[10px] text-gray-400">consommées</span>
                        </div>
                        <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                          <div
                            className="h-full bg-blue-500"
                            style={{
                              width: `${Math.min(
                                100,
                                ((u.aiFreeTrialUsed || 0) / (config.userFreeTrialQuota || 20)) * 100
                              )}%`,
                            }}
                          />
                        </div>
                      </td>
                      <td className="p-3.5 font-bold text-gray-800">{u.aiQuestionsQuota || 0} requêtes</td>
                      <td className="p-3.5 font-black text-indigo-600 text-sm">{u.totalRemaining || 0} requêtes</td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            u.aiAccessDisabled
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {u.aiAccessDisabled ? 'Désactivé' : 'Actif'}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setCreditModalUser(u)}
                            className="px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-[11px] font-bold flex items-center gap-1 transition-all"
                            title="Créditer manuellement des requêtes"
                          >
                            <Gift size={13} />
                            <span>Créditer</span>
                          </button>

                          <button
                            onClick={() => handleToggleUser(u)}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all border ${
                              u.aiAccessDisabled
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                            }`}
                            title={u.aiAccessDisabled ? "Activer l'IA pour cet utilisateur" : "Désactiver l'IA pour cet utilisateur"}
                          >
                            {u.aiAccessDisabled ? <UserCheck size={13} /> : <UserX size={13} />}
                            <span>{u.aiAccessDisabled ? 'Activer IA' : 'Désactiver IA'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL FORFAIT IA (Ajout / Édition) */}
      {showPackageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-gray-100 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Bot size={20} />
                </span>
                <h3 className="text-base font-bold text-gray-900">
                  {editingPackage ? 'Modifier le Forfait IA' : 'Nouveau Forfait IA Utilisateur'}
                </h3>
              </div>
              <button
                onClick={() => setShowPackageModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePackage} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Nom du forfait *</label>
                <input
                  type="text"
                  required
                  value={pkgForm.name}
                  onChange={(e) => setPkgForm({ ...pkgForm, name: e.target.value })}
                  placeholder="ex: Pack 100 Requêtes IA"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Nombre de requêtes *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={pkgForm.totalQuestions}
                    onChange={(e) => setPkgForm({ ...pkgForm, totalQuestions: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Prix (F CFA) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={pkgForm.price}
                    onChange={(e) => setPkgForm({ ...pkgForm, price: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Description courte</label>
                <textarea
                  rows="2"
                  value={pkgForm.description}
                  onChange={(e) => setPkgForm({ ...pkgForm, description: e.target.value })}
                  placeholder="Idéal pour les élèves, parents ou autodidactes..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Audience cible</label>
                  <select
                    value={pkgForm.target}
                    onChange={(e) => setPkgForm({ ...pkgForm, target: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 focus:outline-none"
                  >
                    <option value="user">Utilisateurs publics</option>
                    <option value="all">Tous (utilisateurs & écoles)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Statut</label>
                  <select
                    value={pkgForm.isActive ? 'active' : 'inactive'}
                    onChange={(e) => setPkgForm({ ...pkgForm, isActive: e.target.value === 'active' })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 focus:outline-none"
                  >
                    <option value="active">Actif (en vente)</option>
                    <option value="inactive">Désactivé (masqué)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowPackageModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingPkg}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-md transition-all disabled:opacity-50"
                >
                  {savingPkg ? 'Enregistrement...' : editingPackage ? 'Mettre à jour' : 'Créer le forfait'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CRÉDITER MANUELLEMENT DES REQUÊTES */}
      {creditModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                  <Gift size={20} />
                </span>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Créditer des requêtes IA</h3>
                  <p className="text-xs text-gray-500">{creditModalUser.name}</p>
                </div>
              </div>
              <button
                onClick={() => setCreditModalUser(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreditUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">
                  Nombre de requêtes à ajouter
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[20, 50, 100, 200].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setCreditAmount(n)}
                      className={`py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        creditAmount === n
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      +{n}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  required
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Motif / Justification</label>
                <input
                  type="text"
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  placeholder="ex: Geste commercial, satisfaction utilisateur..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setCreditModalUser(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingCredit}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-md transition-all disabled:opacity-50"
                >
                  {savingCredit ? 'Attribution...' : `Ajouter +${creditAmount} requêtes`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
