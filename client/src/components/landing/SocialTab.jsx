import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Globe2, Play, Eye, ThumbsUp, MessageCircle, Share2, Send, ChevronDown,
  Download, Music, Lock, Check,
} from 'lucide-react'
import { platformApi } from '../../lib/api'

const CATEGORIES = ['Tout', 'Éducation', 'Sport', 'Culture', 'Sciences', 'Technologie']

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

  const handleShare = async (postId) => {
    const url = `${window.location.origin}/social#${postId}`
    try { await navigator.clipboard.writeText(url) } catch (_) {}
    platformApi.sharePost(postId)
    setFeed((prev) => prev.map((p) => p._id === postId ? { ...p, shares: (p.shares || 0) + 1 } : p))
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {feed.map((post) => (
              <PostCard
                key={post._id} post={post} user={user}
                onLike={handleLike} onComment={handleComment} onShare={handleShare}
                commentText={commentText} setCommentText={setCommentText}
                expandedComments={expandedComments} setExpandedComments={setExpandedComments}
                onDownload={(id) => setFeed((prev) => prev.map((p) => p._id === id ? { ...p, downloads: (p.downloads || 0) + 1 } : p))}
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
    </div>
  )
}

function PostCard({ post, user, onLike, onComment, onShare, onDownload, commentText, setCommentText, expandedComments, setExpandedComments }) {
  const navigate = useNavigate()
  const [shareCopied, setShareCopied] = useState(false)
  const [videoExpanded, setVideoExpanded] = useState(false)

  const handleDownload = async () => {
    if (!user) { navigate('/login'); return }
    const url = post.audioUrl || post.videoUrl || post.images?.[0]
    if (!url) return
    try {
      await platformApi.downloadPost(post._id)
      onDownload(post._id)
      const a = document.createElement('a')
      a.href = url; a.download = post.title || 'media'; a.target = '_blank'
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
    } catch (e) {}
  }

  const handleShare = async () => {
    await onShare(post._id)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }

  const hasMedia = post.audioUrl || post.videoUrl || post.images?.length > 0

  return (
    <div id={post._id} className="bg-white border border-gray-100 rounded-xl overflow-hidden hover:shadow-lg transition-all">
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
            <audio controls src={post.audioUrl} className="w-full h-8 accent-white" />
          )}
        </div>
      ) : post.type === 'video' ? (
        <div className="relative aspect-video bg-black">
          {videoExpanded && (post.videoUrl?.includes('youtube') || post.videoUrl?.includes('youtu.be')) ? (
            <iframe
              className="w-full h-full"
              src={post.videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
              allow="autoplay; encrypted-media" allowFullScreen
            />
          ) : videoExpanded && post.videoUrl ? (
            <video controls autoPlay src={post.videoUrl} className="w-full h-full object-contain" />
          ) : (
            <>
              {post.thumbnail || post.images?.[0] ? (
                <img src={post.thumbnail || post.images[0]} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-900">
                  <Play size={40} className="text-gray-600" />
                </div>
              )}
              <button
                onClick={() => setVideoExpanded(true)}
                className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
              >
                <div className="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
                  <Play size={22} className="text-gray-900 fill-gray-900 ml-1" />
                </div>
              </button>
              {post.duration && (
                <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">{post.duration}</span>
              )}
            </>
          )}
          {post.category && (
            <span className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-full">{post.category}</span>
          )}
        </div>
      ) : post.images?.length > 0 ? (
        <div className="relative aspect-video bg-gray-100">
          <img src={post.images[0]} alt="" className="w-full h-full object-cover" />
          {post.images.length > 1 && (
            <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">+{post.images.length - 1}</span>
          )}
          {post.category && (
            <span className="absolute top-2 left-2 bg-black/40 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-full">{post.category}</span>
          )}
        </div>
      ) : (
        <div className="h-16 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-center">
          <Globe2 size={24} className="text-blue-200" />
        </div>
      )}

      {/* ── Content ── */}
      <div className="p-3">
        <div className="flex items-start gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
            {(post.author?.name || 'K')[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            {post.title && <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">{post.title}</h3>}
            <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{post.content}</p>
            <div className="flex items-center gap-1.5 mt-1 text-[10px] text-gray-400">
              <span>{post.author?.name || 'KATD-SCHÜLE'}</span>
              <span>·</span><span>{timeAgo(post.createdAt)}</span>
            </div>
          </div>
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
            onClick={() => setExpandedComments((p) => ({ ...p, [post._id]: !p[post._id] }))}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium text-gray-500 hover:bg-gray-100 transition-colors flex-1 justify-center"
          >
            <MessageCircle size={12} /> {post.comments?.length || 0}
          </button>
          <button
            onClick={handleShare}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors flex-1 justify-center ${
              shareCopied ? 'text-green-600 bg-green-50' : 'text-gray-500 hover:bg-gray-100'
            }`}
            title="Copier le lien"
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
            <a href="/login" className="text-blue-500 hover:underline">Connectez-vous</a> pour télécharger
          </p>
        )}

        {/* Comments section */}
        {expandedComments[post._id] && (
          <div className="mt-2 pt-2 border-t border-gray-50 space-y-2">
            {post.comments?.length === 0 && <p className="text-xs text-gray-400 text-center py-1">Aucun commentaire</p>}
            {post.comments?.slice(0, 5).map((c, i) => (
              <div key={i} className="flex gap-1.5">
                <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                  {c.author?.[0]?.toUpperCase()}
                </div>
                <div className="bg-gray-50 rounded-lg px-2 py-1 text-xs flex-1">
                  <span className="font-semibold text-gray-700">{c.author}</span>
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
                <a href="/login" className="text-blue-500 hover:underline">Connectez-vous</a> pour commenter
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
