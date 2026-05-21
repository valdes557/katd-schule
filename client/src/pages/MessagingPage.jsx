import { useEffect, useState } from 'react'
import { MessageSquare, Send, Plus, Search, ArrowLeft, Loader2, X, Users } from 'lucide-react'
import { messagesApi } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { cn } from '../lib/utils'

export default function MessagingPage() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [contacts, setContacts] = useState([])
  const [activeConv, setActiveConv] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [showCompose, setShowCompose] = useState(false)
  const [composeForm, setComposeForm] = useState({ recipientId: '', subject: '', body: '' })
  const [search, setSearch] = useState('')

  const fetchConversations = async () => {
    setLoading(true)
    try {
      const res = await messagesApi.conversations()
      setConversations(res.data || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const fetchContacts = async () => {
    try {
      const res = await messagesApi.contacts()
      setContacts(res.data || [])
    } catch (e) {}
  }

  useEffect(() => { fetchConversations(); fetchContacts() }, [])

  const openConversation = async (conv) => {
    setActiveConv(conv)
    setLoadingMsgs(true)
    try {
      const res = await messagesApi.conversation(conv.conversationId)
      setMessages(res.data || [])
    } catch (e) { console.error(e) }
    setLoadingMsgs(false)
  }

  const handleSendReply = async () => {
    if (!reply.trim() || !activeConv) return
    setSending(true)
    try {
      await messagesApi.send({
        recipientId: activeConv.contact?._id,
        subject: activeConv.lastMessage?.subject || '',
        body: reply,
      })
      setReply('')
      const res = await messagesApi.conversation(activeConv.conversationId)
      setMessages(res.data || [])
      fetchConversations()
    } catch (e) { alert(e.message) }
    setSending(false)
  }

  const handleCompose = async (e) => {
    e.preventDefault()
    setSending(true)
    try {
      await messagesApi.send(composeForm)
      setShowCompose(false)
      setComposeForm({ recipientId: '', subject: '', body: '' })
      fetchConversations()
    } catch (e) { alert(e.message) }
    setSending(false)
  }

  const filteredConvs = conversations.filter((c) => {
    if (!search) return true
    const name = c.contact?.name || ''
    const subj = c.lastMessage?.subject || ''
    return `${name} ${subj}`.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <MessageSquare size={22} className="text-indigo-600" /> Messagerie
        </h1>
        <button onClick={() => setShowCompose(true)} className="btn-primary text-sm self-start">
          <Plus size={15} /> Nouveau message
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5" style={{ minHeight: 500 }}>
        {/* Conversations list */}
        <div className={cn('card overflow-hidden flex flex-col', activeConv && 'hidden lg:flex')}>
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..." className="input pl-9 text-sm" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="text-center py-12"><Loader2 size={20} className="animate-spin mx-auto text-blue-600" /></div>
            ) : filteredConvs.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-12">Aucune conversation</p>
            ) : (
              filteredConvs.map((c) => (
                <button
                  key={c.conversationId}
                  onClick={() => openConversation(c)}
                  className={cn(
                    'w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors',
                    activeConv?.conversationId === c.conversationId && 'bg-blue-50'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900 truncate">{c.contact?.name || 'Inconnu'}</span>
                    {c.unread > 0 && <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{c.unread}</span>}
                  </div>
                  <div className="text-xs text-gray-500 truncate mt-0.5">{c.lastMessage?.subject || c.lastMessage?.body?.slice(0, 50)}</div>
                  <div className="text-[10px] text-gray-400 mt-1">{new Date(c.lastMessage?.createdAt).toLocaleDateString('fr-FR')}</div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Conversation detail */}
        <div className={cn('card lg:col-span-2 flex flex-col overflow-hidden', !activeConv && 'hidden lg:flex')}>
          {!activeConv ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              <div className="text-center">
                <MessageSquare size={40} className="mx-auto mb-3 opacity-20" />
                <p>Sélectionnez une conversation</p>
              </div>
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                <button onClick={() => setActiveConv(null)} className="lg:hidden p-1 rounded hover:bg-gray-100"><ArrowLeft size={18} /></button>
                <div>
                  <div className="text-sm font-bold text-gray-900">{activeConv.contact?.name}</div>
                  <div className="text-xs text-gray-500">{activeConv.contact?.role} · {activeConv.contact?.email}</div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: 400 }}>
                {loadingMsgs ? (
                  <div className="text-center py-8"><Loader2 size={20} className="animate-spin mx-auto text-blue-600" /></div>
                ) : (
                  messages.map((m) => {
                    const mine = m.sender?._id === user?._id || m.sender === user?._id
                    return (
                      <div key={m._id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                        <div className={cn(
                          'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm',
                          mine ? 'bg-blue-600 text-white rounded-br-md' : 'bg-gray-100 text-gray-800 rounded-bl-md'
                        )}>
                          {m.subject && <div className={cn('text-xs font-semibold mb-1', mine ? 'text-blue-200' : 'text-gray-500')}>{m.subject}</div>}
                          <p>{m.body}</p>
                          <div className={cn('text-[10px] mt-1', mine ? 'text-blue-200' : 'text-gray-400')}>
                            {new Date(m.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              <div className="p-3 border-t border-gray-100 flex gap-2">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                  placeholder="Écrire un message..."
                  className="input flex-1 text-sm"
                />
                <button onClick={handleSendReply} disabled={sending || !reply.trim()} className="btn-primary px-4">
                  <Send size={15} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Compose modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Nouveau message</h3>
              <button onClick={() => setShowCompose(false)} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
            </div>
            <form onSubmit={handleCompose} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Destinataire</label>
                <select required value={composeForm.recipientId} onChange={(e) => setComposeForm({ ...composeForm, recipientId: e.target.value })} className="input text-sm mt-1">
                  <option value="">Sélectionner...</option>
                  {contacts.map((c) => <option key={c._id} value={c._id}>{c.name} ({c.role})</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Objet</label>
                <input value={composeForm.subject} onChange={(e) => setComposeForm({ ...composeForm, subject: e.target.value })} className="input text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Message</label>
                <textarea required value={composeForm.body} onChange={(e) => setComposeForm({ ...composeForm, body: e.target.value })} rows={4} className="input text-sm mt-1 resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCompose(false)} className="btn-ghost flex-1 justify-center border border-gray-200">Annuler</button>
                <button type="submit" disabled={sending} className="btn-primary flex-1 justify-center">
                  {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Envoyer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
