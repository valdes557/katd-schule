import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useSearchParams, useLocation } from 'react-router-dom'
import {
  Newspaper, Search, Eye, Heart, MessageSquare,
  Calendar, User, ArrowRight, Loader2, Sparkles, SlidersHorizontal
} from 'lucide-react'
import { blogsApi } from '../../lib/api'
import SocialShareButtons from '../../components/blog/SocialShareButtons'
import BlogAdSenseBanner from '../../components/blog/BlogAdSenseBanner'
import PublicHeader from '../../components/layout/PublicHeader'
import Footer from '../../components/layout/Footer'

export default function BlogListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeCategory = searchParams.get('category') || 'all'
  const [categories, setCategories] = useState([])
  const [posts, setPosts] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState('recent')

  // Charger les catégories
  useEffect(() => {
    blogsApi.categories()
      .then((res) => setCategories(res.data || []))
      .catch(() => {})
  }, [])

  // Charger les articles
  const loadPosts = useCallback(async (targetPage = 1) => {
    setLoading(true)
    try {
      const isAll = activeCategory === 'all' && !search.trim()
      const res = await blogsApi.list({
        category: activeCategory !== 'all' ? activeCategory : undefined,
        search: search.trim() || undefined,
        sort,
        page: targetPage,
        limit: isAll ? 30 : 12,
      })
      setPosts(res.data || [])
      setTotal(res.total || 0)
      setPage(res.page || 1)
      setTotalPages(res.totalPages || 1)
    } catch (_) {
      setPosts([])
    } finally {
      setLoading(false)
    }
  }, [activeCategory, search, sort])

  useEffect(() => {
    loadPosts(1)
  }, [loadPosts])

  const selectCategory = (catName) => {
    if (catName === 'all') {
      searchParams.delete('category')
    } else {
      searchParams.set('category', catName)
    }
    setSearchParams(searchParams)
  }

  const isCategorizedView = activeCategory === 'all' && !search.trim()

  const groupedPosts = useMemo(() => {
    if (!isCategorizedView) return {}
    const groups = {}
    posts.forEach((post) => {
      const c = post.categoryName || 'Général'
      if (!groups[c]) groups[c] = []
      groups[c].push(post)
    })
    return groups
  }, [posts, isCategorizedView])

  const location = useLocation()
  const isPublicView = !location.pathname.startsWith('/u')

  const content = (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in duration-200">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-blue-100 text-xs font-semibold mb-3 backdrop-blur-sm">
            <Newspaper size={14} /> Blog & Actualités Éducatives
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-2">
            Articles, Guides & Conseils Pédagogiques
          </h1>
          <p className="text-blue-100 text-xs sm:text-sm leading-relaxed">
            Rédigés par l'administration et les enseignants des écoles KATD-SCHÜLE. Partagez nos articles pour inspirer votre communauté.
          </p>
        </div>
      </div>

      {/* Bannière Publicitaire AdSense en haut */}
      <BlogAdSenseBanner format="auto" />

      {/* Barre de recherche et filtres */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un article, un thème..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <SlidersHorizontal size={13} /> Trier par :
          </span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="recent">Plus récents</option>
            <option value="popular">Plus consultés</option>
            <option value="likes">Plus aimés</option>
          </select>
        </div>
      </div>

      {/* Pilules de catégories */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => selectCategory('all')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeCategory === 'all'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Toutes les catégories ({total})
        </button>
        {categories.map((cat) => (
          <button
            key={cat._id}
            onClick={() => selectCategory(cat.name)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeCategory === cat.name
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {cat.name} ({cat.articlesCount || 0})
          </button>
        ))}
      </div>

      {/* Grille d'articles */}
      {loading ? (
        <div className="py-20 text-center flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-blue-600" />
          <p className="text-sm text-gray-500">Chargement des articles de blog...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
          <Newspaper size={48} className="mx-auto text-gray-300 mb-3" />
          <h3 className="font-bold text-gray-800 text-lg mb-1">Aucun article trouvé</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            {search ? 'Aucun résultat ne correspond à votre recherche.' : 'Aucun article n\'a encore été publié dans cette catégorie.'}
          </p>
        </div>
      ) : isCategorizedView ? (
        <div className="space-y-10">
          {Object.entries(groupedPosts).map(([catName, catPosts]) => (
            <div key={catName} className="space-y-4">
              <div className="flex items-center justify-between border-b border-gray-200/80 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-600" />
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">{catName}</h2>
                  <span className="text-xs text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-full">
                    {catPosts.length} article{catPosts.length > 1 ? 's' : ''}
                  </span>
                </div>
                <button
                  onClick={() => selectCategory(catName)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:translate-x-0.5 transition-transform"
                >
                  Voir tous ({catName}) <ArrowRight size={13} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {catPosts.map((post) => (
                  <PostArticleCard key={post._id} post={post} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <PostArticleCard key={post._id} post={post} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => loadPosts(page - 1)}
            disabled={page <= 1}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            Précédent
          </button>
          <span className="text-xs text-gray-500 font-medium">
            Page {page} sur {totalPages}
          </span>
          <button
            onClick={() => loadPosts(page + 1)}
            disabled={page >= totalPages}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            Suivant
          </button>
        </div>
      )}

      {/* Bannière Publicitaire AdSense en bas */}
      <BlogAdSenseBanner format="auto" />
    </div>
  )

  if (isPublicView) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <PublicHeader />
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
          {content}
        </main>
        <Footer />
      </div>
    )
  }

  return content
}

function PostArticleCard({ post }) {
  const targetLink = `/blogs/${post.slug || post._id}`
  return (
    <article className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col group">
      {/* Image de couverture */}
      <Link to={targetLink} className="relative h-48 w-full bg-slate-100 overflow-hidden block">
        {post.coverImage ? (
          <img
            src={post.coverImage}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-400">
            <Newspaper size={40} className="opacity-40" />
          </div>
        )}
        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/90 backdrop-blur-sm text-blue-700 shadow-sm">
          {post.categoryName}
        </span>
      </Link>

      {/* Corps */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] text-gray-400 mb-2">
            <span className="flex items-center gap-1">
              <Calendar size={12} /> {new Date(post.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 font-medium text-gray-600">
              <User size={12} /> {post.authorName} ({post.authorRole})
            </span>
          </div>

          <Link to={targetLink}>
            <h2 className="font-bold text-gray-900 text-base leading-snug group-hover:text-blue-600 transition-colors line-clamp-2 mb-2">
              {post.title}
            </h2>
          </Link>

          <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed mb-4">
            {post.excerpt}
          </p>
        </div>

        {/* Métriques & Partage */}
        <div className="pt-4 border-t border-gray-100 space-y-3">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1" title="Vues">
                <Eye size={14} className="text-gray-400" /> {post.views}
              </span>
              <span className="flex items-center gap-1" title="Likes">
                <Heart size={14} className={post.isLiked ? 'text-red-500 fill-red-500' : 'text-gray-400'} /> {post.likesCount}
              </span>
              <span className="flex items-center gap-1" title="Commentaires">
                <MessageSquare size={14} className="text-gray-400" /> {post.commentsCount}
              </span>
            </div>

            <Link
              to={targetLink}
              className="text-blue-600 font-semibold text-xs flex items-center gap-1 hover:gap-1.5 transition-all"
            >
              Lire <ArrowRight size={13} />
            </Link>
          </div>

          {/* Boutons de partage direct sur le bloc */}
          <div className="pt-1">
            <SocialShareButtons post={post} size="sm" />
          </div>
        </div>
      </div>
    </article>
  )
}
