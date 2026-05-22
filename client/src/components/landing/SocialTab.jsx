import { useState } from 'react'
import {
  Globe2, Play, Eye, ThumbsUp, MessageCircle, Share2, Send, ChevronDown,
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
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => filterFeed(c)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                (c === 'Tout' && !feedCategory) || feedCategory === c
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {c}
            </button>
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
                key={post._id}
                post={post}
                user={user}
                onLike={handleLike}
                onComment={handleComment}
                commentText={commentText}
                setCommentText={setCommentText}
                expandedComments={expandedComments}
                setExpandedComments={setExpandedComments}
              />
            ))}
          </div>
          <div className="text-center pt-4">
            <button
              onClick={loadMore}
              className="inline-flex items-center gap-2 border border-gray-200 text-gray-700 text-sm font-medium px-6 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Charger plus <ChevronDown size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function PostCard({
  post, user, onLike, onComment,
  commentText, setCommentText,
  expandedComments, setExpandedComments,
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden hover:shadow-card transition-all group">
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gray-100">
        {post.thumbnail ? (
          <img src={post.thumbnail} alt="" className="w-full h-full object-cover" />
        ) : post.images?.[0] ? (
          <img src={post.images[0]} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-indigo-100">
            <Globe2 size={32} className="text-blue-300" />
          </div>
        )}
        {post.type === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 bg-black/50 rounded-full flex items-center justify-center">
              <Play size={16} className="text-white fill-white ml-0.5" />
            </div>
          </div>
        )}
        {post.duration && (
          <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
            {post.duration}
          </span>
        )}
        {post.category && (
          <span className="absolute top-2 left-2 bg-black/40 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-full font-medium">
            {post.category}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        <div className="flex items-start gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-[10px] font-bold flex-shrink-0">
            {(post.author?.name || 'K')[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            {post.title && (
              <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">
                {post.title}
              </h3>
            )}
            <p className="text-xs text-gray-600 line-clamp-2 mt-0.5">{post.content}</p>
            <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
              <span>{post.author?.name || 'KATD-SCHÜLE'}</span>
              {post.school?.name && (
                <>
                  <span>·</span>
                  <span className="truncate">{post.school.name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-[10px] text-gray-400 pt-2 border-t border-gray-50">
          <span className="flex items-center gap-1">
            <Eye size={10} /> {post.views || 0} vues
          </span>
          <span>{timeAgo(post.createdAt)}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-50">
          <button
            onClick={() => onLike(post._id)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              user && post.likes?.includes(user._id)
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <ThumbsUp size={12} /> {post.likes?.length || 0}
          </button>
          <button
            onClick={() =>
              setExpandedComments((prev) => ({
                ...prev,
                [post._id]: !prev[post._id],
              }))
            }
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <MessageCircle size={12} /> {post.comments?.length || 0}
          </button>
          <button className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-gray-500 hover:bg-gray-100 transition-colors ml-auto">
            <Share2 size={12} /> Partager
          </button>
        </div>

        {/* Comments */}
        {expandedComments[post._id] && (
          <div className="mt-2 pt-2 border-t border-gray-50 space-y-2">
            {post.comments?.slice(0, 5).map((c, i) => (
              <div key={i} className="flex gap-1.5">
                <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                  {c.author?.[0]?.toUpperCase()}
                </div>
                <div className="bg-gray-50 rounded-lg px-2 py-1 text-xs">
                  <span className="font-semibold text-gray-700">{c.author}</span>
                  <p className="text-gray-600">{c.content}</p>
                </div>
              </div>
            ))}
            {user && (
              <div className="flex gap-1.5">
                <input
                  value={commentText[post._id] || ''}
                  onChange={(e) =>
                    setCommentText((prev) => ({ ...prev, [post._id]: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === 'Enter' && onComment(post._id)}
                  placeholder="Ajouter un commentaire..."
                  className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-400"
                />
                <button
                  onClick={() => onComment(post._id)}
                  className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg"
                >
                  <Send size={12} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
