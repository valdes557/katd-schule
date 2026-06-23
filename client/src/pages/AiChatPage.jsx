import { useState, useRef, useEffect } from 'react'
import { aiApi } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import {
  Bot, Send, Loader2, Plus, Trash2, MessageSquare, Sparkles, AlertTriangle, Menu, X,
} from 'lucide-react'

// Bulle de message (utilisateur à droite en bleu, assistant à gauche en gris).
function Bubble({ role, content }) {
  const mine = role === 'user'
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex items-end gap-2 max-w-[85%] ${mine ? 'flex-row-reverse' : ''}`}>
        {!mine && (
          <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center flex-shrink-0">
            <Bot size={15} />
          </div>
        )}
        <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
          mine ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'
        }`}>
          {content}
        </div>
      </div>
    </div>
  )
}

export default function AiChatPage() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [convId, setConvId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [quota, setQuota] = useState(null) // { remaining, used, total }
  const [access, setAccess] = useState('loading') // loading | ok | no-access | no-subscription | exhausted
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const scrollRef = useRef(null)

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    })
  }

  // Statut de souscription + historique au chargement
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [statusRes, histRes] = await Promise.all([
          aiApi.subscriptionStatus().catch(() => ({ data: null })),
          aiApi.history().catch(() => ({ data: [] })),
        ])
        if (!alive) return
        const sub = statusRes.data
        setConversations(histRes.data || [])

        const canByRole = user?.role === 'directeur' || user?.aiAccess === true
        if (!canByRole) { setAccess('no-access'); return }
        if (!sub || sub.status !== 'approved') { setAccess('no-subscription'); return }
        setQuota({ remaining: sub.remainingQuestions, used: sub.usedQuestions, total: sub.totalQuestions })
        setAccess(sub.remainingQuestions > 0 ? 'ok' : 'exhausted')
      } catch (_) {
        if (alive) setAccess('no-subscription')
      }
    })()
    return () => { alive = false }
  }, [user])

  useEffect(scrollToBottom, [messages])

  const openConversation = async (id) => {
    setSidebarOpen(false)
    if (id === convId) return
    try {
      const res = await aiApi.getConversation(id)
      setConvId(id)
      setMessages(res.data.messages || [])
    } catch (err) { setError(err.message) }
  }

  const newConversation = () => {
    setConvId(null)
    setMessages([])
    setError('')
    setSidebarOpen(false)
  }

  const removeConversation = async (e, id) => {
    e.stopPropagation()
    if (!window.confirm('Supprimer cette conversation ?')) return
    try {
      await aiApi.deleteConversation(id)
      setConversations((c) => c.filter((x) => x._id !== id))
      if (id === convId) newConversation()
    } catch (err) { setError(err.message) }
  }

  const send = async (e) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending) return
    setError('')
    setInput('')
    setMessages((m) => [...m, { role: 'user', content: text }])
    setSending(true)
    try {
      const res = await aiApi.chat(text, convId)
      const d = res.data
      setMessages((m) => [...m, { role: 'assistant', content: d.answer }])
      setQuota({ remaining: d.remainingQuestions, used: d.usedQuestions, total: d.totalQuestions })
      if (d.remainingQuestions <= 0) setAccess('exhausted')
      if (!convId) {
        setConvId(d.conversationId)
        // Rafraîchit la liste des conversations
        aiApi.history().then((h) => setConversations(h.data || [])).catch(() => {})
      }
    } catch (err) {
      setError(err.message)
      // Retire le message utilisateur optimiste en cas d'échec
      setMessages((m) => m.slice(0, -1))
      setInput(text)
      if (/quota/i.test(err.message)) setAccess('exhausted')
    }
    setSending(false)
  }

  // États bloquants (pas d'accès / pas de souscription)
  if (access === 'no-access' || access === 'no-subscription') {
    return (
      <div className="max-w-lg mx-auto mt-10 card p-8 text-center animate-fade-in">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
          <Sparkles size={26} />
        </div>
        <h2 className="text-lg font-bold text-gray-900">Assistant IA</h2>
        {access === 'no-access' ? (
          <p className="text-sm text-gray-500 mt-2">
            Vous n'avez pas encore accès à l'assistant IA. Demandez à votre directeur d'établissement de vous l'accorder.
          </p>
        ) : (
          <p className="text-sm text-gray-500 mt-2">
            Votre établissement ne dispose pas encore d'une souscription IA active.
            {user?.role === 'directeur' && ' Rendez-vous dans « Assistant IA » pour soumettre une demande.'}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-9rem)] animate-fade-in">
      {/* Liste des conversations (sidebar) */}
      <aside className={`${sidebarOpen ? 'fixed inset-0 z-40 bg-black/40 sm:static sm:bg-transparent' : 'hidden'} sm:block sm:w-64 flex-shrink-0`} onClick={() => setSidebarOpen(false)}>
        <div className="bg-white h-full w-64 sm:w-full border-r border-gray-100 sm:border sm:rounded-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="p-3 border-b border-gray-100">
            <button onClick={newConversation} className="btn-primary w-full justify-center text-sm"><Plus size={15} /> Nouvelle conversation</button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversations.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">Aucune conversation.</p>
            ) : conversations.map((c) => (
              <button key={c._id} onClick={() => openConversation(c._id)}
                className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 group ${convId === c._id ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-700'}`}>
                <MessageSquare size={14} className="flex-shrink-0 opacity-60" />
                <span className="text-xs truncate flex-1">{c.title}</span>
                <Trash2 size={13} onClick={(e) => removeConversation(e, c._id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Zone de chat */}
      <section className="flex-1 flex flex-col bg-white border border-gray-100 rounded-2xl overflow-hidden">
        {/* En-tête */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <button onClick={() => setSidebarOpen(true)} className="sm:hidden p-1 text-gray-500"><Menu size={18} /></button>
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center"><Bot size={17} /></div>
            <div>
              <h1 className="text-sm font-bold text-gray-900">Assistant IA</h1>
              <p className="text-[11px] text-gray-400">Questions pédagogiques & administratives</p>
            </div>
          </div>
          {quota && (
            <div className={`text-xs font-semibold px-2.5 py-1 rounded-full ${quota.remaining > 5 ? 'bg-green-50 text-green-700' : quota.remaining > 0 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
              {quota.remaining} / {quota.total} questions
            </div>
          )}
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center text-gray-400">
              <Sparkles size={32} className="mb-3 text-indigo-300" />
              <p className="text-sm font-medium text-gray-500">Posez votre première question</p>
              <p className="text-xs mt-1 max-w-xs">L'assistant répond aux questions pédagogiques, administratives et éducatives.</p>
            </div>
          )}
          {messages.map((m, i) => <Bubble key={i} role={m.role} content={m.content} />)}
          {sending && (
            <div className="flex justify-start">
              <div className="flex items-end gap-2">
                <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center"><Bot size={15} /></div>
                <div className="px-4 py-3 rounded-2xl bg-gray-100"><Loader2 size={15} className="animate-spin text-gray-400" /></div>
              </div>
            </div>
          )}
        </div>

        {/* Erreur / quota épuisé */}
        {(error || access === 'exhausted') && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-100 flex items-center gap-2 text-xs text-red-700">
            <AlertTriangle size={14} className="flex-shrink-0" />
            <span>{access === 'exhausted' ? 'Votre quota de questions IA est épuisé. Veuillez renouveler votre abonnement.' : error}</span>
            {error && access !== 'exhausted' && <button onClick={() => setError('')} className="ml-auto"><X size={14} /></button>}
          </div>
        )}

        {/* Barre de saisie */}
        <form onSubmit={send} className="p-3 border-t border-gray-100 flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e) } }}
            disabled={sending || access === 'exhausted'}
            rows={1}
            placeholder={access === 'exhausted' ? 'Quota épuisé' : 'Écrivez votre question…'}
            className="input text-sm flex-1 resize-none max-h-32 disabled:bg-gray-50 disabled:text-gray-400"
          />
          <button type="submit" disabled={sending || !input.trim() || access === 'exhausted'} className="btn-primary justify-center px-3.5 py-2.5 disabled:opacity-50">
            {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
          </button>
        </form>
      </section>
    </div>
  )
}
