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

      {viewer && (() => {
        const vp = viewer.post || {}
        const vAuthorId = vp.author?._id || vp.authorId
        const vAuthorName = vp.author?.name || vp.authorName || 'KATD-SCHÜLE'
        const vAuthorAvatar = vp.author?.avatar
        const isVideo = viewer.type === 'video' || !!vp.videoUrl
        const liked = user && Array.isArray(vp.likes) && vp.likes.includes(user.id || user._id)
        const authorVideos = (Array.isArray(feed) ? feed : []).filter((p) => {
          if (!p || p._id === vp._id) return false
          const aId = p.author?._id || p.authorId
          const aName = p.author?.name || p.authorName
          const sameAuthor = (vAuthorId && aId && String(aId) === String(vAuthorId)) || (aName && aName === vAuthorName)
          return sameAuthor && (p.type === 'video' || p.videoUrl)
        })
        const fmtDate = vp.createdAt ? new Date(vp.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
        const doDownload = async () => {
          const url = isVideo ? vp.videoUrl : (vp.images?.[0] || viewer.src)
          if (!url) return
          try { await platformApi.downloadPost(vp._id) } catch (e) {}
          let href = url
          if (/https?:\/\/res\.cloudinary\.com\//.test(url) && url.includes('/upload/')) {
            const i = url.indexOf('/upload/') + 8
            href = url.slice(0, i) + 'fl_attachment/' + url.slice(i)
          }
          const a = document.createElement('a')
          a.href = href
          a.download = vp.title || 'katd-media'
          a.target = '_blank'
          a.rel = 'noopener'
          document.body.appendChild(a)
          a.click()
          a.remove()
          setFeed((prev) => prev.map((p) => (p._id === vp._id ? { ...p, downloads: (p.downloads || 0) + 1 } : p)))
        }
        return (
          <div className="fixed inset-0 z-50 bg-black/95 overflow-y-auto" onClick={() => setViewer(null)}>
            <button onClick={() => setViewer(null)} className="fixed top-4 right-4 z-[60] p-2 rounded-full bg-white/10 hover:bg-white/20 text-white">
              <X size={22} />
            </button>
            <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6" onClick={(e) => e.stopPropagation()}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <div className="bg-black rounded-xl overflow-hidden flex items-center justify-center">
                    {isVideo ? (
                      <video key={viewer.src} src={viewer.src} controls autoPlay playsInline className="w-full max-h-[72vh] bg-black" />
                    ) : (
                      <img src={viewer.src} alt="" className="w-full max-h-[72vh] object-contain bg-black" />
                    )}
                  </div>
                  <h1 className="text-white text-lg sm:text-xl font-semibold mt-4">{vp.title || vp.caption || vp.content || 'Publication'}</h1>
                  <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {vAuthorAvatar ? (
                        <img src={vAuthorAvatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold">{(vAuthorName || 'K')[0].toUpperCase()}</div>
                      )}
                      <div className="min-w-0">
                        <p className="text-white font-medium truncate">{vAuthorName}</p>
                        <p className="text-gray-400 text-xs">{authorVideos.length + 1} vidéo{authorVideos.length + 1 > 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={() => handleLike(vp._id)} className={'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ' + (liked ? 'bg-blue-600 text-white' : 'bg-white/10 text-white hover:bg-white/20')}>
                        <ThumbsUp size={16} /> {vp.likes?.length || 0}
                      </button>
                      <button onClick={() => handleShare(vp._id)} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-white/10 text-white hover:bg-white/20 transition-colors">
                        <Share2 size={16} /> Partager
                      </button>
                      <button onClick={() => { const el = document.getElementById('viewer-comments'); el && el.scrollIntoView({ behavior: 'smooth' }) }} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-white/10 text-white hover:bg-white/20 transition-colors">
                        <MessageCircle size={16} /> {vp.comments?.length || 0}
                      </button>
                      <button onClick={doDownload} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-white/10 text-white hover:bg-white/20 transition-colors">
                        <Download size={16} /> Télécharger
                      </button>
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 mt-4 text-gray-200 text-sm">
                    <div className="flex flex-wrap items-center gap-3 text-gray-400 text-xs mb-2">
                      <span className="inline-flex items-center gap-1"><Eye size={13} /> {vp.views || 0} vues</span>
                      {fmtDate && <span>{fmtDate}</span>}
                      {vp.category && <span className="px-2 py-0.5 rounded-full bg-white/10">{vp.category}</span>}
                    </div>
                    {(vp.caption || vp.content) && <p className="whitespace-pre-wrap leading-relaxed">{vp.caption || vp.content}</p>}
                  </div>
                  <div id="viewer-comments" className="mt-5">
                    <h3 className="text-white font-semibold mb-3">{vp.comments?.length || 0} commentaire{(vp.comments?.length || 0) > 1 ? 's' : ''}</h3>
                    {user ? (
                      <div className="flex items-center gap-2 mb-4">
                        <input
                          value={commentText[vp._id] || ''}
                          onChange={(e) => setCommentText((p) => ({ ...p, [vp._id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && handleComment(vp._id)}
                          placeholder="Ajouter un commentaire..."
                          className="flex-1 bg-white/10 text-white placeholder-gray-400 rounded-full px-4 py-2 text-sm outline-none focus:bg-white/15"
                        />
                        <button onClick={() => handleComment(vp._id)} className="p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700"><Send size={16} /></button>
                      </div>
                    ) : (
                      <p className="text-gray-400 text-sm mb-4">Connectez-vous pour commenter.</p>
                    )}
                    <div className="space-y-3">
                      {(vp.comments || []).slice().reverse().map((cm, idx) => (
                        <div key={cm._id || idx} className="flex items-start gap-2">
                          {cm.authorId?.avatar ? (
                            <img src={cm.authorId.avatar} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">{(cm.author || cm.authorId?.name || 'U')[0]?.toUpperCase()}</div>
                          )}
                          <div className="min-w-0">
                            <p className="text-gray-300 text-xs font-medium">{cm.author || cm.authorId?.name || 'Utilisateur'}</p>
                            <p className="text-gray-200 text-sm whitespace-pre-wrap break-words">{cm.content}</p>
                          </div>
                        </div>
                      ))}
                      {(!vp.comments || vp.comments.length === 0) && <p className="text-gray-500 text-sm">Soyez le premier à commenter.</p>}
                    </div>
                  </div>
                </div>
                <div className="lg:col-span-1">
                  <h3 className="text-white font-semibold mb-3">Autres vidéos de {vAuthorName}</h3>
                  <div className="space-y-3">
                    {authorVideos.length === 0 && <p className="text-gray-500 text-sm">Aucune autre vidéo de cet auteur.</p>}
                    {authorVideos.map((p) => {
                      const thumb = p.thumbnail || p.images?.[0]
                      return (
                        <button key={p._id} onClick={() => openMediaAtIndex(feed.indexOf(p))} className="flex gap-3 w-full text-left group">
                          <div className="relative w-40 flex-shrink-0 aspect-video rounded-lg overflow-hidden bg-white/10">
                            {thumb ? (
                              <img src={thumb} alt="" className="w-full h-full object-cover group-hover:opacity-90" />
                            ) : (
                              <video src={p.videoUrl} className="w-full h-full object-cover" muted preload="metadata" />
                            )}
                            <span className="absolute inset-0 flex items-center justify-center"><span className="p-1.5 rounded-full bg-black/50"><Play size={16} className="text-white" /></span></span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-white text-sm font-medium line-clamp-2 group-hover:text-blue-300">{p.title || p.caption || 'Vidéo'}</p>
                            <p className="text-gray-400 text-xs mt-1">{vAuthorName}</p>
                            <p className="text-gray-500 text-xs">{p.views || 0} vues</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
