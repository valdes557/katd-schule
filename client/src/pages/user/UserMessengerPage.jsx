const ASSET = import.meta.env.VITE_API_URL || ''
const asset = (u) => (!u ? '' : u.startsWith('http') ? u : ASSET + u)

const ROLE_LABEL = {
  utilisateur: 'Utilisateur', super_admin: 'Admin', directeur: 'Directeur',
  enseignant: 'Enseignant', parent: 'Parent', eleve: 'Élève',
}

export default function UserMessengerPage() {
  const { user } = useAuth()
  const myId = String(user?.id || user?._id || '')
  const [users, setUsers] = useState([])
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const endRef = useRef(null)

  const convId = useCallback((otherId) => {
    const ids = [myId, String(otherId)].sort()
    return `conv_${ids[0]}_${ids[1]}`
  }, [myId])

  const loadUsers = useCallback(async () => {
    try { const r = await messagesApi.allUsers(); setUsers(r.data || r || []) } catch { setUsers([]) }
    setLoading(false)
  }, [])

  const loadThread = useCallback(async (other) => {
    if (!other) return
    try { const r = await messagesApi.conversation(convId(other._id)); setMessages(r.data || r.messages || r || []) }
    catch { setMessages([]) }
  }, [convId])

  useEffect(() => { loadUsers() }, [loadUsers])
  // Rafraîchit la liste (présence) régulièrement
  useEffect(() => { const t = setInterval(loadUsers, 20000); return () => clearInterval(t) }, [loadUsers])
  // Rafraîchit le fil de discussion ouvert
  useEffect(() => {
    if (!active) return
    loadThread(active)
    const t = setInterval(() => loadThread(active), 5000)
    return () => clearInterval(t)
  }, [active, loadThread])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async (e) => {
    e.preventDefault()
    if (!text.trim() || !active) return
    const body = text.trim()
    setText('')
    setMessages((m) => [...m, { _id: 'tmp' + Date.now(), body, sender: myId, createdAt: new Date().toISOString(), _optimistic: true }])
    try { await messagesApi.send({ recipientId: active._id, body }) } catch (err) { alert(err.message) }
    loadThread(active)
  }

  const senderId = (m) => String((m.sender && m.sender._id) || m.sender || '')
  const filtered = users.filter((u) => u.name?.toLowerCase().includes(query.toLowerCase()))

  // Vue conversation (mobile : remplace la liste)
  if (active) {
    return (
      <div className="flex flex-col h-[calc(100vh-7rem)]">
        <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
          <button onClick={() => setActive(null)} className="text-gray-500"><ArrowLeft size={20} /></button>
          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold overflow-hidden">
            {active.avatar ? <img src={asset(active.avatar)} alt="" className="w-full h-full object-cover" /> : active.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm leading-tight">{active.name}</p>
            <p className={`text-xs flex items-center gap-1 ${active.online ? 'text-green-600' : 'text-gray-400'}`}>
              <Circle size={8} fill="currentColor" /> {active.online ? 'En ligne' : 'Hors ligne'}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-2">
          {messages.length === 0 && <p className="text-center text-gray-400 text-sm mt-8">Démarrez la conversation 👋</p>}
          {messages.map((m) => {
            const mine = senderId(m) === myId
            return (
              <div key={m._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${mine ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                  {m.body}
                </div>
              </div>
            )
          })}
          <div ref={endRef} />
        </div>

        <form onSubmit={send} className="flex items-center gap-2 pt-2 border-t border-gray-100">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Votre message..." className="input flex-1" />
          <button type="submit" className="btn-primary px-4"><Send size={18} /></button>
        </form>
      </div>
    )
  }

  // Liste des utilisateurs
  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-4">Messagerie</h1>
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un utilisateur..." className="input pl-9 w-full" />
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-10">Chargement...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-gray-400 py-10">Aucun utilisateur trouvé.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
          {filtered.map((u) => (
            <button key={u._id} onClick={() => setActive(u)} className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-left">
              <div className="relative">
                <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold overflow-hidden">
                  {u.avatar ? <img src={asset(u.avatar)} alt="" className="w-full h-full object-cover" /> : u.name.charAt(0).toUpperCase()}
                </div>
                <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${u.online ? 'bg-green-500' : 'bg-gray-300'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm truncate">{u.name}</p>
                <p className="text-xs text-gray-400">{ROLE_LABEL[u.role] || u.role}</p>
              </div>
              <span className={`text-xs ${u.online ? 'text-green-600' : 'text-gray-400'}`}>{u.online ? 'En ligne' : 'Hors ligne'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
