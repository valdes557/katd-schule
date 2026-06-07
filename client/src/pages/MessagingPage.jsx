import { useState } from 'react'
import { MessageSquare, Send, Plus, Search, ArrowLeft, Loader2, X, Users } from 'lucide-react'
import { messagesApi } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { cn } from '../lib/utils'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'

export default function MessagingPage() {
  const { user } = useAuth()
  const [activeConv, setActiveConv] = useState(null)
  const [messages, setMessages] = useState([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [showCompose, setShowCompose] = useState(false)
  const [composeForm, setComposeForm] = useState({ recipientId: '', subject: '', body: '' })
  const [search, setSearch] = useState('')
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [groupForm, setGroupForm] = useState({ name: '', memberIds: [], memberRole: 'enseignant' })

  const convsQ = useCachedFetch('/messages/conversations', async () => (await messagesApi.conversations()).data || [], [])
  const contactsQ = useCachedFetch('/messages/contacts', async () => (await messagesApi.contacts()).data || [], [])
  const groupsQ = useCachedFetch('/messages/groups', async () => (await messagesApi.groups()).data || [], [])

  const conversations = convsQ.data || []
  const contacts = contactsQ.data || []
  const groups = groupsQ.data || []
  const loading = convsQ.loading

  const refreshConversations = () => { cache.invalidate('/messages/conversations'); convsQ.refetch() }
  const refreshGroups = () => { cache.invalidate('/messages/groups'); groupsQ.refetch() }

  const openGroupConversation = async (group) => {
    const conv = {
      conversationId: `group_${group._id}`,
      contact: { _id: group._id, name: group.name, role: 'groupe' },
      isGroup: true,
      groupId: group._id,
      lastMessage: null,
      unread: 0,
    }
    setActiveConv(conv)
    setLoadingMsgs(true)
    try {
      const res = await messagesApi.conversation(conv.conversationId)
      setMessages(res.data || [])
    } catch (e) { console.error(e) }
    setLoadingMsgs(false)
  }

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
      if (activeConv.isGroup && activeConv.groupId) {
        await messagesApi.sendGroup(activeConv.groupId, {
          subject: activeConv.lastMessage?.subject || '',
          body: reply,
        })
      } else {
        await messagesApi.send({
          recipientId: activeConv.contact?._id,
          subject: activeConv.lastMessage?.subject || '',
          body: reply,
        })
      }
      setReply('')
      const res = await messagesApi.conversation(activeConv.conversationId)
      setMessages(res.data || [])
      refreshConversations()
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
      refreshConversations()
    } catch (e) { alert(e.message) }
    setSending(false)
  }

  const toggleGroupMember = (id) => {
    setGroupForm((prev) => {
      const exists = prev.memberIds.includes(id)
      return {
        ...prev,
        memberIds: exists ? prev.memberIds.filter((m) => m !== id) : [...prev.memberIds, id],
      }
    })
  }

  const handleCreateGroup = async (e) => {
    e.preventDefault()
    if (!groupForm.name.trim() || groupForm.memberIds.length === 0) return
    setSending(true)
    try {
      await messagesApi.createGroup(groupForm)
      setShowGroupModal(false)
      setGroupForm({ name: '', memberIds: [], memberRole: 'enseignant' })
      refreshGroups()
    } catch (err) {
      alert(err.message)
    }
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
        <div className="flex gap-2 self-start">
          {user?.role === 'directeur' && (
            <button onClick={() => setShowGroupModal(true)} className="btn-ghost text-sm border border-gray-200">
              <Users size={15} /> Nouveau groupe
            </button>
          )}
          <button onClick={() => setShowCompose(true)} className="btn-primary text-sm">
            <Plus size={15} /> Nouveau message
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5" style={{ minHeight: 500 }}>
        {/* Conversations list */}
        <div className={cn('card overflow-hidden flex flex-col', activeConv && 'hidden lg:flex')}>
          <div className="p-3 border-b border-gray-100 space-y-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..." className="input pl-9 text-sm" />
            </div>
            {groups.length > 0 && (
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                {groups.map((g) => (
                  <button
                    key={g._id}
                    type="button"
                    onClick={() => openGroupConversation(g)}
                    className={`px-2 py-0.5 rounded-full border hover:brightness-95 truncate max-w-full ${g.type === 'parent_group' ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      <Users size={11} /> {g.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
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
                  <div className="text-xs text-gray-500">
                    {activeConv.isGroup ? 'Groupe d\'échange' : activeConv.contact?.role}
                    {!activeConv.isGroup && activeConv.contact?.email ? ` · ${activeConv.contact.email}` : ''}
                  </div>
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

      {/* Group creation modal (director) */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">{groupForm.memberRole === 'parent' ? 'Nouveau groupe de parents' : "Nouveau groupe d'enseignants"}</h3>
              <button onClick={() => setShowGroupModal(false)} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateGroup} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Type de groupe</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {[{ v: 'enseignant', l: 'Enseignants' }, { v: 'parent', l: 'Parents' }].map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => setGroupForm({ ...groupForm, memberRole: opt.v, memberIds: [] })}
                      className={`text-sm py-2 rounded-xl border transition-colors ${groupForm.memberRole === opt.v ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Nom du groupe</label>
                <input
                  required
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  className="input text-sm mt-1"
                  placeholder={groupForm.memberRole === 'parent' ? 'Ex: Parents CP' : 'Ex: Équipe CP matin'}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">{groupForm.memberRole === 'parent' ? 'Parents' : 'Enseignants'}</label>
                <div className="mt-1 max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-2 space-y-1">
                  {contacts.filter((c) => c.role === groupForm.memberRole).length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">{groupForm.memberRole === 'parent' ? 'Aucun parent disponible' : 'Aucun enseignant disponible'}</p>
                  ) : (
                    contacts.filter((c) => c.role === groupForm.memberRole).map((c) => (
                      <label key={c._id} className="flex items-center gap-2 text-xs py-1 px-2 rounded hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300"
                          checked={groupForm.memberIds.includes(c._id)}
                          onChange={() => toggleGroupMember(c._id)}
                        />
                        <span className="truncate">{c.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowGroupModal(false)} className="btn-ghost flex-1 justify-center border border-gray-200">Annuler</button>
                <button type="submit" disabled={sending || !groupForm.name.trim() || groupForm.memberIds.length === 0} className="btn-primary flex-1 justify-center">
                  {sending ? <Loader2 size={15} className="animate-spin" /> : <Users size={15} />} Créer le groupe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
