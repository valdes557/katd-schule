import { useEffect, useState } from 'react'
import { Compass, Search, Heart, MessageCircle, Share2, Download, Loader2, Play, Image, Music, X, Send } from 'lucide-react'
import { mediaApi } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { cn } from '../lib/utils'

const TYPES = [
  { key: '', label: 'Tous' },
  { key: 'video', label: 'Vidéos', icon: Play },
  { key: 'image', label: 'Images', icon: Image },
  { key: 'audio', label: 'Audio', icon: Music },
]

const SORTS = [
  { key: 'recent', label: 'Récent' },
  { key: 'popular', label: 'Populaire' },
  { key: 'views', label: 'Plus vus' },
]

export default function ExplorerPage() {
  const { user } = useAuth()
  const [media, setMedia] = useState([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState('')
  const [sort, setSort] = useState('recent')
  const [search, setSearch] = useState('')
  const [selectedMedia, setSelectedMedia] = useState(null)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [loadingDetail, setLoadingDetail] = useState(false)

  const fetchMedia = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ sort, limit: '24' })
      if (type) params.set('type', type)
      const res = await mediaApi.list(params.toString())
      setMedia(res.data || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { fetchMedia() }, [type, sort])

  const handleLike = async (id) => {
    try {
      const res = await mediaApi.like(id)
      setMedia((prev) => prev.map((m) => m._id === id ? { ...m, stats: { ...m.stats, likes: res.likes } } : m))
      if (selectedMedia?._id === id) {
        setSelectedMedia((prev) => ({ ...prev, stats: { ...prev.stats, likes: res.likes } }))
      }
    } catch (e) { console.error(e) }
  }

  const handleShare = async (m) => {
    if (!user) { alert('Connectez-vous pour partager'); return }
    try {
      await mediaApi.share(m._id)
      if (navigator.share) {
        await navigator.share({ title: m.title, url: window.location.href })
      } else {
        await navigator.clipboard.writeText(window.location.href)
        alert('Lien copié !')
      }
    } catch (err) { console.error(err) }
  }

  const handleDownload = async (m) => {
    if (!user) { alert('Connectez-vous pour télécharger'); return }
    try {
      await mediaApi.download(m._id)
      if (m.files?.[0]?.url) {
        const a = document.createElement('a')
        a.href = m.files[0].url
        a.download = m.files[0].filename || m.title
        a.click()
      }
    } catch (e) { console.error(e) }
  }

  const openDetail = async (m) => {
    setSelectedMedia(m)
    setLoadingDetail(true)
    try {
      const res = await mediaApi.get(m._id)
      setSelectedMedia(res.data)
      setComments(res.data.comments || [])
    } catch (err) { console.error(err) }
    setLoadingDetail(false)
  }

  const handleComment = async () => {
    if (!user) { alert('Connectez-vous pour commenter'); return }
    if (!commentText.trim()) return
    try {
      const res = await mediaApi.comment(selectedMedia._id, commentText)
      setComments((prev) => [res.data, ...prev])
      setCommentText('')
      setSelectedMedia((prev) => ({ ...prev, stats: { ...prev.stats, comments: (prev.stats?.comments || 0) + 1 } }))
    } catch (e) { alert(e.message) }
  }

  const filteredMedia = media.filter((m) => {
    if (!search) return true
    return m.title?.toLowerCase().includes(search.toLowerCase())
  })

  const getThumb = (m) => {
    if (m.thumbnail) return m.thumbnail
    if (m.files?.[0]?.url) return m.files[0].url
    return `https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop`
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Compass size={22} className="text-orange-600" /> Explorer
        </h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {TYPES.map((t) => (
            <button key={t.key} onClick={() => setType(t.key)} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors', type === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              {t.label}
            </button>
          ))}
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="input text-sm w-auto">
          {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..." className="input pl-9 text-sm" />
        </div>
      </div>

      {/* Media grid */}
      {loading ? (
        <div className="text-center py-20"><Loader2 size={28} className="animate-spin mx-auto text-blue-600" /></div>
      ) : filteredMedia.length === 0 ? (
        <div className="text-center py-20 text-gray-400"><Compass size={48} className="mx-auto mb-3 opacity-20" /><p>Aucun contenu trouvé</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredMedia.map((m) => (
            <div key={m._id} className="card overflow-hidden group cursor-pointer" onClick={() => openDetail(m)}>
              <div className="relative h-44 bg-gray-100">
                <img src={getThumb(m)} alt={m.title} className="w-full h-full object-cover" />
                {m.type === 'video' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <Play size={32} className="text-white drop-shadow-lg" />
                  </div>
                )}
                <span className="absolute top-2 left-2 badge bg-white/90 text-gray-700 text-[10px]">{m.type}</span>
              </div>
              <div className="p-3">
                <h3 className="text-sm font-semibold text-gray-900 truncate">{m.title}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{m.school?.name || 'École'}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                  <button onClick={(e) => { e.stopPropagation(); handleLike(m._id) }} className="flex items-center gap-1 hover:text-red-500 transition-colors">
                    <Heart size={13} /> {m.stats?.likes || 0}
                  </button>
                  <span className="flex items-center gap-1"><MessageCircle size={13} /> {m.stats?.comments || 0}</span>
                  <button onClick={(e) => { e.stopPropagation(); handleShare(m) }} className="flex items-center gap-1 hover:text-blue-500 transition-colors">
                    <Share2 size={13} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDownload(m) }} className="flex items-center gap-1 hover:text-green-500 transition-colors">
                    <Download size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selectedMedia && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white z-10 p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 truncate pr-4">{selectedMedia.title}</h3>
              <button onClick={() => setSelectedMedia(null)} className="p-1 rounded hover:bg-gray-100 flex-shrink-0"><X size={18} /></button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              <div className="rounded-xl overflow-hidden bg-gray-100">
                {selectedMedia.type === 'video' && selectedMedia.files?.[0]?.url ? (
                  <video controls className="w-full max-h-80" src={selectedMedia.files[0].url} />
                ) : selectedMedia.type === 'audio' && selectedMedia.files?.[0]?.url ? (
                  <div className="p-8"><audio controls className="w-full" src={selectedMedia.files[0].url} /></div>
                ) : (
                  <img src={getThumb(selectedMedia)} alt="" className="w-full max-h-80 object-cover" />
                )}
              </div>

              {selectedMedia.description && <p className="text-sm text-gray-600">{selectedMedia.description}</p>}

              {/* Actions bar */}
              <div className="flex items-center gap-5 py-2 border-y border-gray-100">
                <button onClick={() => handleLike(selectedMedia._id)} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-red-500 transition-colors">
                  <Heart size={16} /> {selectedMedia.stats?.likes || 0}
                </button>
                <span className="flex items-center gap-1.5 text-sm text-gray-600">
                  <MessageCircle size={16} /> {selectedMedia.stats?.comments || 0}
                </span>
                <button onClick={() => handleShare(selectedMedia)} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-500 transition-colors">
                  <Share2 size={16} /> Partager
                </button>
                <button onClick={() => handleDownload(selectedMedia)} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-green-500 transition-colors">
                  <Download size={16} /> Télécharger
                </button>
              </div>

              {/* Comments */}
              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-3">Commentaires</h4>
                {user && (
                  <div className="flex gap-2 mb-4">
                    <input
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleComment()}
                      placeholder="Écrire un commentaire..."
                      className="input flex-1 text-sm"
                    />
                    <button onClick={handleComment} disabled={!commentText.trim()} className="btn-primary px-3">
                      <Send size={14} />
                    </button>
                  </div>
                )}
                {!user && <p className="text-xs text-gray-400 mb-3 italic">Connectez-vous pour commenter</p>}
                {loadingDetail ? (
                  <div className="text-center py-4"><Loader2 size={18} className="animate-spin mx-auto text-blue-600" /></div>
                ) : comments.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Aucun commentaire</p>
                ) : (
                  <div className="space-y-3">
                    {comments.map((c) => (
                      <div key={c._id} className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">
                          {(c.user?.name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-900">{c.user?.name || 'Utilisateur'}</span>
                            <span className="text-[10px] text-gray-400">{new Date(c.createdAt).toLocaleDateString('fr-FR')}</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-0.5">{c.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
