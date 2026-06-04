import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { schoolPagesApi } from '../lib/api'
import { Loader2, Bell, Plus, Trash2 } from 'lucide-react'

export default function AnnoncesPage() {
  const { user, school } = useAuth()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: '', content: '' })

  const isDirector = user?.role === 'directeur'
  const schoolId = school?._id || school?.id || user?.school

  const loadPosts = async () => {
    if (!schoolId) {
      setPosts([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await schoolPagesApi.getPosts(schoolId, 1)
      setPosts(res.data || [])
    } catch (err) {
      console.error(err)
      setPosts([])
    }
    setLoading(false)
  }

  useEffect(() => { loadPosts() }, [schoolId])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!schoolId || !form.content.trim()) return
    setCreating(true)
    try {
      const fd = new FormData()
      if (form.title) fd.append('title', form.title)
      fd.append('content', form.content)
      await schoolPagesApi.createPost(schoolId, fd)
      setForm({ title: '', content: '' })
      loadPosts()
    } catch (err) { console.error(err) }
    setCreating(false)
  }

  const handleDelete = async (id) => {
    if (!isDirector) return
    try {
      await schoolPagesApi.deletePost(id)
      setPosts((prev) => prev.filter((p) => p._id !== id))
    } catch (err) { console.error(err) }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Bell size={22} className="text-indigo-600" /> Annonces de l'école
        </h1>
        {isDirector && (
          <form onSubmit={handleCreate} className="card p-3 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Titre (optionnel)"
              className="input text-xs sm:text-sm flex-1"
            />
            <input
              required
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Votre annonce..."
              className="input text-xs sm:text-sm flex-[2]"
            />
            <button
              type="submit"
              disabled={creating || !form.content.trim()}
              className="btn-primary text-xs sm:text-sm whitespace-nowrap flex items-center gap-1 px-3"
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Publier
            </button>
          </form>
        )}
      </div>

      {!schoolId && (
        <div className="card p-5 text-sm text-gray-500">
          Aucune école n'est associée à votre compte. Contactez l'administration.
        </div>
      )}

      <div className="card p-5">
        {loading ? (
          <div className="py-12 text-center">
            <Loader2 size={24} className="animate-spin mx-auto text-blue-600" />
          </div>
        ) : posts.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Aucune annonce publiée pour le moment.</p>
        ) : (
          <div className="space-y-4">
            {posts.map((p) => (
              <div key={p._id} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900 truncate">{p.title || 'Annonce'}</h2>
                      <p className="text-[11px] text-gray-400">
                        {new Date(p.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    {isDirector && (
                      <button
                        type="button"
                        onClick={() => handleDelete(p._id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 flex-shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-700 mt-1 whitespace-pre-line">{p.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
