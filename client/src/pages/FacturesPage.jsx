import { useState } from 'react'
import { expensesApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'
import { Receipt, Loader2, Plus, Trash2, Pencil, X, Wallet, TrendingDown } from 'lucide-react'

const fmt = (n) => `${(Number(n) || 0).toLocaleString('fr-FR')} F CFA`

const CATEGORIES = [
  { value: 'salaires', label: 'Salaires' },
  { value: 'loyer', label: 'Loyer' },
  { value: 'fournitures', label: 'Fournitures' },
  { value: 'equipement', label: 'Équipement' },
  { value: 'services', label: 'Services' },
  { value: 'transport', label: 'Transport' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'alimentation', label: 'Alimentation' },
  { value: 'autre', label: 'Autre' },
]
const CAT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]))
const METHODS = [
  { value: 'cash', label: 'Espèces' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'bank', label: 'Virement' },
  { value: 'online', label: 'En ligne' },
]

const emptyForm = () => ({ label: '', category: 'fournitures', amount: '', date: new Date().toISOString().slice(0, 10), supplier: '', method: 'cash', reference: '', note: '' })

export default function FacturesPage() {
  const [monthFilter, setMonthFilter] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const qs = new URLSearchParams()
  if (monthFilter) qs.set('month', monthFilter)
  if (catFilter) qs.set('category', catFilter)
  const qsStr = qs.toString()

  const expensesQ = useCachedFetch(`/expenses?${qsStr}`, async () => await expensesApi.list(qsStr), [qsStr])
  const expenses = expensesQ.data?.data || []
  const summary = expensesQ.data?.summary || { total: 0, count: 0, byCategory: {} }
  const loading = expensesQ.loading

  const refresh = () => { cache.invalidate('/expenses'); expensesQ.refetch() }

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setError(''); setModalOpen(true) }
  const openEdit = (e) => {
    setEditing(e)
    setForm({ label: e.label, category: e.category, amount: e.amount, date: e.date ? new Date(e.date).toISOString().slice(0, 10) : '', supplier: e.supplier || '', method: e.method || 'cash', reference: e.reference || '', note: e.note || '' })
    setError(''); setModalOpen(true)
  }

  const save = async () => {
    if (!form.label.trim() || form.amount === '' || Number(form.amount) < 0) { setError('Libellé et montant valides requis'); return }
    setSaving(true); setError('')
    try {
      if (editing) await expensesApi.update(editing._id, form)
      else await expensesApi.create(form)
      refresh(); setModalOpen(false)
    } catch (err) { setError(err.message) }
    setSaving(false)
  }

  const remove = async (e) => {
    if (!window.confirm(`Supprimer la dépense « ${e.label} » ?`)) return
    try { await expensesApi.remove(e._id); refresh() } catch (err) { alert(err.message) }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Receipt size={20} className="text-blue-600" /> Factures & Dépenses</h1>
          <p className="text-sm text-gray-500">Enregistrez et suivez toutes les dépenses de l'école</p>
        </div>
        <button onClick={openCreate} className="btn-primary text-sm self-start"><Plus size={15} /> Nouvelle dépense</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-red-100"><TrendingDown size={18} className="text-red-600" /></div>
          <div className="text-lg sm:text-2xl font-bold text-gray-900">{fmt(summary.total)}</div>
          <div className="text-xs text-gray-500 mt-0.5">Total dépensé{monthFilter ? ' (mois)' : ''}</div>
        </div>
        <div className="card p-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-blue-100"><Wallet size={18} className="text-blue-600" /></div>
          <div className="text-lg sm:text-2xl font-bold text-gray-900">{summary.count}</div>
          <div className="text-xs text-gray-500 mt-0.5">Dépenses enregistrées</div>
        </div>
        <div className="card p-4 col-span-2 lg:col-span-1">
          <div className="text-xs font-semibold text-gray-500 mb-2">Par catégorie</div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(summary.byCategory).length === 0 ? <span className="text-xs text-gray-400">—</span> :
              Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                <span key={cat} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{CAT_LABEL[cat] || cat}: {fmt(amt)}</span>
              ))}
          </div>
        </div>
      </div>

      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div>
          <label className="text-xs text-gray-600">Mois</label>
          <input type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="input text-sm mt-1 w-44" />
        </div>
        <div>
          <label className="text-xs text-gray-600">Catégorie</label>
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="input text-sm mt-1 w-44">
            <option value="">Toutes</option>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        {(monthFilter || catFilter) && <button onClick={() => { setMonthFilter(''); setCatFilter('') }} className="text-xs text-blue-600 hover:underline self-end pb-2">Réinitialiser</button>}
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <div className="text-center py-12"><Loader2 size={24} className="animate-spin text-blue-600 mx-auto" /></div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-12 text-gray-400">Aucune dépense enregistrée</div>
        ) : (
          <table className="w-full min-w-[720px]">
            <thead><tr className="border-b border-gray-100 bg-gray-50">
              {['Date', 'Libellé', 'Catégorie', 'Fournisseur', 'Méthode', 'Montant', ''].map((h) => <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {expenses.map((e) => (
                <tr key={e._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-600">{e.date ? new Date(e.date).toLocaleDateString('fr-FR') : '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{e.label}</td>
                  <td className="px-4 py-3"><span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{CAT_LABEL[e.category] || e.category}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-600">{e.supplier || '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{METHODS.find((m) => m.value === e.method)?.label || e.method}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-red-600 whitespace-nowrap">{fmt(e.amount)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(e)} className="p-1.5 text-gray-400 hover:text-blue-600"><Pencil size={14} /></button>
                    <button onClick={() => remove(e)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
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
              <h3 className="text-sm font-bold text-gray-900">{editing ? 'Modifier la dépense' : 'Nouvelle dépense'}</h3>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3">
              {error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
              <div>
                <label className="text-xs text-gray-600">Libellé *</label>
                <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Ex: Achat de craies" className="input text-sm mt-1 w-full" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600">Catégorie</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input text-sm mt-1 w-full">
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600">Montant (F CFA) *</label>
                  <input type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input text-sm mt-1 w-full" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600">Date</label>
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input text-sm mt-1 w-full" />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Méthode</label>
                  <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="input text-sm mt-1 w-full">
                    {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600">Fournisseur</label>
                  <input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className="input text-sm mt-1 w-full" />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Référence</label>
                  <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className="input text-sm mt-1 w-full" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600">Note</label>
                <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} className="input text-sm mt-1 w-full" />
              </div>
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
