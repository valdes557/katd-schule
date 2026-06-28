const ASSET = import.meta.env.VITE_API_URL || ''
const asset = (u) => (!u ? '' : u.startsWith('http') ? u : ASSET + u)

function MediaCard({ item, me, onDeleted }) {
  const myId = me?.id || me?._id
  const [likes, setLikes] = useState(item.stats?.likes ?? 0)
  const [liked, setLiked] = useState((item.likedBy || []).map(String).includes(String(myId)))
  const [shares, setShares] = useState(item.stats?.shares ?? 0)
  const [downloads, setDownloads] = useState(item.stats?.downloads ?? 0)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [commentCount, setCommentCount] = useState(item.stats?.comments ?? 0)
  const [expanded, setExpanded] = useState(false)

  const author = item.uploadedBy && typeof item.uploadedBy === 'object' ? item.uploadedBy : null
  const file = (item.files && item.files[0]) || {}
  const isOwner = author && String(author._id) === String(myId)

  const toggleLike = async () => {
    setLiked((v) => !v)
    setLikes((n) => (liked ? n - 1 : n + 1))
    try { await mediaApi.like(item._id) } catch { /* ignore */ }
  }
  const loadComments = async () => {
    setShowComments((v) => !v)
    if (!showComments) {
      try { const r = await mediaApi.getComments(item._id); setComments(r.data || r || []) } catch { /* ignore */ }
    }
  }
  const submitComment = async (e) => {
    e.preventDefault()
    if (!commentText.trim()) return
    try {
      const r = await mediaApi.comment(item._id, commentText.trim())
      const c = r.data || r
      setComments((list) => [...list, c])
      setCommentCount((n) => n + 1)
      setCommentText('')
    } catch { /* ignore */ }
  }
  const doShare = async () => {
    try { await mediaApi.share(item._id); setShares((n) => n + 1) } catch { /* ignore */ }
    const url = asset(file.url)
    if (navigator.share) { try { await navigator.share({ title: item.title, url }) } catch { /* ignore */ } }
    else { try { await navigator.clipboard.writeText(url) } catch { /* ignore */ } }
  }
  const doDownload = async () => {
    try { await mediaApi.download(item._id); setDownloads((n) => n + 1) } catch { /* ignore */ }
    const a = document.createElement('a')
    a.href = asset(file.url); a.download = file.filename || item.title || 'media'
    document.body.appendChild(a); a.click(); a.remove()
  }
  const doDelete = async () => {
    if (!confirm('Supprimer cette publication ?')) return
    try { await mediaApi.remove(item._id); onDeleted(item._id) } catch (e) { alert(e.message) }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4 overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold overflow-hidden">
          {author?.avatar ? <img src={asset(author.avatar)} alt="" className="w-full h-full object-cover" /> : (author?.name || '?').charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{author?.name || 'Utilisateur'}</p>
          <p className="text-xs text-gray-400">{new Date(item.createdAt).toLocaleString('fr-FR')}</p>
        </div>
        {isOwner && (
          <button onClick={doDelete} className="text-gray-400 hover:text-red-600" title="Supprimer"><Trash2 size={18} /></button>
        )}
      </div>

      {(item.title || item.description) && (
        <div className="px-4 pb-3">
          {item.title && <p className="font-medium text-gray-900">{item.title}</p>}
          {item.description && (
            <div className="text-sm text-gray-600 mt-0.5">
              <p className={expanded ? 'whitespace-pre-wrap break-words' : 'whitespace-pre-wrap break-words line-clamp-3'}>
                {item.description}
              </p>
              {item.description.length > 140 && (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="mt-1 text-blue-600 font-medium text-xs hover:underline"
                >
                  {expanded ? 'Lire moins' : 'Lire plus'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {file.url && (
        <div className="bg-black/5">
          {item.type === 'photo' && <img src={asset(file.url)} alt={item.title} className="w-full max-h-[480px] object-contain" />}
          {item.type === 'video' && <video src={asset(file.url)} controls className="w-full max-h-[480px]" />}
          {item.type === 'audio' && <audio src={asset(file.url)} controls className="w-full p-4" />}
        </div>
      )}

      <div className="flex items-center justify-around px-2 py-2 border-t border-gray-50 text-sm">
        <button onClick={toggleLike} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 ${liked ? 'text-red-600' : 'text-gray-600'}`}>
          <Heart size={18} fill={liked ? 'currentColor' : 'none'} /> {likes}
        </button>
        <button onClick={loadComments} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-gray-600">
          <MessageCircle size={18} /> {commentCount}
        </button>
        <button onClick={doShare} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-gray-600">
          <Share2 size={18} /> {shares}
        </button>
        <button onClick={doDownload} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-gray-600">
          <Download size={18} /> {downloads}
        </button>
      </div>

      {showComments && (
        <div className="border-t border-gray-50 p-4 space-y-3">
          {comments.length === 0 && <p className="text-xs text-gray-400">Aucun commentaire pour le moment.</p>}
          {comments.map((c) => (
            <div key={c._id} className="flex gap-2 text-sm">
              <span className="font-medium text-gray-800">{(c.author || c.user)?.name || 'Utilisateur'}</span>
              <span className="text-gray-600">{c.text}</span>
            </div>
          ))}
          <form onSubmit={submitComment} className="flex items-center gap-2 pt-1">
            <input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Écrire un commentaire..." className="input flex-1" />
            <button type="submit" className="text-blue-600 p-2 hover:bg-blue-50 rounded-lg"><Send size={18} /></button>
          </form>
        </div>
      )}
    </div>
  )
}

export default function UserSocialPage() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await mediaApi.list('limit=50'); setItems(r.data || r.media || r || []) }
    catch { setItems([]) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Fil social</h1>
        <Link to="/u/publier" className="btn-primary flex items-center gap-1.5 text-sm">
          <PlusCircle size={18} /> Publier
        </Link>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-10">Chargement...</p>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ImageIcon size={40} className="mx-auto mb-3 opacity-50" />
          <p>Aucune publication pour l'instant.</p>
          <Link to="/u/publier" className="text-blue-600 font-medium text-sm">Soyez le premier à publier</Link>
        </div>
      ) : (
        items.map((it) => <MediaCard key={it._id} item={it} me={user} onDeleted={(id) => setItems((l) => l.filter((x) => x._id !== id))} />)
      )}
    </div>
  )
}