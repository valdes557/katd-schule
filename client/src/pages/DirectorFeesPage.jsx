import { useEffect, useState, useRef } from 'react'
import {
  CreditCard, Plus, Trash2, Loader2, CheckCircle2, Bell,
  AlertCircle, X, ChevronDown, ChevronUp, Users, Search,
} from 'lucide-react'
import { feesApi, classesApi, studentsApi } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useCachedFetch } from '../hooks/useCachedFetch'
import DownloadPdfButton from '../components/DownloadPdfButton'

const FMT = (n) => Number(n || 0).toLocaleString('fr-FR')
const STATUS_COLORS = { pending: 'bg-gray-100 text-gray-600', partial: 'bg-amber-100 text-amber-700', paid: 'bg-green-100 text-green-700', overdue: 'bg-red-100 text-red-700' }
const STATUS_LABELS = { pending: 'En attente', partial: 'Partiel', paid: 'Payé', overdue: 'En retard' }
const METHOD_LABELS = { cash: 'Espèces', mobile_money: 'Mobile Money', bank: 'Banque', online: 'En ligne' }

const EMPTY_FEE = { label: 'Frais de scolarité', type: 'scolarite', amount: '', dueDate: '', paymentMode: 'complet', term: '', academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}` }
const EMPTY_INST = { label: '1ère tranche', amount: '', dueDate: '' }

export default function DirectorFeesPage() {
  const pdfRef = useRef(null)
  const { user, school } = useAuth()
  // Charge les classes via le même cache que la page « Classes » (clé identique
  // tenant compte du cycle souscrit) pour garantir la parité d'affichage.
  const subscribedCycle = user?.role === 'directeur' && school?.subscription?.cycle ? school.subscription.cycle : ''
  const classesQ = useCachedFetch(
    `/classes?${subscribedCycle ? `cycle=${subscribedCycle}` : ''}`,
    async () => (await classesApi.list(subscribedCycle ? `cycle=${subscribedCycle}` : '')).data || [],
    [subscribedCycle],
  )
  const classes = classesQ.data || []
  const [selectedClass, setSelectedClass] = useState('')
  const [paymentStatus, setPaymentStatus] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [showFeeModal, setShowFeeModal] = useState(null) // student object
  const [feeForm, setFeeForm] = useState(EMPTY_FEE)
  const [installments, setInstallments] = useState([])
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [payModal, setPayModal] = useState(null) // { feeId, installmentIndex?, total }
  const [payForm, setPayForm] = useState({ amount: '', method: 'cash', reference: '', note: '' })
  const [paying, setPaying] = useState(false)
  const [bulkModal, setBulkModal] = useState(false)
  const [bulkForm, setBulkForm] = useState({ scope: 'all', source: 'modality', label: 'Frais de scolarité', type: 'scolarite', amount: '', dueDate: '', term: '' })
  const [bulkInstallments, setBulkInstallments] = useState([])
  const [bulkSaving, setBulkSaving] = useState(false)

  const loadPaymentStatus = async (classId) => {
    if (!classId) return
    setLoading(true)
    try { const r = await feesApi.paymentStatus(classId); setPaymentStatus(r.data || []) } catch (_) {}
    setLoading(false)
  }

  useEffect(() => { loadPaymentStatus(selectedClass) }, [selectedClass])

  const filteredStudents = paymentStatus.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.matricule?.toLowerCase().includes(search.toLowerCase())
  )

  const addInstallment = () => setInstallments([...installments, { ...EMPTY_INST }])
  const removeInstallment = (i) => setInstallments(installments.filter((_, idx) => idx !== i))
  const updateInstallment = (i, field, value) => {
    const next = [...installments]
    next[i] = { ...next[i], [field]: value }
    setInstallments(next)
  }

  const handleCreateFee = async (e) => {
    e.preventDefault()
    if (!showFeeModal) return
    setSaving(true)
    try {
      const payload = {
        ...feeForm,
        studentId: showFeeModal._id,
        amount: Number(feeForm.amount),
        installments: feeForm.paymentMode === 'tranches' ? installments.map((inst) => ({ ...inst, amount: Number(inst.amount) })) : [],
      }
      const r = await feesApi.create(payload)
      if (r.success) {
        setShowFeeModal(null)
        setFeeForm(EMPTY_FEE)
        setInstallments([])
        loadPaymentStatus(selectedClass)
      } else alert(r.message || 'Erreur')
    } catch (err) { alert(err.message) }
    setSaving(false)
  }

  const handleRecordPayment = async (e) => {
    e.preventDefault()
    if (!payModal) return
    setPaying(true)
    try {
      const payload = { ...payForm, amount: Number(payForm.amount) }
      if (payModal.installmentIndex !== undefined) payload.installmentIndex = payModal.installmentIndex
      const r = await feesApi.recordPayment(payModal.feeId, payload)
      if (r.success) {
        setPayModal(null)
        setPayForm({ amount: '', method: 'cash', reference: '', note: '' })
        loadPaymentStatus(selectedClass)
      } else alert(r.message || 'Erreur')
    } catch (err) { alert(err.message) }
    setPaying(false)
  }

  const notifyInstallment = async (feeId, installmentIndex) => {
    try {
      const r = await feesApi.notifyInstallment(feeId, installmentIndex)
      alert(r.message || 'Rappel envoyé')
    } catch (err) { alert(err.message) }
  }

  const handleBulkAssign = async (e) => {
    e.preventDefault()
    setBulkSaving(true)
    try {
      const payload = {
        scope: bulkForm.scope,
        source: bulkForm.source,
        label: bulkForm.label,
        type: bulkForm.type,
        dueDate: bulkForm.dueDate || undefined,
        term: bulkForm.term || undefined,
      }
      if (bulkForm.source === 'manual') {
        payload.amount = Number(bulkForm.amount)
        if (bulkInstallments.length > 0) {
          payload.paymentMode = 'tranches'
          payload.installments = bulkInstallments.map((inst) => ({ ...inst, amount: Number(inst.amount) }))
        } else {
          payload.paymentMode = 'complet'
        }
      }
      const r = await feesApi.bulkAssign(payload)
      if (r.success) {
        const { created, skipped, noModality } = r.data
        let msg = `${created} frais créé(s).`
        if (skipped) msg += ` ${skipped} ignoré(s) (déjà existant / montant nul).`
        if (noModality) msg += ` ${noModality} élève(s) sans modalité de paiement définie.`
        alert(msg)
        setBulkModal(false)
        setBulkForm({ scope: 'all', source: 'modality', label: 'Frais de scolarité', type: 'scolarite', amount: '', dueDate: '', term: '' })
        setBulkInstallments([])
        if (selectedClass) loadPaymentStatus(selectedClass)
      } else alert(r.message || 'Erreur')
    } catch (err) { alert(err.message) }
    setBulkSaving(false)
  }

  return (
    <div className="space-y-5 animate-fade-in" ref={pdfRef}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><CreditCard size={22} className="text-blue-600" /> Gestion des Frais & Pensions</h1>
          <p className="text-sm text-gray-500">Suivi des paiements et gestion des tranches par classe</p>
        </div>
        <div className="flex gap-2">
          <DownloadPdfButton containerRef={pdfRef} filename="pensions-frais.pdf" title="Frais & Pensions" label="Frais PDF" />
          <button onClick={() => setBulkModal(true)} className="btn-primary text-sm self-start"><Users size={15} /> Assigner les frais en masse</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="input text-sm w-auto min-w-[200px]">
          <option value="">— Sélectionner une classe —</option>
          {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        {selectedClass && (
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un élève..." className="input pl-9 text-sm" />
          </div>
        )}
      </div>

      {!selectedClass ? (
        <div className="text-center py-16 text-gray-400">
          <Users size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Sélectionnez une classe pour voir les paiements</p>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-blue-600" /></div>
      ) : (
        <div className="space-y-3">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-4 text-center">
              <p className="text-lg font-bold text-green-600">{filteredStudents.filter((s) => s.fullyPaid).length}</p>
              <p className="text-xs text-gray-500">Totalement payés</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-lg font-bold text-amber-600">{filteredStudents.filter((s) => !s.fullyPaid && s.totalPaid > 0).length}</p>
              <p className="text-xs text-gray-500">Paiement partiel</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-lg font-bold text-red-500">{filteredStudents.filter((s) => s.totalDue > 0 && s.totalPaid === 0).length}</p>
              <p className="text-xs text-gray-500">Aucun paiement</p>
            </div>
          </div>

          {filteredStudents.map((s) => (
            <div key={s.studentId} className="card overflow-hidden">
              <div
                className="p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpanded(expanded === s.studentId ? null : s.studentId)}
              >
                <div className={`w-2 h-8 rounded-full flex-shrink-0 ${s.fullyPaid ? 'bg-green-400' : s.totalPaid > 0 ? 'bg-amber-400' : s.totalDue > 0 ? 'bg-red-400' : 'bg-gray-200'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">{s.name}</p>
                  <p className="text-xs text-gray-500">{s.matricule}</p>
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-gray-900">{FMT(s.totalPaid)} / {FMT(s.totalDue)} F CFA</p>
                  <p className="text-xs text-red-500">Reste : {FMT(s.remaining)} F</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s.fullyPaid ? 'bg-green-100 text-green-700' : s.totalPaid > 0 ? 'bg-amber-100 text-amber-700' : s.totalDue > 0 ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-500'}`}>
                  {s.fullyPaid ? '✅ Soldé' : s.totalPaid > 0 ? '⚡ Partiel' : s.totalDue > 0 ? '❌ Impayé' : 'Aucun frais'}
                </span>
                {expanded === s.studentId ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              </div>

              {expanded === s.studentId && (
                <div className="border-t border-gray-100 p-4 space-y-3">
                  <div className="flex justify-end">
                    <button onClick={() => { setShowFeeModal(s); setFeeForm(EMPTY_FEE); setInstallments([]) }} className="btn-primary text-xs">
                      <Plus size={12} /> Ajouter des frais
                    </button>
                  </div>

                  {s.fees.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-2">Aucun frais enregistré</p>
                  ) : (
                    s.fees.map((fee) => (
                      <div key={fee._id} className="bg-gray-50 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{fee.label}</p>
                            <p className="text-xs text-gray-500">{FMT(fee.paid)} / {FMT(fee.amount)} F CFA · {fee.paymentMode === 'tranches' ? 'En tranches' : 'Paiement complet'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[fee.status] || 'bg-gray-100 text-gray-500'}`}>{STATUS_LABELS[fee.status] || fee.status}</span>
                            {fee.status !== 'paid' && (
                              <button onClick={() => { setPayModal({ feeId: fee._id, total: fee.amount - fee.paid }); setPayForm({ amount: '', method: 'cash', reference: '', note: '' }) }} className="btn-ghost text-xs py-1 px-2">Payer</button>
                            )}
                          </div>
                        </div>

                        {fee.paymentMode === 'tranches' && fee.installments?.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wide">Tranches :</p>
                            {fee.installments.map((inst, idx) => (
                              <div key={idx} className={`flex items-center gap-2 py-1.5 px-2 rounded-lg ${inst.paid ? 'bg-green-50' : new Date(inst.dueDate) < new Date() ? 'bg-red-50' : 'bg-white border border-gray-100'}`}>
                                <span className={`text-[10px] ${inst.paid ? 'text-green-600' : 'text-gray-500'}`}>{inst.paid ? '✅' : '⏳'}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-gray-700">{inst.label}</p>
                                  <p className="text-[10px] text-gray-400">{FMT(inst.amount)} F · Échéance : {new Date(inst.dueDate).toLocaleDateString('fr-FR')}</p>
                                </div>
                                {!inst.paid && (
                                  <div className="flex gap-1">
                                    <button onClick={() => { setPayModal({ feeId: fee._id, installmentIndex: idx, total: inst.amount }); setPayForm({ amount: String(inst.amount), method: 'cash', reference: '', note: '' }) }} className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded hover:bg-blue-200">Payer</button>
                                    <button onClick={() => notifyInstallment(fee._id, idx)} title="Envoyer rappel email" className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded hover:bg-amber-200"><Bell size={10} /></button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Fee Modal */}
      {showFeeModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">Frais pour {showFeeModal.name}</h3>
              <button onClick={() => setShowFeeModal(null)} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateFee} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Libellé *</label>
                <input required value={feeForm.label} onChange={(e) => setFeeForm({ ...feeForm, label: e.target.value })} className="input text-sm mt-1 w-full" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Montant total (F CFA) *</label>
                  <input required type="number" min="0" value={feeForm.amount} onChange={(e) => setFeeForm({ ...feeForm, amount: e.target.value })} className="input text-sm mt-1 w-full" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Date d'échéance</label>
                  <input type="date" value={feeForm.dueDate} onChange={(e) => setFeeForm({ ...feeForm, dueDate: e.target.value })} className="input text-sm mt-1 w-full" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Mode de paiement</label>
                <select value={feeForm.paymentMode} onChange={(e) => setFeeForm({ ...feeForm, paymentMode: e.target.value })} className="input text-sm mt-1 w-full">
                  <option value="complet">Paiement complet</option>
                  <option value="tranches">Paiement par tranches</option>
                </select>
              </div>

              {feeForm.paymentMode === 'tranches' && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-gray-700">Tranches de paiement</p>
                    <button type="button" onClick={addInstallment} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Plus size={12} /> Ajouter</button>
                  </div>
                  {installments.map((inst, i) => (
                    <div key={i} className="grid grid-cols-3 gap-2 items-end">
                      <div>
                        <label className="text-[10px] text-gray-500">Libellé</label>
                        <input value={inst.label} onChange={(e) => updateInstallment(i, 'label', e.target.value)} className="input text-xs mt-0.5 w-full" placeholder={`Tranche ${i + 1}`} />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500">Montant</label>
                        <input type="number" value={inst.amount} onChange={(e) => updateInstallment(i, 'amount', e.target.value)} className="input text-xs mt-0.5 w-full" />
                      </div>
                      <div className="flex gap-1 items-end">
                        <div className="flex-1">
                          <label className="text-[10px] text-gray-500">Échéance</label>
                          <input type="date" value={inst.dueDate} onChange={(e) => updateInstallment(i, 'dueDate', e.target.value)} className="input text-xs mt-0.5 w-full" />
                        </div>
                        <button type="button" onClick={() => removeInstallment(i)} className="p-1.5 text-red-400 hover:bg-red-50 rounded"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                  {installments.length === 0 && <p className="text-xs text-gray-400 text-center py-1">Aucune tranche définie</p>}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowFeeModal(null)} className="btn-ghost flex-1 justify-center">Annuler</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {payModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">Enregistrer un paiement</h3>
              <button onClick={() => setPayModal(null)} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
            </div>
            {payModal.total > 0 && <p className="text-xs text-gray-500 mb-3">Montant restant : <strong>{FMT(payModal.total)} F CFA</strong></p>}
            <form onSubmit={handleRecordPayment} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Montant payé (F CFA) *</label>
                <input required type="number" min="1" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} className="input text-sm mt-1 w-full" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Mode de paiement</label>
                  <select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })} className="input text-sm mt-1 w-full">
                    {Object.entries(METHOD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Référence</label>
                  <input value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} className="input text-sm mt-1 w-full" placeholder="N° reçu..." />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Note</label>
                <input value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note: e.target.value })} className="input text-sm mt-1 w-full" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setPayModal(null)} className="btn-ghost flex-1 justify-center">Annuler</button>
                <button type="submit" disabled={paying} className="btn-primary flex-1 justify-center">
                  {paying ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Valider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Assign Modal */}
      {bulkModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2"><Users size={18} className="text-blue-600" /> Assigner les frais en masse</h3>
              <button onClick={() => setBulkModal(false)} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
            </div>
            <form onSubmit={handleBulkAssign} className="space-y-3">
              {/* Mode de génération */}
              <div className="grid grid-cols-2 gap-2">
                {[{ v: 'modality', l: 'Depuis les modalités' }, { v: 'manual', l: 'Montant unique' }].map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setBulkForm({ ...bulkForm, source: opt.v })}
                    className={`text-sm py-2 rounded-xl border transition-colors ${bulkForm.source === opt.v ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
              {bulkForm.source === 'modality' && (
                <p className="text-[11px] text-gray-500 bg-gray-50 rounded-lg p-2">Le montant et les tranches de chaque élève sont repris des <strong>modalités de paiement</strong> définies pour sa classe.</p>
              )}

              <div>
                <label className="text-xs font-medium text-gray-600">Élèves concernés</label>
                <select value={bulkForm.scope} onChange={(e) => setBulkForm({ ...bulkForm, scope: e.target.value })} className="input text-sm mt-1 w-full">
                  <option value="all">Toute l'école</option>
                  {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Libellé</label>
                  <input value={bulkForm.label} onChange={(e) => setBulkForm({ ...bulkForm, label: e.target.value })} className="input text-sm mt-1 w-full" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Type</label>
                  <select value={bulkForm.type} onChange={(e) => setBulkForm({ ...bulkForm, type: e.target.value })} className="input text-sm mt-1 w-full">
                    {['scolarite', 'inscription', 'cantine', 'transport', 'uniforme', 'autre'].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {bulkForm.source === 'manual' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600">Montant (F CFA) *</label>
                      <input required={bulkForm.source === 'manual'} type="number" min="1" value={bulkForm.amount} onChange={(e) => setBulkForm({ ...bulkForm, amount: e.target.value })} className="input text-sm mt-1 w-full" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600">Date limite</label>
                      <input type="date" value={bulkForm.dueDate} onChange={(e) => setBulkForm({ ...bulkForm, dueDate: e.target.value })} className="input text-sm mt-1 w-full" />
                    </div>
                  </div>

                  {/* Tranches optionnelles (mode manuel) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-gray-600">Tranches (optionnel)</label>
                      <button type="button" onClick={() => setBulkInstallments([...bulkInstallments, { label: `${bulkInstallments.length + 1}ère tranche`, amount: '', dueDate: '' }])} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Plus size={12} /> Ajouter</button>
                    </div>
                    {bulkInstallments.map((inst, i) => (
                      <div key={i} className="flex gap-2 mb-2">
                        <input value={inst.label} onChange={(e) => setBulkInstallments(bulkInstallments.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))} placeholder="Libellé" className="input text-xs flex-1" />
                        <input type="number" value={inst.amount} onChange={(e) => setBulkInstallments(bulkInstallments.map((x, idx) => idx === i ? { ...x, amount: e.target.value } : x))} placeholder="Montant" className="input text-xs w-24" />
                        <button type="button" onClick={() => setBulkInstallments(bulkInstallments.filter((_, idx) => idx !== i))} className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 size={13} /></button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <p className="text-[11px] text-gray-400">Les élèves ayant déjà ce frais (même libellé et année) seront ignorés automatiquement.</p>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setBulkModal(false)} className="btn-ghost flex-1 justify-center border border-gray-200">Annuler</button>
                <button type="submit" disabled={bulkSaving} className="btn-primary flex-1 justify-center">
                  {bulkSaving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Assigner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
