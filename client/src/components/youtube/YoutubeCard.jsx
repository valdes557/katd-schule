import { Play, Download } from 'lucide-react'

// Formatage vues (1,2 M / 12 k) et date relative (il y a 3 j).
export function fmtViews(n) {
  if (n == null) return ''
  const v = n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + ' M'
    : n >= 1e3 ? Math.round(n / 1e3) + ' k'
    : String(n)
  return v + ' vues'
}
export function timeAgo(date) {
  if (!date) return ''
  const diff = Date.now() - new Date(date).getTime()
  const d = Math.floor(diff / 86400000)
  if (d < 1) return "aujourd'hui"
  if (d < 30) return `il y a ${d} j`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `il y a ${mo} mois`
  return `il y a ${Math.floor(mo / 12)} an${Math.floor(mo / 12) > 1 ? 's' : ''}`
}

// Carte d'une vidéo YouTube dans la grille. `onDownload` (optionnel) ajoute un bouton de
// téléchargement en surimpression (ouvre le « gate » publicitaire côté appelant).
export default function YoutubeCard({ video, onClick, onDownload }) {
  return (
    <div className="text-left group relative">
      <button onClick={onClick} className="block w-full text-left">
        <div className="relative aspect-video rounded-xl overflow-hidden bg-gray-100">
          {video.thumbnail
            ? <img src={video.thumbnail} alt="" loading="lazy" className="w-full h-full object-cover transition-transform group-hover:scale-[1.02]" />
            : <div className="w-full h-full bg-gray-200" />}
          {video.duration && (
            <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded">{video.duration}</span>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow">
              <Play size={20} className="text-gray-900 fill-gray-900 ml-0.5" />
            </span>
          </span>
        </div>
        <p className="mt-2 text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">{video.title}</p>
        <p className="text-xs text-gray-500 mt-0.5 truncate">{video.channelTitle}</p>
        <p className="text-[11px] text-gray-400">{[fmtViews(video.viewCount), timeAgo(video.publishedAt)].filter(Boolean).join(' • ')}</p>
      </button>
      {onDownload && (
        <button
          onClick={(e) => { e.stopPropagation(); onDownload() }}
          title="Télécharger la vidéo"
          className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-black/60 text-white hover:bg-red-600 transition-colors"
        >
          <Download size={14} />
        </button>
      )}
    </div>
  )
}
