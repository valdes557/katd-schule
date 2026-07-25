import { useState, useEffect, useRef, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import { ArrowLeft, Circle, Send, Search, Smile, Paperclip, Mic, Check, CheckCheck, MoreVertical, Trash2, Ban, SquarePen, X } from 'lucide-react'
import { messagesApi } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { assertVideoWithinLimit } from '../../lib/videoValidation'
import { uploadToCloudinary } from '../../lib/cloudinaryUpload'

const ASSET = import.meta.env.VITE_API_URL || ''
const asset = (u) => (!u ? '' : u.startsWith('http') ? u : ASSET + u)

const ROLE_LABEL = {
  utilisateur: 'Utilisateur', super_admin: 'Admin', directeur: 'Directeur',
  enseignant: 'Enseignant', parent: 'Parent', eleve: 'Élève',
}

// Aperçu du dernier message d'une conversation (style Messenger).
function preview(m) {
  if (!m) return ''
  if (m.type === 'voice') return '🎤 Message vocal'
  if (m.type === 'image') return '📷 Photo'
  if (m.type === 'video') return '🎬 Vidéo'
  if (m.deletedForEveryone) return '🚫 Message supprimé'
  if (m.type === 'sticker') return m.mediaUrl
  return m.body || ''
}

// Heure relative courte.
function timeShort(date) {
  if (!date) return ''
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'à l’instant'
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days} j`
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

export default function UserMessengerPage() {
  const { user } = useAuth()
  const { refreshBadges } = useOutletContext() || {}
  const myId = String(user?.id || user?._id || '')
  const [users, setUsers] = useState([])
  const [conversations, setConversations] = useState([])
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(null)
  // Mode « Nouveau message » : affiche la liste de TOUS les utilisateurs pour démarrer
  // une nouvelle conversation (restaure l'option retirée quand on est passé à la vue
  // « conversations récentes »).
  const [compose, setCompose] = useState(false)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [recording, setRecording] = useState(false)
  const [recSeconds, setRecSeconds] = useState(0)
  const [showStickers, setShowStickers] = useState(false)
  const [sending, setSending] = useState(false)
  const [menuMsgId, setMenuMsgId] = useState(null)
  const endRef = useRef(null)
  const scrollRef = useRef(null)
  const atBottomRef = useRef(true)
  const lastCountRef = useRef(0)
  const fileRef = useRef(null)
  const mediaRef = useRef(null)
  const chunksRef = useRef([])
  const recTimerRef = useRef(null)

  const convId = useCallback((otherId) => {
    const ids = [myId, String(otherId)].sort()
    return `conv_${ids[0]}_${ids[1]}`
  }, [myId])

  // Table des utilisateurs par id (pour enrichir avatar / statut en ligne).
  const usersById = {}
  for (const u of users) usersById[String(u._id)] = u

  // Map userId -> conversationId RÉEL d'une discussion existante. Permet, quand on
  // démarre un fil depuis la recherche / le sélecteur, de viser la vraie conversation
  // (donc afficher les messages reçus ET marquer « lu » -> le compteur se décrémente).
  const convIdByUser = {}
  for (const c of conversations) {
    const cid = c.contact && c.contact._id
    if (cid) convIdByUser[String(cid)] = c.conversationId
  }

  const loadUsers = useCallback(async () => {
    try { const r = await messagesApi.allUsers(); setUsers(r.data || r || []) } catch { /* garde l'existant */ }
  }, [])

  const loadConversations = useCallback(async () => {
    try {
      const r = await messagesApi.conversations()
      // On ne garde que les discussions 1-1 (les utilisateurs n'ont pas de groupes).
      setConversations((r.data || []).filter((c) => !c.isGroup))
    } catch { /* garde l'existant */ }
  }, [])

  const loadThread = useCallback(async (other) => {
    if (!other) return
    // Utilise l'ID de conversation RÉEL fourni par la liste si dispo (évite tout
    // décalage avec un ID recalculé -> sinon messages reçus invisibles + compteur figé).
    const cid = other.conversationId || convId(other._id)
    try { const r = await messagesApi.conversation(cid); setMessages(r.data || r.messages || r || []) }
    catch { setMessages([]) }
    // L'ouverture marque les messages comme lus côté serveur -> on rafraîchit compteurs + liste.
    refreshBadges?.()
    loadConversations()
  }, [convId, refreshBadges, loadConversations])

  // Chargement initial.
  useEffect(() => {
    (async () => { await Promise.all([loadUsers(), loadConversations()]); setLoading(false) })()
  }, [loadUsers, loadConversations])

  // Rafraîchit la liste des conversations + présence régulièrement (fait remonter
  // toute nouvelle conversation en tête, façon Messenger).
  useEffect(() => {
    const t = setInterval(() => { loadUsers(); loadConversations() }, 5000)
    return () => clearInterval(t)
  }, [loadUsers, loadConversations])

  // Rafraîchit le fil de discussion ouvert.
  useEffect(() => {
    if (!active) return
    loadThread(active)
    const t = setInterval(() => loadThread(active), 5000)
    return () => clearInterval(t)
  }, [active, loadThread])

  // (3) Auto-scroll uniquement au 1er chargement du fil, ou quand un nouveau message
  // arrive alors qu'on est déjà en bas. Évite que l'inbox « refuie » vers le bas à chaque
  // rechargement (polling 5s) pendant qu'on lit d'anciens messages.
  useEffect(() => {
    const count = messages.length
    const isFirst = lastCountRef.current === 0 && count > 0
    const grew = count > lastCountRef.current
    lastCountRef.current = count
    if (isFirst) { endRef.current?.scrollIntoView(); return }
    if (grew && atBottomRef.current) { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }
  }, [messages])

  // Réinitialise le suivi de scroll à l'ouverture d'un fil.
  useEffect(() => { lastCountRef.current = 0; atBottomRef.current = true }, [active])

  const onScrollThread = () => {
    const el = scrollRef.current
    if (!el) return
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  const send = async (e) => {
    e.preventDefault()
    if (!text.trim() || !active) return
    const body = text.trim()
    setText('')
    setMessages((m) => [...m, { _id: 'tmp' + Date.now(), body, type: 'text', sender: myId, createdAt: new Date().toISOString(), _optimistic: true }])
    try { await messagesApi.send({ recipientId: active._id, body, type: 'text' }) } catch (err) { alert(err.message) }
    loadThread(active)
    loadConversations()
  }

  // Envoi d'un média (image, vidéo, vocal) ou d'un sticker
  const sendMedia = async ({ type, mediaUrl, mediaDuration, body }) => {
    if (!active) return
    setSending(true)
    setMessages((m) => [...m, { _id: 'tmp' + Date.now(), type, mediaUrl, mediaDuration, body: body || '', sender: myId, createdAt: new Date().toISOString(), _optimistic: true }])
    try { await messagesApi.send({ recipientId: active._id, type, mediaUrl, mediaDuration: mediaDuration || 0, body: body || '' }) } catch (err) { alert(err.message) }
    setSending(false)
    loadThread(active)
    loadConversations()
  }

  const onPickFile = async (e) => {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!file) return
    const isVideo = file.type.startsWith('video')
    const isImage = file.type.startsWith('image')
    if (!isVideo && !isImage) { alert('Seules les images et vidéos sont acceptées.'); return }
    if (isVideo) { try { await assertVideoWithinLimit(file) } catch (err) { alert(err.message); return } }
    setSending(true)
    try {
      // Upload DIRECT à Cloudinary (plus de limite 25 Mo ni de base64 lourd).
      const up = await uploadToCloudinary(file, { resourceType: isVideo ? 'video' : 'image' })
      await sendMedia({ type: isVideo ? 'video' : 'image', mediaUrl: up.secureUrl })
    } catch (err) { alert(err.message) }
    setSending(false)
  }

  // Suppression façon WhatsApp. scope: 'me' | 'everyone'
  const handleDelete = async (m, scope) => {
    setMenuMsgId(null)
    try {
      await messagesApi.remove(m._id, scope)
      if (scope === 'everyone') {
        setMessages((prev) => prev.map((x) => (x._id === m._id ? { ...x, deleted: true, deletedForEveryone: true, body: '', mediaUrl: '', type: 'text' } : x)))
      } else {
        setMessages((prev) => prev.filter((x) => x._id !== m._id))
      }
      loadConversations()
    } catch (err) { alert(err.message) }
  }

  const startRec = async () => {
    try {
      // (4) Qualité audio : réduction d'écho/bruit + gain auto, mono, 128 kbps opus.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      })
      let mr
      try { mr = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128000 }) }
      catch { mr = new MediaRecorder(stream) }
      chunksRef.current = []
      mr.ondataavailable = (ev) => { if (ev.data.size > 0) chunksRef.current.push(ev.data) }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const dur = recSeconds
        const reader = new FileReader()
        reader.onload = () => sendMedia({ type: 'voice', mediaUrl: reader.result, mediaDuration: dur })
        reader.readAsDataURL(blob)
        stream.getTracks().forEach((t) => t.stop())
      }
      mediaRef.current = mr
      mr.start()
      setRecording(true)
      setRecSeconds(0)
      recTimerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000)
    } catch (err) { alert("Micro inaccessible : " + err.message) }
  }

  const stopRec = (cancel) => {
    clearInterval(recTimerRef.current)
    setRecording(false)
    const mr = mediaRef.current
    if (!mr) return
    if (cancel) { mr.onstop = () => mr.stream && mr.stream.getTracks().forEach((t) => t.stop()) }
    mr.stop()
  }

  const STICKERS = ['😀','😂','😍','👍','🙏','🎉','❤️','😎','😢','🔥','👏','🤔','😴','🥳','💯','✅']
  const sendSticker = (emoji) => { setShowStickers(false); sendMedia({ type: 'sticker', mediaUrl: emoji }) }

  const senderId = (m) => String((m.sender && m.sender._id) || m.sender || '')

  // Ouvre un fil : on enrichit le contact avec avatar / statut depuis la liste des users.
  // conversationId (optionnel) = l'ID RÉEL de la conversation existante (depuis la liste).
  const openThread = (contact, conversationId) => {
    const u = usersById[String(contact._id)]
    // Si aucun conversationId explicite, on retrouve celui d'une discussion existante.
    const cid = conversationId || convIdByUser[String(contact._id)]
    setActive({ ...contact, conversationId: cid, avatar: contact.avatar || u?.avatar || '', online: u?.online ?? contact.online ?? false })
    setMessages([])
    setQuery('')
    setCompose(false)
  }

  // Liste affichée : soit la liste des utilisateurs (recherche OU « Nouveau message »),
  // soit les conversations récentes.
  const searching = query.trim().length > 0
  const filteredUsers = users.filter((u) => u.name?.toLowerCase().includes(query.toLowerCase()))
  const showUsers = searching || compose
  const listUsers = searching ? filteredUsers : users

  // Vue conversation (mobile : remplace la liste)
  if (active) {
    return (
      <div className="flex flex-col h-[calc(100vh-7rem)]">
        <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
          <button onClick={() => setActive(null)} className="text-gray-500"><ArrowLeft size={20} /></button>
          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold overflow-hidden">
            {active.avatar ? <img src={asset(active.avatar)} alt="" className="w-full h-full object-cover" /> : (active.name || '?').charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm leading-tight">{active.name || 'Utilisateur'}</p>
            <p className={`text-xs flex items-center gap-1 ${active.online ? 'text-green-600' : 'text-gray-400'}`}>
              <Circle size={8} fill="currentColor" /> {active.online ? 'En ligne' : 'Hors ligne'}
            </p>
          </div>
        </div>

        <div ref={scrollRef} onScroll={onScrollThread} className="flex-1 overflow-y-auto py-4 space-y-2">
          {messages.length === 0 && <p className="text-center text-gray-400 text-sm mt-8">Démarrez la conversation 👋</p>}
          {messages.map((m) => {
            const mine = senderId(m) === myId
            const deleted = m.deleted || m.deletedForEveryone
            const menuOpen = menuMsgId === m._id
            const deleteMenu = m._optimistic ? null : (
              <div className="relative flex-shrink-0 self-center">
                <button onClick={() => setMenuMsgId(menuOpen ? null : m._id)} title="Options" className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-gray-700"><MoreVertical size={15} /></button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuMsgId(null)} />
                    <div className={`absolute z-20 top-full mt-1 w-56 bg-white rounded-lg shadow-xl border border-gray-100 py-1 text-sm ${mine ? 'right-0' : 'left-0'}`}>
                      <button onClick={() => handleDelete(m, 'me')} className="w-full text-left px-3 py-2 hover:bg-gray-50 text-gray-700 flex items-center gap-2"><Trash2 size={14} /> Supprimer pour moi</button>
                      {mine && !deleted && (
                        <button onClick={() => handleDelete(m, 'everyone')} className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2"><Trash2 size={14} /> Supprimer pour tout le monde</button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
            const tick = mine && !m._optimistic && !deleted ? (
              m.read ? <CheckCheck size={13} className="text-blue-500" title="Lu" /> : <Check size={13} className="text-gray-400" title="Envoyé" />
            ) : null
            return (
              <div key={m._id} className={`group flex items-end gap-1 ${mine ? 'justify-end' : 'justify-start'} ${m._optimistic ? 'opacity-60' : ''}`}>
                {mine && deleteMenu}
                <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'} max-w-[80%]`}>
                  {deleted ? (
                    <div className={`px-3 py-2 rounded-2xl text-sm italic flex items-center gap-1.5 ${mine ? 'bg-blue-100 text-blue-500 rounded-br-sm' : 'bg-gray-100 text-gray-400 rounded-bl-sm'}`}>
                      <Ban size={13} /> Ce message a été supprimé
                    </div>
                  ) : m.type === 'sticker' ? (
                    <div className="text-5xl select-none">{m.mediaUrl}</div>
                  ) : m.type === 'voice' && m.mediaUrl ? (
                    <div className={`p-1 rounded-2xl flex items-center gap-2 ${mine
                      ? 'bg-gradient-to-br from-indigo-600 to-violet-600 rounded-br-sm'
                      : 'bg-gradient-to-br from-indigo-100 to-violet-100 rounded-bl-sm'}`}>
                      <audio src={asset(m.mediaUrl)} controls className="h-8 max-w-[190px]" />
                      {m.mediaDuration > 0 && <span className={`text-[11px] pr-1.5 ${mine ? 'text-white/80' : 'text-indigo-700/70'}`}>{m.mediaDuration}s</span>}
                    </div>
                  ) : (
                    <div className={`px-3 py-2 rounded-2xl text-sm ${mine ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                      {m.type === 'image' && m.mediaUrl && (
                        <img src={asset(m.mediaUrl)} alt="" className="rounded-lg max-w-full max-h-60 object-cover" />
                      )}
                      {m.type === 'video' && m.mediaUrl && (
                        <video src={asset(m.mediaUrl)} controls className="rounded-lg max-w-full max-h-60" />
                      )}
                      {m.body && <div className={m.type && m.type !== 'text' ? 'mt-1' : ''}>{m.body}</div>}
                    </div>
                  )}
                  {tick && <span className="mt-0.5">{tick}</span>}
                </div>
                {!mine && deleteMenu}
              </div>
            )
          })}
          <div ref={endRef} />
        </div>

        {showStickers && (
          <div className="grid grid-cols-8 gap-1 p-2 border-t border-gray-100 bg-gray-50">
            {STICKERS.map((s) => (
              <button key={s} type="button" onClick={() => sendSticker(s)} className="text-2xl hover:scale-125 transition">{s}</button>
            ))}
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*,video/*" onChange={onPickFile} className="hidden" />
        {recording ? (
          <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
            <span className="flex items-center gap-2 text-red-600 text-sm font-medium"><span className="w-3 h-3 rounded-full bg-red-600 animate-pulse" /> Enregistrement… {recSeconds}s</span>
            <div className="flex-1" />
            <button type="button" onClick={() => stopRec(true)} className="btn-ghost border border-gray-200 px-3 text-sm">Annuler</button>
            <button type="button" onClick={() => stopRec(false)} className="btn-primary px-4 text-sm">Envoyer</button>
          </div>
        ) : (
        <form onSubmit={send} className="flex items-center gap-1.5 pt-2 border-t border-gray-100">
          <button type="button" onClick={() => setShowStickers((v) => !v)} className="p-2 text-gray-500 hover:text-indigo-600" title="Stickers"><Smile size={18} /></button>
          <button type="button" onClick={() => fileRef.current?.click()} className="p-2 text-gray-500 hover:text-indigo-600" title="Photo ou vidéo"><Paperclip size={18} /></button>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Votre message..." className="input flex-1" disabled={sending} />
          {text.trim() ? (
            <button type="submit" className="btn-primary px-4"><Send size={16} /></button>
          ) : (
            <button type="button" onClick={startRec} className="btn-primary px-3" title="Message vocal"><Mic size={16} /></button>
          )}
        </form>
        )}
      </div>
    )
  }

  // Liste : conversations récentes (façon Messenger) + recherche pour démarrer une discussion.
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-xl font-bold text-gray-900">Messagerie</h1>
        {compose ? (
          <button onClick={() => { setCompose(false); setQuery('') }} className="btn-ghost text-sm border border-gray-200"><X size={15} /> Annuler</button>
        ) : (
          <button onClick={() => { setCompose(true); setQuery('') }} className="btn-primary text-sm"><SquarePen size={15} /> Nouveau message</button>
        )}
      </div>
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={compose ? 'Rechercher un destinataire...' : 'Rechercher un utilisateur...'} className="input pl-9 w-full" />
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-10">Chargement...</p>
      ) : showUsers ? (
        listUsers.length === 0 ? (
          <p className="text-center text-gray-400 py-10">Aucun utilisateur trouvé.</p>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {listUsers.map((u) => (
              <button key={u._id} onClick={() => openThread(u, convIdByUser[String(u._id)])} className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-left">
                <div className="relative">
                  <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold overflow-hidden">
                    {u.avatar ? <img src={asset(u.avatar)} alt="" className="w-full h-full object-cover" /> : (u.name || '?').charAt(0).toUpperCase()}
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
        )
      ) : conversations.length === 0 ? (
        <div className="text-center text-gray-400 py-16">
          <p>Aucune discussion pour le moment.</p>
          <p className="text-xs mt-1">Appuyez sur « Nouveau message » pour démarrer une conversation.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
          {conversations.map((c) => {
            const contact = c.contact || {}
            const u = usersById[String(contact._id)]
            const avatar = contact.avatar || u?.avatar || ''
            const online = u?.online || false
            const last = c.lastMessage
            const unreadInc = c.unread > 0
            return (
              <button key={c.conversationId} onClick={() => openThread(contact, c.conversationId)} className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-left">
                <div className="relative">
                  <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold overflow-hidden">
                    {avatar ? <img src={asset(avatar)} alt="" className="w-full h-full object-cover" /> : (contact.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${online ? 'bg-green-500' : 'bg-gray-300'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm truncate ${unreadInc ? 'font-bold text-gray-900' : 'font-medium text-gray-900'}`}>{contact.name || 'Utilisateur'}</p>
                    <span className="text-[11px] text-gray-400 flex-shrink-0">{timeShort(last?.createdAt)}</span>
                  </div>
                  <p className={`text-xs truncate ${unreadInc ? 'text-gray-800 font-semibold' : 'text-gray-400'}`}>
                    {senderId(last) === myId ? 'Vous : ' : ''}{preview(last)}
                  </p>
                </div>
                {unreadInc && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                    {c.unread > 9 ? '9+' : c.unread}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
