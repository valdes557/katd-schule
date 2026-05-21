import { useEffect, useState } from 'react'
import { School, Check, X, Loader2, Clock, CheckCircle2, XCircle, Eye, Phone, Mail } from 'lucide-react'
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
  const [processing, setProcessing] = useState(false)
  const [detail, setDetail] = useState(null)

  const fetch = async () => {
    setLoading(true)
    try {
      const res = await schoolRegistrationApi.list(`status=${filter}`)
      setRegistrations(res.data || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { fetch() }, [filter])

  const handleApprove = async (id) => {
    setProcessing(true)
    try {
      await schoolRegistrationApi.approve(id)
      fetch()
      setDetail(null)
    } catch (e) { alert(e.message) }
    setProcessing(false)
  }

  const handleReject = async () => {
    if (!showRejectModal) return
    setProcessing(true)
    try {
      await schoolRegistrationApi.reject(showRejectModal, rejectReason)
      setShowRejectModal(null)
      setRejectReason('')
      fetch()
      setDetail(null)
    } catch (e) { alert(e.message) }
    setProcessing(false)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <School size={22} className="text-blue-600" /> Demandes de souscription
        </h1>
        <p className="text-sm text-gray-500">Gérez les demandes d'inscription des écoles</p>
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
            return (
              <div key={reg._id} className="card p-4 hover:shadow-card transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">{reg.schoolName}</h3>
                    <p className="text-xs text-gray-500">{reg.directorName} · {reg.cycle} · {reg.plan === 'annual' ? 'Annuel' : 'Trimestriel'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full border', st.bg, st.border, st.color)}>{st.label}</span>
                    <span className="text-sm font-bold text-gray-900">{reg.amount?.toLocaleString()} F</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
                  <span>📍 {reg.neighborhoodName ? reg.neighborhoodName + ', ' : ''}{reg.cityName}, {reg.countryName}</span>
                  <span className="flex items-center gap-1"><Phone size={10} /> {reg.whatsapp}</span>
                  <span className="flex items-center gap-1"><Mail size={10} /> {reg.email}</span>
                  <span>Soumis le {new Date(reg.createdAt).toLocaleDateString('fr-FR')}</span>
                </div>

                {reg.paymentMethods?.length > 0 && (
                  <div className="mt-2 text-xs text-gray-500">
                    💳 {reg.paymentMethods.map((pm) => `${pm.provider || 'Mobile Money'}: ${pm.accountNumber} (${pm.accountName})`).join(' · ')}
                  </div>
                )}

                {reg.status === 'pending' && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                    <button onClick={() => handleApprove(reg._id)} disabled={processing} className="ml-auto text-xs flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors">
                      <Check size={12} /> Approuver
                    </button>
                    <button onClick={() => setShowRejectModal(reg._id)} className="text-xs flex items-center gap-1 bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors">
                      <X size={12} /> Rejeter
                    </button>
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
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <XCircle size={20} className="text-red-500" /> Rejeter la demande
            </h3>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} className="input text-sm resize-none w-full" placeholder="Motif du rejet (optionnel)..." />
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowRejectModal(null); setRejectReason('') }} className="btn-ghost flex-1 justify-center border border-gray-200">Annuler</button>
              <button onClick={handleReject} disabled={processing} className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 flex items-center justify-center gap-2">
                {processing ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />} Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
