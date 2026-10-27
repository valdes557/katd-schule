// client/src/components/AdminAgentMessagingTab.jsx — Messagerie Administrateur <-> Agents & Diffusion Groupée
import { useState, useEffect, useRef } from 'react'
import {
  MessageSquare, Send, Paperclip, Users, Search, Loader2,
  CheckCircle2, AlertCircle, X, FileText, Download, User, Smartphone,
  Radio, Check, CheckCheck, RefreshCw,
} from 'lucide-react'
import { messagesApi } from '../lib/api'
import { uploadToCloudinary } from '../lib/cloudinaryUpload'

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
}) : '—')

export default function AdminAgentMessagingTab({ showBanner }) {
  const [agents, setAgents] = useState([])
  const [loadingAgents, setLoadingAgents] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [messages, setMessages] = useState([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')

  // Modale de diffusion groupée
  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const [broadcastSubject, setBroadcastSubject] = useState('')
  const [broadcastBody, setBroadcastBody] = useState('')
  const [broadcastAttachments, setBroadcastAttachments] = useState([])
  const [uploadingFile, setUploadingFile] = useState(false)
  const [sendingBroadcast, setSendingBroadcast] = useState(false)
  const [broadcastError, setBroadcastError] = useState('')

  const fileInputRef = useRef(null)
  const broadcastFileInputRef = useRef(null)
  const messagesEndRef = useRef(null)

  const loadAgents = async () => {
    try {
      setLoadingAgents(true)
      const res = await messagesApi.getAdminAgents()
      const list = res.agents || []
      setAgents(list)
      if (list.length > 0 && !selectedAgent) {
        setSelectedAgent(list[0])
      }
    } catch (err) {
      if (showBanner) showBanner(err.message || 'Erreur lors du chargement des agents', 'error')
    } finally {
      setLoadingAgents(false)
    }
  }

  const loadConversation = async (agent) => {
    if (!agent || !agent._id) return
    try {
      setLoadingMsgs(true)
      const res = await messagesApi.conversations()
      const convList = res.data || []
      const found = convList.find((c) => c.contact && c.contact._id === agent._id)
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
    loadAgents()
  }, [])

  useEffect(() => {
    if (selectedAgent) {
      loadConversation(selectedAgent)
    }
  }, [selectedAgent])

  // Défilement automatique vers le bas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Envoi d'un message direct à l'agent sélectionné
  const handleSendDirect = async (e) => {
    e.preventDefault()
    if (!text.trim() || !selectedAgent) return

    const pendingText = text.trim()
    setText('')
    setSending(true)

    try {
      await messagesApi.send({
        recipientId: selectedAgent._id,
        body: pendingText,
        type: 'text',
      })
      await loadConversation(selectedAgent)
    } catch (err) {
      if (showBanner) showBanner(err.message || 'Erreur lors de l\'envoi', 'error')
    } finally {
      setSending(false)
    }
  }

  // Upload d'une pièce jointe dans le chat 1-à-1
  const handleDirectFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !selectedAgent) return

    try {
      setSending(true)
      const uploadRes = await uploadToCloudinary(file)
      const secureUrl = uploadRes.secureUrl || uploadRes.url

      await messagesApi.send({
        recipientId: selectedAgent._id,
        body: file.name,
        type: 'document',
        mediaUrl: secureUrl,
        attachments: [{
          filename: file.name,
          url: secureUrl,
          size: file.size,
        }],
      })
      await loadConversation(selectedAgent)
      if (showBanner) showBanner(`Document « ${file.name} » envoyé avec succès.`)
    } catch (err) {
      if (showBanner) showBanner(err.message || 'Erreur lors de l\'upload du fichier', 'error')
    } finally {
      setSending(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Upload d'une pièce jointe dans la modale de diffusion
  const handleBroadcastFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setUploadingFile(true)
      const uploadRes = await uploadToCloudinary(file)
      const secureUrl = uploadRes.secureUrl || uploadRes.url

      setBroadcastAttachments((prev) => [
        ...prev,
        {
          filename: file.name,
          url: secureUrl,
          size: file.size,
        },
      ])
    } catch (err) {
      setBroadcastError(err.message || 'Erreur lors de l\'upload du document.')
    } finally {
      setUploadingFile(false)
      if (broadcastFileInputRef.current) broadcastFileInputRef.current.value = ''
    }
  }

  // Envoi de la diffusion groupée
  const handleSendBroadcast = async (e) => {
    e.preventDefault()
    if (!broadcastBody.trim() && broadcastAttachments.length === 0) {
      setBroadcastError('Veuillez saisir un message ou joindre au moins un document.')
      return
    }

    try {
      setSendingBroadcast(true)
      setBroadcastError('')
      const res = await messagesApi.broadcastAgents({
        subject: broadcastSubject.trim() || 'Note d\'information officielle de la Direction',
        body: broadcastBody.trim(),
        attachments: broadcastAttachments,
      })
      if (showBanner) showBanner(res.message || 'Message et documents transmis avec succès à tous les agents !')
      setBroadcastOpen(false)
      setBroadcastSubject('')
      setBroadcastBody('')
      setBroadcastAttachments([])
      if (selectedAgent) loadConversation(selectedAgent)
    } catch (err) {
      setBroadcastError(err.message || 'Erreur lors de la diffusion.')
    } finally {
      setSendingBroadcast(false)
    }
  }

  const filteredAgents = agents.filter((a) =>
    (a.agencyName || '').toLowerCase().includes(search.toLowerCase()) ||
    (a.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (a.phone || '').includes(search)
  )

  return (
    <div className="space-y-4">
      {/* Barre supérieure : bouton de diffusion groupée */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-gray-150 shadow-2xs">
        <div>
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare size={18} className="text-emerald-600" />
            <span>Messagerie des Agents de Collecte</span>
          </h3>
          <p className="text-xs text-gray-500">
            Communiquez individuellement avec chaque agent ou diffusez des documents (PDF, Word) à l'ensemble des agents.
          </p>
        </div>

        <button
          onClick={() => setBroadcastOpen(true)}
          className="btn-primary text-xs py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-sm shrink-0"
        >
          <Radio size={15} />
          <span>Diffuser un message à tous les agents</span>
        </button>
      </div>

      {/* Interface de messagerie 2 colonnes */}
      <div className="grid grid-cols-1 md:grid-cols-12 bg-white rounded-3xl border border-gray-150 shadow-sm overflow-hidden min-h-[520px]">
        {/* Colonne gauche : liste des agents */}
        <div className="md:col-span-4 border-r border-gray-150 flex flex-col">
          <div className="p-3.5 border-b border-gray-100 space-y-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un agent..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input text-xs w-full pl-9 py-2 rounded-xl bg-gray-50/70"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-gray-400 px-1 font-bold">
              <span>AGENTS ACTIFS</span>
              <span>{filteredAgents.length}</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-50 max-h-[440px]">
            {loadingAgents ? (
              <div className="p-8 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin text-emerald-600" />
                <span>Chargement des agents...</span>
              </div>
            ) : filteredAgents.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">
                Aucun agent trouvé.
              </div>
            ) : (
              filteredAgents.map((ag) => {
                const isSelected = selectedAgent?._id === ag._id
                return (
                  <div
                    key={ag._id}
                    onClick={() => setSelectedAgent(ag)}
                    className={`p-3.5 cursor-pointer transition-all flex items-start gap-3 hover:bg-gray-50/80 ${
                      isSelected ? 'bg-emerald-50/60 border-l-4 border-emerald-600' : ''
                    }`}
                  >
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white font-bold flex items-center justify-center shrink-0 shadow-2xs">
                      {ag.agencyName?.slice(0, 2).toUpperCase() || 'AG'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs text-gray-900 truncate block">
                          {ag.agencyName}
                        </span>
                        {ag.isOnline && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="En ligne" />
                        )}
                      </div>
                      <span className="text-[11px] text-gray-500 truncate block">
                        {ag.name} • {ag.phone}
                      </span>
                      <span className="text-[10px] text-gray-400 truncate block">
                        {ag.neighborhood || ag.city || 'Zone non spécifiée'}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Colonne droite : conversation avec l'agent sélectionné */}
        <div className="md:col-span-8 flex flex-col min-h-[500px]">
          {selectedAgent ? (
            <>
              {/* En-tête de conversation */}
              <div className="p-4 border-b border-gray-150 flex items-center justify-between bg-gray-50/40">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white font-bold flex items-center justify-center shrink-0 shadow-2xs">
                    {selectedAgent.agencyName?.slice(0, 2).toUpperCase() || 'AG'}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-gray-900 flex items-center gap-2">
                      <span>{selectedAgent.agencyName}</span>
                      <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                        Agent Collecte
                      </span>
                    </h4>
                    <p className="text-[11px] text-gray-500">
                      {selectedAgent.name} • {selectedAgent.phone} • {selectedAgent.neighborhood || selectedAgent.city}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => loadConversation(selectedAgent)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                  title="Actualiser les messages"
                >
                  <RefreshCw size={15} />
                </button>
              </div>

              {/* Fil des messages */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#f8fafc]/50 max-h-[380px]">
                {loadingMsgs ? (
                  <div className="py-20 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin text-emerald-600" />
                    <span>Chargement des échanges...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-20 text-center text-xs text-gray-400 space-y-1">
                    <MessageSquare size={28} className="mx-auto text-gray-300 mb-2" />
                    <p className="font-bold text-gray-600">Aucun message pour le moment avec cet agent.</p>
                    <p>Envoyez une consigne, un message d'orientation ou un document officiel ci-dessous.</p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMe = m.sender?._id === selectedAgent._id ? false : true
                    return (
                      <div
                        key={m._id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-[70%] p-3 rounded-2xl text-xs space-y-1.5 shadow-2xs ${
                            isMe
                              ? 'bg-indigo-600 text-white rounded-br-xs'
                              : 'bg-white text-gray-900 border border-gray-150 rounded-bl-xs'
                          }`}
                        >
                          {m.subject && (
                            <span className="font-black text-[11px] block border-b pb-1 opacity-90 border-white/20">
                              {m.subject}
                            </span>
                          )}

                          {m.body && <p className="leading-relaxed whitespace-pre-wrap">{m.body}</p>}

                          {/* Pièces jointes (PDF, Word, etc.) */}
                          {m.attachments && m.attachments.length > 0 && (
                            <div className="space-y-1 pt-1">
                              {m.attachments.map((att, idx) => (
                                <a
                                  key={idx}
                                  href={att.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`flex items-center gap-2 p-2 rounded-xl text-[11px] font-bold border transition-colors ${
                                    isMe
                                      ? 'bg-white/10 hover:bg-white/20 text-white border-white/20'
                                      : 'bg-gray-50 hover:bg-gray-100 text-gray-800 border-gray-200'
                                  }`}
                                >
                                  <FileText size={14} className="shrink-0 text-amber-300" />
                                  <span className="truncate flex-1">{att.filename}</span>
                                  <Download size={13} className="shrink-0 opacity-80" />
                                </a>
                              ))}
                            </div>
                          )}

                          <div
                            className={`flex items-center justify-end gap-1 text-[9px] mt-1 ${
                              isMe ? 'text-indigo-200' : 'text-gray-400'
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

              {/* Formulaire de saisie direct 1-à-1 */}
              <form onSubmit={handleSendDirect} className="p-3 border-t border-gray-150 flex items-center gap-2 bg-white">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleDirectFileUpload}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending}
                  className="p-2.5 text-gray-400 hover:text-indigo-600 rounded-xl hover:bg-gray-100 transition-colors"
                  title="Joindre un document (PDF, Word, etc.)"
                >
                  <Paperclip size={18} />
                </button>

                <input
                  type="text"
                  placeholder={`Écrire à ${selectedAgent.agencyName}...`}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="input text-xs flex-1 py-2.5 rounded-xl"
                />

                <button
                  type="submit"
                  disabled={sending || !text.trim()}
                  className="btn-primary text-xs py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>Envoyer</span>
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400 space-y-2">
              <Users size={36} className="text-gray-300" />
              <p className="font-bold text-gray-600 text-sm">Sélectionnez un agent pour démarrer la discussion.</p>
            </div>
          )}
        </div>
      </div>

      {/* MODALE DE DIFFUSION GROUPÉE À TOUS LES AGENTS */}
      {broadcastOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-150 space-y-4 animate-scale-up">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
                  <Radio size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Diffusion Groupée aux Agents</h3>
                  <p className="text-xs text-gray-500">Transmettre un message et des documents à tous les agents ({agents.length})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBroadcastOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            {broadcastError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{broadcastError}</span>
              </div>
            )}

            <form onSubmit={handleSendBroadcast} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Objet / Titre de la communication</label>
                <input
                  type="text"
                  placeholder="Ex : Note de service N° 04 - Rappel des procédures de collecte"
                  value={broadcastSubject}
                  onChange={(e) => setBroadcastSubject(e.target.value)}
                  className="input text-xs w-full font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Message d'information *</label>
                <textarea
                  rows={4}
                  placeholder="Rédigez ici le contenu de la note d'orientation..."
                  value={broadcastBody}
                  onChange={(e) => setBroadcastBody(e.target.value)}
                  className="input text-xs w-full py-2.5 leading-relaxed"
                  required
                />
              </div>

              {/* Pièces jointes (PDF, Word, etc.) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-gray-700">Pièces jointes officielles (PDF, Word, Excel)</label>
                  <button
                    type="button"
                    onClick={() => broadcastFileInputRef.current?.click()}
                    disabled={uploadingFile}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <Paperclip size={13} />
                    <span>{uploadingFile ? 'Envoi en cours...' : '+ Ajouter un fichier'}</span>
                  </button>
                </div>

                <input
                  type="file"
                  ref={broadcastFileInputRef}
                  onChange={handleBroadcastFileUpload}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  className="hidden"
                />

                {broadcastAttachments.length === 0 ? (
                  <p className="text-[11px] text-gray-400 italic">Aucune pièce jointe ajoutée.</p>
                ) : (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {broadcastAttachments.map((att, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 rounded-xl bg-gray-50 border border-gray-200 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText size={15} className="text-amber-600 shrink-0" />
                          <span className="font-semibold text-gray-800 truncate">{att.filename}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setBroadcastAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                          className="text-gray-400 hover:text-red-600 p-1"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl text-[11px] text-indigo-900 leading-snug">
                Ce message sera délivré instantanément dans l'espace de chaque agent de collecte actif avec notification push.
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBroadcastOpen(false)}
                  className="btn-secondary text-xs flex-1 py-2.5 rounded-xl font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={sendingBroadcast || uploadingFile}
                  className="btn-primary text-xs flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-md"
                >
                  {sendingBroadcast ? <Loader2 size={15} className="animate-spin" /> : <Radio size={15} />}
                  <span>Diffuser à tous ({agents.length})</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
