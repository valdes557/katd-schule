import { useState } from 'react'
import { MessageSquare, Send, Plus, Search, ArrowLeft, Circle } from 'lucide-react'
import { messages } from '../data/mockData'
import { cn } from '../lib/utils'

const conversationReplies = {
  1: [
    { id: 1, from: 'M. Diop Ousmane', text: 'Bonjour, je souhaitais vous informer que les résultats du devoir surveillé de mathématiques de la classe CM2 A sont disponibles. La moyenne est de 13.4/20.', time: '09:15', mine: false },
    { id: 2, from: 'Directeur', text: 'Merci M. Diop. C\'est un bon résultat. Pouvez-vous envoyer le détail par élève ?', time: '09:30', mine: true },
    { id: 3, from: 'M. Diop Ousmane', text: 'Bien sûr, je vais préparer le tableau et vous l\'envoyer avant la fin de la journée.', time: '09:45', mine: false },
  ],
  2: [
    { id: 1, from: 'Mme Kouassi', text: 'Bonjour, mon enfant Amani sera absent les 25 et 26 mai pour des raisons familiales. Je vous prie de bien vouloir prendre note.', time: '14:30', mine: false },
    { id: 2, from: 'Directeur', text: 'Bonjour Madame Kouassi. Nous avons bien pris note de l\'absence d\'Amani. Merci pour votre prévenance.', time: '15:00', mine: true },
  ],
}

export default function MessagingPage() {
  const [selectedMessage, setSelectedMessage] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [showCompose, setShowCompose] = useState(false)
  const [msgList, setMsgList] = useState(messages)

  const filtered = msgList.filter((m) =>
    m.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.subject.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const replies = selectedMessage ? (conversationReplies[selectedMessage.id] || []) : []

  const handleSend = () => {
    if (!newMessage.trim()) return
    setNewMessage('')
  }

  const markAsRead = (msg) => {
    setMsgList((prev) => prev.map((m) => m.id === msg.id ? { ...m, read: true } : m))
    setSelectedMessage(msg)
  }

  return (
    <div className="space-y-0 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare size={22} className="text-blue-600" />
            Messagerie
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {msgList.filter((m) => !m.read).length} message(s) non lu(s)
          </p>
        </div>
        <button onClick={() => setShowCompose(true)} className="btn-primary text-sm">
          <Plus size={15} /> Nouveau message
        </button>
      </div>

      <div className="card overflow-hidden" style={{ height: 'calc(100vh - 220px)', minHeight: '500px' }}>
        <div className="flex h-full">
          {/* Inbox list */}
          <div className={cn('border-r border-gray-100 flex flex-col', selectedMessage ? 'hidden lg:flex w-80' : 'flex-1 lg:w-80')}>
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Rechercher..." className="input pl-8 text-sm py-1.5" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {filtered.map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => markAsRead(msg)}
                  className={cn(
                    'w-full text-left p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors',
                    selectedMessage?.id === msg.id && 'bg-blue-50',
                    !msg.read && 'bg-blue-50/40'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                      style={{ backgroundColor: msg.color }}
                    >
                      {msg.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className={cn('text-sm truncate', !msg.read ? 'font-bold text-gray-900' : 'font-medium text-gray-700')}>
                          {msg.from}
                        </span>
                        <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">{msg.time}</span>
                      </div>
                      <div className={cn('text-xs truncate mb-1', !msg.read ? 'font-semibold text-gray-800' : 'text-gray-600')}>
                        {msg.subject}
                      </div>
                      <div className="text-xs text-gray-400 truncate">{msg.preview}</div>
                    </div>
                    {!msg.read && <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1" />}
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <MessageSquare size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Aucun message</p>
                </div>
              )}
            </div>
          </div>

          {/* Message detail */}
          {selectedMessage ? (
            <div className="flex-1 flex flex-col min-w-0">
              {/* Header */}
              <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                <button onClick={() => setSelectedMessage(null)} className="lg:hidden p-1 rounded hover:bg-gray-100">
                  <ArrowLeft size={18} />
                </button>
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                  style={{ backgroundColor: selectedMessage.color }}
                >
                  {selectedMessage.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-900">{selectedMessage.from}</div>
                  <div className="text-xs text-gray-500">{selectedMessage.role} · {selectedMessage.time}</div>
                </div>
              </div>

              {/* Subject */}
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-800">{selectedMessage.subject}</h3>
              </div>

              {/* Conversation */}
              <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-4">
                {replies.map((reply) => (
                  <div key={reply.id} className={cn('flex gap-3', reply.mine && 'flex-row-reverse')}>
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: reply.mine ? '#2563EB' : selectedMessage.color }}
                    >
                      {reply.mine ? 'DR' : selectedMessage.avatar}
                    </div>
                    <div className={cn('max-w-[70%]', reply.mine && 'items-end flex flex-col')}>
                      <div className="text-xs text-gray-400 mb-1">{reply.from} · {reply.time}</div>
                      <div className={cn(
                        'text-sm rounded-2xl px-4 py-2.5 leading-relaxed',
                        reply.mine
                          ? 'bg-blue-600 text-white rounded-tr-sm'
                          : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                      )}>
                        {reply.text}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply input */}
              <div className="p-4 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Écrire une réponse..."
                    className="input text-sm flex-1"
                  />
                  <button
                    onClick={handleSend}
                    className="w-9 h-9 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center justify-center text-white transition-colors flex-shrink-0"
                  >
                    <Send size={15} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="hidden lg:flex flex-1 items-center justify-center text-gray-400 flex-col gap-3">
              <MessageSquare size={48} className="opacity-20" />
              <p className="text-sm">Sélectionnez un message pour le lire</p>
            </div>
          )}
        </div>
      </div>

      {/* Compose modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Nouveau message</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Destinataire</label>
                <select className="input text-sm">
                  <option>M. Diop Ousmane (Enseignant)</option>
                  <option>Mme Konaté Aïcha (Enseignante)</option>
                  <option>Tous les enseignants</option>
                  <option>Tous les parents</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Objet</label>
                <input placeholder="Objet du message" className="input text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Message</label>
                <textarea placeholder="Rédigez votre message..." className="input text-sm resize-none" rows={5} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowCompose(false)} className="btn-ghost flex-1 justify-center border border-gray-200">Annuler</button>
              <button onClick={() => setShowCompose(false)} className="btn-primary flex-1 justify-center">
                <Send size={14} /> Envoyer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
