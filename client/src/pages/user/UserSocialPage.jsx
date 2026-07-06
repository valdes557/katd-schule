import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { Loader2, Pencil, PlusCircle, Search } from 'lucide-react'
import { platformApi } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import SocialTab from '../../components/landing/SocialTab'

// Fil social de l'espace utilisateur — utilise EXACTEMENT le même fil que la page
// d'accueil et les autres dashboards (platformApi.getFeed + composant SocialTab
// partagé), afin d'afficher les mêmes publications (vidéos, images, audios).
export default function UserSocialPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const ctx = useOutletContext() // { searchTerm } fourni par la barre de recherche de l'en-tête
  const searchTerm = ctx?.searchTerm || ''
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)

  // Feed affiché : filtré par la recherche de l'en-tête (titre / texte / légende).
  const displayedFeed = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return feed
    return feed.filter((p) =>
      `${p.title || ''} ${p.content || ''} ${p.caption || ''}`.toLowerCase().includes(q)
    )
  }, [feed, searchTerm])

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

      {loading ? (
        <div className="text-center py-16">
          <Loader2 size={24} className="animate-spin mx-auto text-blue-600" />
        </div>
      ) : searchTerm.trim() && displayedFeed.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Search size={40} className="mx-auto mb-3 opacity-40" />
          <p>Aucune publication trouvée pour « {searchTerm.trim()} ».</p>
        </div>
      ) : (
        <SocialTab feed={displayedFeed} setFeed={setFeed} user={user} hideHeading />
      )}
    </div>
  )
}
