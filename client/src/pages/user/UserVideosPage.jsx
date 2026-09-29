import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Loader2, Youtube, Search, PlaySquare, Heart, History, Trash2, SlidersHorizontal, X } from 'lucide-react'
import { platformApi, youtubeApi } from '../../lib/api'
import ResourcePreview from '../../components/ResourcePreview'
import YoutubeCard from '../../components/youtube/YoutubeCard'
import YoutubeSkeleton from '../../components/youtube/YoutubeSkeleton'
import YoutubePlayerModal from '../../components/youtube/YoutubePlayerModal'
import DownloadAdGate from '../../components/youtube/DownloadAdGate'

// Page « Vidéos » de l'espace utilisateur — 2 onglets :
//  • YouTube : recherche + lecture EN INTÉGRÉ des vraies vidéos YouTube (API officielle, via backend).
//  • KATD    : vidéos publiées sur la plateforme (comportement historique, inchangé).
const ORDERS = [
  { key: 'relevance', label: 'Pertinence' },
  { key: 'date', label: 'Date' },
  { key: 'viewCount', label: 'Vues' },
]
const DURATIONS = [
  { key: '', label: 'Toutes durées' },
  { key: 'short', label: 'Courtes' },
  { key: 'medium', label: 'Moyennes' },
  { key: 'long', label: 'Longues' },
]

export default function UserVideosPage() {
  const ctx = useOutletContext()
  const headerSearch = ctx?.searchTerm || ''
  const [tab, setTab] = useState('youtube')

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center text-red-600 flex-shrink-0"><Youtube size={18} /></span>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-gray-900">Vidéos</h1>
          <p className="text-xs text-gray-500">Regardez KATDTUBE et les vidéos KATD sans quitter la plateforme.</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4 border-b border-gray-200">
        {[['youtube', 'KATDTUBE'], ['katd', 'KATD']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === k ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'youtube' ? <YoutubeTab /> : <KatdTab headerSearch={headerSearch} />}
    </div>
  )
}

function Empty({ icon: Icon, text }) {
  return <div className="text-center py-16 text-gray-400"><Icon size={40} className="mx-auto mb-3 opacity-30" /><p>{text}</p></div>
}

function YoutubeTab() {
  const [sub, setSub] = useState('search') // search | favorites | history
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [order, setOrder] = useState('relevance')
  const [duration, setDuration] = useState('')
  const [items, setItems] = useState([])
  const [nextToken, setNextToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [categories, setCategories] = useState([
    { key: '', label: 'Tous', emoji: '✨', query: '' },
  ])
  const [activeCat, setActiveCat] = useState('')
  const [player, setPlayer] = useState(null)

  const [favorites, setFavorites] = useState([])
  const [history, setHistory] = useState([])
  const [listLoading, setListLoading] = useState(false)
  // Vidéo en cours de téléchargement (ouvre le « gate » publicitaire AdSense).
  const [downloadVideo, setDownloadVideo] = useState(null)

  useEffect(() => {
    youtubeApi.categories().then((r) => {
      const list = r.categories || []
      if (!list.some(c => c.key === '')) {
        setCategories([{ key: '', label: 'Tous', emoji: '✨', query: '' }, ...list])
      } else {
        setCategories(list)
      }
    }).catch(() => {})
  }, [])

  // Debounce ~500 ms : synchronise query si l'utilisateur arrête de taper
  const debRef = useRef()
  useEffect(() => {
    if (sub !== 'search') return
    clearTimeout(debRef.current)
    debRef.current = setTimeout(() => {
      const clean = input.trim()
      if (clean !== query) setQuery(clean)
    }, 500)
    return () => clearTimeout(debRef.current)
  }, [input, sub, query])

  // Charge le flux de vidéos (flux d'accueil YouTube "Tous" si query est vide, ou recherche spécifique)
  const runSearch = useCallback(async (customQ = null) => {
    setLoading(true); setError('')
    try {
      const effectiveQ = customQ !== null ? customQ : query
      const r = await youtubeApi.search({ q: effectiveQ, order, duration })
      setItems(r.items || []); setNextToken(r.nextPageToken || '')
    } catch (e) {
      setError(e.message || 'Recherche impossible')
    }
    setLoading(false)
  }, [query, order, duration])

  useEffect(() => { runSearch() }, [runSearch])

  const loadMore = async () => {
    if (!nextToken) return
    setLoadingMore(true)
    try {
      const r = await youtubeApi.search({ q: query, order, duration, pageToken: nextToken })
      setItems((prev) => [...prev, ...(r.items || [])]); setNextToken(r.nextPageToken || '')
    } catch (e) { /* on garde la liste actuelle */ }
    setLoadingMore(false)
  }

  // Clic sur une catégorie
  const pickCategory = (cat) => {
    clearTimeout(debRef.current)
    setActiveCat(cat.key)
    const qVal = cat.query || ''
    setInput(qVal)
    setQuery(qVal)
    runSearch(qVal)
  }

  // Soumission manuelle de la recherche (clic bouton ou touche Entrée)
  const submit = (e) => {
    e?.preventDefault()
    clearTimeout(debRef.current)
    const clean = input.trim()
    setQuery(clean)
    setActiveCat('')
    runSearch(clean)
  }

  // Effacer la recherche pour revenir au flux d'accueil
  const clearSearch = () => {
    clearTimeout(debRef.current)
    setInput('')
    setQuery('')
    setActiveCat('')
    runSearch('')
  }

  useEffect(() => {
    if (sub === 'favorites') { setListLoading(true); youtubeApi.favorites().then((r) => setFavorites(r.data || [])).catch(() => setFavorites([])).finally(() => setListLoading(false)) }
    if (sub === 'history') { setListLoading(true); youtubeApi.history().then((r) => setHistory(r.data || [])).catch(() => setHistory([])).finally(() => setListLoading(false)) }
  }, [sub])

  const clearHistory = async () => { if (!window.confirm("Effacer tout l'historique ?")) return; await youtubeApi.clearHistory().catch(() => {}); setHistory([]) }
  const removeFav = async (videoId) => { await youtubeApi.removeFavorite(videoId).catch(() => {}); setFavorites((prev) => prev.filter((f) => f.youtubeVideoId !== videoId)) }

  return (
    <div>
      {/* Sous-onglets */}
      <div className="flex items-center gap-1.5 mb-3">
        {[['search', 'Recherche', PlaySquare], ['favorites', 'Favoris', Heart], ['history', 'Historique', History]].map(([k, label, Icon]) => (
          <button key={k} onClick={() => setSub(k)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${sub === k ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {sub === 'search' && (
        <>
          <form onSubmit={submit} className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Rechercher des vidéos sur tout YouTube..."
                className="w-full pl-9 pr-9 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm"
              />
              {input && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
                  title="Effacer la recherche"
                >
                  <X size={15} />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="bg-red-600 hover:bg-red-700 active:scale-95 text-white text-sm font-semibold rounded-xl px-5 py-2.5 transition-all shadow-sm flex items-center gap-1.5 shrink-0"
            >
              <Search size={15} /> Rechercher
            </button>
          </form>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 no-scrollbar">
            {categories.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => pickCategory(c)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  activeCat === c.key
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 mb-4 text-xs">
            <SlidersHorizontal size={14} className="text-gray-400" />
            <select value={order} onChange={(e) => setOrder(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
              {ORDERS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            <select value={duration} onChange={(e) => setDuration(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
              {DURATIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </div>

          {loading ? <YoutubeSkeleton />
            : error && items.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <Youtube size={40} className="mx-auto mb-3 text-red-200" />
                <p className="max-w-md mx-auto">{error}</p>
                <button onClick={() => runSearch()} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700">
                  Réessayer
                </button>
              </div>
            )
            : !query && items.length === 0 ? <Empty icon={Search} text="Recherchez une vidéo ou choisissez une catégorie." />
            : items.length === 0 ? <Empty icon={Youtube} text="Aucune vidéo trouvée." />
            : (
              <>
                {error && (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={() => setError('')} className="font-semibold text-amber-900 underline ml-2">Fermer</button>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {items.map((v) => <YoutubeCard key={v.videoId} video={v} onClick={() => setPlayer(v.videoId)} onDownload={() => setDownloadVideo(v)} />)}
                </div>
                {nextToken && (
                  <div className="text-center pt-4">
                    <button onClick={loadMore} disabled={loadingMore} className="inline-flex items-center gap-2 border border-gray-200 text-gray-700 text-sm font-medium px-6 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                      {loadingMore && <Loader2 size={14} className="animate-spin" />} Charger plus
                    </button>
                  </div>
                )}
              </>
            )}
        </>
      )}

      {sub === 'favorites' && (
        listLoading ? <YoutubeSkeleton count={4} />
          : favorites.length === 0 ? <Empty icon={Heart} text="Aucune vidéo en favori." />
          : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {favorites.map((f) => (
                <div key={f._id} className="relative">
                  <YoutubeCard video={{ videoId: f.youtubeVideoId, title: f.title, channelTitle: f.channelTitle, thumbnail: f.thumbnail }} onClick={() => setPlayer(f.youtubeVideoId)} onDownload={() => setDownloadVideo({ videoId: f.youtubeVideoId, title: f.title })} />
                  <button onClick={() => removeFav(f.youtubeVideoId)} title="Retirer des favoris" className="absolute top-1.5 left-1.5 p-1.5 rounded-lg bg-white/90 text-red-600 hover:bg-white shadow"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          )
      )}

      {sub === 'history' && (
        listLoading ? <YoutubeSkeleton count={4} />
          : history.length === 0 ? <Empty icon={History} text="Aucune vidéo consultée." />
          : (
            <>
              <div className="flex justify-end mb-2">
                <button onClick={clearHistory} className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg px-3 py-1.5"><Trash2 size={13} /> Effacer l'historique</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {history.map((h) => <YoutubeCard key={h._id} video={{ videoId: h.youtubeVideoId, title: h.title, channelTitle: h.channelTitle, thumbnail: h.thumbnail }} onClick={() => setPlayer(h.youtubeVideoId)} onDownload={() => setDownloadVideo({ videoId: h.youtubeVideoId, title: h.title })} />)}
              </div>
            </>
          )
      )}

      {player && <YoutubePlayerModal videoId={player} onClose={() => setPlayer(null)} />}
      {downloadVideo && <DownloadAdGate videoId={downloadVideo.videoId} title={downloadVideo.title} onClose={() => setDownloadVideo(null)} />}
    </div>
  )
}

// Onglet KATD — vidéos de la plateforme (comportement d'origine, inchangé).
function KatdTab({ headerSearch }) {
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try { const r = await platformApi.getVideos(1); if (alive) setVideos(r.data || []) }
      catch { if (alive) setVideos([]) }
      if (alive) setLoading(false)
    })()
    return () => { alive = false }
  }, [])
  const displayed = useMemo(() => {
    const q = headerSearch.trim().toLowerCase()
    if (!q) return videos
    return videos.filter((p) => `${p.title || ''} ${p.content || ''} ${p.author?.name || ''}`.toLowerCase().includes(q))
  }, [videos, headerSearch])

  if (loading) return <div className="text-center py-16"><Loader2 size={24} className="animate-spin mx-auto text-red-600" /></div>
  if (displayed.length === 0) return <Empty icon={Youtube} text="Aucune vidéo pour le moment." />
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {displayed.map((p) => (
        <div key={p._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-3 pt-3"><ResourcePreview type="video" url={p.videoUrl} title={p.title || p.content} /></div>
          <div className="p-3">
            {(p.title || p.content) && <p className="text-sm font-semibold text-gray-900 line-clamp-2">{p.title || p.content}</p>}
            <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-500">
              {p.author?.avatar ? <img src={p.author.avatar} alt="" className="w-5 h-5 rounded-full object-cover" /> : <span className="w-5 h-5 rounded-full bg-gray-100 inline-block" />}
              <span className="truncate">{p.author?.name || p.school?.name || 'KATD-SCHÜLE'}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
