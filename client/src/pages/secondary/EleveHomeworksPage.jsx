import { ClipboardList, Loader2, Calendar } from 'lucide-react'
import { studentsApi } from '../../lib/api'
import { useCachedFetch } from '../../hooks/useCachedFetch'

/** Devoirs de la classe de l'élève connecté (lecture seule). */
export default function EleveHomeworksPage() {
  const hwQ = useCachedFetch('/students/me/homeworks', async () => (await studentsApi.myHomeworks()).data || [], [])
  const homeworks = hwQ.data || []
  const now = new Date()

  if (hwQ.loading) return <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>

  const upcoming = homeworks.filter((h) => new Date(h.dueDate) >= now)
  const past = homeworks.filter((h) => new Date(h.dueDate) < now)

  const HomeworkCard = ({ h, isPast }) => {
    const days = Math.ceil((new Date(h.dueDate) - now) / (1000 * 3600 * 24))
    return (
      <div className={`card p-4 ${isPast ? 'opacity-60' : ''}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-gray-900">{h.title}</p>
            <p className="text-xs text-indigo-600 font-semibold">{h.subject}</p>
          </div>
          {!isPast && (
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${days <= 1 ? 'bg-red-50 text-red-600' : days <= 3 ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}`}>
              {days <= 0 ? "Aujourd'hui" : `${days} jour${days > 1 ? 's' : ''}`}
            </span>
          )}
        </div>
        {h.description && <p className="text-xs text-gray-500 mt-2 whitespace-pre-wrap">{h.description}</p>}
        <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1"><Calendar size={11} /> À rendre le {new Date(h.dueDate).toLocaleDateString('fr-FR')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><ClipboardList size={20} className="text-indigo-600" /> Mes devoirs</h1>
        <p className="text-sm text-gray-500">{upcoming.length} devoir(s) à venir</p>
      </div>

      {homeworks.length === 0 ? (
        <div className="card p-10 text-center">
          <ClipboardList size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">Aucun devoir pour votre classe.</p>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcoming.map((h) => <HomeworkCard key={h._id} h={h} />)}
            </div>
          )}
          {past.length > 0 && (
            <>
              <h2 className="text-sm font-bold text-gray-500 mt-6">Devoirs passés</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {past.slice(0, 12).map((h) => <HomeworkCard key={h._id} h={h} isPast />)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
