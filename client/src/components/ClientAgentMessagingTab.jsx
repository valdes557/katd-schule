// client/src/components/ClientAgentMessagingTab.jsx — Messagerie Client <-> Agent de Collecte & Direction
import { useState, useEffect, useRef } from 'react'
import {
  MessageSquare, Send, Paperclip, Loader2, FileText, Download,
  CheckCheck, RefreshCw, Shield, PhoneCall, UserCheck,
} from 'lucide-react'
import { messagesApi } from '../lib/api'
import { uploadToCloudinary } from '../lib/cloudinaryUpload'

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

export default function ClientAgentMessagingTab({ showToast }) {
  const [contacts, setContacts] = useState([])
  const [selectedContact, setSelectedContact] = useState(null)
  const [loadingContacts, setLoadingContacts] = useState(true)
  const [messages, setMessages] = useState([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)

  const fileInputRef = useRef(null)
  const messagesEndRef = useRef(null)

  const loadContacts = async () => {
    try {
      setLoadingContacts(true)
      const res = await messagesApi.getClientContacts()
      const list = res.contacts || []
      setContacts(list)
      if (list.length > 0 && !selectedContact) {
        setSelectedContact(list[0])
      }
    } catch (e) {
      if (showToast) showToast(e.message || 'Erreur de chargement de la messagerie', 'error')
    } finally {
      setLoadingContacts(false)
    }
  }

  const loadConversation = async (contact, silent = false) => {
    if (!contact || !contact._id) return
    try {
      if (!silent) setLoadingMsgs(true)
      const res = await messagesApi.withUser(contact._id)
      setMessages(res.data || res.messages || [])
    } catch (_) {
      if (!silent) setMessages([])
    } finally {
      if (!silent) setLoadingMsgs(false)
    }
  }

  useEffect(() => {
    loadContacts()
  }, [])

  useEffect(() => {
    if (!selectedContact) return
    loadConversation(selectedContact)
    const timer = setInterval(() => {
      loadConversation(selectedContact, true)
    }, 5000)
    return () => clearInterval(timer)
  }, [selectedContact])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!text.trim() || !selectedContact?._id) return
    const pending = text.trim()
    setText('')
    setSending(true)
    try {
      await messagesApi.send({
        recipientId: selectedContact._id,
        body: pending,
        type: 'text',
      })
      await loadConversation(selectedContact, true)
    } catch (err) {
      setText(pending)
      if (showToast) showToast(err.message || "Erreur lors de l'envoi du message", 'error')
    } finally {
      setSending(false)
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !selectedContact?._id) return
    setUploadingFile(true)
    try {
      let url = ''
      try {
        const upDocs = await messagesApi.uploadDocs([file])
        url = upDocs?.attachments?.[0]?.url || ''
      } catch (_) {
        const res = await uploadToCloudinary(file)
        url = res.secure_url || res.secureUrl || res.url
      }
      await messagesApi.send({
        recipientId: selectedContact._id,
        body: file.name,
        type: 'document',
        mediaUrl: url,
        attachments: [
          {
            filename: file.name,
            url,
            size: file.size,
            mimeType: file.type,
          },
        ],
      })
      await loadConversation(selectedContact, true)
      if (showToast) showToast(`Document « ${file.name} » envoyé avec succès !`, 'success')
    } catch (err) {
      if (showToast) showToast(err.message || "Erreur lors de l'envoi du fichier", 'error')
    } finally {
      setUploadingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  if (loadingContacts) {
    return (
      <div className="bg-white rounded-[24px] p-10 text-center border border-gray-150 shadow-xs">
        <Loader2 size={26} className="animate-spin text-[#0f9755] mx-auto mb-2" />
        <p className="text-xs text-gray-500">Chargement de votre messagerie agent...</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-[24px] border border-gray-200 shadow-xs overflow-hidden flex flex-col h-[540px]">
      {/* Sélecteur d'interlocuteur : Mon Agent de Collecte / Direction */}
      <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2 overflow-x-auto">
        {contacts.map((c) => {
          const active = String(selectedContact?._id) === String(c._id)
          const isAgent = c.type === 'agent'
          return (
            <button
              key={c._id}
              type="button"
              onClick={() => setSelectedContact(c)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                active
                  ? 'bg-[#0f9755] text-white border-[#0f9755] shadow-xs'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
              }`}
            >
              {isAgent ? <UserCheck size={14} /> : <Shield size={14} />}
              <span>{isAgent ? `Mon Agent (${c.agencyName || c.name})` : 'Direction / Support'}</span>
            </button>
          )
        })}
      </div>

      {selectedContact ? (
        <>
          {/* En-tête de l'interlocuteur actif */}
          <div className="px-4 py-3 border-b border-gray-150 flex items-center justify-between bg-white">
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-black text-gray-900 truncate">
                {selectedContact.agencyName || selectedContact.name}
              </h3>
              <p className="text-[11px] text-gray-500 truncate">
                {selectedContact.name}
                {selectedContact.phone ? ` • ${selectedContact.phone}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {selectedContact.phone && (
                <a
                  href={`tel:${selectedContact.phone}`}
                  className="p-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold flex items-center gap-1"
                  title="Appeler"
                >
                  <PhoneCall size={14} />
                </a>
              )}
              <button
                type="button"
                onClick={() => loadConversation(selectedContact)}
                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600"
                title="Actualiser"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {/* Fil de discussion */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 bg-gray-50/60">
            {loadingMsgs ? (
              <div className="py-16 text-center text-xs text-gray-400">
                <Loader2 size={22} className="animate-spin text-[#0f9755] mx-auto mb-1.5" />
                Chargement des messages...
              </div>
            ) : messages.length === 0 ? (
              <div className="py-16 text-center text-xs text-gray-400 space-y-1">
                <MessageSquare size={30} className="mx-auto text-gray-300 mb-1" />
                <p className="font-bold text-gray-600">Aucun message échangé pour le moment.</p>
                <p>Écrivez à votre agent de collecte ci-dessous.</p>
              </div>
            ) : (
              messages.map((m) => {
                const senderId = String(m.sender?._id || m.sender || '')
                const isMe = senderId !== String(selectedContact._id)
                return (
                  <div
                    key={m._id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[82%] p-3 rounded-2xl text-xs space-y-1.5 shadow-2xs ${
                        isMe
                          ? 'bg-[#0f9755] text-white rounded-br-xs'
                          : 'bg-white text-gray-900 border border-gray-200 rounded-bl-xs'
                      }`}
                    >
                      {m.body && <p className="leading-relaxed whitespace-pre-wrap">{m.body}</p>}

                      {m.attachments && m.attachments.length > 0 && (
                        <div className="space-y-1 pt-1">
                          {m.attachments.map((att, idx) => (
                            <a
                              key={idx}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`flex items-center gap-2 p-2 rounded-xl text-[11px] font-bold border ${
                                isMe
                                  ? 'bg-white/15 text-white border-white/25'
                                  : 'bg-gray-50 text-gray-800 border-gray-200'
                              }`}
                            >
                              <FileText size={13} className="shrink-0" />
                              <span className="truncate flex-1">{att.filename || 'Document'}</span>
                              <Download size={12} className="shrink-0" />
                            </a>
                          ))}
                        </div>
                      )}

                      <div
                        className={`flex items-center justify-end gap-1 text-[10px] ${
                          isMe ? 'text-emerald-100' : 'text-gray-400'
                        }`}
                      >
                        <span>{fmtDate(m.createdAt)}</span>
                        {isMe && <CheckCheck size={12} />}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Barre d'envoi */}
          <form onSubmit={handleSend} className="p-3 bg-white border-t border-gray-200 flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploadingFile || sending}
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 disabled:opacity-50"
              title="Joindre un document ou une photo"
            >
              {uploadingFile ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
            </button>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Écrire un message à votre agent..."
              className="flex-1 px-3.5 py-2.5 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0f9755]"
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="p-2.5 rounded-xl bg-[#0f9755] hover:bg-[#0c7c45] text-white disabled:opacity-50"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </form>
        </>
      ) : (
        <div className="p-10 text-center text-xs text-gray-500">
          Aucun interlocuteur disponible pour le moment.
        </div>
      )}
    </div>
  )
}
