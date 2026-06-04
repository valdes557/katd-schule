import { useEffect, useState } from 'react'
import { CreditCard, CheckCircle2, Loader2, Search, Trash2, Eye, Edit2, AlertCircle, History, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { registrationsApi } from '../lib/api'
import { subscriptionPlans } from '../data/mockData'

const STATUS_MAP = { pending: { label: 'En attente', cls: 'bg-amber-100 text-amber-700' }, approved: { label: 'Approuvé', cls: 'bg-green-100 text-green-700' }, rejected: { label: 'Rejeté', cls: 'bg-red-100 text-red-700' } }

/* ─── Admin Souscriptions ─── */
function AdminSouscriptions() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const params = filter ? `status=${filter}` : ''
      const r = await registrationsApi.list(params)
      setItems(r.data || [])
    } catch (err) { console.error(err) }
    setLoading(false)
  }
  useEffect(() => { load() }, [filter])

  const filteredItems = search
    ? items.filter((i) => i.schoolName?.toLowerCase().includes(search.toLowerCase()) || i.directorName?.toLowerCase().includes(search.toLowerCase()) || i.email?.toLowerCase().includes(search.toLowerCase()))
    : items

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette souscription ?')) return
    try { await registrationsApi.remove(id); load() } catch (e) { alert(e.message) }
  }

  const handleApprove = async (id) => {
    try { await registrationsApi.approve(id); load() } catch (e) { alert(e.message) }
  }

  const handleReject = async (id) => {
    const reason = prompt('Motif du rejet (optionnel):')
    try { await registrationsApi.reject(id, reason || ''); load() } catch (e) { alert(e.message) }
  }

  const totalRevenue = items.filter((i) => i.status === 'approved').reduce((s, i) => s + (i.amount || 0), 0)

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><CreditCard size={22} className="text-blue-600" /> Gestion des Souscriptions</h1>
        <p className="text-sm text-gray-500">{items.length} souscription(s) · Revenus: <strong>{totalRevenue.toLocaleString()} F CFA</strong></p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..." className="input pl-9 text-sm" />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="input text-sm w-auto">
          <option value="">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="approved">Approuvé</option>
          <option value="rejected">Rejeté</option>
        </select>
      </div>

      {loading ? <div className="text-center py-16"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div> : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['École', 'Directeur', 'Cycle', 'Plan', 'Montant', 'Statut', 'Date', 'Actions'].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredItems.map((r) => {
                const st = STATUS_MAP[r.status] || STATUS_MAP.pending
                return (
                  <tr key={r._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.schoolName}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{r.directorName}<br/><span className="text-gray-400">{r.email}</span></td>
                    <td className="px-4 py-3"><span className="badge badge-blue text-xs">{r.cycle}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-600 capitalize">{r.plan === 'annual' ? 'Annuel' : 'Trimestriel'}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">{r.amount?.toLocaleString()} F</td>
                    <td className="px-4 py-3"><span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(r.createdAt).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-3 flex gap-1">
                      {r.status === 'pending' && (
                        <>
                          <button onClick={() => handleApprove(r._id)} className="p-1.5 rounded hover:bg-green-50 text-green-600 text-xs font-medium">Approuver</button>
                          <button onClick={() => handleReject(r._id)} className="p-1.5 rounded hover:bg-red-50 text-red-500 text-xs font-medium">Rejeter</button>
                        </>
                      )}
                      <button onClick={() => handleDelete(r._id)} className="p-1.5 rounded hover:bg-red-50 text-red-400"><Trash2 size={13} /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filteredItems.length === 0 && <p className="text-center py-10 text-sm text-gray-400">Aucune souscription trouvée</p>}
        </div>
      )}
    </div>
  )
}

/* ─── Director Souscriptions ─── */
function DirectorSouscriptions() {
  const { school } = useAuth()
  const sub = school?.subscription
  const planColors = {
    orange: { gradient: 'from-orange-500 to-amber-400', light: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600', btn: 'bg-orange-500 hover:bg-orange-600' },
    blue: { gradient: 'from-blue-600 to-blue-400', light: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', btn: 'bg-blue-600 hover:bg-blue-700' },
    green: { gradient: 'from-green-600 to-emerald-400', light: 'bg-green-50', border: 'border-green-200', text: 'text-green-600', btn: 'bg-green-600 hover:bg-green-700' },
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><CreditCard size={22} className="text-blue-600" /> Mon Abonnement</h1>
        <p className="text-sm text-gray-500 mt-0.5">{school?.name || 'Mon école'}</p>
      </div>

      {sub ? (
        <div className="card p-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={18} />
                <span className="font-semibold text-lg">Abonnement {sub.status === 'active' ? 'Actif' : 'Inactif'}</span>
                <span className="bg-white/20 text-xs px-2 py-0.5 rounded-full capitalize">{sub.plan === 'annual' ? 'Annuel' : 'Trimestriel'}</span>
              </div>
              <div className="text-blue-100 text-sm mb-1">Cycle {sub.cycle} · {school?.name}</div>
              {sub.endDate && <div className="text-blue-100 text-sm">Valable jusqu'au <strong className="text-white">{new Date(sub.endDate).toLocaleDateString('fr-FR')}</strong></div>}
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{(sub.amount || 0).toLocaleString()}</div>
              <div className="text-blue-200 text-sm">F CFA</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-6 text-center">
          <AlertCircle size={36} className="mx-auto text-amber-400 mb-3" />
          <p className="text-sm text-gray-600">Aucun abonnement actif</p>
        </div>
      )}

      <div>
        <h2 className="text-base font-bold text-gray-900 mb-4">Nos formules d'abonnement</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {subscriptionPlans.map((plan) => {
            const c = planColors[plan.color]
            const isActive = sub?.cycle === plan.cycle
            return (
              <div key={plan.cycle} className={`card overflow-hidden ${isActive ? 'ring-2 ring-blue-600' : ''}`}>
                <div className={`bg-gradient-to-r ${c.gradient} p-5 text-white`}>
                  <div className="text-2xl mb-1">{plan.icon}</div>
                  <div className="text-base font-bold">{plan.cycle}</div>
                  {isActive && <span className="inline-block bg-white/20 text-xs px-2 py-0.5 rounded-full mt-1">Votre plan actuel</span>}
                </div>
                <div className="p-5">
                  <div className="space-y-2 mb-4">
                    <div className={`p-3 rounded-xl ${c.light} ${c.border} border`}><div className="text-xs text-gray-500">Trimestriel</div><div className={`text-base font-bold ${c.text}`}>{plan.quarterly.label}</div></div>
                    <div className={`p-3 rounded-xl ${c.light} ${c.border} border`}><div className="text-xs text-gray-500">Annuel</div><div className={`text-base font-bold ${c.text}`}>{plan.annual.label}</div></div>
                  </div>
                  <div className="space-y-2 mb-4">
                    {['Accès à toutes les fonctionnalités', 'Support prioritaire', 'Mises à jour incluses', 'Export PDF/Excel'].map((f) => (
                      <div key={f} className="flex items-center gap-2 text-xs text-gray-600"><CheckCircle2 size={12} className="text-green-500 flex-shrink-0" />{f}</div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function SouscriptionsPage() {
  const { user } = useAuth()
  if (user?.role === 'super_admin') return <AdminSouscriptions />
  return <DirectorSouscriptions />
}
