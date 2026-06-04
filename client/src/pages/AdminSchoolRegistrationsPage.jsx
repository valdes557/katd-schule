import { useEffect, useState, useRef } from 'react'
import { School, Check, X, Loader2, Clock, CheckCircle2, XCircle, Phone, Mail, Download, Image, ChevronDown, ChevronUp, ExternalLink, RefreshCw, Trash2, KeyRound, AlertTriangle, MessageCircle } from 'lucide-react'
import { schoolRegistrationApi } from '../lib/api'
import { cn } from '../lib/utils'

const STATUS_MAP = {
  pending: { label: 'En attente', icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  approved: { label: 'Approuvée', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  rejected: { label: 'Rejetée', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
}

export default function AdminSchoolRegistrationsPage() {
  const [registrations, setRegistrations] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [showRejectModal, setShowRejectModal] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [credentialsModal, setCredentialsModal] = useState(null)
  const [confirmModal, setConfirmModal] = useState(null)
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  const showToast = (type, message) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ type, message })
    toastTimer.current = setTimeout(() => setToast(null), 5000)
  }

  const load = async (newFilter) => {
    setLoading(true)
    try {
      const f = newFilter !== undefined ? newFilter : filter
      const res = await schoolRegistrationApi.list(`status=${f}`)
      setRegistrations(res.data || [])
    } catch (e) { showToast('error', 'Erreur de chargement : ' + e.message) }
    setLoading(false)
  }

  useEffect(() => { load() }, [filter])

  const handleApprove = (reg) => {
    setConfirmModal({ id: reg._id, action: 'approve', schoolName: reg.schoolName, directorName: reg.directorName, email: reg.email })
  }

  const handleRevoke = (reg) => {
    setConfirmModal({ id: reg._id, action: 'revoke', schoolName: reg.schoolName, directorName: reg.directorName })
  }

  const executeConfirm = async () => {
    if (!confirmModal) return
    const { id, action } = confirmModal
    setConfirmModal(null)
    setProcessing(id)
    try {
      if (action === 'approve') {
        const result = await schoolRegistrationApi.approve(id)
        const pwd = result.data?.user?.rawPassword
        const email = result.data?.user?.email || confirmModal.email
        const waLink = result.whatsappLink || result.data?.whatsappLink || null
        // Auto-open WhatsApp tab so the admin can send credentials in one click
        if (waLink) {
          try { window.open(waLink, '_blank', 'noopener,noreferrer') } catch (err) { console.error(err) }
        }
        // Always display credentials so the admin can transmit them manually if email is delayed/filtered
        setCredentialsModal({
          email,
          password: pwd || '(voir logs serveur)',
          whatsappLink: waLink,
          sent: !!result.emailSent,
          error: result.emailSent ? null : (result.message || 'SMTP non configuré'),
        })
        if (result.emailSent) {
          showToast('success', `✅ Compte créé. Email envoyé à ${email}. Conservez aussi le mot de passe affiché en cas de filtrage.`)
        } else {
          showToast('warning', 'Compte créé mais email non envoyé — identifiants affichés ci-dessous.')
        }
        setExpandedId(null)
        setFilter('approved')
        await load('approved')
      } else if (action === 'revoke') {
        await schoolRegistrationApi.revoke(id)
        showToast('success', `✅ Compte de "${confirmModal.schoolName}" révoqué. Le dossier peut être resoumis.`)
        await load('approved')
      }
    } catch (e) {
      showToast('error', '❌ Erreur : ' + e.message)
    }
    setProcessing(null)
  }

  const handleResend = async (id) => {
    setProcessing(id)
    try {
      const reg = registrations.find((r) => r._id === id)
      const result = await schoolRegistrationApi.resendCredentials(id)
      const waLink = result.whatsappLink || null
      if (waLink) {
        try { window.open(waLink, '_blank', 'noopener,noreferrer') } catch (err) { console.error(err) }
      }
      setCredentialsModal({
        email: reg?.email,
        password: result.rawPassword || '(inconnu)',
        whatsappLink: waLink,
        sent: result.emailSent,
        error: result.emailSent ? null : result.message,
      })
      if (result.emailSent) showToast('success', 'Nouveaux identifiants envoyés par email.')
    } catch (e) { showToast('error', '❌ Erreur : ' + e.message) }
    setProcessing(null)
  }

  const handleReject = async () => {
    if (!showRejectModal) return
    setProcessing(showRejectModal)
    try {
      await schoolRegistrationApi.reject(showRejectModal, rejectReason)
      setShowRejectModal(null)
      setRejectReason('')
      setExpandedId(null)
      showToast('success', 'Demande rejetée et email envoyé.')
      await load()
    } catch (e) { showToast('error', '❌ Erreur : ' + e.message) }
    setProcessing(null)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg border text-sm font-medium max-w-md w-full transition-all',
          toast.type === 'success' && 'bg-green-50 border-green-300 text-green-800',
          toast.type === 'error' && 'bg-red-50 border-red-300 text-red-800',
          toast.type === 'warning' && 'bg-amber-50 border-amber-300 text-amber-800',
        )}>
          {toast.type === 'success' && <CheckCircle2 size={18} className="text-green-600 flex-shrink-0" />}
          {toast.type === 'error' && <XCircle size={18} className="text-red-600 flex-shrink-0" />}
          {toast.type === 'warning' && <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" />}
          <span className="flex-1">{toast.message}</span>
          <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100"><X size={14} /></button>
        </div>
      )}

      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <School size={22} className="text-blue-600" /> Demandes de souscription
        </h1>
        <p className="text-sm text-gray-500">Examinez, vérifiez la preuve de paiement, puis approuvez ou rejetez.</p>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {['pending', 'approved', 'rejected'].map((s) => {
          const st = STATUS_MAP[s]
          return (
            <button key={s} onClick={() => setFilter(s)} className={cn('px-4 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5', filter === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500')}>
              <st.icon size={12} /> {st.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="text-center py-16"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div>
      ) : registrations.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <School size={40} className="mx-auto mb-3 opacity-20" />
          <p>Aucune demande {filter === 'pending' ? 'en attente' : filter === 'approved' ? 'approuvée' : 'rejetée'}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {registrations.map((reg) => {
            const st = STATUS_MAP[reg.status]
            const expanded = expandedId === reg._id
            const isProcessing = processing === reg._id
            return (
              <div key={reg._id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Card header */}
                <div
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedId(expanded ? null : reg._id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <School size={18} className="text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">{reg.schoolName}</h3>
                      <p className="text-xs text-gray-500">{reg.directorName} · Cycle {reg.cycle} · {reg.plan === 'annual' ? 'Annuel' : 'Trimestriel'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full border', st.bg, st.border, st.color)}>
                      <span className="flex items-center gap-1"><st.icon size={10} /> {st.label}</span>
                    </span>
                    <span className="text-sm font-bold text-gray-900">{reg.amount?.toLocaleString()} F</span>
                    {reg.paymentProof && <span className="text-[10px] bg-green-50 text-green-600 border border-green-200 px-2 py-0.5 rounded-full">✅ Preuve jointe</span>}
                    {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                  </div>
                </div>

                {/* Expanded detail */}
                {expanded && (
                  <div className="border-t border-gray-100 p-4 space-y-4 bg-gray-50">
                    {/* Info grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="bg-white rounded-lg p-3 border border-gray-100">
                        <p className="text-xs text-gray-400 mb-0.5">Localisation</p>
                        <p className="text-gray-800 font-medium">📍 {reg.neighborhoodName ? reg.neighborhoodName + ', ' : ''}{reg.cityName}, {reg.countryName}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-gray-100">
                        <p className="text-xs text-gray-400 mb-0.5">Contact</p>
                        <p className="text-gray-800 flex items-center gap-1.5"><Phone size={12} /> {reg.whatsapp}</p>
                        <p className="text-gray-800 flex items-center gap-1.5 mt-0.5"><Mail size={12} /> {reg.email}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-gray-100">
                        <p className="text-xs text-gray-400 mb-0.5">Plan souscrit</p>
                        <p className="text-gray-800 font-medium">{reg.cycle} — {reg.plan === 'annual' ? 'Annuel' : 'Trimestriel'}</p>
                        <p className="text-green-600 font-bold">{reg.amount?.toLocaleString()} F CFA</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-gray-100">
                        <p className="text-xs text-gray-400 mb-0.5">Date de soumission</p>
                        <p className="text-gray-800">{new Date(reg.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                      </div>
                    </div>

                    {/* Payment proof */}
                    <div className="bg-white rounded-xl border border-gray-100 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                          <Image size={14} className="text-blue-600" /> Preuve de paiement
                        </h4>
                        {reg.paymentProof && (
                          <div className="flex gap-2">
                            <a href={reg.paymentProof} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1 text-blue-600 hover:underline">
                              <ExternalLink size={11} /> Ouvrir
                            </a>
                            <a href={reg.paymentProof} download className="text-xs flex items-center gap-1 text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded-md transition-colors">
                              <Download size={11} /> Télécharger
                            </a>
                          </div>
                        )}
                      </div>
                      {reg.paymentProof ? (
                        <img src={reg.paymentProof} alt="Preuve de paiement" className="max-h-72 rounded-lg object-contain w-full bg-gray-100" />
                      ) : (
                        <div className="text-center py-8 text-gray-400">
                          <Image size={32} className="mx-auto mb-2 opacity-20" />
                          <p className="text-xs">Aucune preuve de paiement jointe</p>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    {reg.status === 'pending' && (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleApprove(reg) }}
                          disabled={!!processing}
                          className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          Approuver — Créer le compte directeur
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowRejectModal(reg._id) }}
                          className="flex items-center justify-center gap-2 bg-red-50 text-red-600 border border-red-200 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-100 transition-colors"
                        >
                          <X size={14} /> Rejeter
                        </button>
                      </div>
                    )}
                    {reg.status === 'approved' && (
                      <div className="space-y-2">
                        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-xs text-green-700 flex items-center gap-2">
                          <CheckCircle2 size={14} /> Approuvée le {reg.approvedAt ? new Date(reg.approvedAt).toLocaleDateString('fr-FR') : '—'} — Compte directeur actif.
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleResend(reg._id) }}
                            disabled={!!processing}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors disabled:opacity-50"
                          >
                            {isProcessing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                            Renvoyer identifiants
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRevoke(reg) }}
                            disabled={!!processing}
                            className="flex items-center justify-center gap-1.5 bg-red-50 text-red-600 border border-red-200 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
                          >
                            <Trash2 size={12} /> Révoquer compte
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Confirm modal (approve / revoke) */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-start gap-4 mb-5">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', confirmModal.action === 'approve' ? 'bg-green-100' : 'bg-red-100')}>
                {confirmModal.action === 'approve'
                  ? <Check size={20} className="text-green-600" />
                  : <AlertTriangle size={20} className="text-red-600" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  {confirmModal.action === 'approve' ? 'Approuver cette demande ?' : 'Révoquer ce compte ?'}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {confirmModal.action === 'approve'
                    ? <>Un compte directeur sera créé pour <strong>{confirmModal.directorName}</strong> ({confirmModal.schoolName}) et les identifiants envoyés à <strong>{confirmModal.email}</strong>.</>
                    : <>Le compte de <strong>{confirmModal.directorName}</strong>, l'école <strong>{confirmModal.schoolName}</strong> et cette demande seront supprimés définitivement. Un nouveau dossier pourra être soumis avec le même email.</>}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                Annuler
              </button>
              <button
                onClick={executeConfirm}
                className={cn('flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors', confirmModal.action === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700')}
              >
                {confirmModal.action === 'approve' ? <><Check size={14} /> Oui, approuver</> : <><Trash2 size={14} /> Oui, révoquer</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credentials modal */}
      {credentialsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <KeyRound size={16} className="text-blue-600" /> Identifiants du directeur
              </h3>
              <button onClick={() => setCredentialsModal(null)} className="p-1 hover:bg-gray-100 rounded"><X size={16} /></button>
            </div>
            {credentialsModal.sent
              ? <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-700 mb-4 flex items-center gap-2"><CheckCircle2 size={13} /> Email envoyé avec succès au directeur.</div>
              : <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 mb-4"><AlertTriangle size={13} className="inline mr-1" />Email non envoyé ({credentialsModal.error}). Transmettez manuellement :</div>
            }
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
              {credentialsModal.email && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Email du directeur</p>
                  <p className="text-sm font-semibold text-gray-900 select-all">{credentialsModal.email}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-400 mb-1">Mot de passe temporaire</p>
                <p className="text-2xl font-bold text-blue-700 tracking-[0.2em] select-all font-mono">{credentialsModal.password}</p>
                <p className="text-[11px] text-gray-400 mt-2">Cliquez sur le mot de passe pour le sélectionner, puis copiez-le.</p>
              </div>
              <button
                onClick={() => { navigator.clipboard?.writeText(`Email: ${credentialsModal.email || ''}\nMot de passe: ${credentialsModal.password}`); showToast('success', 'Identifiants copiés dans le presse-papier') }}
                className="w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 py-2 rounded-lg text-xs font-semibold"
              >
                📋 Copier email + mot de passe
              </button>
            </div>
            {credentialsModal.whatsappLink && (
              <a
                href={credentialsModal.whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <MessageCircle size={14} /> Envoyer par WhatsApp
              </a>
            )}
            <button onClick={() => setCredentialsModal(null)} className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
              OK, compris
            </button>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <XCircle size={20} className="text-red-500" /> Rejeter la demande
            </h3>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} className="input text-sm resize-none w-full" placeholder="Motif du rejet (optionnel, sera envoyé par email)..." />
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowRejectModal(null); setRejectReason('') }} className="btn-ghost flex-1 justify-center border border-gray-200">Annuler</button>
              <button onClick={handleReject} disabled={!!processing} className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 flex items-center justify-center gap-2">
                {processing ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />} Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
