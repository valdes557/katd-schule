import { useState } from 'react'
import { Search, MapPin, Users, BookOpen, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import PublicHeader from '../components/layout/PublicHeader'
import Footer from '../components/layout/Footer'
import { schools } from '../data/mockData'

export default function EcolesPage() {
  const [search, setSearch] = useState('')
  const [cycleFilter, setCycleFilter] = useState('Tous')

  const cycles = ['Tous', 'Maternelle', 'Primaire', 'Secondaire']

  const filtered = schools.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.city.toLowerCase().includes(search.toLowerCase())
    const matchCycle = cycleFilter === 'Tous' || s.type.includes(cycleFilter)
    return matchSearch && matchCycle
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader />

      <div className="bg-white border-b border-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Toutes les écoles</h1>
          <p className="text-sm text-gray-500">Découvrez et rejoignez les écoles sur KATD-SCHÜLE</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une école ou une ville..." className="input pl-9 text-sm" />
          </div>
          <div className="flex gap-2">
            {cycles.map((c) => (
              <button key={c} onClick={() => setCycleFilter(c)} className={`text-sm px-4 py-2 rounded-lg border transition-colors ${cycleFilter === c ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}>{c}</button>
            ))}
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-5">{filtered.length} école(s) trouvée(s)</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((school) => (
            <div key={school.id} className="card p-5 hover:shadow-card-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0" style={{ backgroundColor: school.color }}>
                    {school.initials}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">{school.name}</h3>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                      <MapPin size={11} />
                      {school.city}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mb-4">
                {school.cycles.map((c) => (
                  <span key={c} className="badge badge-blue text-xs">{c}</span>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 mb-4 text-xs text-gray-500">
                <div className="flex items-center gap-1.5">
                  <Users size={12} className="text-gray-400" />
                  <span>~{Math.floor(Math.random() * 300 + 150)} élèves</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <BookOpen size={12} className="text-gray-400" />
                  <span>~{Math.floor(Math.random() * 10 + 8)} classes</span>
                </div>
              </div>
              <Link to="/login" className="flex items-center justify-center gap-2 w-full py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
                Accéder à cette école <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      </div>

      <Footer />
    </div>
  )
}
