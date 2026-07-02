import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Pencil, PlusCircle } from 'lucide-react'
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

      {loading ? (
        <div className="text-center py-16">
          <Loader2 size={24} className="animate-spin mx-auto text-blue-600" />
        </div>
      ) : (
        <SocialTab feed={feed} setFeed={setFeed} user={user} />
      )}
    </div>
  )
}
