import { useEffect, useState } from 'react'
import { School, Search, Trash2, Eye, Loader2, AlertCircle, MapPin } from 'lucide-react'
import { schoolsApi } from '../lib/api'

export default function AdminEcolesPage() {
  const [schools, setSchools] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [cycleFilter, setCycleFilter] = useState('')

  const fetchSchools = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (cycleFilter) params.set('cycle', cycleFilter)
      const res = await schoolsApi.list(params.toString())
      setSchools(res.data || [])
      setTotal(res.total || 0)
    } catch (e) {}
    setLoading(false)
  }

  useEffect(() => { fetchSchools() }, [])
  useEffect(() => { const t = setTimeout(fetchSchools, 400); return () => clearTimeout(t) }, [search, cycleFilter])

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette école ? Cette action est irréversible.')) return
    try { await schoolsApi.remove(id); fetchSchools() } catch (e) { alert(e.message) }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <School size={22} className="text-blue-600" /> Gestion des Écoles
          </h1>
          <p className="text-sm text-gray-500">{total} école(s) sur la plateforme</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une école..." className="input pl-9 text-sm" />
        </div>
        <select value={cycleFilter} onChange={(e) => setCycleFilter(e.target.value)} className="input text-sm w-auto">
          <option value="">Tous les cycles</option>
          <option value="Maternelle">Maternelle</option>
          <option value="Primaire">Primaire</option>
          <option value="Secondaire">Secondaire</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-16"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div>
      ) : schools.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <AlertCircle size={36} className="mx-auto mb-3 opacity-30" />
          <p>Aucune école trouvée</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {schools.map((s) => (
            <div key={s._id} className="card p-4 flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-blue-600 flex items-center justify-center text-white text-lg font-bold">
                {s.logo ? <img src={s.logo} alt="" className="w-full h-full object-cover" /> : s.name?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">{s.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      {s.cycles?.map((c) => (
                        <span key={c} className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full font-medium">{c}</span>
                      ))}
                      {s.address?.city && (
                        <span className="text-xs text-gray-400 flex items-center gap-1"><MapPin size={10} /> {s.address.city}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s.subscription?.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {s.subscription?.status === 'active' ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span>Plan: <strong className="text-gray-700 capitalize">{s.subscription?.plan || '—'}</strong></span>
                  {s.subscription?.endDate && <span>Expire: {new Date(s.subscription.endDate).toLocaleDateString('fr-FR')}</span>}
                  <span>Élèves: <strong>{s.stats?.totalStudents || 0}</strong></span>
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <a href={`/ecole/${s._id}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded hover:bg-blue-50 text-blue-600"><Eye size={14} /></a>
                <button onClick={() => handleDelete(s._id)} className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
