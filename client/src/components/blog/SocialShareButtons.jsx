import { useState } from 'react'
import { Share2, Copy, Check, MessageCircle } from 'lucide-react'
import { blogsApi } from '../../lib/api'

export default function SocialShareButtons({ post, size = 'md' }) {
  const [copied, setCopied] = useState(false)

  if (!post) return null

  // URL canonique de partage : passe par le proxy /b/:slug pour générer les balises Open Graph
  const origin = window.location.origin
  const shareSlug = post.slug || post._id
  const shareUrl = `${origin}/b/${shareSlug}`
  const shareTitle = post.title || 'Article KATD-SCHÜLE'

  const recordShare = () => {
    blogsApi.share(post._id).catch(() => {})
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    recordShare()
    setTimeout(() => setCopied(false), 2500)
  }

  const shareWhatsApp = () => {
    recordShare()
    const text = encodeURIComponent(`📰 *${shareTitle}*\n\nLire l'article complet sur KATD-SCHÜLE :\n${shareUrl}`)
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank')
  }

  const shareFacebook = () => {
    recordShare()
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank')
  }

  const shareTelegram = () => {
    recordShare()
    window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`, '_blank')
  }

  const shareTwitter = () => {
    recordShare()
    window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`, '_blank')
  }

  const btnClass = size === 'sm'
    ? 'p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all'
    : 'px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm'

  return (
    <div className="flex items-center flex-wrap gap-1.5 select-none">
      {/* WhatsApp */}
      <button
        onClick={shareWhatsApp}
        className={`${btnClass} bg-green-500 hover:bg-green-600 text-white`}
        title="Partager sur WhatsApp"
      >
        <MessageCircle size={size === 'sm' ? 14 : 16} />
        {size !== 'sm' && <span>WhatsApp</span>}
      </button>

      {/* Facebook */}
      <button
        onClick={shareFacebook}
        className={`${btnClass} bg-blue-600 hover:bg-blue-700 text-white`}
        title="Partager sur Facebook"
      >
        <span className="font-bold text-sm">f</span>
        {size !== 'sm' && <span>Facebook</span>}
      </button>

      {/* Telegram */}
      <button
        onClick={shareTelegram}
        className={`${btnClass} bg-sky-500 hover:bg-sky-600 text-white`}
        title="Partager sur Telegram"
      >
        <Share2 size={size === 'sm' ? 14 : 16} />
        {size !== 'sm' && <span>Telegram</span>}
      </button>

      {/* Twitter / X */}
      <button
        onClick={shareTwitter}
        className={`${btnClass} bg-gray-900 hover:bg-black text-white`}
        title="Partager sur X (Twitter)"
      >
        <span className="font-bold text-xs">𝕏</span>
        {size !== 'sm' && <span>X</span>}
      </button>

      {/* Copier le lien */}
      <button
        onClick={handleCopy}
        className={`${btnClass} bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200`}
        title="Copier le lien"
      >
        {copied ? <Check size={size === 'sm' ? 14 : 16} className="text-green-600" /> : <Copy size={size === 'sm' ? 14 : 16} />}
        {size !== 'sm' && <span>{copied ? 'Copié !' : 'Copier'}</span>}
      </button>
    </div>
  )
}
