import { Clock, Loader2 } from 'lucide-react'
import { timetablesApi } from '../../lib/api'
import { useCachedFetch } from '../../hooks/useCachedFetch'

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

/** Emploi du temps de la classe de l'élève connecté (lecture seule). */
export default function EleveTimetablePage() {
  const ttQ = useCachedFetch('/timetables?eleve', async () => (await timetablesApi.list()).data || [], [])
  const timetable = (ttQ.data || [])[0]
  const slots = timetable?.slots || []

  if (ttQ.loading) return <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Clock size={20} className="text-indigo-600" /> Mon emploi du temps</h1>
        <p className="text-sm text-gray-500">{timetable?.class?.name ? `Classe : ${timetable.class.name}` : 'Aucune classe attribuée'}</p>
      </div>

      {slots.length === 0 ? (
        <div className="card p-10 text-center">
          <Clock size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">Aucun créneau défini pour votre classe.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {DAYS.map((day) => {
            const daySlots = slots
              .filter((s) => s.day === day)
              .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
            if (daySlots.length === 0) return null
            return (
              <div key={day} className="card p-4">
                <h3 className="text-sm font-bold text-indigo-700 mb-2">{day}</h3>
                <div className="space-y-2">
                  {daySlots.map((s, i) => (
                    <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                      <div className="text-xs font-semibold text-gray-900">{s.subject}</div>
                      <div className="text-[11px] text-gray-500">{s.startTime} – {s.endTime}{s.teacher ? ` · ${s.teacher}` : ''}{s.room ? ` · Salle ${s.room}` : ''}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
