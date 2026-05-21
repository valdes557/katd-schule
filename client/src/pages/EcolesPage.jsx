import { useEffect, useState } from 'react'
import { Search, MapPin, Users, BookOpen, Loader2 } from 'lucide-react'
import PublicHeader from '../components/layout/PublicHeader'
import Footer from '../components/layout/Footer'
import { schoolsApi } from '../lib/api'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4']

export default function EcolesPage() {
  const [schools, setSchools] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [cycleFilter, setCycleFilter] = useState('Tous')

  const cycles = ['Tous', 'Maternelle', 'Primaire', 'Secondaire']

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (search) params.set('search', search)
        if (cycleFilter !== 'Tous') params.set('cycle', cycleFilter)
        const res = await schoolsApi.list(params.toString())
        setSchools(res.data || [])
      } catch (e) { console.error(e) }
      setLoading(false)
    }
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [search, cycleFilter])

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Écoles partenaires</h1>
          <p className="text-base text-gray-600">Découvrez les établissements du réseau KATD-SCHÜLE</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8 max-w-xl mx-auto">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une école..." className="input pl-9 text-sm" />
          </div>
          <div className="flex gap-1 bg-white border border-gray-200 p-1 rounded-xl">
            {cycles.map((c) => (
              <button key={c} onClick={() => setCycleFilter(c)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${cycleFilter === c ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Schools grid */}
        {loading ? (
          <div className="text-center py-16"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div>
        ) : schools.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <BookOpen size={40} className="mx-auto mb-3 opacity-20" />
            <p>Aucune école trouvée</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {schools.map((school, i) => {
              const initials = (school.name || '').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
              const color = COLORS[i % COLORS.length]
              return (
                <div key={school._id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-card-lg transition-all">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-base font-bold mb-3" style={{ backgroundColor: color }}>
                    {initials}
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1">{school.name}</h3>
                  <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
                    <MapPin size={11} /> {school.address?.city || 'Cameroun'}
                  </div>
                  {school.cycles?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {school.cycles.map((c) => (
                        <span key={c} className="badge badge-blue text-[10px]">{c}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Users size={11} /> {school.stats?.totalStudents || 0}</span>
                    <span className="flex items-center gap-1"><BookOpen size={11} /> {school.stats?.totalClasses || 0} classes</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}
