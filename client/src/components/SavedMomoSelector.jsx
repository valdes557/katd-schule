// client/src/components/SavedMomoSelector.jsx — Sélecteur et gestionnaire de numéros Mobile Money enregistrés
import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2, Check, Smartphone, Loader2, X, AlertCircle, Bookmark } from 'lucide-react'
import { walletApi } from '../lib/api'

export default function SavedMomoSelector({ selectedOperator, selectedPhone, selectedName, onSelect, className = '' }) {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ operator: 'mtn', phone: '', accountName: '', isDefault: false })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const loadAccounts = async () => {
    try {
      setLoading(true)
      const res = await walletApi.getSavedMomoAccounts()
      const list = res.savedMomoAccounts || []
      setAccounts(list)

      // Si aucun compte n'est encore sélectionné et qu'il y a un compte par défaut, pré-remplir automatiquement
      if ((!selectedPhone || !selectedPhone.trim()) && list.length > 0 && onSelect) {
        const def = list.find((a) => a.isDefault) || list[0]
        onSelect({ operator: def.operator, phone: def.phone, accountName: def.accountName })
      }
    } catch (_) {
      // silencieux
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAccounts()
  }, [])

  const handleOpenAdd = () => {
    setEditingId(null)
    setForm({ operator: selectedOperator || 'mtn', phone: selectedPhone || '', accountName: selectedName || '', isDefault: accounts.length === 0 })
    setError('')
    setModalOpen(true)
  }

  const handleOpenEdit = (acc, e) => {
    e.stopPropagation()
    setEditingId(acc._id)
    setForm({ operator: acc.operator, phone: acc.phone, accountName: acc.accountName, isDefault: !!acc.isDefault })
    setError('')
    setModalOpen(true)
  }

  const handleDelete = async (id, e) => {
    e.stopPropagation()
    if (!window.confirm('Voulez-vous supprimer ce numéro de vos comptes enregistrés ?')) return
    try {
      setLoading(true)
      const res = await walletApi.deleteSavedMomoAccount(id)
      setAccounts(res.savedMomoAccounts || [])
    } catch (err) {
      alert(err.message || 'Erreur lors de la suppression')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.phone.trim()) {
      setError('Veuillez saisir le numéro de téléphone.')
      return
    }
    if (!form.accountName.trim()) {
      setError('Veuillez saisir le nom complet du titulaire.')
      return
    }

    try {
      setSubmitting(true)
      setError('')
      let res
      if (editingId) {
        res = await walletApi.updateSavedMomoAccount(editingId, form)
      } else {
        res = await walletApi.addSavedMomoAccount(form)
      }
      const list = res.savedMomoAccounts || []
      setAccounts(list)
      // Sélectionne immédiatement le compte enregistré
      if (onSelect) {
        onSelect({ operator: form.operator, phone: form.phone.trim(), accountName: form.accountName.trim() })
      }
      setModalOpen(false)
    } catch (err) {
      setError(err.message || "Erreur lors de l'enregistrement.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={`space-y-2.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
          <Bookmark size={14} className="text-indigo-600" />
          <span>Numéros Mobile Money enregistrés</span>
        </label>
        <button
          type="button"
          onClick={handleOpenAdd}
          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1"
        >
          <Plus size={13} /> Ajouter un numéro
        </button>
      </div>

      {loading && accounts.length === 0 ? (
        <div className="p-3 bg-gray-50 rounded-xl text-center text-xs text-gray-400 flex items-center justify-center gap-2">
          <Loader2 size={14} className="animate-spin text-indigo-600" />
          <span>Chargement de vos numéros...</span>
        </div>
      ) : accounts.length === 0 ? (
        <div className="p-3 bg-gray-50 border border-dashed border-gray-200 rounded-2xl text-center space-y-1">
          <p className="text-[11px] text-gray-500 font-medium">
            Aucun numéro enregistré. Enregistrez vos comptes MTN et Orange Money pour des retraits en 1 clic.
          </p>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="text-xs font-extrabold text-indigo-600 hover:text-indigo-800"
          >
            + Enregistrer mon premier numéro
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {accounts.map((acc) => {
            const isSelected =
              acc.operator === selectedOperator &&
              String(acc.phone).replace(/\s+/g, '') === String(selectedPhone || '').replace(/\s+/g, '')

            return (
              <div
                key={acc._id}
                onClick={() => onSelect && onSelect({ operator: acc.operator, phone: acc.phone, accountName: acc.accountName })}
                className={`p-2.5 rounded-2xl border text-left cursor-pointer transition-all flex items-center justify-between gap-2 shadow-2xs ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                    : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-gray-50/50'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-[9px] shrink-0 text-white shadow-2xs ${
                      acc.operator === 'orange' ? 'bg-[#ff6600]' : 'bg-[#ffcc00] text-black'
                    }`}
                  >
                    {acc.operator === 'orange' ? 'OM' : 'MTN'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-xs text-gray-900 truncate">
                        {acc.phone}
                      </span>
                      {acc.isDefault && (
                        <span className="px-1.5 py-0.2 rounded-md bg-indigo-100 text-indigo-700 text-[9px] font-black uppercase">
                          Défaut
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-500 truncate block">
                      {acc.accountName}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {isSelected && (
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-2xs">
                      <Check size={12} />
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => handleOpenEdit(acc, e)}
                    className="p-1 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-gray-100"
                    title="Modifier"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(acc._id, e)}
                    className="p-1 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                    title="Supprimer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODALE D'AJOUT / MODIFICATION D'UN NUMÉRO */}
      {modalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-gray-150 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Smartphone size={16} className="text-indigo-600" />
                <span>{editingId ? 'Modifier le compte Mobile Money' : 'Enregistrer un compte Mobile Money'}</span>
              </h4>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={16} />
              </button>
            </div>

            {error && (
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Opérateur</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, operator: 'mtn' }))}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                      form.operator === 'mtn'
                        ? 'border-amber-400 bg-amber-50 text-amber-900 ring-2 ring-amber-400/20'
                        : 'border-gray-200 bg-white text-gray-600'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ffcc00]" />
                    <span>MTN MoMo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, operator: 'orange' }))}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                      form.operator === 'orange'
                        ? 'border-orange-400 bg-orange-50 text-orange-900 ring-2 ring-orange-400/20'
                        : 'border-gray-200 bg-white text-gray-600'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ff6600]" />
                    <span>Orange Money</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Numéro Mobile Money *</label>
                <input
                  type="tel"
                  placeholder="6XXXXXXXX"
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className="input text-xs w-full font-bold font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Nom complet du titulaire *</label>
                <input
                  type="text"
                  placeholder="Ex : Johnson Tankou"
                  value={form.accountName}
                  onChange={(e) => setForm((prev) => ({ ...prev, accountName: e.target.value }))}
                  className="input text-xs w-full font-medium"
                  required
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs text-gray-600 font-medium">Définir comme compte de retrait par défaut</span>
              </label>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-secondary text-xs flex-1 py-2.5 rounded-xl font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary text-xs flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>{editingId ? 'Mettre à jour' : 'Enregistrer'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
