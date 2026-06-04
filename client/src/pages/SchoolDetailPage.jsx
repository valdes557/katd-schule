import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, MessageCircle, Share2, Send, Star, Phone, Mail,
  Globe, Users, FileText, Shield, HelpCircle, Gift, CreditCard, Loader2,
  ThumbsUp, ChevronDown, ChevronUp, Play, Eye, GraduationCap,
  Facebook, Instagram, Twitter, Youtube, Linkedin, X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut,
} from 'lucide-react'
import PublicHeader from '../components/layout/PublicHeader'
import Footer from '../components/layout/Footer'
import { schoolsApi, schoolPagesApi } from '../lib/api'
import { useAuth } from '../context/AuthContext'

const TABS = [
  { id: 'social', label: 'Social', icon: Globe },
  { id: 'about', label: 'À propos', icon: Users },
  { id: 'team', label: 'Notre Équipe', icon: Users },
  { id: 'payments', label: 'Paiements', icon: CreditCard },
  { id: 'contact', label: 'Contact', icon: Phone },
  { id: 'terms', label: 'Conditions', icon: FileText },
  { id: 'privacy', label: 'Confidentialité', icon: Shield },
  { id: 'reviews', label: 'Vos avis', icon: Star },
  { id: 'donate', label: 'Faites un Don', icon: Gift },
  { id: 'help', label: 'Aide', icon: HelpCircle },
]

export default function SchoolDetailPage() {
  const { schoolId } = useParams()
  const { user } = useAuth()
  const [school, setSchool] = useState(null)
  const [page, setPage] = useState(null)
  const [tab, setTab] = useState('social')
  const [posts, setPosts] = useState([])
  const [team, setTeam] = useState([])
  const [reviews, setReviews] = useState([])
  const [paymentMods, setPaymentMods] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [sRes, pRes] = await Promise.all([
          schoolsApi.get(schoolId),
          schoolPagesApi.get(schoolId),
        ])
        setSchool(sRes.data)
        setPage(pRes.data)
      } catch (e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [schoolId])

  useEffect(() => {
    if (tab === 'social') schoolPagesApi.getPosts(schoolId).then((r) => setPosts(r.data || [])).catch(() => {})
    if (tab === 'team') schoolPagesApi.getTeam(schoolId).then((r) => setTeam(r.data || [])).catch(() => {})
    if (tab === 'reviews') schoolPagesApi.getReviews(schoolId).then((r) => setReviews(r.data || [])).catch(() => {})
    if (tab === 'payments') schoolPagesApi.getPayments(schoolId).then((r) => setPaymentMods(r.data || [])).catch(() => {})
  }, [tab, schoolId])

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader />
      <div className="flex items-center justify-center py-32"><Loader2 size={32} className="animate-spin text-blue-600" /></div>
    </div>
  )

  if (!school) return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader />
      <div className="text-center py-32 text-gray-500">École introuvable</div>
    </div>
  )

  const initials = school.name?.split(' ').map((w) => w[0]).join('').slice(0, 3).toUpperCase()

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader />

      {/* School Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
          <Link to="/ecoles" className="inline-flex items-center gap-1 text-blue-200 hover:text-white text-sm mb-4">
            <ArrowLeft size={14} /> Retour aux écoles
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:justify-between">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 bg-white/20 rounded-2xl overflow-hidden flex items-center justify-center text-2xl font-bold backdrop-blur-sm flex-shrink-0">
                {school.logo ? <img src={school.logo} alt="" className="w-full h-full object-cover" /> : initials}
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">{school.name}</h1>
                <p className="text-blue-200 text-sm mt-1">
                  {school.address?.neighborhood && `${school.address.neighborhood}, `}{school.address?.city}, {school.address?.country}
                </p>
                <div className="flex flex-wrap gap-2 mt-2 items-center">
                  {school.cycles?.map((c) => (
                    <span key={c} className="bg-white/15 backdrop-blur-sm text-xs px-2.5 py-0.5 rounded-full">{c}</span>
                  ))}
                  {/* Socials */}
                  {school.socials && Object.entries(school.socials).some(([, v]) => v) && (
                    <span className="flex items-center gap-1 ml-1">
                      {[
                        { key: 'facebook', icon: Facebook, build: (v) => v },
                        { key: 'instagram', icon: Instagram, build: (v) => v },
                        { key: 'twitter', icon: Twitter, build: (v) => v },
                        { key: 'youtube', icon: Youtube, build: (v) => v },
                        { key: 'linkedin', icon: Linkedin, build: (v) => v },
                        { key: 'tiktok', icon: Globe, build: (v) => v },
                        { key: 'whatsapp', icon: MessageCircle, build: (v) => `https://wa.me/${v.replace(/\D/g, '')}` },
                      ].filter((s) => school.socials?.[s.key]).map((s) => (
                        <a key={s.key} href={s.build(school.socials[s.key])} target="_blank" rel="noopener noreferrer" className="w-7 h-7 bg-white/15 hover:bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors" title={s.key}>
                          <s.icon size={12} />
                        </a>
                      ))}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {/* Inscription CTA */}
            <Link
              to={`/inscription/${school._id}`}
              className="bg-white text-blue-700 hover:bg-blue-50 font-bold text-sm px-5 py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg whitespace-nowrap"
            >
              <GraduationCap size={16} /> S'inscrire à cette école
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile sticky Inscription button */}
      <Link
        to={`/inscription/${school._id}`}
        className="sm:hidden fixed bottom-4 right-4 z-40 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-3 rounded-full shadow-xl flex items-center gap-1.5"
      >
        <GraduationCap size={14} /> S'inscrire
      </Link>

      {/* Tab Navigation */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex overflow-x-auto scrollbar-thin gap-0">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs sm:text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <t.icon size={14} /> {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {tab === 'social' && <SocialTab schoolId={schoolId} posts={posts} setPosts={setPosts} user={user} />}
        {tab === 'about' && <AboutTab page={page} />}
        {tab === 'team' && <TeamTab team={team} />}
        {tab === 'payments' && <PaymentsTab modalities={paymentMods} />}
        {tab === 'contact' && <ContactTab page={page} school={school} />}
        {tab === 'terms' && <TextTab title="Conditions d'utilisation" content={page?.terms} icon={FileText} />}
        {tab === 'privacy' && <TextTab title="Politique de confidentialité" content={page?.privacy} icon={Shield} />}
        {tab === 'reviews' && <ReviewsTab schoolId={schoolId} reviews={reviews} setReviews={setReviews} />}
        {tab === 'donate' && <DonateTab page={page} />}
        {tab === 'help' && <TextTab title="Aide" content={page?.help} icon={HelpCircle} />}
      </div>
      <Footer />
    </div>
  )
}

/* ===================== SOCIAL TAB ===================== */
function SocialTab({ schoolId, posts, setPosts, user }) {
  const [commentText, setCommentText] = useState({})
  const [expandedComments, setExpandedComments] = useState({})
  const [viewer, setViewer] = useState(null) // { type: 'image' | 'video', src, post, index }
  const [viewerZoom, setViewerZoom] = useState(1)

  useEffect(() => {
    setViewerZoom(1)
  }, [viewer])

  const findNextMediaIndex = (startIndex, direction) => {
    if (!Array.isArray(posts) || !posts.length || startIndex == null || startIndex < 0) return null
    let i = startIndex + direction
    while (i >= 0 && i < posts.length) {
      const p = posts[i]
      if (p) {
        if (p.type === 'video' && p.videoUrl) return i
        if (p.images?.[0] || p.thumbnail) return i
      }
      i += direction
    }
    return null
  }

  const openMediaAtIndex = (index) => {
    if (!Array.isArray(posts) || index == null || index < 0 || index >= posts.length) return
    const p = posts[index]
    if (!p) return
    if (p.type === 'video' && p.videoUrl) {
      setViewer({ type: 'video', src: p.videoUrl, post: p, index })
    } else {
      const imgSrc = p.images?.[0] || p.thumbnail
      if (imgSrc) setViewer({ type: 'image', src: imgSrc, post: p, index })
    }
  }

  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `Il y a ${mins} min`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `Il y a ${hrs} h`
    const days = Math.floor(hrs / 24)
    if (days < 30) return `Il y a ${days} j`
    return new Date(date).toLocaleDateString('fr-FR')
  }

  const handleLike = async (id) => {
    if (!user) return
    try {
      const r = await schoolPagesApi.likePost(id)
      setPosts((prev) => prev.map((p) => p._id === id ? r.data : p))
    } catch (e) { console.error(e) }
  }

  const handleComment = async (id) => {
    const txt = commentText[id]?.trim()
    if (!txt) return
    try {
      const r = await schoolPagesApi.commentPost(id, txt)
      setPosts((prev) => prev.map((p) => p._id === id ? r.data : p))
      setCommentText((prev) => ({ ...prev, [id]: '' }))
    } catch (e) { console.error(e) }
  }

  return (
    <div className="space-y-4">
      {posts.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Globe size={40} className="mx-auto mb-3 opacity-20" />
          <p>Aucune publication pour le moment</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {posts.map((post, index) => (
            <div key={post._id} className="bg-white border border-gray-100 rounded-xl overflow-hidden hover:shadow-card transition-all">
              {/* Thumbnail */}
              <button
                type="button"
                className="relative aspect-video bg-gray-100 w-full"
                onClick={() => openMediaAtIndex(index)}
              >
                {post.thumbnail ? (
                  <img src={post.thumbnail} alt="" className="w-full h-full object-cover" />
                ) : post.images?.[0] ? (
                  <img src={post.images[0]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-indigo-100">
                    <Globe size={28} className="text-blue-300" />
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
                  <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">{post.duration}</span>
                )}
                {post.category && (
                  <span className="absolute top-2 left-2 bg-black/40 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-full">{post.category}</span>
                )}
              </button>

              {/* Body */}
              <div className="p-3">
                <div className="flex items-start gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-[10px] font-bold flex-shrink-0">
                    {(post.author?.name || 'K')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    {post.title && <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">{post.title}</h3>}
                    <p className="text-xs text-gray-600 line-clamp-2 mt-0.5">{post.content}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                      <span>{post.author?.name || 'Admin'}</span>
                      <span>·</span>
                      <span>{timeAgo(post.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between text-[10px] text-gray-400 pt-2 border-t border-gray-50">
                  <span className="flex items-center gap-1"><Eye size={10} /> {post.views || 0} vues</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-50">
                  <button
                    onClick={() => handleLike(post._id)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                      user && post.likes?.includes(user._id) ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    <ThumbsUp size={12} /> {post.likes?.length || 0}
                  </button>
                  <button
                    onClick={() => setExpandedComments((p) => ({ ...p, [post._id]: !p[post._id] }))}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                  >
                    <MessageCircle size={12} /> {post.comments?.length || 0}
                  </button>
                  <button className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-gray-500 hover:bg-gray-100 transition-colors ml-auto">
                    <Share2 size={12} /> Partager
                  </button>
                </div>

                {/* Comments expand */}
                {expandedComments[post._id] && (
                  <div className="mt-2 pt-2 border-t border-gray-50 space-y-2">
                    {post.comments?.slice(0, 5).map((c, i) => (
                      <div key={i} className="flex gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-bold flex-shrink-0">{c.author?.[0]?.toUpperCase()}</div>
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
                          onChange={(e) => setCommentText((p) => ({ ...p, [post._id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && handleComment(post._id)}
                          placeholder="Ajouter un commentaire..."
                          className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-400"
                        />
                        <button onClick={() => handleComment(post._id)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg">
                          <Send size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {viewer && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
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
              const currentIndex = viewer.index ?? -1
              const prevIndex = findNextMediaIndex(currentIndex, -1)
              const nextIndex = findNextMediaIndex(currentIndex, 1)
              return (
                <>
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
                </>
              )
            })()}
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

/* ===================== ABOUT TAB ===================== */
function AboutTab({ page }) {
  return (
    <div className="max-w-3xl mx-auto">
      {page?.about?.content ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2"><Users size={20} className="text-blue-600" /> À propos de nous</h2>
          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">{page.about.content}</div>
          {page.about.images?.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6">
              {page.about.images.map((img, i) => <img key={i} src={img} alt="" className="rounded-xl object-cover h-40 w-full" />)}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400"><Users size={40} className="mx-auto mb-3 opacity-20" /><p>Aucune information publiée</p></div>
      )}
    </div>
  )
}

/* ===================== TEAM TAB ===================== */
function TeamTab({ team }) {
  const [expanded, setExpanded] = useState(null)

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2"><Users size={20} className="text-blue-600" /> Notre Équipe</h2>
      {team.length === 0 ? (
        <div className="text-center py-16 text-gray-400"><Users size={40} className="mx-auto mb-3 opacity-20" /><p>Aucun membre publié</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {team.map((m) => (
            <div key={m._id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-card transition-shadow">
              <div className="h-48 bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                {m.photo ? (
                  <img src={m.photo} alt={m.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-20 h-20 bg-blue-200 rounded-full flex items-center justify-center text-2xl font-bold text-blue-600">{m.name?.[0]}</div>
                )}
              </div>
              <div className="p-4">
                <h3 className="text-sm font-bold text-gray-900">{m.name}</h3>
                <p className="text-xs text-blue-600 font-medium mb-2">{m.role}</p>
                {m.description && (
                  <div>
                    <p className={`text-xs text-gray-600 leading-relaxed ${expanded !== m._id ? 'line-clamp-3' : ''}`}>{m.description}</p>
                    {m.description.length > 120 && (
                      <button onClick={() => setExpanded(expanded === m._id ? null : m._id)} className="text-blue-600 text-xs mt-1 hover:underline flex items-center gap-1">
                        {expanded === m._id ? <><ChevronUp size={10} /> Voir moins</> : <><ChevronDown size={10} /> Voir plus</>}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ===================== PAYMENTS TAB ===================== */
function PaymentsTab({ modalities }) {
  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2"><CreditCard size={20} className="text-blue-600" /> Nos modalités de paiement</h2>
      {modalities.length === 0 ? (
        <div className="text-center py-16 text-gray-400"><CreditCard size={40} className="mx-auto mb-3 opacity-20" /><p>Aucune modalité publiée</p></div>
      ) : (
        <div className="space-y-4">
          {modalities.map((m) => (
            <div key={m._id} className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-900">{m.className}</h3>
                <span className="text-base font-bold text-blue-600">{m.totalAmount?.toLocaleString()} F CFA</span>
              </div>
              {m.installments?.length > 0 && (
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs text-gray-500 mb-2 font-medium">Tranches de paiement :</p>
                  <div className="space-y-1.5">
                    {m.installments.map((inst, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-xs text-gray-700 font-medium">{inst.label}</span>
                        <div className="text-right">
                          <span className="text-xs font-bold text-gray-900">{inst.amount?.toLocaleString()} F CFA</span>
                          {inst.deadline && <span className="text-[10px] text-gray-400 ml-2">avant le {inst.deadline}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ===================== CONTACT TAB ===================== */
function ContactTab({ page, school }) {
  const contacts = page?.contacts || []
  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2"><Phone size={20} className="text-blue-600" /> Contactez-nous</h2>
      <div className="space-y-3">
        {school?.phone && (
          <a href={`tel:${school.phone}`} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 hover:shadow-card transition-shadow">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center"><Phone size={16} className="text-green-600" /></div>
            <div><p className="text-xs text-gray-500">Téléphone</p><p className="text-sm font-medium text-gray-900">{school.phone}</p></div>
          </a>
        )}
        {school?.email && (
          <a href={`mailto:${school.email}`} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 hover:shadow-card transition-shadow">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center"><Mail size={16} className="text-blue-600" /></div>
            <div><p className="text-xs text-gray-500">Email</p><p className="text-sm font-medium text-gray-900">{school.email}</p></div>
          </a>
        )}
        {contacts.map((c, i) => {
          const icons = { whatsapp: { bg: 'bg-green-100', color: 'text-green-600', icon: Phone }, phone: { bg: 'bg-orange-100', color: 'text-orange-600', icon: Phone }, email: { bg: 'bg-blue-100', color: 'text-blue-600', icon: Mail } }
          const ic = icons[c.type] || icons.phone
          const href = c.type === 'whatsapp' ? `https://wa.me/${c.value.replace(/\D/g, '')}` : c.type === 'email' ? `mailto:${c.value}` : `tel:${c.value}`
          return (
            <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 hover:shadow-card transition-shadow">
              <div className={`w-10 h-10 ${ic.bg} rounded-full flex items-center justify-center`}><ic.icon size={16} className={ic.color} /></div>
              <div>
                <p className="text-xs text-gray-500">{c.label || c.type}</p>
                <p className="text-sm font-medium text-gray-900">{c.value}</p>
              </div>
            </a>
          )
        })}
        {contacts.length === 0 && !school?.phone && !school?.email && (
          <div className="text-center py-16 text-gray-400"><Phone size={40} className="mx-auto mb-3 opacity-20" /><p>Aucun contact publié</p></div>
        )}
      </div>
    </div>
  )
}

/* ===================== TEXT TAB (terms/privacy/help) ===================== */
function TextTab({ title, content, icon: Icon }) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2"><Icon size={20} className="text-blue-600" /> {title}</h2>
        {content ? (
          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">{content}</div>
        ) : (
          <p className="text-gray-400 text-sm py-8 text-center">Aucun contenu publié pour le moment.</p>
        )}
      </div>
    </div>
  )
}

/* ===================== REVIEWS TAB ===================== */
function ReviewsTab({ schoolId, reviews, setReviews }) {
  const [form, setForm] = useState({ authorName: '', authorEmail: '', rating: 5, content: '' })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await schoolPagesApi.submitReview(schoolId, form)
      setSuccess(true)
      setForm({ authorName: '', authorEmail: '', rating: 5, content: '' })
    } catch (e) { alert(e.message) }
    setSubmitting(false)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2"><Star size={20} className="text-yellow-500" /> Vos avis</h2>

      {/* Submit review form */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        <h3 className="text-sm font-bold text-gray-800 mb-3">Laisser un avis</h3>
        {success ? (
          <p className="text-green-600 text-sm py-4">✅ Merci ! Votre avis a été soumis et sera publié après validation.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input required value={form.authorName} onChange={(e) => setForm({ ...form, authorName: e.target.value })} className="input text-sm" placeholder="Votre nom" />
              <input value={form.authorEmail} onChange={(e) => setForm({ ...form, authorEmail: e.target.value })} className="input text-sm" placeholder="Email (optionnel)" type="email" />
            </div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} type="button" onClick={() => setForm({ ...form, rating: s })}>
                  <Star size={20} className={s <= form.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />
                </button>
              ))}
            </div>
            <textarea required value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="input text-sm resize-none" rows={3} placeholder="Votre avis..." />
            <button type="submit" disabled={submitting} className="btn-primary text-sm">{submitting ? 'Envoi...' : 'Soumettre mon avis'}</button>
          </form>
        )}
      </div>

      {/* Reviews list */}
      {reviews.length === 0 ? (
        <p className="text-center text-gray-400 py-8 text-sm">Aucun avis publié</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r._id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center text-xs font-bold text-yellow-600">{r.authorName?.[0]}</div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{r.authorName}</p>
                    <p className="text-[10px] text-gray-400">{new Date(r.createdAt).toLocaleDateString('fr-FR')}</p>
                  </div>
                </div>
                <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map((s) => <Star key={s} size={12} className={s <= r.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'} />)}</div>
              </div>
              <p className="text-sm text-gray-700">{r.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ===================== DONATE TAB ===================== */
function DonateTab({ page }) {
  const accounts = page?.donationAccounts || []
  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2"><Gift size={20} className="text-purple-600" /> Faites un Don</h2>
      {accounts.length === 0 ? (
        <div className="text-center py-16 text-gray-400"><Gift size={40} className="mx-auto mb-3 opacity-20" /><p>Aucun compte de donation publié</p></div>
      ) : (
        <div className="space-y-3">
          {accounts.map((a, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center"><Gift size={20} className="text-purple-600" /></div>
              <div>
                <p className="text-sm font-bold text-gray-900">{a.accountName}</p>
                <p className="text-xs text-gray-500">{a.bankName}</p>
                <p className="text-sm font-mono text-blue-600 mt-0.5">{a.accountNumber}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
