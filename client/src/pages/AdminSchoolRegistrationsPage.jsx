import { useEffect, useState } from 'react'
import { School, Check, X, Loader2, Clock, CheckCircle2, XCircle, Phone, Mail, Download, Image, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
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

  const load = async () => {
    setLoading(true)
    try {
      const res = await schoolRegistrationApi.list(`status=${filter}`)
      setRegistrations(res.data || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [filter])

  const handleApprove = async (id) => {
    if (!window.confirm('Approuver cette demande ? Un compte directeur sera créé et les identifiants envoyés par email.')) return
    setProcessing(id)
    try {
      const result = await schoolRegistrationApi.approve(id)
      if (result.emailSent) {
        alert('✅ Approuvé ! Le reçu et les identifiants ont été envoyés par email au directeur.')
      } else {
        alert('⚠️ Compte créé avec succès mais l\'email n\'a pas pu être envoyé. Identifiants : ' + (result.data?.user?.rawPassword ? `Email: ${result.data.user.email}, Mot de passe: ${result.data.user.rawPassword}` : 'Consultez les logs.'))
      }
      load()
      setExpandedId(null)
    } catch (e) { alert('❌ Erreur : ' + e.message) }
    setProcessing(null)
  }

  const handleReject = async () => {
    if (!showRejectModal) return
    setProcessing(showRejectModal)
    try {
      await schoolRegistrationApi.reject(showRejectModal, rejectReason)
      setShowRejectModal(null)
      setRejectReason('')
      load()
      setExpandedId(null)
    } catch (e) { alert(e.message) }
    setProcessing(null)
  }

  return (
    <div className="space-y-5 animate-fade-in">
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
                          onClick={() => handleApprove(reg._id)}
                          disabled={!!processing}
                          className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          Approuver — Créer le compte directeur
                        </button>
                        <button
                          onClick={() => setShowRejectModal(reg._id)}
                          className="flex items-center justify-center gap-2 bg-red-50 text-red-600 border border-red-200 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-100 transition-colors"
                        >
                          <X size={14} /> Rejeter
                        </button>
                      </div>
                    )}
                    {reg.status === 'approved' && (
                      <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 flex items-center gap-2">
                        <CheckCircle2 size={15} /> Approuvée — Compte directeur créé et identifiants envoyés par email.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
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
