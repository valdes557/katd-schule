// pages/AdminCollectPage.jsx — Gestion des Collectes Journalières côté Administrateur.
import { useState, useEffect } from 'react'
import {
  Coins, Loader2, Users, CheckCircle2, AlertCircle, X, Shield,
  TrendingUp, Calendar, AlertTriangle, ArrowUpRight, FileText, Ban,
  Eye, RefreshCw, Save, MapPin, Edit3, Lock, ArrowDownCircle, Smartphone, Wallet,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { collectApi } from '../lib/api'

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')

export default function AdminCollectPage() {
  const [tab, setTab] = useState('agents') // agents | fees | terms
  const [overview, setOverview] = useState(null)
  const [agents, setAgents] = useState([])
  const [feesSummary, setFeesSummary] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [statusModalAgent, setStatusModalAgent] = useState(null)
  const [statusReason, setStatusReason] = useState('')
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [banner, setBanner] = useState({ type: '', text: '' })

  const loadData = async () => {
    try {
      setLoading(true)
      const [ovRes, agRes, feesRes] = await Promise.all([
        collectApi.adminOverview(),
        collectApi.adminAgents(),
        collectApi.adminFeesSummary(),
      ])
      setOverview(ovRes.stats)
      setAgents(agRes.agents || [])
      setFeesSummary(feesRes.summary || [])
    } catch (e) {
      setBanner({ type: 'error', text: e.message || 'Erreur lors du chargement des données.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const showBanner = (text, type = 'success') => {
    setBanner({ text, type })
    setTimeout(() => setBanner({ text: '', type: '' }), 5000)
  }

  const handleToggleStatus = async (agent, newStatus) => {
    setUpdatingStatus(true)
    try {
      await collectApi.adminToggleAgentStatus(agent._id, {
        status: newStatus,
        reason: statusReason,
      })
      showBanner(`Statut de l'agent ${agent.agencyName} mis à jour avec succès.`)
      setStatusModalAgent(null)
      setStatusReason('')
      loadData()
    } catch (e) {
      showBanner(e.message, 'error')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleTriggerMonthlyFees = async () => {
    if (!window.confirm('Voulez-vous synchroniser et déduire les frais mensuels de 1 100 FCFA sur tous les comptes clients actifs ?')) return
    try {
      setLoading(true)
      const res = await collectApi.adminTriggerMonthlyFees()
      showBanner(res.message || 'Frais mensuels synchronisés avec succès !')
      loadData()
    } catch (e) {
      showBanner(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* En-tête de la page */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
            <Coins size={24} className="text-emerald-600" /> Gestion des Collectes Journalières
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Supervision des agents de collecte, répertoire des clients enregistrés, rapports et frais mensuels.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/dashboard/frais-transaction-admin"
            className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5 rounded-xl border border-gray-200"
          >
            <ArrowUpRight size={15} /> Frais de transaction
          </Link>
          <button
            onClick={loadData}
            disabled={loading}
            className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 rounded-xl"
            title="Actualiser"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {banner.text && (
        <div className={`p-4 rounded-2xl text-xs sm:text-sm font-medium flex items-center gap-3 border shadow-sm ${
          banner.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
        }`}>
          {banner.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{banner.text}</span>
        </div>
      )}

      {/* Règle de sanctuarisation stricte */}
      <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-900">
        <Lock size={18} className="text-amber-700 shrink-0 mt-0.5" />
        <div>
          <b className="font-bold">Sanctuarisation des fonds de collecte :</b> Conformément aux règles strictes de la plateforme, ni l'agent de collecte ni l'administrateur n'ont le droit de retirer l'argent de collecte d'un client. Les fonds appartiennent strictement et exclusivement aux clients.
        </div>
      </div>

      {/* Cartes de synthèse globale */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 border-l-4 border-emerald-500">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">Agents de Collecte</span>
          <div className="text-xl sm:text-2xl font-black text-gray-900 mt-1">
            {overview?.totalAgents || 0}
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold mt-0.5 block">
            {overview?.activeAgents || 0} actif(s) • {overview?.suspendedAgents || 0} suspendu(s)
          </span>
        </div>

        <div className="card p-4 border-l-4 border-indigo-500">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">Clients enregistrés</span>
          <div className="text-xl sm:text-2xl font-black text-gray-900 mt-1">
            {overview?.totalClients || 0}
          </div>
          <span className="text-[11px] text-gray-500 mt-0.5 block">Sur l'ensemble des agences</span>
        </div>

        <div className="card p-4 border-l-4 border-blue-500">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">Collecté ce mois</span>
          <div className="text-xl sm:text-2xl font-black text-blue-700 mt-1">
            {fmt(overview?.monthCollected)} <span className="text-xs font-normal text-gray-400">XAF</span>
          </div>
          <span className="text-[11px] text-gray-500 mt-0.5 block">
            Aujourd'hui : {fmt(overview?.todayCollected)} XAF
          </span>
        </div>

        <div className="card p-4 border-l-4 border-amber-500">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">Frais de tenue encaissés</span>
          <div className="text-xl sm:text-2xl font-black text-amber-700 mt-1">
            {fmt(overview?.totalFeesCollected)} <span className="text-xs font-normal text-gray-400">XAF</span>
          </div>
          <span className="text-[11px] text-amber-800 font-semibold mt-0.5 block">1 100 FCFA / client / mois</span>
        </div>
      </div>

      {/* Onglets navigation */}
      <div className="flex gap-2 p-1.5 bg-gray-100 rounded-2xl border border-gray-200/60 overflow-x-auto">
        {[
          { key: 'agents', label: 'Agents & Clients enregistrés', icon: Users },
          { key: 'fees', label: 'Frais de Collecte par Agence', icon: Coins },
          { key: 'terms', label: "Termes & Conditions d'adhésion", icon: FileText },
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

      {/* ONGLET 1 : AGENTS & CLIENTS */}
      {tab === 'agents' && (
        <div className="card p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <div>
              <h2 className="text-base font-bold text-gray-900">Liste des Agents de Collecte</h2>
              <p className="text-xs text-gray-500">Consultez les informations, clients et rapports de chaque agent.</p>
            </div>
            <span className="text-xs font-bold text-gray-500">{agents.length} agent(s)</span>
          </div>

          {loading ? (
            <div className="py-16 text-center text-gray-400"><Loader2 size={24} className="animate-spin text-emerald-600 mx-auto" /></div>
          ) : agents.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-xs">Aucun agent de collecte inscrit pour le moment.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    <th className="py-3 px-3">Agence / Agent</th>
                    <th className="py-3 px-3">Contact & Secteur</th>
                    <th className="py-3 px-3 text-right">Clients</th>
                    <th className="py-3 px-3 text-right">Collecte Jour</th>
                    <th className="py-3 px-3 text-right">Collecte Mois</th>
                    <th className="py-3 px-3 text-center">Statut</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {agents.map((ag) => (
                    <tr key={ag._id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-gray-900">{ag.agencyName}</div>
                        <div className="text-[11px] text-gray-400">Responsable : {ag.user?.name || '—'}</div>
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        <div>📱 {ag.phone}</div>
                        <div className="text-[11px] text-gray-400">{ag.neighborhood || 'Quartier non renseigné'}{ag.city ? `, ${ag.city}` : ''}</div>
                      </td>
                      <td className="py-3 px-3 text-right font-black text-gray-900">{ag.clientCount || 0}</td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-700 whitespace-nowrap">
                        {fmt(ag.todayAmount)} <span className="text-[10px] font-normal text-gray-400">XAF</span>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-indigo-700 whitespace-nowrap">
                        {fmt(ag.monthAmount)} <span className="text-[10px] font-normal text-gray-400">XAF</span>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {ag.status === 'active' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 size={12} /> Actif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
                            <Ban size={12} /> Suspendu
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedAgent(ag)}
                            className="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold flex items-center gap-1"
                          >
                            <Eye size={13} /> Voir clients
                          </button>
                          <button
                            onClick={() => { setStatusModalAgent(ag); setStatusReason(ag.statusReason || '') }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 ${
                              ag.status === 'active'
                                ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                            title="Retirer ou réactiver l'agent"
                          >
                            {ag.status === 'active' ? 'Retirer fonctions' : 'Réactiver'}
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
      )}

      {/* ONGLET 2 : FRAIS DE COLLECTE PAR AGENCE */}
      {tab === 'fees' && (
        <div className="card p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-gray-100">
            <div>
              <h2 className="text-base font-bold text-gray-900">Frais de Collecte par Agence (1 100 FCFA / client)</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Les frais sont additionnés et attribués au nom de chaque agence. L'administrateur peut ensuite les retirer.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleTriggerMonthlyFees}
                disabled={loading}
                className="btn-primary text-xs py-2 px-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl flex items-center gap-1.5"
              >
                <Coins size={14} /> Synchroniser les frais du mois
              </button>
              <Link
                to="/dashboard/frais-transaction-admin"
                className="btn-primary text-xs py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center gap-1.5"
              >
                <ArrowUpRight size={14} /> Retirer mes frais
              </Link>
            </div>
          </div>

          {feesSummary.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-xs">Aucun frais de collecte déduit pour l'instant.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    <th className="py-3 px-3">Agence & Responsable</th>
                    <th className="py-3 px-3 text-center">Nombre de Clients</th>
                    <th className="py-3 px-3 text-right">Frais par Client</th>
                    <th className="py-3 px-3 text-right">Total Frais Encaissés</th>
                    <th className="py-3 px-3 text-right">Dernier Prélèvement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {feesSummary.map((f) => (
                    <tr key={f._id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-gray-900">{f.agencyName}</div>
                        <div className="text-[11px] text-gray-400">Agent : {f.agentName}</div>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-gray-800">{f.totalClientsCount}</td>
                      <td className="py-3 px-3 text-right text-gray-500">1 100 XAF</td>
                      <td className="py-3 px-3 text-right font-black text-amber-700 whitespace-nowrap">
                        {fmt(f.totalAmount)} <span className="text-[10px] font-normal text-gray-400">XAF</span>
                      </td>
                      <td className="py-3 px-3 text-right text-gray-500 whitespace-nowrap">
                        {fmtDate(f.lastDeductedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ONGLET 3 : TERMES ET CONDITIONS D'ADHÉSION */}
      {tab === 'terms' && <AdminTermsTab showBanner={showBanner} />}

      {/* Modal Détails Agent & Ses Clients */}
      {selectedAgent && (
        <AgentClientsModal
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
        />
      )}

      {/* Modal Changement de Statut (Retirer un agent de ses fonctions) */}
      {statusModalAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-base">
                {statusModalAgent.status === 'active' ? "Retirer l'agent de ses fonctions" : "Réactiver l'agent"}
              </h3>
              <button onClick={() => setStatusModalAgent(null)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-gray-600">
              {statusModalAgent.status === 'active'
                ? `Êtes-vous sûr de vouloir suspendre l'agent « ${statusModalAgent.agencyName} » ? Il ne pourra plus enregistrer de collectes.`
                : `Voulez-vous réactiver l'agent « ${statusModalAgent.agencyName} » ?`}
            </p>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Motif administratif (optionnel)</label>
              <textarea
                rows={3}
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="Raison de la suspension ou réactivation..."
                className="input text-xs w-full resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setStatusModalAgent(null)} className="btn-secondary text-xs">
                Annuler
              </button>
              <button
                type="button"
                disabled={updatingStatus}
                onClick={() => handleToggleStatus(statusModalAgent, statusModalAgent.status === 'active' ? 'suspended' : 'active')}
                className={`btn-primary text-xs flex items-center gap-1.5 ${
                  statusModalAgent.status === 'active' ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {updatingStatus ? <Loader2 size={14} className="animate-spin" /> : null}
                <span>{statusModalAgent.status === 'active' ? 'Confirmer la suspension' : 'Confirmer la réactivation'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Modal pour voir tous les clients et collectes d'un agent avec retrait Super Administrateur
function AgentClientsModal({ agent, onClose }) {
  const [details, setDetails] = useState(null)
  const [loading, setLoading] = useState(true)
  const [withdrawClient, setWithdrawClient] = useState(null)
  const [msg, setMsg] = useState({ text: '', type: '' })

  const loadAgentDetails = () => {
    setLoading(true)
    collectApi.adminAgentDetail(agent._id)
      .then((res) => setDetails(res))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadAgentDetails()
  }, [agent._id])

  const showModalMsg = (text, type = 'success') => {
    setMsg({ text, type })
    setTimeout(() => setMsg({ text: '', type: '' }), 5000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl p-6 w-full max-w-4xl shadow-2xl border border-gray-100 space-y-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900 text-base">{agent.agencyName}</h3>
            <p className="text-xs text-gray-500">
              Responsable : {agent.user?.name} • 📱 {agent.phone} • Zone : {agent.neighborhood}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {msg.text && (
          <div className={`p-3 text-xs rounded-xl border flex items-center gap-2 ${
            msg.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}>
            <CheckCircle2 size={15} />
            <span>{msg.text}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {loading ? (
            <div className="py-16 text-center text-gray-400"><Loader2 size={24} className="animate-spin mx-auto text-emerald-600" /></div>
          ) : (
            <>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Clients enregistrés ({details?.clients?.length || 0}) — Retrait direct vers MTN / Orange Money
                </h4>
                {(details?.clients || []).length === 0 ? (
                  <div className="py-6 text-center text-gray-400 text-xs">Aucun client enregistré par cet agent.</div>
                ) : (
                  <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-[11px] font-bold uppercase text-gray-400">
                          <th className="py-2.5 px-3">N° Compte</th>
                          <th className="py-2.5 px-3">Client & Mobile Money</th>
                          <th className="py-2.5 px-3">Quartier</th>
                          <th className="py-2.5 px-3 text-right">Collecte/j</th>
                          <th className="py-2.5 px-3 text-right">Solde Collecte</th>
                          <th className="py-2.5 px-3 text-right">Action Admin</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {details.clients.map((c) => (
                          <tr key={c._id} className="hover:bg-gray-50/70">
                            <td className="py-2.5 px-3 font-mono font-bold text-gray-700 whitespace-nowrap">{c.accountNumber}</td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-gray-900">{c.fullName}</div>
                              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                {c.momoMtn && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-yellow-100 text-yellow-800 font-mono font-medium">
                                    MTN: {c.momoMtn}
                                  </span>
                                )}
                                {c.momoOrange && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-orange-100 text-orange-800 font-mono font-medium">
                                    Orange: {c.momoOrange}
                                  </span>
                                )}
                                {c.phone && !c.momoMtn && !c.momoOrange && (
                                  <span className="text-[10px] text-gray-500 font-mono">{c.phone}</span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-gray-600">{c.neighborhood}</td>
                            <td className="py-2.5 px-3 text-right text-gray-600 whitespace-nowrap">{fmt(c.dailyTarget)} F</td>
                            <td className="py-2.5 px-3 text-right font-black text-emerald-700 whitespace-nowrap">{fmt(c.balance)} F</td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              {c.balance > 0 ? (
                                <button
                                  onClick={() => setWithdrawClient(c)}
                                  className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-colors border border-rose-200 shadow-2xs"
                                  title="Retirer / Décaisser pour ce client"
                                >
                                  <ArrowDownCircle size={13} /> Retirer
                                </button>
                              ) : (
                                <span className="text-[11px] text-gray-400">Solde nul</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Rapports journaliers transmis ({details?.reports?.length || 0})
                </h4>
                {(details?.reports || []).length === 0 ? (
                  <div className="py-4 text-center text-gray-400 text-xs">Aucun rapport journalier transmis.</div>
                ) : (
                  <div className="space-y-2">
                    {details.reports.map((rep) => (
                      <div key={rep._id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-gray-900">Rapport du {fmtDate(rep.date)}</span>
                          <span className="text-gray-500 block text-[11px]">
                            {rep.totalClients} client(s) • {rep.paidClientsCount} payé(s) • {rep.unpaidClientsCount} non payé(s)
                          </span>
                        </div>
                        <div className="font-black text-emerald-700">{fmt(rep.totalCollected)} XAF</div>
                      </div>
                    ))}
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

      {withdrawClient && (
        <AdminClientWithdrawModal
          client={withdrawClient}
          onClose={() => setWithdrawClient(null)}
          onSuccess={(updated) => {
            setWithdrawClient(null)
            showModalMsg(`Retrait validé avec succès pour ${updated.fullName || withdrawClient.fullName} !`)
            loadAgentDetails()
          }}
        />
      )}
    </div>
  )
}

// Modal de retrait ordonné par le Super Administrateur pour un client
function AdminClientWithdrawModal({ client, onClose, onSuccess }) {
  const [amount, setAmount] = useState(client.balance || 0)
  const [payoutMethod, setPayoutMethod] = useState(client.momoMtn ? 'momo_mtn' : (client.momoOrange ? 'momo_orange' : 'wallet'))
  const [customPhone, setCustomPhone] = useState(client.momoMtn || client.momoOrange || client.phone || '')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (payoutMethod === 'momo_mtn') setCustomPhone(client.momoMtn || client.phone || '')
    else if (payoutMethod === 'momo_orange') setCustomPhone(client.momoOrange || client.phone || '')
  }, [payoutMethod, client])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const amt = Number(amount)
    if (!amt || amt <= 0) {
      setErr('Veuillez saisir un montant de retrait valide.')
      return
    }
    if (amt > client.balance) {
      setErr(`Montant supérieur au solde disponible (${fmt(client.balance)} FCFA).`)
      return
    }
    if ((payoutMethod === 'momo_mtn' || payoutMethod === 'momo_orange') && !customPhone.trim()) {
      setErr('Veuillez saisir le numéro Mobile Money destinataire.')
      return
    }

    setSubmitting(true)
    setErr('')
    try {
      const res = await collectApi.adminWithdrawClient(client._id, {
        amount: amt,
        payoutMethod,
        customPhone: customPhone.trim(),
        notes,
      })
      onSuccess(res.client || { _id: client._id, fullName: client.fullName, balance: res.newBalance })
    } catch (e) {
      setErr(e.message || "Erreur lors de l'exécution du retrait.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900 text-base">Retrait / Décaissement Client</h3>
            <p className="text-xs text-gray-500">Action réservée au Super Administrateur</p>
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

        {/* Coordonnées automatiques du client */}
        <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-gray-500 font-medium">Nom complet :</span>
            <span className="font-bold text-gray-900">{client.fullName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500 font-medium">N° de Compte :</span>
            <span className="font-mono font-bold text-gray-700">{client.accountNumber}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500 font-medium">Solde Collecte :</span>
            <span className="font-black text-sm text-emerald-700">{fmt(client.balance)} FCFA</span>
          </div>
          <div className="pt-2 border-t border-gray-200/60 space-y-1">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-gray-500">Numéro MTN MoMo :</span>
              <span className="font-mono font-bold text-yellow-800">{client.momoMtn || 'Non renseigné'}</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-gray-500">Numéro Orange Money :</span>
              <span className="font-mono font-bold text-orange-800">{client.momoOrange || 'Non renseigné'}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Mode de décaissement *</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPayoutMethod('momo_mtn')}
                className={`p-2 rounded-xl border text-center text-xs font-bold transition-all ${
                  payoutMethod === 'momo_mtn'
                    ? 'border-yellow-500 bg-yellow-50 text-yellow-900 ring-2 ring-yellow-400/30'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                MTN MoMo
              </button>
              <button
                type="button"
                onClick={() => setPayoutMethod('momo_orange')}
                className={`p-2 rounded-xl border text-center text-xs font-bold transition-all ${
                  payoutMethod === 'momo_orange'
                    ? 'border-orange-500 bg-orange-50 text-orange-900 ring-2 ring-orange-400/30'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Orange Money
              </button>
              <button
                type="button"
                onClick={() => setPayoutMethod('wallet')}
                className={`p-2 rounded-xl border text-center text-xs font-bold transition-all ${
                  payoutMethod === 'wallet'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-400/30'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Portefeuille
              </button>
            </div>
          </div>

          {(payoutMethod === 'momo_mtn' || payoutMethod === 'momo_orange') && (
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Numéro Mobile Money destinataire (pré-rempli automatiquement) *
              </label>
              <input
                type="tel"
                required
                value={customPhone}
                onChange={(e) => setCustomPhone(e.target.value)}
                placeholder="Ex : 670000000"
                className="input text-xs w-full font-mono font-bold"
              />
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-gray-700">Montant à décaisser (FCFA) *</label>
              <button
                type="button"
                onClick={() => setAmount(client.balance)}
                className="text-[11px] font-bold text-emerald-600 hover:underline"
              >
                Tout retirer ({fmt(client.balance)} F)
              </button>
            </div>
            <input
              type="number"
              min="100"
              max={client.balance}
              step="50"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input text-xs w-full font-black text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Motif / Justificatif (Optionnel)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex : Retrait ordonné à la demande du client"
              className="input text-xs w-full"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary text-xs">
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting || Number(amount) <= 0 || Number(amount) > client.balance}
              className="btn-primary text-xs bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 font-bold disabled:opacity-50"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <ArrowDownCircle size={14} />}
              <span>Valider le retrait de {fmt(amount)} FCFA</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Onglet Termes & Conditions côté admin
function AdminTermsTab({ showBanner }) {
  const [terms, setTerms] = useState('')
  const [monthlyFee, setMonthlyFee] = useState(1100)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    collectApi.getConfig()
      .then((res) => {
        setTerms(res.termsAndConditions || '')
        setMonthlyFee(res.monthlyFee ?? 1100)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await collectApi.adminUpdateTerms({
        termsAndConditions: terms,
        monthlyFee: Number(monthlyFee),
      })
      showBanner('Termes, conditions et frais mis à jour avec succès !')
    } catch (e) {
      showBanner(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="py-16 text-center text-gray-400"><Loader2 size={22} className="animate-spin mx-auto" /></div>

  return (
    <div className="card p-5 sm:p-6 max-w-3xl space-y-5">
      <div>
        <h2 className="text-base font-bold text-gray-900">Rédaction des Termes & Conditions d'adhésion</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Ce texte sera présenté à tout utilisateur souhaitant activer son compte d'agent de collecte. Il devra obligatoirement l'accepter avant d'accéder au service.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="text-xs font-bold text-gray-700 block mb-1">Frais mensuels par client (XAF)</label>
          <input
            type="number"
            min="0"
            step="100"
            value={monthlyFee}
            onChange={(e) => setMonthlyFee(e.target.value)}
            className="input text-xs w-48 font-bold"
          />
          <span className="text-[11px] text-gray-400 mt-0.5 block">Défaut recommandé : 1 100 FCFA</span>
        </div>

        <div>
          <label className="text-xs font-bold text-gray-700 block mb-1">Contenu des Termes et Conditions d'Adhésion</label>
          <textarea
            rows={14}
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            className="input text-xs w-full resize-y font-mono leading-relaxed"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="btn-primary text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          <span>Enregistrer les termes & conditions</span>
        </button>
      </form>
    </div>
  )
}
