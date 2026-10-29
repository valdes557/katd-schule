// client/src/components/AdminZonesManagementTab.jsx — Gestion des zones géographiques et attribution des utilisateurs
import { useState, useEffect } from 'react'
import {
  MapPin, Plus, Search, Filter, Loader2, Save, Trash2, Pencil,
  CheckCircle2, X, Globe, Users, Landmark, AlertCircle, RefreshCw,
  UserCheck, ArrowRight, ShieldCheck,
} from 'lucide-react'
import { zonesApi } from '../lib/api'

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')

const ZONE_TYPE_LABELS = {
  arrondissement: 'Arrondissement',
  regional: 'Régional',
  national: 'National',
  international: 'International',
  mondial: 'Mondial',
}

const ZONE_TYPE_BADGES = {
  arrondissement: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  regional: 'bg-blue-50 text-blue-800 border-blue-200',
  national: 'bg-purple-50 text-purple-800 border-purple-200',
  international: 'bg-amber-50 text-amber-800 border-amber-200',
  mondial: 'bg-rose-50 text-rose-800 border-rose-200',
}

export default function AdminZonesManagementTab() {
  const [subTab, setSubTab] = useState('zones') // 'zones' | 'users'
  const [zones, setZones] = useState([])
  const [unassignedCount, setUnassignedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Modales
  const [zoneModalOpen, setZoneModalOpen] = useState(false)
  const [editingZone, setEditingZone] = useState(null)
  const [assignModalUser, setAssignModalUser] = useState(null)

  // Filtre et recherche zones
  const [zoneTypeFilter, setZoneTypeFilter] = useState('')

  const loadZones = async () => {
    try {
      setLoading(true)
      setError('')
      const res = await zonesApi.adminList()
      setZones(res.zones || [])
      setUnassignedCount(res.unassignedUsersCount || 0)
    } catch (e) {
      setError(e.message || 'Erreur lors du chargement des zones.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadZones()
  }, [])

  const showSuccess = (msg) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 4500)
  }

  // Statistiques calculées
  const stats = {
    total: zones.length,
    arrondissements: zones.filter((z) => z.type === 'arrondissement').length,
    regionales: zones.filter((z) => z.type === 'regional').length,
    nationales: zones.filter((z) => z.type === 'national').length,
    internationales: zones.filter((z) => z.type === 'international').length,
    totalUsersAssigned: zones.reduce((s, z) => s + (z.usersCount || 0), 0),
    totalShareholders: zones.reduce((s, z) => s + (z.shareholdersCount || 0), 0),
  }

  const filteredZones = zones.filter((z) => {
    if (!zoneTypeFilter) return true
    return z.type === zoneTypeFilter
  })

  const handleDeleteZone = async (zone) => {
    if (!window.confirm(`Confirmez-vous la suppression de la zone « ${zone.name} » ?`)) return
    try {
      await zonesApi.adminDelete(zone._id)
      showSuccess(`Zone « ${zone.name} » supprimée avec succès.`)
      loadZones()
    } catch (e) {
      alert(e.message || 'Impossible de supprimer cette zone.')
    }
  }

  const handleToggleActive = async (zone) => {
    try {
      await zonesApi.adminUpdate(zone._id, { isActive: !zone.isActive })
      showSuccess(`Statut de « ${zone.name} » mis à jour.`)
      loadZones()
    } catch (e) {
      alert(e.message || 'Erreur lors de la mise à jour.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Alertes d'état */}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl flex items-center gap-2 animate-fade-in">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-2xl flex items-center gap-2 animate-fade-in">
          <AlertCircle size={16} className="text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Cartes métriques globales */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-gray-150 shadow-2xs">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Arrondissements</span>
          <span className="text-lg font-black text-emerald-700">{fmt(stats.arrondissements)}</span>
          <p className="text-[10px] text-gray-500 mt-0.5">Collectes & Associés locaux</p>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-gray-150 shadow-2xs">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Régions</span>
          <span className="text-lg font-black text-blue-700">{fmt(stats.regionales)}</span>
          <p className="text-[10px] text-gray-500 mt-0.5">Paliers régionaux</p>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-gray-150 shadow-2xs">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">National</span>
          <span className="text-lg font-black text-purple-700">{fmt(stats.nationales)}</span>
          <p className="text-[10px] text-gray-500 mt-0.5">Couverture pays</p>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-gray-150 shadow-2xs">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">International</span>
          <span className="text-lg font-black text-amber-700">{fmt(stats.internationales)}</span>
          <p className="text-[10px] text-gray-500 mt-0.5">Diaspora & Étranger</p>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-gray-150 shadow-2xs">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Utilisateurs Assignés</span>
          <span className="text-lg font-black text-gray-900">{fmt(stats.totalUsersAssigned)}</span>
          <p className="text-[10px] text-gray-500 mt-0.5">Rattachés en base</p>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-amber-200 bg-amber-50/40 shadow-2xs">
          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Non Assignés</span>
          <span className="text-lg font-black text-amber-900">{fmt(unassignedCount)}</span>
          <p className="text-[10px] text-amber-700 mt-0.5">En attente d'attribution</p>
        </div>
      </div>

      {/* Navigation sous-onglets */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-2">
        <div className="flex gap-2">
          <button
            onClick={() => setSubTab('zones')}
            className={`text-xs font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
              subTab === 'zones'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <MapPin size={14} /> Répertoire des Zones ({zones.length})
          </button>
          <button
            onClick={() => setSubTab('users')}
            className={`text-xs font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
              subTab === 'users'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <UserCheck size={14} /> Attribution des Utilisateurs
            {unassignedCount > 0 && (
              <span className="bg-amber-400 text-amber-950 px-1.5 py-0.2 rounded-full text-[10px] font-black">
                {unassignedCount}
              </span>
            )}
          </button>
        </div>

        {subTab === 'zones' && (
          <button
            onClick={() => {
              setEditingZone(null)
              setZoneModalOpen(true)
            }}
            className="btn-primary text-xs py-2 px-3.5 rounded-xl font-bold flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
          >
            <Plus size={14} /> Ajouter une zone
          </button>
        )}
      </div>

      {/* ── CONTENU DU SOUS-ONGLET 1 : RÉPERTOIRE DES ZONES ── */}
      {subTab === 'zones' && (
        <div className="space-y-4">
          {/* Filtres par type */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-xs font-bold text-gray-500 mr-1 flex items-center gap-1">
              <Filter size={13} /> Filtrer :
            </span>
            {[
              { key: '', label: 'Toutes les zones' },
              { key: 'arrondissement', label: 'Arrondissements' },
              { key: 'regional', label: 'Régions' },
              { key: 'national', label: 'National' },
              { key: 'international', label: 'International' },
              { key: 'mondial', label: 'Mondial' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setZoneTypeFilter(f.key)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap ${
                  zoneTypeFilter === f.key
                    ? 'bg-gray-900 text-white shadow-2xs'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-400 text-xs flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin text-indigo-600" />
              <span>Chargement du répertoire des zones géographiques...</span>
            </div>
          ) : filteredZones.length === 0 ? (
            <div className="p-12 bg-white rounded-3xl border border-dashed border-gray-300 text-center space-y-3">
              <MapPin size={32} className="mx-auto text-gray-300" />
              <p className="text-sm font-bold text-gray-700">Aucune zone géographique trouvée</p>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Commencez par ajouter un arrondissement, une région ou un pays pour qu'il apparaisse instantanément
                dans les plans de souscription des associés et à l'inscription des utilisateurs.
              </p>
              <button
                onClick={() => {
                  setEditingZone(null)
                  setZoneModalOpen(true)
                }}
                className="btn-primary text-xs py-2 px-4 rounded-xl font-bold inline-flex items-center gap-1.5 bg-indigo-600 text-white"
              >
                <Plus size={14} /> Créer la première zone
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-gray-150 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-bold">
                    <tr>
                      <th className="py-3 px-4">Type de Zone</th>
                      <th className="py-3 px-4">Nom de la Zone</th>
                      <th className="py-3 px-4">Code & Pays</th>
                      <th className="py-3 px-4 text-center">Utilisateurs</th>
                      <th className="py-3 px-4 text-center">Associés</th>
                      <th className="py-3 px-4 text-center">Statut</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredZones.map((z) => (
                      <tr key={z._id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border ${
                              ZONE_TYPE_BADGES[z.type] || 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {ZONE_TYPE_LABELS[z.type] || z.type}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-extrabold text-gray-900 text-sm">{z.name}</div>
                          {z.description && (
                            <p className="text-[11px] text-gray-400 line-clamp-1">{z.description}</p>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-mono font-semibold text-gray-700">
                            {z.code ? z.code : '—'}
                          </div>
                          <span className="text-[11px] text-gray-500">{z.country || 'Cameroun'}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg">
                            {fmt(z.usersCount)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-extrabold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg">
                            {fmt(z.shareholdersCount)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleToggleActive(z)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                              z.isActive
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                            }`}
                            title="Cliquer pour changer le statut"
                          >
                            {z.isActive ? 'Actif' : 'Inactif'}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setEditingZone(z)
                                setZoneModalOpen(true)
                              }}
                              className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-600 hover:text-indigo-600 transition-colors"
                              title="Modifier cette zone"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteZone(z)}
                              className="p-1.5 rounded-xl hover:bg-rose-50 text-gray-400 hover:text-rose-600 transition-colors"
                              title="Supprimer cette zone"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CONTENU DU SOUS-ONGLET 2 : ATTRIBUTION DES UTILISATEURS EXISTANTS ── */}
      {subTab === 'users' && (
        <AdminUsersAssignmentList
          zones={zones}
          onAssignClick={(u) => setAssignModalUser(u)}
          onRefresh={loadZones}
        />
      )}

      {/* MODAL CRÉATION / ÉDITION DE ZONE */}
      {zoneModalOpen && (
        <ZoneFormModal
          zone={editingZone}
          onClose={() => setZoneModalOpen(false)}
          onSuccess={(msg) => {
            showSuccess(msg)
            setZoneModalOpen(false)
            loadZones()
          }}
        />
      )}

      {/* MODAL D'ATTRIBUTION D'UN UTILISATEUR À UNE ZONE */}
      {assignModalUser && (
        <AssignUserModal
          user={assignModalUser}
          zones={zones}
          onClose={() => setAssignModalUser(null)}
          onSuccess={(msg) => {
            showSuccess(msg)
            setAssignModalUser(null)
            loadZones()
          }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANT : LISTE ET RECHERCHE DES UTILISATEURS POUR ATTRIBUTION
// ─────────────────────────────────────────────────────────────────────────────
function AdminUsersAssignmentList({ zones, onAssignClick, onRefresh }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterZoneId, setFilterZoneId] = useState('')
  const [unassignedOnly, setUnassignedOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const loadUsers = async () => {
    try {
      setLoading(true)
      const res = await zonesApi.adminUsers({
        search,
        zoneType: filterType,
        zoneId: filterZoneId,
        unassigned: unassignedOnly,
        page,
        limit: 25,
      })
      setUsers(res.users || [])
      setTotalPages(res.pages || 1)
      setTotalCount(res.total || 0)
    } catch (_) {
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(loadUsers, 250)
    return () => clearTimeout(timer)
  }, [search, filterType, filterZoneId, unassignedOnly, page])

  return (
    <div className="space-y-4">
      {/* Barre d'outils et de filtres utilisateurs */}
      <div className="bg-white p-4 rounded-3xl border border-gray-150 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          {/* Recherche texte */}
          <div className="sm:col-span-5 relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Rechercher par nom, email, téléphone..."
              className="input pl-9 text-xs w-full h-10"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filtre Type de Zone */}
          <div className="sm:col-span-3">
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value)
                setFilterZoneId('')
                setPage(1)
              }}
              className="input text-xs w-full h-10"
            >
              <option value="">Tous les types de zones</option>
              <option value="arrondissement">Arrondissements</option>
              <option value="regional">Régions</option>
              <option value="national">National</option>
              <option value="international">International</option>
              <option value="mondial">Mondial</option>
            </select>
          </div>

          {/* Filtre Zone Spécifique */}
          <div className="sm:col-span-4">
            <select
              value={filterZoneId}
              onChange={(e) => {
                setFilterZoneId(e.target.value)
                setPage(1)
              }}
              className="input text-xs w-full h-10"
            >
              <option value="">Toutes les zones géographiques</option>
              {zones
                .filter((z) => !filterType || z.type === filterType)
                .map((z) => (
                  <option key={z._id} value={z._id}>
                    {z.name} ({ZONE_TYPE_LABELS[z.type] || z.type})
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-gray-100 text-xs">
          <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-700 select-none">
            <input
              type="checkbox"
              checked={unassignedOnly}
              onChange={(e) => {
                setUnassignedOnly(e.target.checked)
                setPage(1)
              }}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span>Afficher uniquement les utilisateurs NON ATTRIBUÉS</span>
          </label>

          <span className="text-gray-500 text-[11px]">
            Total : <b>{fmt(totalCount)}</b> utilisateur(s) trouvé(s)
          </span>
        </div>
      </div>

      {/* Tableau des utilisateurs */}
      <div className="bg-white rounded-3xl border border-gray-150 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-bold">
              <tr>
                <th className="py-3 px-4">Utilisateur</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Rôle</th>
                <th className="py-3 px-4">Zone Géographique Attribuée</th>
                <th className="py-3 px-4">Date Inscription</th>
                <th className="py-3 px-4 text-right">Attribution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-gray-400">
                    <Loader2 size={16} className="animate-spin inline-block text-indigo-600 mr-2" />
                    Chargement des utilisateurs...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-gray-400">
                    Aucun utilisateur ne correspond aux critères de recherche.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const zName = u.geographicZone?.zoneName
                  const zType = u.geographicZone?.zoneType
                  const hasZone = !!(zName && zName.trim())

                  return (
                    <tr key={u._id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-extrabold text-gray-900 text-sm">{u.name}</div>
                        <span className="text-[10px] text-gray-400 font-mono">ID: {u._id.slice(-6)}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-gray-800">{u.email}</div>
                        <div className="text-gray-400 text-[11px]">{u.phone || '—'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-gray-100 text-gray-700 border border-gray-200">
                          {u.role || 'utilisateur'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {hasZone ? (
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${
                                ZONE_TYPE_BADGES[zType] || 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {ZONE_TYPE_LABELS[zType] || zType}
                            </span>
                            <span className="font-bold text-gray-900">{zName}</span>
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            Non attribué
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-[11px]">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR') : '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => onAssignClick(u)}
                          className="btn-secondary text-[11px] py-1.5 px-3 rounded-xl font-bold inline-flex items-center gap-1 hover:border-indigo-500 hover:text-indigo-600 shadow-2xs"
                        >
                          <Pencil size={12} />
                          <span>{hasZone ? 'Modifier la zone' : 'Attribuer une zone'}</span>
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3.5 border-t border-gray-100 text-xs">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="btn-secondary text-xs py-1 px-3 rounded-lg disabled:opacity-40"
            >
              Précédent
            </button>
            <span className="text-gray-500">
              Page <b>{page}</b> sur <b>{totalPages}</b>
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="btn-secondary text-xs py-1 px-3 rounded-lg disabled:opacity-40"
            >
              Suivant
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL : CRÉATION / MODIFICATION D'UNE ZONE GÉOGRAPHIQUE
// ─────────────────────────────────────────────────────────────────────────────
function ZoneFormModal({ zone, onClose, onSuccess }) {
  const isEdit = Boolean(zone)
  const [type, setType] = useState(zone?.type || 'arrondissement')
  const [name, setName] = useState(zone?.name || '')
  const [code, setCode] = useState(zone?.code || '')
  const [country, setCountry] = useState(zone?.country || 'Cameroun')
  const [description, setDescription] = useState(zone?.description || '')
  const [order, setOrder] = useState(zone?.order || 0)
  const [isActive, setIsActive] = useState(zone ? zone.isActive : true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setErr('Le nom de la zone est obligatoire.')
      return
    }

    try {
      setSaving(true)
      setErr('')
      const payload = {
        type,
        name: name.trim(),
        code: code.trim(),
        country: country.trim(),
        description: description.trim(),
        order: Number(order) || 0,
        isActive,
      }

      if (isEdit) {
        await zonesApi.adminUpdate(zone._id, payload)
        onSuccess(`Zone « ${payload.name} » mise à jour avec succès !`)
      } else {
        await zonesApi.adminCreate(payload)
        onSuccess(`Zone « ${payload.name} » créée avec succès !`)
      }
    } catch (e) {
      setErr(e.message || "Erreur lors de l'enregistrement de la zone.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-150 space-y-4 my-auto">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
              <MapPin size={18} />
            </div>
            <div>
              <h3 className="font-extrabold text-gray-900 text-sm">
                {isEdit ? 'Modifier la zone géographique' : 'Ajouter une zone géographique'}
              </h3>
              <p className="text-[11px] text-gray-500">Paliers associés & Inscriptions</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={18} />
          </button>
        </div>

        {err && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{err}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* Type de zone */}
          <div>
            <label className="font-bold text-gray-700 block mb-1">Type de zone *</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'arrondissement', label: 'Arrondissement' },
                { key: 'regional', label: 'Régional' },
                { key: 'national', label: 'National' },
                { key: 'international', label: 'International' },
                { key: 'mondial', label: 'Mondial' },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setType(t.key)}
                  className={`py-2 px-2.5 rounded-xl border text-center font-bold transition-all ${
                    type === t.key
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-400/20'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Nom de la zone */}
          <div>
            <label className="font-bold text-gray-700 block mb-1">Nom officiel de la zone *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Yaoundé 1er, Région du Littoral, Cameroun, Diaspora Europe..."
              className="input w-full"
              required
            />
          </div>

          {/* Code & Pays */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-bold text-gray-700 block mb-1">Code / Réf (optionnel)</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Ex : YDE-1, LT-DLA"
                className="input w-full font-mono uppercase"
              />
            </div>
            <div>
              <label className="font-bold text-gray-700 block mb-1">Pays</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Cameroun"
                className="input w-full"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="font-bold text-gray-700 block mb-1">Description / Notes (optionnel)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Détails sur les localités couvertes, limites territoriales..."
              rows={2}
              className="input w-full resize-none"
            />
          </div>

          {/* Statut actif */}
          <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-700 pt-1">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span>Zone active (visible dans les souscriptions associés et formulaires)</span>
          </label>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-xs flex-1 py-2.5 rounded-xl font-bold"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary text-xs flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>{isEdit ? 'Mettre à jour' : 'Enregistrer la zone'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL : ATTRIBUTION D'UN UTILISATEUR À UNE ZONE
// ─────────────────────────────────────────────────────────────────────────────
function AssignUserModal({ user, zones, onClose, onSuccess }) {
  const currentZoneId = user?.geographicZone?.zoneId || ''
  const [selectedType, setSelectedType] = useState(user?.geographicZone?.zoneType || 'arrondissement')
  const [selectedZoneId, setSelectedZoneId] = useState(currentZoneId)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const zonesOfType = zones.filter((z) => !selectedType || z.type === selectedType)

  const handleAssign = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      setErr('')
      const res = await zonesApi.adminAssignUser({
        userId: user._id,
        zoneId: selectedZoneId || null,
      })
      onSuccess(res.message || 'Utilisateur attribué avec succès !')
    } catch (e) {
      setErr(e.message || "Erreur lors de l'attribution de la zone.")
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async () => {
    if (!window.confirm(`Retirer l'attribution de zone pour ${user.name} ?`)) return
    try {
      setSaving(true)
      const res = await zonesApi.adminAssignUser({
        userId: user._id,
        zoneId: null,
      })
      onSuccess(res.message || 'Zone retirée avec succès !')
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-150 space-y-4 my-auto">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
              <UserCheck size={18} />
            </div>
            <div>
              <h3 className="font-extrabold text-gray-900 text-sm">Attribution Géographique</h3>
              <p className="text-[11px] text-gray-500">Rattacher un utilisateur à un territoire</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={18} />
          </button>
        </div>

        {/* Détails utilisateur */}
        <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200 text-xs space-y-1">
          <div className="font-extrabold text-gray-900 text-sm">{user.name}</div>
          <p className="text-gray-500">{user.email} {user.phone ? `• ${user.phone}` : ''}</p>
          <div className="pt-1 flex items-center gap-1.5">
            <span className="text-[10px] text-gray-400 font-bold uppercase">Zone actuelle :</span>
            {user.geographicZone?.zoneName ? (
              <span className="font-black text-indigo-700">
                {user.geographicZone.zoneName} ({user.geographicZone.zoneType?.toUpperCase()})
              </span>
            ) : (
              <span className="text-amber-700 font-bold">Aucune (Non attribué)</span>
            )}
          </div>
        </div>

        {err && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{err}</span>
          </div>
        )}

        <form onSubmit={handleAssign} className="space-y-3 text-xs">
          <div>
            <label className="font-bold text-gray-700 block mb-1">Filtrer par type de zone</label>
            <div className="grid grid-cols-2 gap-1.5">
              {['arrondissement', 'regional', 'national', 'international', 'mondial'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setSelectedType(t)
                    setSelectedZoneId('')
                  }}
                  className={`py-1.5 px-2 rounded-xl border text-center font-bold capitalize transition-all ${
                    selectedType === t
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-400/20'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {ZONE_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1">
              Sélectionner la zone à attribuer *
            </label>
            <select
              value={selectedZoneId}
              onChange={(e) => setSelectedZoneId(e.target.value)}
              className="input w-full font-medium"
              required
            >
              <option value="">-- Choisir une zone --</option>
              {zonesOfType.map((z) => (
                <option key={z._id} value={z._id}>
                  {z.name} {z.code ? `(${z.code})` : ''} — {z.country}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            {user.geographicZone?.zoneName && (
              <button
                type="button"
                onClick={handleClear}
                disabled={saving}
                className="btn-ghost text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 py-2.5 px-3 rounded-xl font-bold"
              >
                Désassigner
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-xs flex-1 py-2.5 rounded-xl font-bold"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving || !selectedZoneId}
              className="btn-primary text-xs flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>Confirmer l'attribution</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
