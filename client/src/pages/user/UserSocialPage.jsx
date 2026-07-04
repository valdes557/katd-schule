import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Pencil, PlusCircle, Search, X } from 'lucide-react'
import { platformApi } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import SocialTab from '../../components/landing/SocialTab'

// Fil social de l'espace utilisateur — utilise EXACTEMENT le même fil que la page
// d'accueil et les autres dashboards (platformApi.getFeed + composant SocialTab
// partagé), afin d'afficher les mêmes publications (vidéos, images, audios).
export default function UserSocialPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)
  const [videoQuery, setVideoQuery] = useState('')

  // Un post est une vidéo s'il est de type 'video' ou possède une URL vidéo.
  const isVideoPost = (p) => p?.type === 'video' || !!p?.videoUrl

  // Feed affiché : tant que la recherche est vide, on montre TOUT le fil.
  // Dès qu'on tape, on ne garde que les vidéos dont le titre/texte correspond.
  const displayedFeed = useMemo(() => {
    const q = videoQuery.trim().toLowerCase()
    if (!q) return feed
    return feed.filter(
      (p) =>
        isVideoPost(p) &&
        (`${p.title || ''} ${p.content || ''} ${p.caption || ''}`.toLowerCase().includes(q))
    )
  }, [feed, videoQuery])

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const r = await platformApi.getFeed(1)
        if (alive) setFeed(r.data || [])
      } catch {
        if (alive) setFeed([])
      }
      if (alive) setLoading(false)
    })()
    return () => { alive = false }
  }, [])

  return (
    <div>
      {/* En-tête du fil */}
      <div className="flex items-center gap-2 mb-4">
        <span className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
          <PlusCircle size={18} />
        </span>
        <div>
          <h1 className="text-lg font-bold text-gray-900 leading-tight">Fil social</h1>
          <p className="text-xs text-gray-500">Partagez, échangez, informez</p>
        </div>
      </div>

      {/* Composer « Quoi de neuf ? » — ouvre la page de publication */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 mb-5 flex items-center gap-3">
        <span className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
          <Pencil size={16} />
        </span>
        <button
          onClick={() => navigate('/u/publier')}
          className="flex-1 text-left text-sm text-gray-400 bg-gray-50 hover:bg-gray-100 rounded-full px-4 py-2.5 transition-colors"
        >
          Quoi de neuf ?
        </button>
        <button
          onClick={() => navigate('/u/publier')}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-full px-4 py-2.5 transition-colors flex-shrink-0"
        >
          <PlusCircle size={16} /> <span className="hidden sm:inline">Publier</span>
        </button>
      </div>

      {/* Barre de recherche de vidéos dans le fil */}
      <div className="relative mb-5">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={videoQuery}
          onChange={(e) => setVideoQuery(e.target.value)}
          placeholder="Rechercher une vidéo…"
          className="w-full bg-white border border-gray-200 rounded-full pl-10 pr-10 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
        />
        {videoQuery && (
          <button
            onClick={() => setVideoQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            title="Effacer"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16">
          <Loader2 size={24} className="animate-spin mx-auto text-blue-600" />
        </div>
      ) : videoQuery.trim() && displayedFeed.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Search size={40} className="mx-auto mb-3 opacity-40" />
          <p>Aucune vidéo trouvée pour « {videoQuery.trim()} ».</p>
        </div>
      ) : (
        <SocialTab feed={displayedFeed} setFeed={setFeed} user={user} hideHeading />
      )}
    </div>
  )
}
