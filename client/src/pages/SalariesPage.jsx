import { useState, useRef } from 'react'
import { salariesApi, teachersApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'
import { Wallet, Loader2, Plus, Trash2, Pencil, X, CheckCircle2, Clock, Banknote } from 'lucide-react'
import DownloadPdfButton from '../components/DownloadPdfButton'

const fmt = (n) => `${(Number(n) || 0).toLocaleString('fr-FR')} F CFA`
const METHODS = [
  { value: 'cash', label: 'Espèces' },
  { value: 'mtn_momo', label: 'MTN Mobile Money' },
  { value: 'royalkatd', label: 'RoyalKATD' },
  { value: 'futurra', label: 'Futurra' },
  { value: 'orange_money', label: 'Orange Money' },
  { value: 'bank_transfer', label: 'Virement bancaire' },
  // Anciennes valeurs (compat affichage)
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'bank', label: 'Virement' },
  { value: 'online', label: 'En ligne' },
]
const methodLabel = (v) => METHODS.find((m) => m.value === v)?.label || v
// Modes de paiement proposés à la saisie (sans les valeurs héritées)
const METHOD_OPTIONS = METHODS.slice(0, 6)
const monthLabel = (m) => {
  if (!m) return '—'
  const [y, mo] = m.split('-')
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}
const currentMonth = () => new Date().toISOString().slice(0, 7)
const emptyForm = () => ({
  teacherId: '', month: currentMonth(), grossAmount: '', deductions: '', deductionReason: '',
  status: 'pending', method: 'cash', bankAccountNumber: '', bankAccountName: '', bankReference: '', reference: '', note: '',
})

export default function SalariesPage() {
  const pdfRef = useRef(null)
  const [monthFilter, setMonthFilter] = useState('')
  const [teacherFilter, setTeacherFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const teachersQ = useCachedFetch('/teachers?', async () => (await teachersApi.list()).data || [], [])
  const teachers = teachersQ.data || []

  const qs = new URLSearchParams()
  if (monthFilter) qs.set('month', monthFilter)
  if (teacherFilter) qs.set('teacherId', teacherFilter)
  const qsStr = qs.toString()

  const salariesQ = useCachedFetch(`/salaries?${qsStr}`, async () => await salariesApi.list(qsStr), [qsStr])
  const salaries = salariesQ.data?.data || []
  const summary = salariesQ.data?.summary || { total: 0, totalPaid: 0, totalPending: 0, count: 0 }
  const loading = salariesQ.loading

  const refresh = () => { cache.invalidate('/salaries'); salariesQ.refetch() }

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setError(''); setModalOpen(true) }
  const openEdit = (s) => {
    setEditing(s)
    setForm({
      teacherId: s.teacher?._id || s.teacher, month: s.month,
      grossAmount: s.grossAmount ?? s.amount ?? '', deductions: s.deductions ?? '', deductionReason: s.deductionReason || '',
      status: s.status, method: s.method || 'cash',
      bankAccountNumber: s.bankDetails?.accountNumber || '', bankAccountName: s.bankDetails?.accountName || '', bankReference: s.bankDetails?.reference || '',
      reference: s.reference || '', note: s.note || '',
    })
    setError(''); setModalOpen(true)
  }

  // Net calculé = brut - déductions (affiché en lecture seule)
  const netPreview = Math.max(0, (Number(form.grossAmount) || 0) - (Number(form.deductions) || 0))

  const save = async () => {
    if (!form.teacherId || !form.month || form.grossAmount === '' || Number(form.grossAmount) < 0) { setError('Enseignant, mois et montant brut valides requis'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        teacherId: form.teacherId, month: form.month,
        grossAmount: Number(form.grossAmount), deductions: Number(form.deductions) || 0, deductionReason: form.deductionReason,
        status: form.status, method: form.method,
        bankDetails: form.method === 'bank_transfer' ? { accountNumber: form.bankAccountNumber, accountName: form.bankAccountName, reference: form.bankReference } : undefined,
        reference: form.reference, note: form.note,
      }
      if (editing) await salariesApi.update(editing._id, payload)
      else await salariesApi.create(payload)
      refresh(); setModalOpen(false)
    } catch (err) { setError(err.message) }
    setSaving(false)
  }

  const markPaid = async (s) => {
    try { await salariesApi.pay(s._id, {}); refresh() } catch (err) { alert(err.message) }
  }

  const remove = async (s) => {
    if (!window.confirm('Supprimer cet enregistrement de salaire ?')) return
    try { await salariesApi.remove(s._id); refresh() } catch (err) { alert(err.message) }
  }

  return (
    <div className="space-y-5 animate-fade-in" ref={pdfRef} id="salaries-pdf-section">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Wallet size={20} className="text-blue-600" /> Salaires des enseignants</h1>
          <p className="text-sm text-gray-500">État des salaires par mois et par enseignant</p>
        </div>
        <div className="flex gap-2">
          <DownloadPdfButton containerRef={pdfRef} filename="salaires.pdf" label="Salaires PDF" />
          <button onClick={openCreate} className="btn-primary text-sm self-start"><Plus size={15} /> Enregistrer un salaire</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4"><div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-blue-100"><Banknote size={18} className="text-blue-600" /></div><div className="text-lg sm:text-2xl font-bold text-gray-900">{fmt(summary.total)}</div><div className="text-xs text-gray-500 mt-0.5">Masse salariale</div></div>
        <div className="card p-4"><div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-green-100"><CheckCircle2 size={18} className="text-green-600" /></div><div className="text-lg sm:text-2xl font-bold text-gray-900">{fmt(summary.totalPaid)}</div><div className="text-xs text-gray-500 mt-0.5">Payé</div></div>
        <div className="card p-4"><div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-amber-100"><Clock size={18} className="text-amber-600" /></div><div className="text-lg sm:text-2xl font-bold text-gray-900">{fmt(summary.totalPending)}</div><div className="text-xs text-gray-500 mt-0.5">En attente</div></div>
        <div className="card p-4"><div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-purple-100"><Wallet size={18} className="text-purple-600" /></div><div className="text-lg sm:text-2xl font-bold text-gray-900">{summary.count}</div><div className="text-xs text-gray-500 mt-0.5">Fiches</div></div>
      </div>

      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div>
          <label className="text-xs text-gray-600">Mois</label>
          <input type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="input text-sm mt-1 w-44" />
        </div>
        <div>
          <label className="text-xs text-gray-600">Enseignant</label>
          <select value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)} className="input text-sm mt-1 w-56">
            <option value="">Tous</option>
            {teachers.map((t) => <option key={t._id} value={t._id}>{t.lastName} {t.firstName}</option>)}
          </select>
        </div>
        {(monthFilter || teacherFilter) && <button onClick={() => { setMonthFilter(''); setTeacherFilter('') }} className="text-xs text-blue-600 hover:underline self-end pb-2">Réinitialiser</button>}
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <div className="text-center py-12"><Loader2 size={24} className="animate-spin text-blue-600 mx-auto" /></div>
        ) : salaries.length === 0 ? (
          <div className="text-center py-12 text-gray-400">Aucun salaire enregistré</div>
        ) : (
          <table className="w-full min-w-[860px]">
            <thead><tr className="border-b border-gray-100 bg-gray-50">
              {['Enseignant', 'Mois', 'Brut', 'Déductions', 'Net reçu', 'Statut', 'Payé le', 'Méthode', ''].map((h) => <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {salaries.map((s) => (
                <tr key={s._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{s.teacher ? `${s.teacher.lastName} ${s.teacher.firstName}` : '—'}{s.teacher?.speciality ? <span className="block text-[10px] text-gray-400">{s.teacher.speciality}</span> : null}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 capitalize">{monthLabel(s.month)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{fmt(s.grossAmount ?? s.amount)}</td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap">
                    {s.deductions > 0
                      ? <span className="text-red-600" title={s.deductionReason || ''}>− {fmt(s.deductions)}{s.deductionReason ? <span className="block text-[10px] text-gray-400 font-normal">{s.deductionReason}</span> : null}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">{fmt(s.netAmount ?? s.amount)}</td>
                  <td className="px-4 py-3">
                    {s.status === 'paid'
                      ? <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200"><CheckCircle2 size={12} /> Payé</span>
                      : <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200"><Clock size={12} /> En attente</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{s.paidAt ? new Date(s.paidAt).toLocaleDateString('fr-FR') : '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{methodLabel(s.method)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {s.status !== 'paid' && <button onClick={() => markPaid(s)} className="text-xs font-semibold text-green-600 hover:underline mr-2">Marquer payé</button>}
                    <button onClick={() => openEdit(s)} className="p-1.5 text-gray-400 hover:text-blue-600"><Pencil size={14} /></button>
                    <button onClick={() => remove(s)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">{editing ? 'Modifier le salaire' : 'Enregistrer un salaire'}</h3>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3">
              {error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
              <div>
                <label className="text-xs text-gray-600">Enseignant *</label>
                <select value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })} disabled={!!editing} className="input text-sm mt-1 w-full disabled:bg-gray-50">
                  <option value="">— Sélectionner —</option>
                  {teachers.map((t) => <option key={t._id} value={t._id}>{t.lastName} {t.firstName}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600">Mois *</label>
                  <input type="month" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} className="input text-sm mt-1 w-full" />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Montant brut (F CFA) *</label>
                  <input type="number" min="0" value={form.grossAmount} onChange={(e) => setForm({ ...form, grossAmount: e.target.value })} className="input text-sm mt-1 w-full" placeholder="Ex. 70000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600">Déductions (F CFA)</label>
                  <input type="number" min="0" value={form.deductions} onChange={(e) => setForm({ ...form, deductions: e.target.value })} className="input text-sm mt-1 w-full" placeholder="0" />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Net reçu (calculé)</label>
                  <input value={fmt(netPreview)} readOnly className="input text-sm mt-1 w-full bg-gray-50 font-semibold text-gray-900" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600">Motif des déductions</label>
                <input value={form.deductionReason} onChange={(e) => setForm({ ...form, deductionReason: e.target.value })} className="input text-sm mt-1 w-full" placeholder="Ex. Retard, absence, tontine mensuelle…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600">Statut</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input text-sm mt-1 w-full">
                    <option value="pending">En attente</option>
                    <option value="paid">Payé</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600">Mode de paiement</label>
                  <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="input text-sm mt-1 w-full">
                    {METHOD_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
              </div>
              {form.method === 'bank_transfer' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50 rounded-lg p-3">
                  <div>
                    <label className="text-xs text-gray-600">Numéro de compte</label>
                    <input value={form.bankAccountNumber} onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })} className="input text-sm mt-1 w-full" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Nom du compte</label>
                    <input value={form.bankAccountName} onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })} className="input text-sm mt-1 w-full" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Référence</label>
                    <input value={form.bankReference} onChange={(e) => setForm({ ...form, bankReference: e.target.value })} className="input text-sm mt-1 w-full" />
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs text-gray-600">Commentaires / notes</label>
                <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} className="input text-sm mt-1 w-full" />
              </div>
              <p className="text-[11px] text-gray-400">Le net (brut − déductions) est calculé automatiquement. Un salaire marqué « Payé » est ajouté aux dépenses (Factures).</p>
            </div>
            <div className="flex gap-2 px-5 py-3 border-t border-gray-100">
              <button onClick={() => setModalOpen(false)} className="flex-1 justify-center border border-gray-200 rounded-lg px-3 py-2 text-sm hover:bg-gray-50">Annuler</button>
              <button disabled={saving} onClick={save} className="btn-primary flex-1 justify-center text-sm">{saving ? <Loader2 size={14} className="animate-spin" /> : (editing ? 'Enregistrer' : 'Ajouter')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
