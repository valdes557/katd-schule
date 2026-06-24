import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Globe2, Play, Eye, ThumbsUp, MessageCircle, Share2, Send, ChevronDown,
  Download, Music, Lock, Check, X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Trash2,
  Facebook, Twitter, Linkedin, Mail, Link2,
} from 'lucide-react'
import { platformApi } from '../../lib/api'

const CATEGORIES = ['Tout', 'Éducation', 'Sport', 'Culture', 'Sciences', 'Technologie']

// Déduit l'URL d'une miniature (1re frame) à partir de l'URL Cloudinary d'une vidéo.
// Couvre rétroactivement les vidéos publiées avant la génération serveur de la miniature.
function videoThumb(url) {
  if (!url || typeof url !== 'string' || !url.includes('/upload/')) return ''
  return url.replace('/upload/', '/upload/so_0/').replace(/\.(mp4|mov|webm|avi|mkv|m4v|ogv)(\?.*)?$/i, '.jpg$2')
}

// Ratio largeur/hauteur d'affichage du média (respecte l'orientation initiale, borné pour la mise en page).
function mediaAspect(post) {
  const ar = post?.aspectRatio || (post?.mediaWidth && post?.mediaHeight ? post.mediaWidth / post.mediaHeight : null)
  if (!ar || !isFinite(ar) || ar <= 0) return null
  return Math.max(0.5, Math.min(ar, 2.2)) // borne portrait extrême ↔ paysage large
}

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `Il y a ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Il y a ${hrs} h`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `Il y a ${days} j`
  return new Date(date).toLocaleDateString('fr-FR')
}

export default function SocialTab({ feed, setFeed, user }) {
  const [feedPage, setFeedPage] = useState(1)
  const [feedCategory, setFeedCategory] = useState('')
  const [commentText, setCommentText] = useState({})
  const [expandedComments, setExpandedComments] = useState({})
  const [viewer, setViewer] = useState(null) // { type: 'image' | 'video', src, post, index }
  const [viewerZoom, setViewerZoom] = useState(1)
  // Publications déjà vues durant cette session (évite de compter plusieurs fois la même vue)
  const viewedRef = useRef(new Set())

  useEffect(() => {
    setViewerZoom(1)
  }, [viewer])

  // Compte une vue au clic sur une publication (une seule fois par session)
  const markViewed = (postId) => {
    if (!postId || viewedRef.current.has(postId)) return
    viewedRef.current.add(postId)
    platformApi.viewPost(postId)
    setFeed((prev) => prev.map((p) => (p._id === postId ? { ...p, views: (p.views || 0) + 1 } : p)))
  }

  const findNextMediaIndex = (startIndex, direction) => {
    if (!Array.isArray(feed) || !feed.length || startIndex == null || startIndex < 0) return null
    const currentAuthorId = viewer?.post?.author?._id || viewer?.post?.authorId
    const currentAuthorName = viewer?.post?.author?.name || viewer?.post?.authorName
    let i = startIndex + direction
    while (i >= 0 && i < feed.length) {
      const p = feed[i]
      if (p) {
        const pAuthorId = p.author?._id || p.authorId
        const pAuthorName = p.author?.name || p.authorName
        const sameAuthor = currentAuthorId
          ? (pAuthorId && pAuthorId.toString() === currentAuthorId.toString())
          : currentAuthorName
            ? (pAuthorName && pAuthorName === currentAuthorName)
            : true

        if (sameAuthor) {
          if (p.type === 'video' && p.videoUrl) return i
          if (p.images?.[0] || p.thumbnail) return i
        }
      }
      i += direction
    }
    return null
  }

  const openMediaAtIndex = (index) => {
    if (!Array.isArray(feed) || index == null || index < 0 || index >= feed.length) return
    const p = feed[index]
    if (!p) return
    markViewed(p._id)
    if (p.type === 'video' && p.videoUrl) {
      setViewer({ type: 'video', src: p.videoUrl, post: p, index })
    } else {
      const imgSrc = p.images?.[0] || p.thumbnail
      if (imgSrc) setViewer({ type: 'image', src: imgSrc, post: p, index })
    }
  }

  const handleLike = async (postId) => {
    try {
      const r = await platformApi.likePost(postId)
      setFeed((prev) => prev.map((p) => (p._id === postId ? r.data : p)))
    } catch (e) {}
  }

  const handleComment = async (postId) => {
    const txt = commentText[postId]?.trim()
    if (!txt) return
    try {
      const r = await platformApi.commentPost(postId, txt)
      setFeed((prev) => prev.map((p) => (p._id === postId ? r.data : p)))
      setCommentText((prev) => ({ ...prev, [postId]: '' }))
    } catch (e) {}
  }

  const handleDelete = async (postId) => {
    if (!window.confirm('Supprimer définitivement cette publication ?')) return
    try {
      await platformApi.deletePost(postId)
      setFeed((prev) => prev.filter((p) => p._id !== postId))
      if (viewer?.post?._id === postId) setViewer(null)
    } catch (e) { alert(e.message || 'Suppression impossible') }
  }

  const handleShare = async (postId) => {
    const url = `${window.location.origin}/social#${postId}`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'KATD-SCHÜLE', text: 'Découvrez cette publication', url })
      } else {
        try { await navigator.clipboard.writeText(url) } catch (_) {}
      }
    } catch (_) {}
    platformApi.sharePost(postId)
    setFeed((prev) => prev.map((p) => (p._id === postId ? { ...p, shares: (p.shares || 0) + 1 } : p)))
  }

  const loadMore = async () => {
    const next = feedPage + 1
    try {
      const r = await platformApi.getFeed(next, feedCategory)
      setFeed((prev) => [...prev, ...(r.data || [])])
      setFeedPage(next)
    } catch (e) {}
  }

  const filterFeed = async (cat) => {
    const c = cat === 'Tout' ? '' : cat
    setFeedCategory(c)
    setFeedPage(1)
    try {
      const r = await platformApi.getFeed(1, c)
      setFeed(r.data || [])
    } catch (e) {}
  }

  const currentIndex = viewer?.index ?? -1
  const prevIndex = viewer ? findNextMediaIndex(currentIndex, -1) : null
  const nextIndex = viewer ? findNextMediaIndex(currentIndex, 1) : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3 px-4 sm:px-0">
        <h2 className="text-xl font-bold text-gray-900">Fil d'actualité</h2>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {CATEGORIES.map((c) => (
            <button
              key={c} onClick={() => filterFeed(c)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                (c === 'Tout' && !feedCategory) || feedCategory === c
                  ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >{c}</button>
          ))}
        </div>
      </div>

      {feed.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Globe2 size={40} className="mx-auto mb-3 opacity-30" />
          <p>Aucune publication pour le moment</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-y-3 gap-x-0 sm:gap-4">
            {feed.map((post, index) => (
              <PostCard
                key={post._id} post={post} user={user}
                onLike={handleLike} onComment={handleComment} onShare={handleShare} onDelete={handleDelete}
                commentText={commentText} setCommentText={setCommentText}
                expandedComments={expandedComments} setExpandedComments={setExpandedComments}
                onDownload={(id) => setFeed((prev) => prev.map((p) => p._id === id ? { ...p, downloads: (p.downloads || 0) + 1 } : p))}
                onView={markViewed}
                onOpenMedia={(payload) => { markViewed(payload.post?._id); setViewer({ ...payload, index }) }}
              />
            ))}
          </div>
          <div className="text-center pt-4">
            <button onClick={loadMore} className="inline-flex items-center gap-2 border border-gray-200 text-gray-700 text-sm font-medium px-6 py-2 rounded-lg hover:bg-gray-50 transition-colors">
              Charger plus <ChevronDown size={14} />
            </button>
          </div>
        </>
      )}

      {viewer && (
        <div
          className="fixed inset-0 z-50 bg-black flex items-center justify-center p-4"
          onClick={() => setViewer(null)}
        >
          <div
            className="relative max-w-5xl w-full max-h-[90vh] flex items-center justify-center overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setViewer(null)}
              className="absolute top-2 right-2 text-white bg-black/50 rounded-full p-1.5 hover:bg-black/70"
            >
              <X size={18} />
            </button>
            {viewer && (() => {
              const currentIdx = currentIndex
              if (currentIdx < 0 || !Array.isArray(feed) || !feed.length) return null
              const currentAuthorId = viewer.post?.author?._id || viewer.post?.authorId
              const currentAuthorName = viewer.post?.author?.name || viewer.post?.authorName
              const sameIndices = []
              feed.forEach((p, idx) => {
                if (!p) return
                const pAuthorId = p.author?._id || p.authorId
                const pAuthorName = p.author?.name || p.authorName
                const sameAuthor = currentAuthorId
                  ? (pAuthorId && pAuthorId.toString() === currentAuthorId.toString())
                  : currentAuthorName
                    ? (pAuthorName && pAuthorName === currentAuthorName)
                    : true
                if (!sameAuthor) return
                if (p.type === 'video' && p.videoUrl) sameIndices.push(idx)
                else if (p.images?.[0] || p.thumbnail) sameIndices.push(idx)
              })
              if (sameIndices.length === 0) return null
              const pos = sameIndices.indexOf(currentIdx) + 1
              const total = sameIndices.length
              const displayName = currentAuthorName || 'cet utilisateur'
              return (
                <div className="absolute top-3 left-3 bg-black/40 text-white text-[11px] px-3 py-1.5 rounded-full max-w-[70%] truncate">
                  Publications de <span className="font-semibold">{displayName}</span>
                  {total > 1 && ` (${pos > 0 ? pos : 1} / ${total})`}
                </div>
              )
            })()}
            {prevIndex !== null && (
              <button
                type="button"
                onClick={() => openMediaAtIndex(prevIndex)}
                className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 text-white bg-black/40 hover:bg-black/70 rounded-full p-2"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            {nextIndex !== null && (
              <button
                type="button"
                onClick={() => openMediaAtIndex(nextIndex)}
                className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 text-white bg-black/40 hover:bg-black/70 rounded-full p-2"
              >
                <ChevronRight size={20} />
              </button>
            )}
            {viewer.type === 'image' && viewer.src && (
              <img
                src={viewer.src}
                alt={viewer.post?.title || ''}
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-lg transition-transform duration-200"
                style={{ transform: `scale(${viewerZoom})` }}
              />
            )}
            {viewer.type === 'video' && viewer.src && (
              viewer.src.includes('youtube') || viewer.src.includes('youtu.be') ? (
                <iframe
                  className="w-full h-[60vh] max-h-[85vh] rounded-lg shadow-lg"
                  src={viewer.src.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              ) : (
                <video
                  controls
                  autoPlay
                  src={viewer.src}
                  className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-lg bg-black"
                />
              )
            )}
            {viewer.type === 'image' && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/40 text-white text-xs px-3 py-1.5 rounded-full">
                <button
                  type="button"
                  onClick={() => setViewerZoom((z) => Math.max(0.5, z - 0.25))}
                  className="p-1 hover:bg-black/50 rounded-full"
                >
                  <ZoomOut size={14} />
                </button>
                <span className="min-w-[36px] text-center">{Math.round(viewerZoom * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setViewerZoom((z) => Math.min(3, z + 0.25))}
                  className="p-1 hover:bg-black/50 rounded-full"
                >
                  <ZoomIn size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function PostCard({ post, user, onLike, onComment, onShare, onDelete, onDownload, onView, commentText, setCommentText, expandedComments, setExpandedComments, onOpenMedia }) {
  const navigate = useNavigate()
  const [shareCopied, setShareCopied] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  // Lien + texte de partage de la publication
  const shareUrl = `${window.location.origin}/social#${post._id}`
  const shareTitle = post.title || 'KATD-SCHÜLE'
  const shareText = `${shareTitle} — Découvrez cette publication sur KATD-SCHÜLE`
  const enc = encodeURIComponent

  // Cibles de partage (réseaux sociaux + email)
  const SHARE_TARGETS = [
    { name: 'WhatsApp', icon: MessageCircle, color: 'bg-green-500', href: `https://wa.me/?text=${enc(`${shareText} ${shareUrl}`)}` },
    { name: 'Facebook', icon: Facebook, color: 'bg-blue-600', href: `https://www.facebook.com/sharer/sharer.php?u=${enc(shareUrl)}` },
    { name: 'Twitter / X', icon: Twitter, color: 'bg-sky-500', href: `https://twitter.com/intent/tweet?url=${enc(shareUrl)}&text=${enc(shareText)}` },
    { name: 'Telegram', icon: Send, color: 'bg-sky-600', href: `https://t.me/share/url?url=${enc(shareUrl)}&text=${enc(shareText)}` },
    { name: 'LinkedIn', icon: Linkedin, color: 'bg-blue-700', href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(shareUrl)}` },
    { name: 'Email', icon: Mail, color: 'bg-gray-600', href: `mailto:?subject=${enc(shareTitle)}&body=${enc(`${shareText}\n${shareUrl}`)}` },
  ]

  const shareTo = (href) => {
    window.open(href, '_blank', 'noopener,noreferrer')
    onShare(post._id)
    setShareOpen(false)
  }

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(shareUrl) } catch (_) {}
    onShare(post._id)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
    setShareOpen(false)
  }

  const nativeShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl })
        onShare(post._id)
      }
    } catch (_) {}
    setShareOpen(false)
  }

  // L'utilisateur peut supprimer sa propre publication (ou super_admin pour tout).
  const myId = user?.id || user?._id
  const authorId = post.author?._id || post.author
  const canDelete = !!user && (post.isPlatform ? user.role === 'super_admin' : (authorId && myId && authorId.toString() === myId.toString()) || user.role === 'super_admin')

  // Ratio d'affichage respectant l'orientation initiale (portrait reste portrait).
  const ar = mediaAspect(post)
  const mediaStyle = ar ? { aspectRatio: String(ar) } : undefined
  const videoThumbSrc = post.thumbnail || videoThumb(post.videoUrl) || post.images?.[0]

  const handleDownload = async () => {
    if (!user) { navigate('/login'); return }
    const url = post.audioUrl || post.videoUrl || post.images?.[0]
    if (!url) return
    try {
      await platformApi.downloadPost(post._id)
      onDownload(post._id)
      let href = url
      const isCloudinary = /https?:\/\/res\.cloudinary\.com\//.test(url) && url.includes('/upload/')
      if (isCloudinary) {
        const i = url.indexOf('/upload/') + 8
        const base = (post.title || 'media').toString().toLowerCase().replace(/[^a-z0-9-_]+/g, '-') || 'media'
        const transform = `fl_attachment:${base}`
        href = url.slice(0, i) + transform + '/' + url.slice(i)
      }
      const a = document.createElement('a')
      a.href = href
      a.download = (post.title || 'media').toString().replace(/\s+/g, '-')
      a.target = '_blank'
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
    } catch (e) {}
  }

  const hasMedia = post.audioUrl || post.videoUrl || post.images?.length > 0

  return (
    <div id={post._id} className="bg-white border-y sm:border border-gray-100 sm:rounded-xl overflow-hidden hover:shadow-lg transition-all">
      {/* ── Media zone ── */}
      {post.type === 'audio' ? (
        <div className="bg-gradient-to-br from-purple-600 to-indigo-700 p-5 text-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Music size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              {post.title && <p className="text-sm font-bold truncate">{post.title}</p>}
              {post.duration && <p className="text-xs text-purple-200">{post.duration}</p>}
            </div>
          </div>
          {post.audioUrl && (
            <audio controls src={post.audioUrl} onPlay={() => onView?.(post._id)} className="w-full h-8 accent-white" />
          )}
        </div>
      ) : post.type === 'video' ? (
        <button
          type="button"
          className="relative bg-black w-full"
          style={mediaStyle || { aspectRatio: '16 / 9' }}
          onClick={() => {
            if (!post.videoUrl && !post.thumbnail && !(post.images && post.images[0])) return
            const src = post.videoUrl || post.thumbnail || (post.images && post.images[0])
            if (onOpenMedia) onOpenMedia({ type: 'video', src, post })
          }}
        >
          {videoThumbSrc ? (
            <img src={videoThumbSrc} alt="" className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-900">
              <Play size={40} className="text-gray-600" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors">
            <div className="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
              <Play size={22} className="text-gray-900 fill-gray-900 ml-1" />
            </div>
          </div>
          {post.duration && (
            <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">{post.duration}</span>
          )}
          {post.category && (
            <span className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-full">{post.category}</span>
          )}
        </button>
      ) : post.images?.length > 0 ? (
        <button
          type="button"
          className="relative bg-black w-full"
          style={mediaStyle || { aspectRatio: '16 / 9' }}
          onClick={() => {
            if (!post.images?.[0]) return
            if (onOpenMedia) onOpenMedia({ type: 'image', src: post.images[0], post })
          }}
        >
          <img src={post.images[0]} alt="" className="w-full h-full object-contain" />
          {post.images.length > 1 && (
            <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">+{post.images.length - 1}</span>
          )}
          {post.category && (
            <span className="absolute top-2 left-2 bg-black/40 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-full">{post.category}</span>
          )}
        </button>
      ) : (
        <div className="h-16 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-center">
          <Globe2 size={24} className="text-blue-200" />
        </div>
      )}

      {/* ── Content ── */}
      <div className="p-3">
        <div className="flex items-start gap-2 mb-2">
          {post.author?.avatar ? (
            <img src={post.author.avatar} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
              {(post.author?.name || 'K')[0].toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            {post.title && <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">{post.title}</h3>}
            <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{post.content}</p>
            <div className="flex items-center gap-1.5 mt-1 text-[10px] text-gray-400">
              <span>{post.author?.name || 'KATD-SCHÜLE'}</span>
              <span>·</span><span>{timeAgo(post.createdAt)}</span>
            </div>
          </div>
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete?.(post._id)}
              title="Supprimer ma publication"
              className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 flex-shrink-0"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-[10px] text-gray-400 pb-2 border-b border-gray-50">
          <span className="flex items-center gap-0.5"><Eye size={10} /> {post.views || 0}</span>
          <span className="flex items-center gap-0.5"><Download size={10} /> {post.downloads || 0}</span>
          <span className="flex items-center gap-0.5"><Share2 size={10} /> {post.shares || 0}</span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5 mt-2">
          <button
            onClick={() => onLike(post._id)}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors flex-1 justify-center ${
              user && post.likes?.includes(user.id || user._id) ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <ThumbsUp size={12} /> {post.likes?.length || 0}
          </button>
          <button
            onClick={() => { onView?.(post._id); setExpandedComments((p) => ({ ...p, [post._id]: !p[post._id] })) }}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium text-gray-500 hover:bg-gray-100 transition-colors flex-1 justify-center"
          >
            <MessageCircle size={12} /> {post.comments?.length || 0}
          </button>
          <button
            onClick={() => setShareOpen(true)}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors flex-1 justify-center ${
              shareCopied ? 'text-green-600 bg-green-50' : 'text-gray-500 hover:bg-gray-100'
            }`}
            title="Partager"
          >
            {shareCopied ? <><Check size={12} /> Copié</> : <><Share2 size={12} /> Partager</>}
          </button>
          {hasMedia && (
            <button
              onClick={handleDownload}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors flex-1 justify-center ${
                user ? 'text-gray-500 hover:bg-gray-100' : 'text-orange-500 hover:bg-orange-50'
              }`}
              title={user ? 'Télécharger' : 'Connexion requise'}
            >
              {user ? <Download size={12} /> : <Lock size={12} />}
              {user ? 'DL' : 'Login'}
            </button>
          )}
        </div>

        {/* Login prompt if not logged in */}
        {!user && (
          <p className="text-[10px] text-center text-gray-400 mt-1">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-blue-500 hover:underline"
            >
              Connectez-vous
            </button>{' '}
            pour télécharger
          </p>
        )}

        {/* Comments section */}
        {expandedComments[post._id] && (
          <div className="mt-2 pt-2 border-t border-gray-50 space-y-2">
            {post.comments?.length === 0 && <p className="text-xs text-gray-400 text-center py-1">Aucun commentaire</p>}
            {post.comments?.slice(0, 5).map((c, i) => (
              <div key={i} className="flex gap-1.5">
                {c.authorId?.avatar ? (
                  <img src={c.authorId.avatar} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                    {(c.author || c.authorId?.name)?.[0]?.toUpperCase()}
                  </div>
                )}
                <div className="bg-gray-50 rounded-lg px-2 py-1 text-xs flex-1">
                  <span className="font-semibold text-gray-700">{c.author || c.authorId?.name}</span>
                  <p className="text-gray-600">{c.content}</p>
                </div>
              </div>
            ))}
            {user ? (
              <div className="flex gap-1.5">
                <input
                  value={commentText[post._id] || ''}
                  onChange={(e) => setCommentText((p) => ({ ...p, [post._id]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && onComment(post._id)}
                  placeholder="Ajouter un commentaire..."
                  className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-400"
                />
                <button onClick={() => onComment(post._id)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg">
                  <Send size={12} />
                </button>
              </div>
            ) : (
              <p className="text-xs text-center text-gray-400">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="text-blue-500 hover:underline"
                >
                  Connectez-vous
                </button>{' '}
                pour commenter
              </p>
            )}
          </div>
        )}
      </div>

      {/* Menu de partage — réseaux sociaux + email + copier le lien */}
      {shareOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShareOpen(false)}
        >
          <div
            className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><Share2 size={16} className="text-blue-600" /> Partager</h3>
              <button onClick={() => setShareOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {SHARE_TARGETS.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => shareTo(t.href)}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <span className={`w-12 h-12 rounded-full ${t.color} flex items-center justify-center text-white`}>
                    <t.icon size={20} />
                  </span>
                  <span className="text-[11px] text-gray-600 text-center">{t.name}</span>
                </button>
              ))}
              {typeof navigator !== 'undefined' && navigator.share && (
                <button
                  type="button"
                  onClick={nativeShare}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <span className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center text-white">
                    <Share2 size={20} />
                  </span>
                  <span className="text-[11px] text-gray-600 text-center">Plus…</span>
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={copyLink}
              className="mt-4 w-full flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Link2 size={15} /> Copier le lien
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
