import { useEffect, useState } from 'react'
import { UserCheck, Search, Plus, Trash2, Edit2, Loader2, AlertCircle, X, Mail, Phone, Key, Eye, EyeOff } from 'lucide-react'
import { teachersApi, classesApi } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { getInitials } from '../lib/utils'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4']
const EMPTY = { firstName: '', lastName: '', email: '', phone: '', gender: 'M', subjects: '', speciality: '', password: '', classes: [], cycle: '' }

export default function EnseignantsPage() {
  const { user, school } = useAuth()
  const isDirecteur = user?.role === 'directeur' || user?.role === 'super_admin'
  const subscribedCycle = user?.role === 'directeur' && school?.subscription?.cycle ? school.subscription.cycle : null

  const [teachers, setTeachers] = useState([])
  const [allClasses, setAllClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [showPwd, setShowPwd] = useState(false)

  const fetchTeachers = async () => {
    setLoading(true)
    try {
      const [res, cr] = await Promise.all([teachersApi.list(search ? `search=${search}` : ''), classesApi.list()])
      setTeachers(res.data || [])
      setTotal(res.total || 0)
      setAllClasses(cr.data || [])
    } catch (e) {}
    setLoading(false)
  }

  useEffect(() => { fetchTeachers() }, [])
  useEffect(() => { const t = setTimeout(fetchTeachers, 400); return () => clearTimeout(t) }, [search])

  const toggleClass = (id) => setForm((f) => ({ ...f, classes: f.classes.includes(id) ? f.classes.filter((c) => c !== id) : [...f.classes, id] }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const data = { ...form, subjects: typeof form.subjects === 'string' ? form.subjects.split(',').map((s) => s.trim()).filter(Boolean) : form.subjects }
      if (!editing && !form.password) { alert('Le mot de passe est requis pour créer le compte de connexion'); return }
      if (!form.cycle) { alert('Veuillez attribuer un cycle (Maternelle / Primaire / Secondaire) à l\'enseignant'); return }
      if (editing) {
        const { password, ...rest } = data
        await teachersApi.update(editing._id, password ? data : rest)
      } else {
        await teachersApi.create(data)
      }
      setShowModal(false)
      setEditing(null)
      setForm(EMPTY)
      fetchTeachers()
    } catch (e) { alert(e.message) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cet enseignant et son compte de connexion ?')) return
    try { await teachersApi.remove(id); fetchTeachers() } catch (e) { alert(e.message) }
  }

  const openEdit = (t) => {
    setEditing(t)
    setForm({ firstName: t.firstName, lastName: t.lastName, email: t.email || '', phone: t.phone || '', gender: t.gender || 'M', subjects: (t.subjects || []).join(', '), speciality: t.speciality || '', password: '', classes: (t.classes || []).map((c) => c._id || c), cycle: t.cycle || '' })
    setShowModal(true)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><UserCheck size={22} className="text-teal-600" /> Enseignants</h1>
          <p className="text-sm text-gray-500">{total} enseignant(s)</p>
        </div>
        {isDirecteur && (
          <button onClick={() => { setEditing(null); setForm({ ...EMPTY, cycle: subscribedCycle || '' }); setShowModal(true) }} className="btn-primary text-sm self-start">
            <Plus size={15} /> Ajouter
          </button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..." className="input pl-9 text-sm" />
      </div>

      {loading ? (
        <div className="text-center py-16"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div>
      ) : teachers.length === 0 ? (
        <div className="text-center py-16 text-gray-400"><AlertCircle size={36} className="mx-auto mb-3 opacity-30" /><p>Aucun enseignant trouvé</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teachers.map((t, i) => (
            <div key={t._id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                    {getInitials(`${t.lastName} ${t.firstName}`)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900">{t.lastName} {t.firstName}</div>
                    <div className="text-xs text-gray-500">{t.speciality || 'Enseignant'}</div>
                  </div>
                </div>
                {isDirecteur && (
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(t)} className="p-1 rounded hover:bg-blue-50 text-blue-600"><Edit2 size={13} /></button>
                    <button onClick={() => handleDelete(t._id)} className="p-1 rounded hover:bg-red-50 text-red-500"><Trash2 size={13} /></button>
                  </div>
                )}
              </div>
              {t.subjects?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {t.subjects.map((s) => <span key={s} className="badge badge-blue text-[10px]">{s}</span>)}
                </div>
              )}
              {t.cycle && (
                <div className="mb-2"><span className="badge bg-amber-50 text-amber-700 text-[10px]">Cycle : {t.cycle}</span></div>
              )}
              {t.classes?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {t.classes.map((c) => (
                    <span key={c._id || c} className="badge bg-purple-50 text-purple-600 text-[10px]">
                      {c.name || c}{c.room ? ` (Salle ${c.room})` : ''}
                    </span>
                  ))}
                </div>
              )}
              <div className="space-y-1 text-xs text-gray-500">
                {t.email && <div className="flex items-center gap-1.5"><Mail size={11} />{t.email}</div>}
                {t.phone && <div className="flex items-center gap-1.5"><Phone size={11} />{t.phone}</div>}
                {t.user && <div className="flex items-center gap-1.5"><Key size={11} className="text-green-500" /><span className="text-green-600">Compte actif</span></div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">{editing ? 'Modifier l\'enseignant' : 'Nouvel enseignant'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600">Prénom *</label><input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="input text-sm mt-1" /></div>
                <div><label className="text-xs font-medium text-gray-600">Nom *</label><input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="input text-sm mt-1" /></div>
              </div>

              {/* Login credentials */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <p className="text-xs font-bold text-blue-800 mb-2 flex items-center gap-1.5"><Key size={12} /> Identifiants de connexion</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Email *</label>
                    <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input text-sm mt-1 bg-white" placeholder="enseignant@ecole.cm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">{editing ? 'Nouveau mot de passe' : 'Mot de passe *'}</label>
                    <div className="relative">
                      <input
                        type={showPwd ? 'text' : 'password'}
                        required={!editing}
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        className="input text-sm mt-1 pr-8 bg-white"
                        placeholder={editing ? 'Laisser vide si inchangé' : 'Min 6 caractères'}
                      />
                      <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-2 top-1/2 -translate-y-1/2 mt-0.5 text-gray-400">
                        {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600">Téléphone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input text-sm mt-1" /></div>
                <div><label className="text-xs font-medium text-gray-600">Genre</label>
                  <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="input text-sm mt-1">
                    <option value="M">Homme</option><option value="F">Femme</option>
                  </select>
                </div>
              </div>
              <div><label className="text-xs font-medium text-gray-600">Matières (virgules)</label><input value={form.subjects} onChange={(e) => setForm({ ...form, subjects: e.target.value })} placeholder="Mathématiques, Français" className="input text-sm mt-1" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Cycle attribué *</label>
                  <select required value={form.cycle} onChange={(e) => setForm({ ...form, cycle: e.target.value })} className="input text-sm mt-1">
                    {!subscribedCycle && <option value="">Sélectionner...</option>}
                    {(subscribedCycle ? [subscribedCycle] : ['Maternelle', 'Primaire', 'Secondaire']).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div><label className="text-xs font-medium text-gray-600">Spécialité</label><input value={form.speciality} onChange={(e) => setForm({ ...form, speciality: e.target.value })} className="input text-sm mt-1" placeholder="Ex: Mathématiques" /></div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Salles de classe attribuées</label>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto bg-gray-50 p-2 rounded-lg">
                  {allClasses
                    .filter((c) => (!form.cycle ? (subscribedCycle ? c.cycle === subscribedCycle : true) : c.cycle === form.cycle))
                    .map((c) => (
                      <button key={c._id} type="button" onClick={() => toggleClass(c._id)}
                        className={`px-2 py-1 rounded text-[10px] font-medium border transition-all ${form.classes.includes(c._id) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                        {c.name}{c.room ? ` · Salle ${c.room}` : ''}
                      </button>
                    ))}
                  {allClasses.length === 0 && <span className="text-xs text-gray-400">Aucune classe créée dans l'école</span>}
                  {allClasses.length > 0 && form.cycle && allClasses.filter((c) => c.cycle === form.cycle).length === 0 && (
                    <span className="text-xs text-amber-600">Aucune classe pour le cycle « {form.cycle} ». Créez d'abord les classes correspondantes.</span>
                  )}
                </div>
                {form.classes.length > 0 && (
                  <p className="text-[10px] text-gray-500 mt-1">{form.classes.length} salle{form.classes.length > 1 ? 's' : ''} sélectionnée{form.classes.length > 1 ? 's' : ''}</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost flex-1 justify-center border border-gray-200">Annuler</button>
                <button type="submit" className="btn-primary flex-1 justify-center">{editing ? 'Enregistrer' : 'Créer le compte'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
