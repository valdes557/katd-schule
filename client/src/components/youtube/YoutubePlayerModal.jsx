import { useState, useEffect } from 'react'
import { X, Heart, Share2, Loader2, AlertTriangle, Download } from 'lucide-react'
import { youtubeApi } from '../../lib/api'
import { fmtViews, timeAgo } from './YoutubeCard'
import DownloadAdGate from './DownloadAdGate'

// Lecteur YouTube intégré (modal) — mécanisme officiel IFrame embed. L'utilisateur regarde
// SANS quitter KATD. Gère les vidéos non intégrables, les favoris, le partage dans le fil,
// et les vidéos similaires. Enregistre l'historique à l'ouverture.
export default function YoutubePlayerModal({ videoId: initialId, onClose, onShared }) {
  const [videoId, setVideoId] = useState(initialId)
  const [video, setVideo] = useState(null)
  const [related, setRelated] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [fav, setFav] = useState(false)
  const [shared, setShared] = useState(false)
  const [showDownload, setShowDownload] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true); setError(''); setShared(false); setFav(false)
    ;(async () => {
      try {
        const r = await youtubeApi.video(videoId)
        if (!alive) return
        setVideo(r.video)
        youtubeApi.recordHistory({ videoId, title: r.video.title, thumbnail: r.video.thumbnail, channelTitle: r.video.channelTitle }).catch(() => {})
      } catch (e) { if (alive) setError(e.message || 'Chargement impossible') }
      if (alive) setLoading(false)
      try { const rr = await youtubeApi.related(videoId); if (alive) setRelated(rr.items || []) } catch { /* silencieux */ }
    })()
    return () => { alive = false }
  }, [videoId])

  const toggleFav = async () => {
    try {
      if (fav) { await youtubeApi.removeFavorite(videoId); setFav(false) }
      else { await youtubeApi.addFavorite({ videoId, title: video?.title, thumbnail: video?.thumbnail, channelTitle: video?.channelTitle }); setFav(true) }
    } catch (e) { alert(e.message || 'Action impossible') }
  }
  const doShare = async () => {
    try {
      const r = await youtubeApi.share({ videoId, title: video?.title, thumbnail: video?.thumbnail, channelTitle: video?.channelTitle })
      setShared(true); onShared?.(r.data)
    } catch (e) { alert(e.message || 'Partage impossible') }
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 overflow-y-auto" onClick={onClose}>
      <div className="min-h-full flex items-start sm:items-center justify-center p-0 sm:p-4">
        <div className="bg-white w-full sm:max-w-3xl sm:rounded-2xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 truncate pr-2">{video?.title || 'Vidéo'}</h3>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg flex-shrink-0"><X size={18} /></button>
          </div>

          {loading ? (
            <div className="aspect-video flex items-center justify-center bg-black"><Loader2 size={26} className="animate-spin text-white" /></div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-red-600">{error}</div>
          ) : video && video.embeddable === false ? (
            <div className="p-8 text-center">
              <AlertTriangle size={36} className="mx-auto text-amber-500 mb-3" />
              <p className="text-sm text-gray-700">Cette vidéo ne peut pas être lue directement dans KATD SCHÜLE en raison des restrictions définies par son propriétaire.</p>
            </div>
          ) : (
            <div className="aspect-video bg-black">
              <iframe
                key={videoId}
                src={`https://www.youtube.com/embed/${videoId}?rel=0`}
                title={video?.title || 'YouTube'}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          )}

          {video && !loading && !error && (
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{video.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{[video.channelTitle, fmtViews(video.viewCount), timeAgo(video.publishedAt)].filter(Boolean).join(' • ')}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={toggleFav} title="Ajouter aux favoris" className={`p-2 rounded-lg transition-colors ${fav ? 'text-red-600 bg-red-50' : 'text-gray-500 hover:bg-gray-100'}`}>
                    <Heart size={16} className={fav ? 'fill-red-600' : ''} />
                  </button>
                  <button onClick={doShare} title="Partager dans le fil KATD" className={`p-2 rounded-lg transition-colors ${shared ? 'text-green-600 bg-green-50' : 'text-gray-500 hover:bg-gray-100'}`}>
                    <Share2 size={16} />
                  </button>
                  <button onClick={() => setShowDownload(true)} title="Télécharger la vidéo" className="p-2 rounded-lg transition-colors text-gray-500 hover:bg-gray-100 hover:text-red-600">
                    <Download size={16} />
                  </button>
                </div>
              </div>
              {shared && <p className="mt-1 text-[11px] text-green-600">Partagé dans le fil KATD ✓</p>}
              {video.description && <p className="mt-3 text-xs text-gray-600 whitespace-pre-wrap line-clamp-4">{video.description}</p>}

              {related.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Vidéos similaires</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {related.slice(0, 6).map((v) => (
                      <button key={v.videoId} onClick={() => setVideoId(v.videoId)} className="text-left group">
                        <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-100">
                          {v.thumbnail && <img src={v.thumbnail} alt="" loading="lazy" className="w-full h-full object-cover" />}
                          {v.duration && <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[9px] px-1 rounded">{v.duration}</span>}
                        </div>
                        <p className="mt-1 text-[11px] font-medium text-gray-800 line-clamp-2">{v.title}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {showDownload && <DownloadAdGate videoId={videoId} title={video?.title} onClose={() => setShowDownload(false)} />}
    </div>
  )
}
