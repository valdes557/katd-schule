import { useState } from 'react'
import { UserPlus, Check, X, Loader2, Eye, Clock, CheckCircle2, XCircle, Lock, Unlock, AlertCircle } from 'lucide-react'
import { enrollmentApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'
import { cn } from '../lib/utils'

const STATUS_MAP = {
  pending: { label: 'En attente', icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  approved: { label: 'Approuvée', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  rejected: { label: 'Rejetée', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
}

export default function InscriptionsPage() {
  const [filter, setFilter] = useState('pending')
  const [selected, setSelected] = useState(null)
  const [showRejectModal, setShowRejectModal] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing] = useState(false)

  const enrollmentsQ = useCachedFetch(
    `/enrollments?status=${filter}`,
    async () => {
      const res = await enrollmentApi.list(`status=${filter}`)
      return res.data || []
    },
    [filter],
  )

  const enrollments = enrollmentsQ.data || []
  const loading = enrollmentsQ.loading

  const refreshEnrollments = () => {
    cache.invalidate('/enrollments')
    enrollmentsQ.refetch()
  }

  const handleApprove = async (id) => {
    setProcessing(true)
    try {
      const r = await enrollmentApi.approve(id)
      // Auto-open WhatsApp with pre-filled receipt if phone was provided
      if (r?.data?.whatsappLink) {
        window.open(r.data.whatsappLink, '_blank', 'noopener,noreferrer')
      }
      refreshEnrollments()
      setSelected(null)
    } catch (e) { alert(e.message) }
    setProcessing(false)
  }

  const handleReject = async () => {
    if (!showRejectModal) return
    setProcessing(true)
    try {
      await enrollmentApi.reject(showRejectModal, rejectReason)
      setShowRejectModal(null)
      setRejectReason('')
      refreshEnrollments()
      setSelected(null)
    } catch (e) { alert(e.message) }
    setProcessing(false)
  }

  const handleBlock = async (studentId) => {
    try {
      await enrollmentApi.blockStudent(studentId)
      refreshEnrollments()
    } catch (e) { alert(e.message) }
  }

  const handleUnblock = async (studentId) => {
    try {
      await enrollmentApi.unblockStudent(studentId)
      refreshEnrollments()
    } catch (e) { alert(e.message) }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <UserPlus size={22} className="text-blue-600" /> Demandes d'inscription
          </h1>
          <p className="text-sm text-gray-500">Gérez les inscriptions en ligne de votre école</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {['pending', 'approved', 'rejected'].map((s) => {
          const st = STATUS_MAP[s]
          return (
            <button key={s} onClick={() => setFilter(s)} className={cn('px-4 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5', filter === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              <st.icon size={12} /> {st.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="text-center py-16"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div>
      ) : enrollments.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <UserPlus size={40} className="mx-auto mb-3 opacity-20" />
          <p>Aucune demande {filter === 'pending' ? 'en attente' : filter === 'approved' ? 'approuvée' : 'rejetée'}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {enrollments.map((enr) => {
            const st = STATUS_MAP[enr.status]
            return (
              <div key={enr._id} className="card p-4 hover:shadow-card transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">
                      {enr.firstName?.[0]}{enr.lastName?.[0]}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">{enr.lastName} {enr.firstName}</h3>
                      <p className="text-xs text-gray-500">{enr.email} · {enr.className}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full border', st.bg, st.border, st.color)}>
                      {st.label}
                    </span>
                    <span className="text-sm font-bold text-gray-900">{enr.amount?.toLocaleString()} F</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
                  <span>Né(e) le {new Date(enr.dateOfBirth).toLocaleDateString('fr-FR')}</span>
                  <span>à {enr.placeOfBirth}</span>
                  <span>{enr.gender === 'M' ? 'Masculin' : 'Féminin'}</span>
                  <span>Soumis le {new Date(enr.createdAt).toLocaleDateString('fr-FR')}</span>
                </div>

                <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-600">
                  <span>Père: {enr.fatherName || '—'}</span>
                  <span>Mère: {enr.motherName || '—'}</span>
                  <span>Contact père: {enr.fatherPhone || '—'}</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                  {enr.paymentProof && (
                    <a href={enr.paymentProof.startsWith('http') ? enr.paymentProof : `${import.meta.env.VITE_API_URL || ''}${enr.paymentProof}`} target="_blank" rel="noopener" className="text-xs flex items-center gap-1 text-blue-600 hover:underline">
                      <Eye size={12} /> Voir preuve
                    </a>
                  )}
                  {enr.status === 'pending' && (
                    <>
                      <button onClick={() => handleApprove(enr._id)} disabled={processing} className="ml-auto text-xs flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors">
                        <Check size={12} /> Approuver
                      </button>
                      <button onClick={() => setShowRejectModal(enr._id)} className="text-xs flex items-center gap-1 bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors">
                        <X size={12} /> Rejeter
                      </button>
                    </>
                  )}
                  {enr.status === 'approved' && enr.studentCreated && (
                    <button onClick={() => handleBlock(enr.studentCreated)} className="ml-auto text-xs flex items-center gap-1 bg-orange-50 text-orange-600 border border-orange-200 px-3 py-1.5 rounded-lg hover:bg-orange-100 transition-colors">
                      <Lock size={12} /> Bloquer élève
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <XCircle size={20} className="text-red-500" /> Rejeter la demande
            </h3>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Motif du rejet (optionnel)</label>
              <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} className="input text-sm resize-none" placeholder="Ex: Documents incomplets, paiement non valide..." />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowRejectModal(null); setRejectReason('') }} className="btn-ghost flex-1 justify-center border border-gray-200">Annuler</button>
              <button onClick={handleReject} disabled={processing} className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 flex items-center justify-center gap-2">
                {processing ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />} Confirmer le rejet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
