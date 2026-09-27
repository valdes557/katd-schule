import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowLeft, Calendar, User, Eye, Heart, MessageSquare,
  Share2, Lock, UserPlus, LogIn, Loader2, Send, CheckCircle2,
  AlertCircle, Sparkles, Newspaper
} from 'lucide-react'
import { blogsApi } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import SocialShareButtons from '../../components/blog/SocialShareButtons'
import BlogAdSenseBanner from '../../components/blog/BlogAdSenseBanner'

export default function BlogDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [post, setPost] = useState(null)
  const [requiresAuth, setRequiresAuth] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [liked, setLiked] = useState(false)
  const [likesCount, setLikesCount] = useState(0)
  const [comments, setComments] = useState([])
  const [commentInput, setCommentInput] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

  const currentUrl = window.location.href

  useEffect(() => {
    setLoading(true)
    setError('')
    blogsApi.get(id)
      .then((res) => {
        if (res.requiresAuth) {
          setRequiresAuth(true)
          setPost(res.data)
        } else {
          setRequiresAuth(false)
          setPost(res.data)
          setLiked(res.data.isLiked || false)
          setLikesCount(res.data.likesCount || 0)
          setComments(res.data.comments || [])
        }
      })
      .catch((err) => {
        setError(err.message || 'Impossible de charger cet article')
      })
      .finally(() => setLoading(false))
  }, [id, user])

  const handleLike = async () => {
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`)
      return
    }
    try {
      const res = await blogsApi.like(post._id)
      setLiked(res.liked)
      setLikesCount(res.likesCount)
    } catch (_) {}
  }

  const handleAddComment = async (e) => {
    e.preventDefault()
    if (!commentInput.trim()) return
    setSubmittingComment(true)
    try {
      const res = await blogsApi.addComment(post._id, commentInput.trim())
      setComments((prev) => [...prev, res.comment])
      setCommentInput('')
    } catch (err) {
      alert(err.message || 'Erreur lors de l\'ajout du commentaire')
    } finally {
      setSubmittingComment(false)
    }
  }

  if (loading) {
    return (
      <div className="py-24 text-center flex flex-col items-center gap-3">
        <Loader2 size={32} className="animate-spin text-blue-600" />
        <p className="text-sm text-gray-500">Chargement de l'article...</p>
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
        <AlertCircle size={44} className="text-red-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-gray-900 mb-1">Article introuvable</h2>
        <p className="text-xs text-gray-500 mb-5">{error || "Cet article n'existe plus ou a été retiré."}</p>
        <Link to="/u/blogs" className="btn-primary text-sm inline-flex items-center gap-1.5">
          <ArrowLeft size={16} /> Retour aux articles
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16 animate-in fade-in duration-200">
      {/* Bouton retour */}
      <div className="flex items-center justify-between">
        <Link
          to="/u/blogs"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft size={15} /> Tous les articles
        </Link>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
          {post.categoryName}
        </span>
      </div>

      {/* Titre & Métadonnées */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm space-y-5">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 leading-tight">
          {post.title}
        </h1>

        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-gray-100 text-xs text-gray-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm overflow-hidden shrink-0">
              {post.authorAvatar ? (
                <img src={post.authorAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <User size={18} />
              )}
            </div>
            <div>
              <div className="font-bold text-gray-900 text-sm">{post.authorName}</div>
              <div className="text-[11px] text-gray-400">{post.authorRole} {post.schoolName ? `• ${post.schoolName}` : ''}</div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar size={13} /> {new Date(post.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            <span className="flex items-center gap-1" title="Vues">
              <Eye size={13} /> {post.views} vues
            </span>
          </div>
        </div>

        {/* Image de couverture */}
        {post.coverImage && (
          <div className="rounded-2xl overflow-hidden bg-slate-100 max-h-96 w-full shadow-inner">
            <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Bannière AdSense en tête d'article */}
        <BlogAdSenseBanner format="auto" />

        {/* ── Contenu de l'article ── */}
        {requiresAuth ? (
          /* MUR DE LECTURE (AUTH GATE) POUR LES VISITEURS EXTERNES */
          <div className="space-y-6 pt-2">
            <div className="text-gray-700 text-base leading-relaxed font-serif italic border-l-4 border-blue-500 pl-4 py-1 bg-blue-50/40 rounded-r-xl">
              « {post.teaserContent || post.excerpt} »
            </div>

            {/* Carte bloquante avec flou */}
            <div className="relative rounded-3xl bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-950 p-8 sm:p-10 text-white text-center shadow-2xl overflow-hidden">
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10 max-w-lg mx-auto space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-white/10 text-yellow-300 flex items-center justify-center mx-auto shadow-inner border border-white/20">
                  <Lock size={26} />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight">
                  Rejoignez KATD-SCHÜLE pour lire la suite de cet article
                </h3>
                <p className="text-blue-200 text-xs sm:text-sm leading-relaxed">
                  L'accès à l'article complet, aux vidéos KATDTUBE, aux cours interactifs et aux échanges communautaires est 100% gratuit pour tous les utilisateurs.
                </p>

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link
                    to={`/login?mode=user&signup=1&redirect=${encodeURIComponent(location.pathname)}`}
                    className="btn-primary w-full sm:w-auto bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-slate-950 font-bold px-6 py-3 text-sm shadow-xl justify-center"
                  >
                    <UserPlus size={16} /> Créer mon compte gratuit
                  </Link>
                  <Link
                    to={`/login?mode=user&redirect=${encodeURIComponent(location.pathname)}`}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl border border-white/30 text-white hover:bg-white/10 font-semibold text-sm transition-all justify-center inline-flex items-center gap-2"
                  >
                    <LogIn size={16} /> J'ai déjà un compte
                  </Link>
                </div>
              </div>
            </div>

            {/* Boutons de partage pour inviter d'autres amis */}
            <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50 p-4 rounded-2xl">
              <span className="text-xs font-semibold text-gray-700">Partager cet article avec vos proches :</span>
              <SocialShareButtons post={post} size="md" />
            </div>
          </div>
        ) : (
          /* CONTENU COMPLET POUR UTILISATEURS CONNECTÉS */
          <div className="space-y-6 pt-2">
            <div
              className="prose prose-blue max-w-none text-gray-800 text-base leading-relaxed break-words"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />

            {/* Bannière AdSense en fin d'article */}
            <BlogAdSenseBanner format="auto" />

            {/* Barre d'actions : Like + Partage */}
            <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <button
                onClick={handleLike}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm transition-all ${
                  liked
                    ? 'bg-red-50 text-red-600 border border-red-200 shadow-sm'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                <Heart size={18} className={liked ? 'fill-red-600 text-red-600' : ''} />
                <span>{liked ? 'Aimé !' : "J'aime cet article"}</span>
                <span className="ml-1 text-xs opacity-75">({likesCount})</span>
              </button>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-medium">Partager :</span>
                <SocialShareButtons post={post} size="md" />
              </div>
            </div>

            {/* ── Section Commentaires ── */}
            <div className="pt-8 border-t border-gray-100 space-y-5">
              <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                <MessageSquare size={18} className="text-blue-600" />
                Commentaires ({comments.length})
              </h3>

              {/* Formulaire de commentaire */}
              {user ? (
                <form onSubmit={handleAddComment} className="flex gap-2">
                  <input
                    type="text"
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    placeholder="Écrivez un commentaire constructif..."
                    className="flex-1 input text-sm"
                    required
                  />
                  <button
                    type="submit"
                    disabled={submittingComment || !commentInput.trim()}
                    className="btn-primary px-5 py-2 text-sm justify-center"
                  >
                    {submittingComment ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </form>
              ) : (
                <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-500 text-center">
                  <Link to="/login" className="text-blue-600 font-semibold underline">Connectez-vous</Link> pour laisser un commentaire.
                </div>
              )}

              {/* Liste des commentaires */}
              <div className="space-y-3">
                {comments.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Soyez le premier à commenter cet article !</p>
                ) : (
                  comments.map((c, i) => (
                    <div key={i} className="bg-gray-50 rounded-2xl p-4 flex gap-3 text-xs border border-gray-100">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold shrink-0 overflow-hidden">
                        {c.userAvatar ? <img src={c.userAvatar} alt="" className="w-full h-full object-cover" /> : <User size={14} />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-gray-900">{c.userName || 'Utilisateur'}</span>
                          <span className="text-[10px] text-gray-400">
                            {new Date(c.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-gray-700 leading-relaxed text-xs sm:text-sm">{c.content}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
