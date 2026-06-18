import { useState } from 'react'
import { Link } from 'react-router-dom'
import { staffApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'
import {
  Loader2, UserCog, UserCheck, Plus, Pencil, Trash2, X, Phone, Mail, Users, Briefcase,
} from 'lucide-react'

// Catégories de personnel non-enseignant
const CATEGORIES = [
  { id: 'nettoyeur', label: "Nettoyeur / Agent d'entretien" },
  { id: 'chauffeur', label: 'Chauffeur' },
  { id: 'gardien', label: 'Gardien / Sécurité' },
  { id: 'secretaire', label: 'Secrétaire' },
  { id: 'comptable', label: 'Comptable' },
  { id: 'cuisinier', label: 'Cuisinier / Cantine' },
  { id: 'surveillant', label: 'Surveillant' },
  { id: 'infirmier', label: 'Infirmier(ère)' },
  { id: 'autre', label: 'Autre' },
]
const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]))

const STATUS = {
  active: { label: 'Actif', cls: 'bg-green-100 text-green-700' },
  inactive: { label: 'Inactif', cls: 'bg-gray-100 text-gray-500' },
  on_leave: { label: 'En congé', cls: 'bg-amber-100 text-amber-700' },
}

const EMPTY = { firstName: '', lastName: '', category: 'autre', jobTitle: '', phone: '', email: '', gender: '', salary: '', status: 'active' }

function Avatar({ photo, name, tone = 'bg-indigo-600' }) {
  if (photo) return <img src={photo} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
  return (
    <div className={`w-9 h-9 rounded-full ${tone} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
      {(name || '?')[0]?.toUpperCase()}
    </div>
  )
}

export default function PersonnelPage() {
  const [filter, setFilter] = useState('')
  const [modal, setModal] = useState(null) // null | { ...staff } (edit) | EMPTY (create)
  const [saving, setSaving] = useState(false)

  const q = useCachedFetch('/staff', async () => {
    const r = await staffApi.list()
    return r.data || { staff: [], teachers: [] }
  }, [])

  const data = q.data || { staff: [], teachers: [] }
  const teachers = data.teachers || []
  const allStaff = data.staff || []
  const staff = filter ? allStaff.filter((s) => s.category === filter) : allStaff

  const refresh = () => { cache.invalidate('/staff'); q.refetch() }

  const openCreate = () => setModal({ ...EMPTY })
  const openEdit = (m) => setModal({
    ...EMPTY, ...m,
    salary: m.salary ?? '',
    gender: m.gender || '',
  })

  const save = async (e) => {
    e.preventDefault()
    if (!modal.firstName.trim() || !modal.lastName.trim()) return
    setSaving(true)
    try {
      const payload = {
        firstName: modal.firstName.trim(),
        lastName: modal.lastName.trim(),
        category: modal.category,
        jobTitle: modal.jobTitle?.trim() || '',
        phone: modal.phone?.trim() || '',
        email: modal.email?.trim() || '',
        gender: modal.gender || undefined,
        salary: modal.salary === '' ? undefined : Number(modal.salary),
        status: modal.status,
      }
      if (modal._id) await staffApi.update(modal._id, payload)
      else await staffApi.create(payload)
      setModal(null)
      refresh()
    } catch (err) { alert(err.message) }
    setSaving(false)
  }

  const remove = async (m) => {
    if (!window.confirm(`Supprimer ${m.lastName} ${m.firstName} du personnel ?`)) return
    try { await staffApi.remove(m._id); refresh() } catch (err) { alert(err.message) }
  }

  const total = teachers.length + allStaff.length

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><UserCog size={22} className="text-indigo-600" /> Personnel de l'école</h1>
          <p className="text-sm text-gray-500">Le corps enseignant et le personnel non-enseignant, tous confondus.</p>
        </div>
        <button onClick={openCreate} className="btn-primary text-sm justify-center"><Plus size={15} /> Ajouter du personnel</button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center"><Users size={20} /></div>
          <div><p className="text-xs text-gray-500">Total</p><p className="text-lg font-bold text-gray-900">{total}</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center"><UserCheck size={20} /></div>
          <div><p className="text-xs text-gray-500">Enseignants</p><p className="text-lg font-bold text-gray-900">{teachers.length}</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><Briefcase size={20} /></div>
          <div><p className="text-xs text-gray-500">Non-enseignant</p><p className="text-lg font-bold text-gray-900">{allStaff.length}</p></div>
        </div>
      </div>

      {q.loading ? (
        <div className="py-12 text-center"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div>
      ) : (
        <>
          {/* Corps enseignant (lecture seule) */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><UserCheck size={16} className="text-teal-600" /> Corps enseignant <span className="text-gray-400 font-normal">({teachers.length})</span></h3>
              <Link to="/dashboard/enseignants" className="text-xs text-blue-600 hover:underline">Gérer →</Link>
            </div>
            {teachers.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Aucun enseignant enregistré.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {teachers.map((t) => (
                  <div key={t._id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                    <Avatar photo={t.photo} name={t.lastName} tone="bg-teal-600" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{t.lastName} {t.firstName}</p>
                      <p className="text-xs text-gray-500 truncate">{t.subjects?.join(', ') || t.speciality || 'Enseignant'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Personnel non-enseignant (CRUD) */}
          <div className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><Briefcase size={16} className="text-amber-600" /> Personnel non-enseignant <span className="text-gray-400 font-normal">({allStaff.length})</span></h3>
              <select value={filter} onChange={(e) => setFilter(e.target.value)} className="input text-sm">
                <option value="">Toutes les catégories</option>
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>

            {staff.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">{filter ? 'Aucun membre dans cette catégorie.' : 'Aucun personnel non-enseignant. Cliquez sur « Ajouter du personnel ».'}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {staff.map((m) => (
                  <div key={m._id} className="border border-gray-100 rounded-xl p-3 hover:shadow-card-lg transition-shadow">
                    <div className="flex items-start gap-3">
                      <Avatar photo={m.photo} name={m.lastName} tone="bg-amber-500" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{m.lastName} {m.firstName}</p>
                        <p className="text-xs text-gray-500 truncate">{m.jobTitle || CATEGORY_LABEL[m.category]}</p>
                        <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS[m.status]?.cls || STATUS.active.cls}`}>{STATUS[m.status]?.label || 'Actif'}</span>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-blue-600"><Pencil size={14} /></button>
                        <button onClick={() => remove(m)} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    {(m.phone || m.email) && (
                      <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-gray-50 text-[11px] text-gray-500">
                        {m.phone && <span className="flex items-center gap-1.5"><Phone size={11} /> {m.phone}</span>}
                        {m.email && <span className="flex items-center gap-1.5 truncate"><Mail size={11} /> {m.email}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modale créer/éditer */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white">
              <h3 className="text-sm font-bold text-gray-900">{modal._id ? 'Modifier le personnel' : 'Nouveau personnel'}</h3>
              <button onClick={() => setModal(null)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
            </div>
            <form onSubmit={save} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Nom *</label>
                  <input value={modal.lastName} onChange={(e) => setModal({ ...modal, lastName: e.target.value })} required className="input text-sm w-full mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Prénom *</label>
                  <input value={modal.firstName} onChange={(e) => setModal({ ...modal, firstName: e.target.value })} required className="input text-sm w-full mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Catégorie</label>
                  <select value={modal.category} onChange={(e) => setModal({ ...modal, category: e.target.value })} className="input text-sm w-full mt-1">
                    {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Intitulé de poste</label>
                  <input value={modal.jobTitle} onChange={(e) => setModal({ ...modal, jobTitle: e.target.value })} className="input text-sm w-full mt-1" placeholder="(optionnel)" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Téléphone</label>
                  <input value={modal.phone} onChange={(e) => setModal({ ...modal, phone: e.target.value })} className="input text-sm w-full mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Email</label>
                  <input type="email" value={modal.email} onChange={(e) => setModal({ ...modal, email: e.target.value })} className="input text-sm w-full mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Sexe</label>
                  <select value={modal.gender} onChange={(e) => setModal({ ...modal, gender: e.target.value })} className="input text-sm w-full mt-1">
                    <option value="">—</option>
                    <option value="M">M</option>
                    <option value="F">F</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Salaire (F)</label>
                  <input type="number" value={modal.salary} onChange={(e) => setModal({ ...modal, salary: e.target.value })} className="input text-sm w-full mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Statut</label>
                  <select value={modal.status} onChange={(e) => setModal({ ...modal, status: e.target.value })} className="input text-sm w-full mt-1">
                    <option value="active">Actif</option>
                    <option value="on_leave">En congé</option>
                    <option value="inactive">Inactif</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setModal(null)} className="btn-ghost border border-gray-200 flex-1 justify-center text-sm">Annuler</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center text-sm">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} {modal._id ? 'Enregistrer' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
