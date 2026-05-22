import { Link } from 'react-router-dom'
import { GraduationCap, MapPin } from 'lucide-react'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4']

export default function SchoolsTab({ schoolsList }) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Nos écoles partenaires</h2>

      {['Maternelle', 'Primaire', 'Secondaire'].map((cycle) => {
        const filtered = schoolsList.filter((s) => s.cycles?.includes(cycle))
        if (filtered.length === 0) return null
        return (
          <div key={cycle}>
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <GraduationCap size={14} className="text-blue-600" /> Cycle {cycle}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((school) => {
                const initials = (school.name || '')
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()
                const color = COLORS[Math.abs(school.name?.charCodeAt(0) || 0) % COLORS.length]
                return (
                  <div
                    key={school._id}
                    className="bg-white border border-gray-100 rounded-xl p-4 hover:border-blue-300 hover:shadow-card transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                        style={{ backgroundColor: color }}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-gray-900 truncate">
                          {school.name}
                        </div>
                        <div className="text-xs text-gray-400 flex items-center gap-1">
                          <MapPin size={10} /> {school.address?.city || 'Cameroun'}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Link
                        to={`/ecole/${school._id}`}
                        className="flex-1 text-center text-[11px] font-semibold py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Voir les détails
                      </Link>
                      <Link
                        to={`/inscription/${school._id}`}
                        className="flex-1 text-center text-[11px] font-semibold py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                      >
                        S'inscrire
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Show all schools if none matched cycles */}
      {schoolsList.length > 0 &&
        !['Maternelle', 'Primaire', 'Secondaire'].some((c) =>
          schoolsList.some((s) => s.cycles?.includes(c))
        ) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {schoolsList.map((school) => {
              const initials = (school.name || '')
                .split(' ')
                .map((w) => w[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()
              const color = COLORS[Math.abs(school.name?.charCodeAt(0) || 0) % COLORS.length]
              return (
                <div
                  key={school._id}
                  className="bg-white border border-gray-100 rounded-xl p-4 hover:border-blue-300 hover:shadow-card transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {school.name}
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-1">
                        <MapPin size={10} /> {school.address?.city || 'Cameroun'}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Link
                      to={`/ecole/${school._id}`}
                      className="flex-1 text-center text-[11px] font-semibold py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Voir les détails
                    </Link>
                    <Link
                      to={`/inscription/${school._id}`}
                      className="flex-1 text-center text-[11px] font-semibold py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                      S'inscrire
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      {schoolsList.length === 0 && (
        <p className="text-center text-sm text-gray-400 py-12">
          Aucune école inscrite pour le moment
        </p>
      )}
    </div>
  )
}
