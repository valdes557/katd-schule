// client/src/components/AgentMessagingTab.jsx — Messagerie Agent : Direction (Super Admin) & Mes Clients
import { useState, useEffect, useRef } from 'react'
import {
  MessageSquare, Send, Paperclip, Users, Search, Loader2,
  CheckCircle2, AlertCircle, X, FileText, Download, User as UserIcon, Smartphone,
  Check, CheckCheck, RefreshCw, Shield, ArrowLeft, PhoneCall,
} from 'lucide-react'
import { messagesApi } from '../lib/api'
import { uploadToCloudinary } from '../lib/cloudinaryUpload'

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
}) : '—')

export default function AgentMessagingTab({ showBanner }) {
  const [subTab, setSubTab] = useState('admin') // 'admin' | 'clients'
  const [admins, setAdmins] = useState([])
  const [clients, setClients] = useState([])
  const [loadingContacts, setLoadingContacts] = useState(true)

  const [selectedContact, setSelectedContact] = useState(null)
  const [messages, setMessages] = useState([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')

  // Pièces jointes
  const [attachments, setAttachments] = useState([])
  const [uploadingFile, setUploadingFile] = useState(false)

  const fileInputRef = useRef(null)
  const messagesEndRef = useRef(null)

  // Chargement des contacts (Admins & Clients)
  const loadContacts = async () => {
    try {
      setLoadingContacts(true)
      const res = await messagesApi.getAgentClients()
      const admList = res.admins || []
      const clList = res.clients || []
      setAdmins(admList)
      setClients(clList)

      // Sélectionner par défaut le super admin si aucun contact sélectionné
      if (!selectedContact) {
        if (admList.length > 0) {
          setSelectedContact({
            ...admList[0],
            isSuperAdmin: true,
            displayRole: 'Direction / Super Admin',
          })
        }
      }
    } catch (err) {
      if (showBanner) showBanner(err.message || 'Erreur lors du chargement des contacts', 'error')
    } finally {
      setLoadingContacts(false)
    }
  }

  // Chargement de la conversation avec le contact sélectionné
  const loadConversation = async (contact) => {
    const contactId = contact?._id || contact?.userId
    if (!contactId) return
    try {
      setLoadingMsgs(true)
      const res = await messagesApi.conversations()
      const convList = res.data || []
      const found = convList.find((c) => c.contact && (c.contact._id === contactId || c.contact._id === contact._id))
      if (found) {
        const detail = await messagesApi.conversation(found.conversationId)
        setMessages(detail.data || [])
      } else {
        setMessages([])
      }
    } catch (_) {
      setMessages([])
    } finally {
      setLoadingMsgs(false)
    }
  }

  useEffect(() => {
    loadContacts()
  }, [])

  useEffect(() => {
    if (selectedContact) {
      loadConversation(selectedContact)
    }
  }, [selectedContact])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Changement d'onglet secondaire
  const handleSwitchTab = (tab) => {
    setSubTab(tab)
    setSearch('')
    if (tab === 'admin') {
      if (admins.length > 0) {
        setSelectedContact({
          ...admins[0],
          isSuperAdmin: true,
          displayRole: 'Direction / Super Admin',
        })
      } else {
        setSelectedContact(null)
      }
    } else {
      const activeCls = clients.filter((c) => c.hasUserAccount)
      if (activeCls.length > 0) {
        setSelectedContact({
          _id: activeCls[0].userId,
          name: activeCls[0].fullName,
          phone: activeCls[0].phone,
          accountNumber: activeCls[0].accountNumber,
          avatar: activeCls[0].avatar,
          displayRole: 'Client (' + activeCls[0].accountNumber + ')',
        })
      } else {
        setSelectedContact(null)
      }
    }
  }

  // Upload d'une pièce jointe
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 15 * 1024 * 1024) {
      if (showBanner) showBanner('Le fichier dépasse la taille maximale autorisée (15 Mo).', 'error')
      return
    }

    setUploadingFile(true)
    try {
      const res = await uploadToCloudinary(file)
      const url = res.secure_url || res.url
      setAttachments((prev) => [
        ...prev,
        {
          filename: file.name,
          url,
          size: file.size,
          mimeType: file.type,
        },
      ])
    } catch (err) {
      if (showBanner) showBanner(err.message || "Erreur lors de l'upload du fichier", 'error')
    } finally {
      setUploadingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removeAttachment = (idx) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx))
  }

  // Envoi d'un message
  const handleSend = async (e) => {
    e.preventDefault()
    const targetId = selectedContact?._id || selectedContact?.userId
    if ((!text.trim() && attachments.length === 0) || !targetId) return

    const pendingText = text.trim()
    const pendingAttachments = [...attachments]
    setText('')
    setAttachments([])
    setSending(true)

    try {
      const payload = {
        recipientId: targetId,
        body: pendingText || (pendingAttachments.length > 0 ? 'Fichier(s) joint(s)' : ''),
        type: pendingAttachments.length > 0 ? 'document' : 'text',
      }
      if (pendingAttachments.length > 0) {
        payload.attachments = pendingAttachments
        payload.mediaUrl = pendingAttachments[0].url
      }

      await messagesApi.send(payload)
      await loadConversation(selectedContact)
    } catch (err) {
      setText(pendingText)
      setAttachments(pendingAttachments)
      if (showBanner) showBanner(err.message || "Erreur lors de l'envoi du message", 'error')
    } finally {
      setSending(false)
    }
  }

  // Filtrage des clients pour la recherche
  const filteredClients = clients.filter((c) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      (c.fullName && c.fullName.toLowerCase().includes(q)) ||
      (c.accountNumber && c.accountNumber.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q))
    )
  })

  return (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[750px] animate-fade-in">
      {/* En-tête Messagerie */}
      <div className="p-4 bg-gradient-to-r from-emerald-700 via-teal-800 to-indigo-900 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center shrink-0 border border-white/20">
            <MessageSquare size={20} className="text-emerald-200" />
          </div>
          <div>
            <h2 className="text-base font-bold">Messagerie Agent Collecte</h2>
            <p className="text-xs text-emerald-100">
              Communiquez directement avec la Direction ou vos clients affiliés
            </p>
          </div>
        </div>

        {/* Sélecteur de sous-onglet */}
        <div className="flex items-center gap-1.5 bg-black/20 p-1 rounded-2xl border border-white/10">
          <button
            onClick={() => handleSwitchTab('admin')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              subTab === 'admin'
                ? 'bg-white text-emerald-900 shadow-sm'
                : 'text-emerald-100 hover:bg-white/10'
            }`}
          >
            <Shield size={14} />
            <span>Direction (Super Admin)</span>
          </button>
          <button
            onClick={() => handleSwitchTab('clients')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              subTab === 'clients'
                ? 'bg-white text-emerald-900 shadow-sm'
                : 'text-emerald-100 hover:bg-white/10'
            }`}
          >
            <Users size={14} />
            <span>Mes Clients ({clients.length})</span>
          </button>
        </div>
      </div>

      {/* Corps à 2 colonnes */}
      <div className="flex-1 flex overflow-hidden">
        {/* Colonne de gauche : Liste des contacts */}
        <div className="w-full sm:w-80 md:w-96 border-r border-gray-200 flex flex-col bg-gray-50/50">
          {subTab === 'admin' ? (
            <div className="p-3 border-b border-gray-200">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Liaison officielle avec la Direction
              </span>
            </div>
          ) : (
            <div className="p-3 border-b border-gray-200 space-y-2">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un client (nom, n° compte, tél)..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 bg-white rounded-xl border border-gray-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          {/* Liste des contacts scrollable */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {loadingContacts ? (
              <div className="p-8 text-center text-gray-400 text-xs flex flex-col items-center gap-2">
                <Loader2 className="animate-spin text-emerald-600" size={24} />
                <span>Chargement des contacts...</span>
              </div>
            ) : subTab === 'admin' ? (
              admins.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-500">
                  Aucun administrateur disponible pour le moment.
                </div>
              ) : (
                admins.map((adm) => {
                  const isSelected = selectedContact?._id === adm._id
                  return (
                    <button
                      key={adm._id}
                      onClick={() =>
                        setSelectedContact({
                          ...adm,
                          isSuperAdmin: true,
                          displayRole: 'Direction / Super Admin',
                        })
                      }
                      className={`w-full text-left p-3.5 flex items-center gap-3 transition-colors ${
                        isSelected
                          ? 'bg-emerald-50/90 border-l-4 border-emerald-600'
                          : 'hover:bg-white'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0 shadow-inner">
                        <Shield size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-900 truncate">
                            {adm.name || 'Super Administrateur'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                            Direction
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 truncate mt-0.5">
                          {adm.email || 'Administration centrale KATD'}
                        </p>
                      </div>
                    </button>
                  )
                })
              )
            ) : filteredClients.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-500">
                Aucun client trouvé.
              </div>
            ) : (
              filteredClients.map((cl) => {
                const targetId = cl.userId || cl.clientId
                const isSelected =
                  selectedContact?._id === targetId ||
                  selectedContact?.userId === targetId
                return (
                  <button
                    key={cl.clientId}
                    onClick={() => {
                      if (!cl.hasUserAccount) {
                        if (showBanner) {
                          showBanner(
                            `Ce client (${cl.fullName}) n'a pas encore créé de compte KATD en ligne. Vous pouvez le contacter au ${cl.phone}.`,
                            'info'
                          )
                        }
                      }
                      setSelectedContact({
                        _id: cl.userId || cl.clientId,
                        userId: cl.userId,
                        name: cl.fullName,
                        phone: cl.phone,
                        accountNumber: cl.accountNumber,
                        avatar: cl.avatar,
                        hasUserAccount: cl.hasUserAccount,
                        displayRole: 'Client (' + cl.accountNumber + ')',
                      })
                    }}
                    className={`w-full text-left p-3.5 flex items-center gap-3 transition-colors ${
                      isSelected
                        ? 'bg-emerald-50/90 border-l-4 border-emerald-600'
                        : 'hover:bg-white'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm shrink-0">
                      {cl.avatar ? (
                        <img
                          src={cl.avatar}
                          alt=""
                          className="w-full h-full rounded-2xl object-cover"
                        />
                      ) : (
                        (cl.fullName || 'C').charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900 truncate">
                          {cl.fullName}
                        </span>
                        {cl.hasUserAccount ? (
                          <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            En ligne
                          </span>
                        ) : (
                          <span className="px-2 py-0.2 rounded-full text-[10px] font-medium bg-gray-200 text-gray-600">
                            Hors-ligne
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-gray-500 mt-0.5">
                        <span className="font-mono text-emerald-700">
                          {cl.accountNumber}
                        </span>
                        <span>{cl.phone}</span>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Colonne de droite : Discussion active */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          {selectedContact ? (
            <>
              {/* Entête du contact actif */}
              <div className="p-3.5 border-b border-gray-200 flex items-center justify-between bg-white shadow-2xs">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm text-white ${
                      selectedContact.isSuperAdmin
                        ? 'bg-indigo-600'
                        : 'bg-emerald-600'
                    }`}
                  >
                    {selectedContact.isSuperAdmin ? (
                      <Shield size={20} />
                    ) : (
                      (selectedContact.name || 'C').charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <span>{selectedContact.name}</span>
                      {selectedContact.accountNumber && (
                        <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-gray-100 text-gray-700">
                          {selectedContact.accountNumber}
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-gray-500 flex items-center gap-2">
                      <span>{selectedContact.displayRole}</span>
                      {selectedContact.phone && (
                        <span>• Tél : {selectedContact.phone}</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedContact.phone && (
                    <a
                      href={`tel:${selectedContact.phone}`}
                      className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs flex items-center gap-1.5 transition-colors"
                      title="Appeler"
                    >
                      <PhoneCall size={14} />
                      <span className="hidden sm:inline">Appeler</span>
                    </a>
                  )}
                  <button
                    onClick={() => loadConversation(selectedContact)}
                    className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs transition-colors"
                    title="Actualiser la conversation"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>

              {/* Message d'avertissement si le client n'a pas de compte KATD en ligne */}
              {subTab === 'clients' && selectedContact && !selectedContact.hasUserAccount && (
                <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-xs text-amber-800 flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0 text-amber-600" />
                  <span>
                    Ce client n'a pas encore activé de compte utilisateur KATD en ligne. Vos messages seront enregistrés mais il est recommandé de le contacter directement par appel ou SMS au <b>{selectedContact.phone}</b>.
                  </span>
                </div>
              )}

              {/* Zone des messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-gray-50/40">
                {loadingMsgs ? (
                  <div className="flex justify-center items-center py-16">
                    <Loader2 className="animate-spin text-emerald-600" size={28} />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-20 text-gray-400 space-y-2">
                    <MessageSquare size={36} className="mx-auto text-gray-300" />
                    <p className="text-xs">Aucun message pour le moment.</p>
                    <p className="text-[11px] text-gray-400">
                      Envoyez votre premier message ou une note ci-dessous.
                    </p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMe = m.sender?._id !== (selectedContact._id || selectedContact.userId)
                    return (
                      <div
                        key={m._id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl p-3.5 shadow-2xs text-xs sm:text-sm ${
                            isMe
                              ? 'bg-emerald-600 text-white rounded-br-none'
                              : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'
                          }`}
                        >
                          {/* Sujet éventuel (notes de service ou diffusions) */}
                          {m.subject && (
                            <div
                              className={`font-bold text-xs uppercase tracking-wider pb-1 mb-1.5 border-b ${
                                isMe
                                  ? 'border-white/20 text-emerald-100'
                                  : 'border-gray-200 text-indigo-700'
                              }`}
                            >
                              📢 {m.subject}
                            </div>
                          )}

                          {/* Corps du message */}
                          <p className="whitespace-pre-wrap leading-relaxed">
                            {m.body}
                          </p>

                          {/* Pièces jointes éventuelles (PDF, Word, Images) */}
                          {m.attachments && m.attachments.length > 0 && (
                            <div className="mt-2.5 space-y-1.5">
                              {m.attachments.map((att, i) => (
                                <a
                                  key={i}
                                  href={att.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`flex items-center gap-2 p-2 rounded-xl text-xs transition-colors ${
                                    isMe
                                      ? 'bg-white/15 hover:bg-white/25 text-white'
                                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                                  }`}
                                >
                                  <FileText size={15} className="shrink-0" />
                                  <span className="truncate flex-1 font-medium">
                                    {att.filename || 'Document'}
                                  </span>
                                  <Download size={14} className="shrink-0 opacity-70" />
                                </a>
                              ))}
                            </div>
                          )}

                          {/* Heure et accusé */}
                          <div
                            className={`flex items-center justify-end gap-1 mt-1.5 text-[10px] ${
                              isMe ? 'text-emerald-100' : 'text-gray-400'
                            }`}
                          >
                            <span>{fmtDate(m.createdAt)}</span>
                            {isMe &&
                              (m.read ? (
                                <CheckCheck size={12} className="text-white" />
                              ) : (
                                <Check size={12} className="text-emerald-200" />
                              ))}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Prévisualisation des pièces jointes prêtes à l'envoi */}
              {attachments.length > 0 && (
                <div className="p-2.5 bg-gray-100 border-t border-gray-200 flex flex-wrap gap-2">
                  {attachments.map((att, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-300 text-xs"
                    >
                      <FileText size={14} className="text-emerald-600" />
                      <span className="truncate max-w-[150px] font-medium">
                        {att.filename}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Barre de saisie */}
              <form
                onSubmit={handleSend}
                className="p-3 border-t border-gray-200 bg-white flex items-center gap-2"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile}
                  className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer shrink-0"
                  title="Joindre un fichier (PDF, Word, image)"
                >
                  {uploadingFile ? (
                    <Loader2 size={18} className="animate-spin text-emerald-600" />
                  ) : (
                    <Paperclip size={18} />
                  )}
                </button>

                <input
                  type="text"
                  placeholder="Écrivez votre message ici..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="flex-1 text-xs sm:text-sm px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:border-emerald-500"
                />

                <button
                  type="submit"
                  disabled={(!text.trim() && attachments.length === 0) || sending}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-xs"
                >
                  {sending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <Send size={15} />
                      <span className="hidden sm:inline">Envoyer</span>
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
              <MessageSquare size={48} className="text-gray-200 mb-3" />
              <p className="text-sm font-semibold text-gray-600">
                Sélectionnez un contact pour ouvrir la discussion
              </p>
              <p className="text-xs text-gray-400 mt-1 max-w-sm">
                Vous pouvez échanger avec la Direction de la plateforme ou avec vos clients affiliés.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
