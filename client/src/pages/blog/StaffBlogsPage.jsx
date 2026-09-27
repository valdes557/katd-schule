import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Newspaper, Plus, BarChart2, Eye, Heart, MessageSquare,
  Share2, Edit3, Trash2, CheckCircle2, AlertCircle, Loader2,
  Image as ImageIcon, FolderPlus, ArrowRight, ExternalLink
} from 'lucide-react'
import { blogsApi } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import RichTextEditor from '../../components/blog/RichTextEditor'

export default function StaffBlogsPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('write') // 'write' | 'stats' | 'all'
  const [categories, setCategories] = useState([])
  const [loadingCats, setLoadingCats] = useState(false)

  // Formulaire d'écriture / modification
  const [editingId, setEditingId] = useState(null)
  const [title, setTitle] = useState('')
  const [categoryName, setCategoryName] = useState('Général')
  const [excerpt, setExcerpt] = useState('')
  const [content, setContent] = useState('')
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState('')
  const [status, setStatus] = useState('published')
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Création rapide de catégorie
  const [showNewCatModal, setShowNewCatModal] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatDesc, setNewCatDesc] = useState('')
  const [creatingCat, setCreatingCat] = useState(false)

  // Données statistiques de l'auteur
  const [statsData, setStatsData] = useState(null)
  const [loadingStats, setLoadingStats] = useState(false)

  // Tous les articles de la plateforme
  const [allPosts, setAllPosts] = useState([])
  const [loadingAll, setLoadingAll] = useState(false)

  const loadCategories = () => {
    setLoadingCats(true)
    blogsApi.categories()
      .then((res) => {
        setCategories(res.data || [])
        if (res.data?.length && categoryName === 'Général') {
          setCategoryName(res.data[0].name)
        }
      })
      .catch(() => {})
      .finally(() => setLoadingCats(false))
  }

  const loadStats = () => {
    setLoadingStats(true)
    blogsApi.myStats()
      .then((res) => setStatsData(res))
      .catch(() => {})
      .finally(() => setLoadingStats(false))
  }

  const loadAllPosts = () => {
    setLoadingAll(true)
    blogsApi.list({ limit: 50 })
      .then((res) => setAllPosts(res.data || []))
      .catch(() => {})
      .finally(() => setLoadingAll(false))
  }

  useEffect(() => {
    loadCategories()
    loadStats()
  }, [])

  const handleTabChange = (t) => {
    setTab(t)
    setSuccessMsg('')
    setErrorMsg('')
    if (t === 'stats') loadStats()
    if (t === 'all') loadAllPosts()
  }

  const handleCoverChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setCoverFile(f)
    setCoverPreview(URL.createObjectURL(f))
  }

  const handleCreateCategory = async (e) => {
    e.preventDefault()
    if (!newCatName.trim()) return
    setCreatingCat(true)
    try {
      await blogsApi.createCategory({ name: newCatName.trim(), description: newCatDesc.trim() })
      setCategoryName(newCatName.trim())
      setNewCatName('')
      setNewCatDesc('')
      setShowNewCatModal(false)
      loadCategories()
    } catch (err) {
      alert(err.message || 'Impossible de créer la catégorie')
    } finally {
      setCreatingCat(false)
    }
  }

  const resetForm = () => {
    setEditingId(null)
    setTitle('')
    setContent('')
    setExcerpt('')
    setCoverFile(null)
    setCoverPreview('')
    setStatus('published')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!title.trim()) {
      setErrorMsg('Veuillez renseigner un titre pour votre article.')
      return
    }
    if (!content.trim() || content.trim() === '<p><br></p>') {
      setErrorMsg('Veuillez rédiger le contenu de votre article.')
      return
    }

    setSaving(true)
    try {
      const formData = new FormData()
      formData.append('title', title.trim())
      formData.append('content', content)
      formData.append('categoryName', categoryName)
      formData.append('excerpt', excerpt.trim())
      formData.append('status', status)
      if (coverFile) {
        formData.append('coverImage', coverFile)
      }

      if (editingId) {
        await blogsApi.update(editingId, formData)
        setSuccessMsg('Article mis à jour avec succès !')
      } else {
        await blogsApi.create(formData)
        setSuccessMsg('Article publié avec succès dans le blog !')
        resetForm()
      }
      loadStats()
    } catch (err) {
      setErrorMsg(err.message || "Erreur lors de l'enregistrement de l'article")
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (p) => {
    setEditingId(p._id)
    setTitle(p.title)
    setContent(p.content || '')
    setExcerpt(p.excerpt || '')
    setCategoryName(p.categoryName || 'Général')
    setCoverPreview(p.coverImage || '')
    setStatus(p.status || 'published')
    setTab('write')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet article de blog ?')) return
    try {
      await blogsApi.remove(id)
      loadStats()
      if (editingId === id) resetForm()
    } catch (err) {
      alert(err.message || 'Erreur lors de la suppression')
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 animate-in fade-in duration-200">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Newspaper size={18} />
            </span>
            <h1 className="text-xl font-bold text-gray-900">Espace Blog & Publications</h1>
          </div>
          <p className="text-xs text-gray-500">
            Publiez des articles pédagogiques, créez des thématiques et suivez l'engagement (vues, likes, commentaires).
          </p>
        </div>

        <Link
          to="/u/blogs"
          target="_blank"
          className="btn-ghost text-xs border border-gray-200 self-start sm:self-center flex items-center gap-1.5"
        >
          <ExternalLink size={13} /> Voir le blog public
        </Link>
      </div>

      {/* Barre d'onglets */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => handleTabChange('write')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 -mb-px flex items-center gap-1.5 transition-colors ${
            tab === 'write'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Plus size={15} /> {editingId ? "Modifier l'article" : 'Rédiger un article'}
        </button>
        <button
          onClick={() => handleTabChange('stats')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 -mb-px flex items-center gap-1.5 transition-colors ${
            tab === 'stats'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <BarChart2 size={15} /> Mes articles & Statistiques ({statsData?.stats?.totalArticles || 0})
        </button>
        <button
          onClick={() => handleTabChange('all')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 -mb-px flex items-center gap-1.5 transition-colors ${
            tab === 'all'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Newspaper size={15} /> Tous les articles du site
        </button>
      </div>

      {/* ── ONGLET 1 : RÉDIGER UN ARTICLE ── */}
      {tab === 'write' && (
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm space-y-6">
          {successMsg && (
            <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 size={16} className="text-green-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
          {errorMsg && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle size={16} className="text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Titre de l'article */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Titre de l'article *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: 5 méthodes efficaces pour mémoriser ses leçons en primaire"
              className="w-full text-base font-semibold border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white"
              required
            />
          </div>

          {/* Catégorie & Statut */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Catégorie
                </label>
                <button
                  type="button"
                  onClick={() => setShowNewCatModal(true)}
                  className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1"
                >
                  <FolderPlus size={13} /> Nouvelle catégorie
                </button>
              </div>
              <select
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                className="input text-sm w-full bg-gray-50"
              >
                {categories.map((c) => (
                  <option key={c._id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Statut de publication
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="input text-sm w-full bg-gray-50"
              >
                <option value="published">Publier immédiatement (Visible de tous)</option>
                <option value="draft">Brouillon (Non visible)</option>
              </select>
            </div>
          </div>

          {/* Image de couverture */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Image de couverture (affichée lors du partage sur WhatsApp/Facebook)
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <label className="cursor-pointer border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-2xl p-4 w-full sm:w-64 text-center bg-gray-50 hover:bg-blue-50/30 transition-all">
                <ImageIcon size={28} className="mx-auto text-gray-400 mb-2" />
                <span className="text-xs font-semibold text-gray-700 block">Choisir une image</span>
                <span className="text-[10px] text-gray-400 block mt-0.5">JPG, PNG, WebP</span>
                <input type="file" accept="image/*" onChange={handleCoverChange} className="hidden" />
              </label>

              {coverPreview && (
                <div className="relative h-28 w-44 rounded-xl overflow-hidden bg-slate-100 border border-gray-200 shrink-0 shadow-sm">
                  <img src={coverPreview} alt="Aperçu" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => { setCoverFile(null); setCoverPreview('') }}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 text-xs"
                    title="Supprimer l'image"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Résumé / Amorce */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Court résumé / Amorce (affiché avant le mur de connexion)
            </label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={2}
              placeholder="Courte phrase d'accroche qui suscite la curiosité du lecteur pour l'inciter à cliquer et créer son compte..."
              className="w-full text-xs sm:text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
            />
          </div>

          {/* Éditeur de texte riche WYSIWYG */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Corps de l'article (Éditeur riche) *
            </label>
            <RichTextEditor value={content} onChange={setContent} />
          </div>

          {/* Boutons d'action */}
          <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary text-sm px-6 py-3 justify-center"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {editingId ? "Mettre à jour l'article" : "Publier l'article"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="btn-ghost text-xs border border-gray-200"
              >
                Annuler la modification
              </button>
            )}
          </div>
        </form>
      )}

      {/* ── ONGLET 2 : MES ARTICLES & STATISTIQUES (KPIs) ── */}
      {tab === 'stats' && (
        <div className="space-y-6">
          {/* Cartes KPI */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="text-gray-400 text-xs font-semibold uppercase mb-1 flex items-center gap-1.5">
                <Newspaper size={14} className="text-blue-500" /> Articles
              </div>
              <div className="text-2xl font-extrabold text-gray-900">{statsData?.stats?.totalArticles || 0}</div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="text-gray-400 text-xs font-semibold uppercase mb-1 flex items-center gap-1.5">
                <Eye size={14} className="text-emerald-500" /> Total Vues
              </div>
              <div className="text-2xl font-extrabold text-emerald-600">{statsData?.stats?.totalViews || 0}</div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="text-gray-400 text-xs font-semibold uppercase mb-1 flex items-center gap-1.5">
                <Heart size={14} className="text-red-500" /> Total Likes
              </div>
              <div className="text-2xl font-extrabold text-red-600">{statsData?.stats?.totalLikes || 0}</div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="text-gray-400 text-xs font-semibold uppercase mb-1 flex items-center gap-1.5">
                <MessageSquare size={14} className="text-purple-500" /> Commentaires
              </div>
              <div className="text-2xl font-extrabold text-purple-600">{statsData?.stats?.totalComments || 0}</div>
            </div>
          </div>

          {/* Liste détaillée des articles de l'auteur */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4">
              Détail des performances par article
            </h2>

            {loadingStats ? (
              <div className="py-12 text-center text-gray-400 flex flex-col items-center gap-2">
                <Loader2 size={24} className="animate-spin text-blue-600" />
                <span className="text-xs">Chargement de vos statistiques...</span>
              </div>
            ) : (!statsData?.articles || statsData.articles.length === 0) ? (
              <div className="py-12 text-center text-gray-400">
                <Newspaper size={36} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">Vous n'avez pas encore rédigé d'article.</p>
                <button
                  onClick={() => setTab('write')}
                  className="btn-primary text-xs mt-3 inline-flex items-center gap-1.5"
                >
                  <Plus size={14} /> Rédiger mon premier article
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {statsData.articles.map((art) => (
                  <div key={art._id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {art.coverImage ? (
                        <img src={art.coverImage} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
                          <Newspaper size={20} />
                        </div>
                      )}
                      <div>
                        <Link to={`/u/blogs/${art.slug || art._id}`} target="_blank" className="font-bold text-gray-900 text-sm hover:text-blue-600 line-clamp-1">
                          {art.title}
                        </Link>
                        <div className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-[10px] text-gray-600 font-semibold">{art.categoryName}</span>
                          <span>•</span>
                          <span>{new Date(art.createdAt).toLocaleDateString('fr-FR')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 self-end sm:self-center">
                      <div className="flex items-center gap-3 text-xs text-gray-600 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                        <span className="flex items-center gap-1 font-semibold text-emerald-600" title="Vues">
                          <Eye size={13} /> {art.views}
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-red-600" title="Likes">
                          <Heart size={13} /> {art.likesCount}
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-purple-600" title="Commentaires">
                          <MessageSquare size={13} /> {art.commentsCount}
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-blue-600" title="Partages">
                          <Share2 size={13} /> {art.sharesCount}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(art)}
                          className="p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Modifier"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(art._id)}
                          className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ONGLET 3 : TOUS LES ARTICLES DE LA PLATEFORME ── */}
      {tab === 'all' && (
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-2">
            Tous les articles publiés sur KATD-SCHÜLE
          </h2>

          {loadingAll ? (
            <div className="py-12 text-center text-gray-400 flex flex-col items-center gap-2">
              <Loader2 size={24} className="animate-spin text-blue-600" />
              <span className="text-xs">Chargement des publications...</span>
            </div>
          ) : allPosts.length === 0 ? (
            <p className="text-xs text-gray-400 py-8 text-center">Aucun article publié pour le moment.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {allPosts.map((p) => (
                <div key={p._id} className="p-4 rounded-2xl border border-gray-100 bg-gray-50 hover:bg-blue-50/30 transition-all flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-100/60 px-2 py-0.5 rounded-full inline-block mb-1.5">
                      {p.categoryName}
                    </span>
                    <h3 className="font-bold text-gray-900 text-sm line-clamp-2">{p.title}</h3>
                    <p className="text-xs text-gray-500 line-clamp-2 mt-1">{p.excerpt}</p>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-200/60 flex items-center justify-between text-[11px] text-gray-400">
                    <span>Par {p.authorName}</span>
                    <Link to={`/u/blogs/${p.slug || p._id}`} target="_blank" className="text-blue-600 font-bold hover:underline flex items-center gap-0.5">
                      Voir <ArrowRight size={11} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modale de création rapide de catégorie */}
      {showNewCatModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="font-bold text-gray-900 text-base">Nouvelle catégorie de blog</h3>
            <form onSubmit={handleCreateCategory} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Nom de la catégorie *</label>
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Ex: Pédagogie, Orientation..."
                  className="input text-sm w-full"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Description (optionnelle)</label>
                <textarea
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  placeholder="Brève description..."
                  rows={2}
                  className="input text-xs w-full"
                />
              </div>
              <div className="flex gap-2 pt-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowNewCatModal(false)}
                  className="btn-ghost text-xs border border-gray-200"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creatingCat || !newCatName.trim()}
                  className="btn-primary text-xs"
                >
                  {creatingCat ? 'Création...' : 'Créer la catégorie'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
