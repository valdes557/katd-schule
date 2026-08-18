import { useState, useEffect, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Loader2, Youtube, Search } from 'lucide-react'
import { platformApi } from '../../lib/api'
import ResourcePreview from '../../components/ResourcePreview'

// Page « Vidéos » de l'espace utilisateur : liste toutes les vidéos publiées sur le site
// et les lit EN INTÉGRÉ (iframe pour YouTube/Vimeo, lecteur <video> pour les fichiers).
// L'utilisateur regarde sans jamais être redirigé vers YouTube.
export default function UserVideosPage() {
  const ctx = useOutletContext() // { searchTerm } fourni par la barre de recherche de l'en-tête
  const searchTerm = ctx?.searchTerm || ''
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const r = await platformApi.getVideos(1)
        if (alive) setVideos(r.data || [])
      } catch {
        if (alive) setVideos([])
      }
      if (alive) setLoading(false)
    })()
    return () => { alive = false }
  }, [])

  // Filtre par la recherche de l'en-tête (titre / texte / auteur).
  const displayed = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return videos
    return videos.filter((p) =>
      `${p.title || ''} ${p.content || ''} ${p.author?.name || ''}`.toLowerCase().includes(q)
    )
  }, [videos, searchTerm])

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center text-red-600 flex-shrink-0">
          <Youtube size={18} />
        </span>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Vidéos</h1>
          <p className="text-xs text-gray-500">Toutes les vidéos du site, à regarder sans quitter la plateforme.</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16">
          <Loader2 size={24} className="animate-spin mx-auto text-red-600" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {searchTerm.trim() ? <Search size={40} className="mx-auto mb-3 opacity-40" /> : <Youtube size={40} className="mx-auto mb-3 opacity-30" />}
          <p>{searchTerm.trim() ? `Aucune vidéo trouvée pour « ${searchTerm.trim()} ».` : 'Aucune vidéo pour le moment.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {displayed.map((p) => (
            <div key={p._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Lecture en intégré : ResourcePreview transforme les liens YouTube/Vimeo en
                  iframe embed et joue les fichiers mp4 dans un lecteur <video>. */}
              <div className="px-3 pt-3">
                <ResourcePreview type="video" url={p.videoUrl} title={p.title || p.content} />
              </div>
              <div className="p-3">
                {(p.title || p.content) && (
                  <p className="text-sm font-semibold text-gray-900 line-clamp-2">{p.title || p.content}</p>
                )}
                <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-500">
                  {p.author?.avatar
                    ? <img src={p.author.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                    : <span className="w-5 h-5 rounded-full bg-gray-100 inline-block" />}
                  <span className="truncate">{p.author?.name || p.school?.name || 'KATD-SCHÜLE'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
