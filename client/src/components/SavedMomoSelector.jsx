// client/src/components/SavedMomoSelector.jsx
// Sélecteur et gestionnaire de numéros Mobile Money par classes d'opérateurs (MTN & Orange) avec recherche et défilement
import { useState, useEffect, useMemo } from 'react'
import {
  Search, Plus, Trash2, Edit2, Check, Smartphone, Loader2, X,
  AlertCircle, CheckCircle2, Bookmark, ArrowRight, UserCheck
} from 'lucide-react'
import { walletApi } from '../lib/api'

export default function SavedMomoSelector({
  selectedOperator = 'mtn',
  selectedPhone = '',
  selectedName = '',
  country = 'CM',
  availableOperators, // optionnel: ex [{ value: 'mtn', label: 'MTN Mobile Money' }, { value: 'orange', label: 'Orange Money' }]
  onSelect,
  className = '',
}) {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeOperator, setActiveOperator] = useState(selectedOperator || 'mtn')
  const [searchQuery, setSearchQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({
    operator: 'mtn',
    phone: '',
    accountName: '',
    country: country || 'CM',
    isDefault: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Charger les comptes enregistrés
  const loadAccounts = async () => {
    try {
      setLoading(true)
      const res = await walletApi.getSavedMomoAccounts()
      const list = res.savedMomoAccounts || []
      setAccounts(list)

      // Auto-sélection en arrière-plan si aucun numéro n'est encore sélectionné
      if (list.length > 0 && onSelect) {
        const curOp = activeOperator || selectedOperator || 'mtn'
        const matching = list.filter((a) => a.operator === curOp)
        if (matching.length > 0) {
          const alreadyMatch = matching.find(
            (a) => String(a.phone).replace(/\s+/g, '') === String(selectedPhone || '').replace(/\s+/g, '')
          )
          if (!alreadyMatch) {
            const def = matching.find((a) => a.isDefault) || matching[0]
            onSelect({
              operator: def.operator,
              phone: def.phone,
              accountName: def.accountName,
              country: def.country || country,
            })
          }
        } else {
          // Si aucun numéro pour cet opérateur mais qu'il y a des numéros dans l'autre classe, basculer vers l'autre
          const other = list.find((a) => a.isDefault) || list[0]
          if ((!selectedPhone || !selectedPhone.trim()) && other) {
            setActiveOperator(other.operator || 'mtn')
            onSelect({
              operator: other.operator,
              phone: other.phone,
              accountName: other.accountName,
              country: other.country || country,
            })
          }
        }
      }
    } catch (_) {
      // Silencieux
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAccounts()
  }, [])

  // Synchronise l'opérateur actif si la prop selectedOperator change
  useEffect(() => {
    if (selectedOperator && selectedOperator !== activeOperator) {
      setActiveOperator(selectedOperator)
    }
  }, [selectedOperator])

  // Changement d'opérateur (MTN vs Orange Money)
  const handleOperatorChange = (op) => {
    setActiveOperator(op)
    setSearchQuery('')
    // Recherche automatique d'un compte correspondant pour cet opérateur
    const matching = accounts.filter((a) => a.operator === op)
    if (matching.length > 0) {
      const def = matching.find((a) => a.isDefault) || matching[0]
      if (onSelect) {
        onSelect({
          operator: op,
          phone: def.phone,
          accountName: def.accountName,
          country: def.country || country,
        })
      }
    } else if (onSelect) {
      // Aucun numéro pour cet opérateur pour le moment
      onSelect({
        operator: op,
        phone: '',
        accountName: '',
        country,
      })
    }
  }

  // Filtrage par classe d'opérateur et par barre de recherche
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      // 1. Filtrer strictement par la classe d'opérateur sélectionnée (MTN ou Orange)
      if (acc.operator !== activeOperator) return false

      // 2. Filtrer par texte de recherche (numéro ou nom du titulaire)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().replace(/\s+/g, '')
        const phone = String(acc.phone || '').toLowerCase().replace(/\s+/g, '')
        const name = String(acc.accountName || '').toLowerCase()
        return phone.includes(q) || name.includes(searchQuery.toLowerCase().trim())
      }
      return true
    })
  }, [accounts, activeOperator, searchQuery])

  // Compter le nombre de numéros par classe d'opérateur
  const mtnCount = accounts.filter((a) => a.operator === 'mtn').length
  const orangeCount = accounts.filter((a) => a.operator === 'orange').length
  const otherOperators = availableOperators
    ? availableOperators.filter((o) => o.value !== 'mtn' && o.value !== 'orange')
    : []

  // Sélection d'un numéro
  const handleSelectAccount = (acc) => {
    if (onSelect) {
      onSelect({
        operator: acc.operator,
        phone: acc.phone,
        accountName: acc.accountName,
        country: acc.country || country,
      })
    }
  }

  // Ouvrir modal ajout
  const handleOpenAdd = () => {
    setEditingId(null)
    setForm({
      operator: activeOperator || 'mtn',
      phone: '',
      accountName: '',
      country: country || 'CM',
      isDefault: accounts.length === 0,
    })
    setError('')
    setModalOpen(true)
  }

  // Ouvrir modal édition
  const handleOpenEdit = (acc, e) => {
    e.stopPropagation()
    setEditingId(acc._id)
    setForm({
      operator: acc.operator || 'mtn',
      phone: acc.phone,
      accountName: acc.accountName,
      country: acc.country || country || 'CM',
      isDefault: !!acc.isDefault,
    })
    setError('')
    setModalOpen(true)
  }

  // Suppression
  const handleDelete = async (id, e) => {
    e.stopPropagation()
    if (!window.confirm('Voulez-vous supprimer ce numéro de vos comptes enregistrés ?')) return
    try {
      setLoading(true)
      const res = await walletApi.deleteSavedMomoAccount(id)
      const list = res.savedMomoAccounts || []
      setAccounts(list)
      // Si le compte supprimé était celui sélectionné, réévaluer
      const stillSelected = list.find(
        (a) => a.operator === activeOperator && String(a.phone).replace(/\s+/g, '') === String(selectedPhone).replace(/\s+/g, '')
      )
      if (!stillSelected) {
        const next = list.find((a) => a.operator === activeOperator)
        if (next && onSelect) {
          onSelect({
            operator: next.operator,
            phone: next.phone,
            accountName: next.accountName,
            country: next.country || country,
          })
        } else if (onSelect) {
          onSelect({ operator: activeOperator, phone: '', accountName: '', country })
        }
      }
    } catch (err) {
      alert(err.message || 'Erreur lors de la suppression')
    } finally {
      setLoading(false)
    }
  }

  // Soumission modal
  const handleSubmitModal = async (e) => {
    e.preventDefault()
    if (!form.phone.trim()) {
      setError('Veuillez saisir le numéro de téléphone.')
      return
    }
    if (!form.accountName.trim()) {
      setError('Veuillez saisir le nom complet du titulaire du numéro.')
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
      setActiveOperator(form.operator)
      if (onSelect) {
        onSelect({
          operator: form.operator,
          phone: form.phone.trim(),
          accountName: form.accountName.trim(),
          country: form.country || country,
        })
      }
      setModalOpen(false)
    } catch (err) {
      setError(err.message || "Erreur lors de l'enregistrement.")
    } finally {
      setSubmitting(false)
    }
  }

  // Vérifie si un compte est actuellement sélectionné
  const currentSelectedAccount = accounts.find(
    (a) =>
      a.operator === activeOperator &&
      String(a.phone).replace(/\s+/g, '') === String(selectedPhone || '').replace(/\s+/g, '')
  )

  return (
    <div className={`space-y-3 ${className}`}>
      {/* 1. RÉPARTITION EN DEUX CLASSES D'OPÉRATEURS : MTN & ORANGE */}
      <div>
        <label className="text-xs font-bold text-gray-700 block mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Smartphone size={14} className="text-indigo-600" />
            <span>Sélectionnez votre opérateur Mobile Money</span>
          </span>
          <span className="text-[11px] font-normal text-gray-400">
            {accounts.length} numéro{accounts.length > 1 ? 's' : ''} enregistré{accounts.length > 1 ? 's' : ''}
          </span>
        </label>

        <div className="grid grid-cols-2 gap-2">
          {/* CLASSE 1 : MTN MOBILE MONEY */}
          <button
            type="button"
            onClick={() => handleOperatorChange('mtn')}
            className={`p-2.5 rounded-2xl border text-left transition-all relative overflow-hidden flex items-center justify-between shadow-2xs ${
              activeOperator === 'mtn'
                ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-400/30'
                : 'bg-white border-gray-200 hover:border-amber-300 hover:bg-amber-50/20'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-[#ffcc00] text-black font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                MTN
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-gray-900 block truncate">
                  MTN MoMo
                </span>
                <span className="text-[10px] text-gray-500 block truncate">
                  {mtnCount > 0 ? `${mtnCount} numéro${mtnCount > 1 ? 's' : ''}` : 'Aucun numéro'}
                </span>
              </div>
            </div>
            {activeOperator === 'mtn' && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Check size={12} />
              </span>
            )}
          </button>

          {/* CLASSE 2 : ORANGE MONEY */}
          <button
            type="button"
            onClick={() => handleOperatorChange('orange')}
            className={`p-2.5 rounded-2xl border text-left transition-all relative overflow-hidden flex items-center justify-between shadow-2xs ${
              activeOperator === 'orange'
                ? 'bg-orange-50/80 border-orange-500 ring-2 ring-orange-500/30'
                : 'bg-white border-gray-200 hover:border-orange-300 hover:bg-orange-50/20'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-[#ff6600] text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                OM
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-gray-900 block truncate">
                  Orange Money
                </span>
                <span className="text-[10px] text-gray-500 block truncate">
                  {orangeCount > 0 ? `${orangeCount} numéro${orangeCount > 1 ? 's' : ''}` : 'Aucun numéro'}
                </span>
              </div>
            </div>
            {activeOperator === 'orange' && (
              <span className="w-5 h-5 rounded-full bg-orange-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Check size={12} />
              </span>
            )}
          </button>
        </div>

        {/* Autres opérateurs disponibles pour ce pays si applicable */}
        {otherOperators.length > 0 && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-[10px] text-gray-400 font-bold uppercase">Autres :</span>
            {otherOperators.map((op) => (
              <button
                key={op.value}
                type="button"
                onClick={() => handleOperatorChange(op.value)}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border transition-all ${
                  activeOperator === op.value
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {op.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. NUMÉROS DE CET OPÉRATEUR AVEC BARRE DE RECHERCHE ET DÉFILEMENT (SCROLL) */}
      <div className="bg-gray-50/70 border border-gray-200 rounded-2xl p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-gray-800">
              Numéros {activeOperator === 'mtn' ? 'MTN' : activeOperator === 'orange' ? 'Orange' : activeOperator.toUpperCase()}
            </span>
            <span className="text-[10px] bg-white px-2 py-0.5 rounded-full border border-gray-200 font-bold text-gray-600">
              {filteredAccounts.length}
            </span>
          </div>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline"
          >
            <Plus size={13} />
            <span>Enregistrer un numéro</span>
          </button>
        </div>

        {/* BARRE DE RECHERCHE POUR SAISIR OU CHERCHER */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Rechercher un numéro ${activeOperator.toUpperCase()} ou un nom...`}
            className="input w-full pl-8 pr-7 py-2 text-xs bg-white border-gray-200 focus:border-indigo-500 rounded-xl"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* LISTE DÉROULANTE SCROLLABLE DES NUMÉROS DE L'OPÉRATEUR SÉLECTIONNÉ */}
        {loading && accounts.length === 0 ? (
          <div className="py-6 text-center text-xs text-gray-400 flex items-center justify-center gap-2 bg-white rounded-xl border border-gray-150">
            <Loader2 size={15} className="animate-spin text-indigo-600" />
            <span>Chargement des numéros...</span>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="py-6 px-4 text-center bg-white rounded-xl border border-dashed border-gray-200 space-y-2">
            <p className="text-xs text-gray-500 font-medium">
              {searchQuery
                ? `Aucun numéro ne correspond à « ${searchQuery} »`
                : `Aucun numéro ${activeOperator.toUpperCase()} enregistré pour vos retraits.`}
            </p>
            <button
              type="button"
              onClick={handleOpenAdd}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-colors inline-flex items-center gap-1"
            >
              <Plus size={13} />
              <span>Enregistrer un numéro {activeOperator.toUpperCase()}</span>
            </button>
          </div>
        ) : (
          <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
            {filteredAccounts.map((acc) => {
              const isSelected =
                String(acc.phone).replace(/\s+/g, '') === String(selectedPhone || '').replace(/\s+/g, '')

              return (
                <div
                  key={acc._id}
                  onClick={() => handleSelectAccount(acc)}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between gap-2 shadow-2xs ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50/90 ring-2 ring-emerald-500/25'
                      : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/20'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-[9px] shrink-0 text-white ${
                        acc.operator === 'orange' ? 'bg-[#ff6600]' : 'bg-[#ffcc00] text-black'
                      }`}
                    >
                      {acc.operator === 'orange' ? 'OM' : 'MTN'}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-black text-xs text-gray-900 tracking-wide">
                          {acc.phone}
                        </span>
                        {acc.isDefault && (
                          <span className="px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 text-[9px] font-black uppercase">
                            Défaut
                          </span>
                        )}
                        {isSelected && (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-200 text-emerald-800 text-[9px] font-black flex items-center gap-0.5">
                            <Check size={9} /> Sélectionné
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-gray-600 font-medium truncate block">
                        👤 {acc.accountName}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
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

        {/* 3. EN-TÊTE DU NUMÉRO SÉLECTIONNÉ EN BACKGROUND */}
        {selectedPhone && selectedName ? (
          <div className="p-2.5 bg-emerald-100/70 border border-emerald-300 rounded-xl flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-emerald-900 font-bold uppercase tracking-wider block">
                  Numéro de retrait sélectionné :
                </span>
                <span className="font-mono font-bold text-emerald-950 truncate block">
                  {selectedPhone} <span className="font-normal font-sans text-emerald-800">({selectedName})</span>
                </span>
              </div>
            </div>
            <span className="text-[10px] font-bold text-emerald-800 bg-white/80 px-2 py-0.5 rounded-full border border-emerald-300 uppercase shrink-0">
              {activeOperator === 'orange' ? 'Orange' : 'MTN'}
            </span>
          </div>
        ) : (
          <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0 text-amber-600" />
            <span>Veuillez cliquer sur un numéro ci-dessus pour le sélectionner.</span>
          </div>
        )}
      </div>

      {/* MODALE D'AJOUT / MODIFICATION D'UN NUMÉRO */}
      {modalOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-gray-150 space-y-4 animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Smartphone size={16} className="text-indigo-600" />
                <span>{editingId ? 'Modifier le compte Mobile Money' : 'Enregistrer un compte Mobile Money'}</span>
              </h4>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
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

            <form onSubmit={handleSubmitModal} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Classe d'opérateur *</label>
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
                  placeholder="Ex : 6XXXXXXXX"
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
                <span className="text-[10px] text-gray-400 mt-0.5 block">
                  Identité exacte enregistrée auprès de l'opérateur Mobile Money
                </span>
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs text-gray-600 font-medium">Définir comme compte par défaut</span>
              </label>

              <div className="flex gap-2 pt-2 border-t border-gray-100">
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
