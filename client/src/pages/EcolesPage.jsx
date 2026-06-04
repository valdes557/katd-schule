import { useEffect, useState } from 'react'
import { Search, MapPin, Users, BookOpen, Loader2, GraduationCap, Eye, Baby } from 'lucide-react'
import { Link } from 'react-router-dom'
import PublicHeader from '../components/layout/PublicHeader'
import Footer from '../components/layout/Footer'
import { schoolsApi } from '../lib/api'

const CYCLES_CONFIG = [
  {
    id: 'Maternelle',
    label: 'Cycle Maternelle',
    icon: Baby,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    badge: 'bg-orange-100 text-orange-700',
    accent: 'bg-orange-600',
    desc: 'Établissements accueillant les enfants de 2 à 6 ans',
  },
  {
    id: 'Primaire',
    label: 'Cycle Primaire',
    icon: BookOpen,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-700',
    accent: 'bg-blue-600',
    desc: 'Du CP au CM2 — de 6 à 12 ans',
  },
  {
    id: 'Secondaire',
    label: 'Cycle Secondaire',
    icon: GraduationCap,
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    badge: 'bg-green-100 text-green-700',
    accent: 'bg-green-600',
    desc: 'De la 6ème à la Terminale',
  },
]

const ACCENT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#EC4899', '#14B8A6']

export default function EcolesPage() {
  const [schools, setSchools] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [cycleFilter, setCycleFilter] = useState('Tous')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (search) params.set('search', search)
        if (cycleFilter !== 'Tous') params.set('cycle', cycleFilter)
        const res = await schoolsApi.list(params.toString())
        setSchools(res.data || [])
      } catch (err) { console.error(err) }
      setLoading(false)
    }
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [search, cycleFilter])

  const schoolsByCycle = (cycle) => schools.filter((s) => s.cycles?.includes(cycle))
  const showGrouped = cycleFilter === 'Tous' && !search

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader />

      {/* Hero */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white py-14">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Nos Écoles Partenaires</h1>
          <p className="text-blue-200 text-base mb-8">Découvrez les établissements du réseau KATD-SCHÜLE</p>

          {/* Search bar */}
          <div className="max-w-lg mx-auto relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une école par nom ou ville..."
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-white text-gray-800 text-sm shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Cycle filter tabs */}
          <div className="flex items-center justify-center gap-2 mt-5 flex-wrap">
            {['Tous', 'Maternelle', 'Primaire', 'Secondaire'].map((c) => (
              <button
                key={c}
                onClick={() => setCycleFilter(c)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  cycleFilter === c ? 'bg-white text-blue-700 shadow' : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-blue-600" />
          </div>
        ) : schools.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <BookOpen size={44} className="mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">Aucune école trouvée</p>
            <p className="text-sm mt-1">Essayez un autre terme de recherche ou cycle</p>
          </div>
        ) : showGrouped ? (
          /* ── Grouped by cycle ── */
          <div className="space-y-12">
            {CYCLES_CONFIG.map((cfg) => {
              const group = schoolsByCycle(cfg.id)
              if (group.length === 0) return null
              const Icon = cfg.icon
              return (
                <section key={cfg.id}>
                  <div className={`flex items-center gap-3 mb-5 pb-3 border-b ${cfg.border}`}>
                    <div className={`w-9 h-9 rounded-xl ${cfg.bg} flex items-center justify-center`}>
                      <Icon size={18} className={cfg.color} />
                    </div>
                    <div>
                      <h2 className={`text-lg font-bold ${cfg.color}`}>{cfg.label}</h2>
                      <p className="text-xs text-gray-500">{cfg.desc} · {group.length} école{group.length > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {group.map((school, i) => (
                      <SchoolCard key={school._id} school={school} accent={ACCENT_COLORS[i % ACCENT_COLORS.length]} cycleCfg={cfg} />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        ) : (
          /* ── Flat grid (filtered) ── */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {schools.map((school, i) => (
              <SchoolCard key={school._id} school={school} accent={ACCENT_COLORS[i % ACCENT_COLORS.length]} />
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}

function SchoolCard({ school, accent, cycleCfg }) {
  const initials = (school.name || '').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all group">
      {/* Logo / Image banner */}
      <div className="h-28 relative overflow-hidden" style={{ backgroundColor: accent + '20' }}>
        {school.logo ? (
          <img src={school.logo} alt={school.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-lg"
              style={{ backgroundColor: accent }}
            >
              {initials}
            </div>
          </div>
        )}
        {/* Cycle badges */}
        {school.cycles?.length > 0 && (
          <div className="absolute top-2 right-2 flex flex-wrap gap-1 justify-end">
            {school.cycles.slice(0, 2).map((c) => (
              <span key={c} className="text-[9px] font-semibold bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded-full text-gray-700 shadow-sm">
                {c}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        <h3 className="text-sm font-bold text-gray-900 mb-1 line-clamp-2 leading-snug">{school.name}</h3>
        <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
          <MapPin size={10} className="flex-shrink-0" />
          <span className="truncate">{[school.address?.neighborhood, school.address?.city].filter(Boolean).join(', ') || 'Cameroun'}</span>
        </div>

        {school.description && (
          <p className="text-xs text-gray-500 line-clamp-2 mb-3">{school.description}</p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-3 text-[10px] text-gray-400 mb-4 border-t border-gray-50 pt-2">
          <span className="flex items-center gap-0.5"><Users size={9} /> {school.stats?.totalStudents || 0} élèves</span>
          <span className="flex items-center gap-0.5"><BookOpen size={9} /> {school.stats?.totalClasses || 0} classes</span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Link
            to={`/ecole/${school._id}`}
            className="flex-1 flex items-center justify-center gap-1 border border-gray-200 text-gray-700 text-xs font-semibold py-2 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <Eye size={12} /> Voir détails
          </Link>
          <Link
            to={`/inscription/${school._id}`}
            className="flex-1 flex items-center justify-center gap-1.5 text-white text-xs font-semibold py-2 rounded-xl hover:opacity-90 transition-opacity"
            style={{ backgroundColor: accent }}
          >
            <GraduationCap size={12} /> S'inscrire
          </Link>
        </div>
      </div>
    </div>
  )
}
