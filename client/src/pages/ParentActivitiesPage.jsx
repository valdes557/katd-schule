import { Loader2, Calendar, MapPin, Users, Sparkles, BookOpen, ExternalLink } from 'lucide-react'
import { parentApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'

export default function ParentActivitiesPage({ section = 'activities' }) {
  const itemsQ = useCachedFetch(
    `/parent/${section}`,
    async () => {
      const r = section === 'resources' ? await parentApi.resources() : await parentApi.activities()
      return r.data || []
    },
    [section],
  )

  const items = itemsQ.data || []
  const loading = itemsQ.loading

  if (loading) return <div className="flex justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>

  const isResources = section === 'resources'

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        {isResources ? <BookOpen className="w-6 h-6 text-emerald-600"/> : <Sparkles className="w-6 h-6 text-purple-600"/>}
        {isResources ? 'Ressources pédagogiques' : 'Activités scolaires'}
      </h1>
      <p className="text-sm text-gray-500">
        {isResources
          ? "Documents et liens partagés par les enseignants pour vos enfants."
          : "Activités planifiées par les enseignants pour vos enfants."}
      </p>

      {items.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">{isResources ? 'Aucune ressource disponible' : 'Aucune activité planifiée'}</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((it) => isResources ? (
            <div key={it._id} className="bg-white border rounded-xl p-4 shadow-sm">
              <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-700">{it.type}</span>
              <h3 className="font-bold text-lg mt-2 mb-1">{it.title}</h3>
              {it.subject && <p className="text-xs text-gray-500 mb-1">{it.subject}</p>}
              {it.description && <p className="text-sm text-gray-600 mb-3 line-clamp-2">{it.description}</p>}
              <div className="flex flex-wrap gap-1 mb-2">
                {(it.classes || []).map((c) => <span key={c._id || c} className="text-xs px-2 py-0.5 bg-gray-100 rounded">{c.name}</span>)}
              </div>
              <p className="text-xs text-gray-500">par {it.teacher?.firstName} {it.teacher?.lastName}</p>
              {it.url && (
                <a href={it.url} target="_blank" rel="noreferrer" className="mt-2 text-emerald-600 hover:underline text-sm flex items-center gap-1">
                  <ExternalLink className="w-3 h-3"/> Ouvrir
                </a>
              )}
            </div>
          ) : (
            <div key={it._id} className="bg-white border rounded-xl p-4 shadow-sm">
              <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700">{it.type}</span>
              <h3 className="font-bold text-lg mt-2 mb-1">{it.title}</h3>
              {it.description && <p className="text-sm text-gray-600 mb-3 line-clamp-2">{it.description}</p>}
              <div className="space-y-1 text-sm text-gray-700">
                <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-gray-400"/>{new Date(it.date).toLocaleDateString('fr-FR')}</div>
                {it.location && <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-400"/>{it.location}</div>}
                <div className="flex items-center gap-2"><Users className="w-4 h-4 text-gray-400"/>{it.class?.name}</div>
                {it.cost > 0 && <div className="text-orange-600 font-semibold">Coût: {it.cost} FCFA</div>}
                {it.requiresAuthorization && <div className="text-amber-600 text-xs">⚠️ Autorisation requise</div>}
              </div>
              <p className="text-xs text-gray-500 mt-2">par {it.teacher?.firstName} {it.teacher?.lastName}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
