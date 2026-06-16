import { FileText, ExternalLink, Download, Music, Link as LinkIcon } from 'lucide-react'

// Transforme une URL YouTube/Vimeo en URL d'intégration (embed), sinon null.
function toEmbedUrl(url = '') {
  try {
    const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/)
    if (yt) return `https://www.youtube.com/embed/${yt[1]}`
    const vm = url.match(/vimeo\.com\/(\d+)/)
    if (vm) return `https://player.vimeo.com/video/${vm[1]}`
    return null
  } catch (_) { return null }
}

const isImageUrl = (u = '') => /\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/i.test(u)
const isVideoUrl = (u = '') => /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(u)
const isAudioUrl = (u = '') => /\.(mp3|wav|ogg|m4a|aac)(\?|$)/i.test(u)
const isPdfUrl = (u = '') => /\.pdf(\?|$)/i.test(u)

// Aperçu actif d'une ressource pédagogique selon son type / son URL.
export default function ResourcePreview({ type, url, title }) {
  if (!url) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 text-xs text-gray-400">
        <FileText className="w-4 h-4" /> Aucun fichier joint
      </div>
    )
  }

  const embed = toEmbedUrl(url)
  const effectiveType =
    type === 'image' || isImageUrl(url) ? 'image'
    : type === 'video' || isVideoUrl(url) || embed ? 'video'
    : type === 'audio' || isAudioUrl(url) ? 'audio'
    : type === 'pdf' || isPdfUrl(url) ? 'pdf'
    : 'link'

  if (effectiveType === 'image') {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mt-2 block">
        <img src={url} alt={title || ''} loading="lazy" className="w-full h-40 object-cover rounded-lg border border-gray-100 bg-gray-50" />
      </a>
    )
  }

  if (effectiveType === 'video') {
    return embed ? (
      <div className="mt-2 aspect-video w-full overflow-hidden rounded-lg border border-gray-100 bg-black">
        <iframe src={embed} title={title || 'video'} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
      </div>
    ) : (
      <video src={url} controls preload="metadata" className="mt-2 w-full h-40 rounded-lg border border-gray-100 bg-black object-contain" />
    )
  }

  if (effectiveType === 'audio') {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
        <Music className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <audio src={url} controls className="w-full h-8" />
      </div>
    )
  }

  if (effectiveType === 'pdf') {
    return (
      <div className="mt-2 space-y-2">
        <object data={url} type="application/pdf" className="w-full h-56 rounded-lg border border-gray-100">
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500"><FileText className="w-4 h-4" /> Aperçu PDF indisponible</div>
        </object>
        <a href={url} target="_blank" rel="noreferrer" download className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline">
          <Download className="w-3 h-3" /> Télécharger le PDF
        </a>
      </div>
    )
  }

  // Lien générique / document
  return (
    <a href={url} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-100 transition-colors">
      <LinkIcon className="w-4 h-4 flex-shrink-0" />
      <span className="truncate flex-1">{url.replace(/^https?:\/\//, '')}</span>
      <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
    </a>
  )
}
