import { useEffect, useState } from 'react'
import { GraduationCap, Search, Plus, Trash2, Edit2, Loader2, AlertCircle, X, KeyRound, CheckCircle2, UserPlus, Camera } from 'lucide-react'
import { studentsApi, classesApi, teachersApi } from '../lib/api'
import { useAuth } from '../context/AuthContext'

const EMPTY = { firstName: '', lastName: '', gender: 'M', cycle: 'Primaire', class: '', teacher: '', dateOfBirth: '', placeOfBirth: '', parent: { name: '', phone: '', email: '', relation: 'pere' } }

export default function ElevesPage() {
  const { user, school } = useAuth()
  const isDirecteur = user?.role === 'directeur' || user?.role === 'super_admin'
  const subscribedCycle = user?.role === 'directeur' && school?.subscription?.cycle ? school.subscription.cycle : null

  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [cycleFilter, setCycleFilter] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)

  const fetchStudents = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (cycleFilter) params.set('cycle', cycleFilter)
      if (classFilter) params.set('classId', classFilter)
      const res = await studentsApi.list(params.toString())
      setStudents(res.data || [])
      setTotal(res.total || 0)
    } catch (e) {}
    setLoading(false)
  }

  const fetchClasses = async () => {
    try {
      const [classRes, teacherRes] = await Promise.all([
        classesApi.list(),
        teachersApi.list(),
      ])
      setClasses(classRes.data || [])
      setTeachers(teacherRes.data || [])
    } catch (e) {}
  }

  useEffect(() => { fetchStudents(); fetchClasses() }, [])
  useEffect(() => { if (subscribedCycle && cycleFilter !== subscribedCycle) setCycleFilter(subscribedCycle) }, [subscribedCycle])
  useEffect(() => { const t = setTimeout(fetchStudents, 400); return () => clearTimeout(t) }, [search, cycleFilter, classFilter])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (photoFile) {
        if (editing) await studentsApi.updateWithFile(editing._id, form, photoFile)
        else await studentsApi.createWithFile(form, photoFile)
      } else {
        if (editing) await studentsApi.update(editing._id, form)
        else await studentsApi.create(form)
      }
      setShowModal(false)
      setEditing(null)
      setForm(EMPTY)
      setPhotoFile(null)
      setPhotoPreview(null)
      fetchStudents()
    } catch (e) { alert(e.message) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cet élève ?')) return
    try { await studentsApi.remove(id); fetchStudents() } catch (e) { alert(e.message) }
  }

  const [parentModal, setParentModal] = useState(null) // { student }
  const [parentForm, setParentForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [parentResult, setParentResult] = useState(null)
  const [parentSaving, setParentSaving] = useState(false)

  const [selectedStudentIds, setSelectedStudentIds] = useState([])
  const [linkParentModalOpen, setLinkParentModalOpen] = useState(false)
  const [linkParentForm, setLinkParentForm] = useState({ email: '' })
  const [linkParentSaving, setLinkParentSaving] = useState(false)
  const [linkParentResult, setLinkParentResult] = useState(null)

  const openParentModal = (s) => {
    setParentModal(s)
    setParentForm({ name: s.parent?.name || '', email: s.parent?.email || '', phone: s.parent?.phone || '', password: '' })
    setParentResult(null)
  }

  const handleCreateParentAccount = async (e) => {
    e.preventDefault()
    setParentSaving(true)
    try {
      const r = await studentsApi.createParentAccount(parentModal._id, parentForm)
      if (r.success) { setParentResult(r); fetchStudents() }
      else alert(r.message || 'Erreur')
    } catch (err) { alert(err.message) }
    setParentSaving(false)
  }

  const toggleSelectStudent = (id) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    const allIds = students.map((s) => s._id)
    if (allIds.length === 0) return
    const allSelected = allIds.every((id) => selectedStudentIds.includes(id))
    setSelectedStudentIds(allSelected ? [] : allIds)
  }

  const handleBulkLinkParent = async (e) => {
    e.preventDefault()
    if (!linkParentForm.email || selectedStudentIds.length === 0) return
    setLinkParentSaving(true)
    try {
      const res = await studentsApi.linkParent(linkParentForm.email, selectedStudentIds)
      if (res.success) {
        setLinkParentResult(res)
        fetchStudents()
      } else {
        alert(res.message || 'Erreur')
      }
    } catch (err) {
      alert(err.message)
    }
    setLinkParentSaving(false)
  }

  const closeLinkParentModal = () => {
    setLinkParentModalOpen(false)
    setLinkParentForm({ email: '' })
    setLinkParentResult(null)
    setSelectedStudentIds([])
  }

  const openEdit = (s) => {
    setEditing(s)
    setForm({
      firstName: s.firstName, lastName: s.lastName, gender: s.gender, cycle: s.cycle || 'Primaire',
      class: s.class?._id || s.class || '', dateOfBirth: s.dateOfBirth?.slice(0, 10) || '',
      placeOfBirth: s.placeOfBirth || '',
      teacher: s.teacher?._id || s.teacher || '',
      parent: s.parent || { name: '', phone: '', email: '', relation: 'pere' },
    })
    setPhotoFile(null)
    setPhotoPreview(s.photo || null)
    setShowModal(true)
  }

  const filteredClasses = classes.filter((c) => !form.cycle || c.cycle === form.cycle)
  const filteredTeachers = teachers.filter((t) => !form.cycle || t.cycle === form.cycle)

  const allSelectableIds = students.map((s) => s._id)
  const allSelected = allSelectableIds.length > 0 && allSelectableIds.every((id) => selectedStudentIds.includes(id))

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <GraduationCap size={22} className="text-blue-600" /> Élèves
          </h1>
          <p className="text-sm text-gray-500">{total} élève(s) inscrit(s)</p>
        </div>
        {isDirecteur && (
          <button onClick={() => { setEditing(null); setForm({ ...EMPTY, cycle: subscribedCycle || EMPTY.cycle }); setPhotoFile(null); setPhotoPreview(null); setShowModal(true) }} className="btn-primary text-sm self-start">
            <Plus size={15} /> Ajouter un élève
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..." className="input pl-9 text-sm" />
        </div>
        <select value={cycleFilter} onChange={(e) => { setCycleFilter(e.target.value); setClassFilter('') }} className="input text-sm w-auto">
          {!subscribedCycle && <option value="">Tous les cycles</option>}
          {(subscribedCycle ? [subscribedCycle] : ['Maternelle', 'Primaire', 'Secondaire']).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="input text-sm w-auto">
          <option value="">Toutes les classes</option>
          {classes.filter((c) => !cycleFilter ? (subscribedCycle ? c.cycle === subscribedCycle : true) : c.cycle === cycleFilter).map((c) => (
            <option key={c._id} value={c._id}>{c.name}</option>
          ))}
        </select>
        {isDirecteur && (
          <button
            type="button"
            onClick={() => setLinkParentModalOpen(true)}
            disabled={selectedStudentIds.length === 0}
            className="btn-ghost text-xs border border-gray-200 px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <UserPlus size={13} /> Associer parent existant
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div>
      ) : students.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <AlertCircle size={36} className="mx-auto mb-3 opacity-30" />
          <p>Aucun élève trouvé</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {isDirecteur && (
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                    />
                  </th>
                )}
                {['Matricule', 'Nom', 'Classe', 'Genre', 'Naissance', 'Parent', ...(isDirecteur ? ['Actions'] : [])].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {students.map((s) => (
                <tr key={s._id} className="hover:bg-gray-50">
                  {isDirecteur && (
                    <td className="px-4 py-3 text-xs">
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.includes(s._id)}
                        onChange={() => toggleSelectStudent(s._id)}
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 text-xs font-mono text-gray-600">{s.matricule}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.lastName} {s.firstName}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{s.class?.name || '—'}</td>
                  <td className="px-4 py-3"><span className={`badge ${s.gender === 'M' ? 'badge-blue' : 'badge-pink'} text-xs`}>{s.gender === 'M' ? 'G' : 'F'}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString('fr-FR') : '—'}
                    {s.placeOfBirth && <span className="text-gray-400"> à {s.placeOfBirth}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{s.parent?.name || '—'}<br/>{s.parent?.phone && <span className="text-gray-400">{s.parent.phone}</span>}</td>
                  {isDirecteur && (
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button title="Créer compte parent" onClick={() => openParentModal(s)} className="p-1.5 rounded hover:bg-green-50 text-green-600"><UserPlus size={14} /></button>
                        <button onClick={() => openEdit(s)} className="p-1.5 rounded hover:bg-blue-50 text-blue-600"><Edit2 size={14} /></button>
                        <button onClick={() => handleDelete(s._id)} className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk Link Parent Modal */}
      {linkParentModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                Associer un parent existant
              </h3>
              <button onClick={closeLinkParentModal} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
            </div>

            {linkParentResult ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                  <CheckCircle2 size={32} className="text-green-500 mx-auto mb-2" />
                  <p className="text-sm font-bold text-green-800">{linkParentResult.message}</p>
                  {linkParentResult.data && (
                    <p className="text-xs text-green-700 mt-1">
                      Élèves concernés : {linkParentResult.data.modified ?? linkParentResult.data.matched}
                    </p>
                  )}
                </div>
                <button onClick={closeLinkParentModal} className="btn-primary w-full justify-center">Fermer</button>
              </div>
            ) : (
              <form onSubmit={handleBulkLinkParent} className="space-y-3">
                <p className="text-xs text-gray-500">
                  Vous allez lier <strong>{selectedStudentIds.length}</strong> élève(s) à un <strong>compte parent déjà existant</strong> via son email.
                </p>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 max-h-32 overflow-y-auto text-xs text-gray-700">
                  {students.filter((s) => selectedStudentIds.includes(s._id)).map((s) => (
                    <div key={s._id}>{s.lastName} {s.firstName} — {s.class?.name || 'Sans classe'}</div>
                  ))}
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Email du compte parent existant *</label>
                  <input
                    required
                    type="email"
                    value={linkParentForm.email}
                    onChange={(e) => setLinkParentForm({ email: e.target.value })}
                    className="input text-sm mt-1 w-full"
                    placeholder="email-parent@exemple.com"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeLinkParentModal} className="btn-ghost flex-1 justify-center">Annuler</button>
                  <button type="submit" disabled={linkParentSaving} className="btn-primary flex-1 justify-center">
                    {linkParentSaving ? <Loader2 size={14} className="animate-spin" /> : 'Associer le parent'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Parent Account Modal */}
      {parentModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <KeyRound size={18} className="text-green-600" /> Compte parent — {parentModal.lastName} {parentModal.firstName}
              </h3>
              <button onClick={() => setParentModal(null)} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
            </div>

            {parentResult ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                  <CheckCircle2 size={32} className="text-green-500 mx-auto mb-2" />
                  <p className="text-sm font-bold text-green-800">{parentResult.message}</p>
                </div>
                {!parentResult.data?.linked && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-bold text-gray-700">📋 Identifiants à communiquer au parent :</p>
                    <div className="font-mono text-sm space-y-1">
                      <p>📧 Email : <strong>{parentResult.data?.email}</strong></p>
                      <p>🔑 Mot de passe : <strong>{parentResult.data?.rawPassword}</strong></p>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Notez ces identifiants. Le mot de passe ne sera plus affiché.</p>
                    {parentResult.data?.whatsappLink && (
                      <a href={parentResult.data.whatsappLink} target="_blank" rel="noopener" className="inline-flex items-center gap-2 text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg mt-2">
                        Envoyer via WhatsApp
                      </a>
                    )}
                  </div>
                )}

                {parentResult.data?.class && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-bold text-blue-800">🎒 Ce que le parent verra :</p>
                    <div className="text-xs text-blue-900 space-y-1">
                      <p>📚 Classe : <strong>{parentResult.data.class.name}</strong>
                        {parentResult.data.class.room ? ` · Salle ${parentResult.data.class.room}` : ''}
                        {parentResult.data.class.cycle ? ` · ${parentResult.data.class.cycle}` : ''}
                      </p>
                      {parentResult.data.teachers?.length > 0 ? (
                        <div>
                          <p className="font-semibold mt-1">👨‍🏫 Enseignants ({parentResult.data.teachers.length}) :</p>
                          <ul className="ml-3 mt-0.5 space-y-0.5">
                            {parentResult.data.teachers.map((t, i) => (
                              <li key={i}>• {t.fullName}{t.subjects?.length ? ` — ${t.subjects.join(', ')}` : (t.speciality ? ` — ${t.speciality}` : '')}</li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-amber-700 mt-1">⚠️ Aucun enseignant attribué à cette classe pour l'instant.</p>
                      )}
                    </div>
                  </div>
                )}

                <button onClick={() => setParentModal(null)} className="btn-primary w-full justify-center">Fermer</button>
              </div>
            ) : (
              <form onSubmit={handleCreateParentAccount} className="space-y-3">
                <p className="text-xs text-gray-500">Créer un compte de connexion pour le parent de cet élève.</p>
                {!parentModal.class && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 text-xs">
                    ⚠️ Cet élève n'est affecté à <strong>aucune classe</strong>. Veuillez d'abord lui attribuer une classe pour que le parent puisse voir la salle, le programme et les enseignants.
                  </div>
                )}
                {parentModal.class && (
                  <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-3 text-xs">
                    📚 Classe attribuée : <strong>{parentModal.class.name}</strong>
                    {parentModal.class.room ? ` · Salle ${parentModal.class.room}` : ''}
                    {' · '}{parentModal.class.cycle || parentModal.cycle}
                    <p className="text-[11px] text-blue-700 mt-1">Le parent pourra voir cette classe, ses enseignants et son programme.</p>
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-gray-600">Nom du parent</label>
                  <input value={parentForm.name} onChange={(e) => setParentForm({ ...parentForm, name: e.target.value })} className="input text-sm mt-1 w-full" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Email * <span className="text-gray-400">(sera l'identifiant)</span></label>
                  <input required type="email" value={parentForm.email} onChange={(e) => setParentForm({ ...parentForm, email: e.target.value })} className="input text-sm mt-1 w-full" placeholder="email@exemple.com" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Téléphone</label>
                  <input value={parentForm.phone} onChange={(e) => setParentForm({ ...parentForm, phone: e.target.value })} className="input text-sm mt-1 w-full" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Mot de passe <span className="text-gray-400">(auto-généré si vide)</span></label>
                  <input value={parentForm.password} onChange={(e) => setParentForm({ ...parentForm, password: e.target.value })} className="input text-sm mt-1 w-full" placeholder="Laisser vide = auto" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setParentModal(null)} className="btn-ghost flex-1 justify-center">Annuler</button>
                  <button type="submit" disabled={parentSaving} className="btn-primary flex-1 justify-center">
                    {parentSaving ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Créer le compte
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">{editing ? 'Modifier l\'élève' : 'Nouvel élève'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Photo upload (optional) */}
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {photoPreview ? (
                    <img src={photoPreview.startsWith('blob:') ? photoPreview : (photoPreview.startsWith('/') ? photoPreview : photoPreview)} alt="Photo" className="w-full h-full object-cover" />
                  ) : (
                    <Camera size={24} className="text-gray-400" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files[0]
                      if (f) {
                        setPhotoFile(f)
                        setPhotoPreview(URL.createObjectURL(f))
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-600">Photo de l'élève</p>
                  <p className="text-xs text-gray-400">Optionnel · JPG, PNG · Max 5 Mo</p>
                  {photoFile && <p className="text-xs text-green-600 mt-0.5">{photoFile.name}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Prénom *</label>
                  <input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="input text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Nom *</label>
                  <input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="input text-sm mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Genre *</label>
                  <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="input text-sm mt-1">
                    <option value="M">Garçon</option>
                    <option value="F">Fille</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Cycle *</label>
                  <select value={form.cycle} onChange={(e) => setForm({ ...form, cycle: e.target.value, class: '' })} className="input text-sm mt-1">
                    {(subscribedCycle ? [subscribedCycle] : ['Maternelle', 'Primaire', 'Secondaire']).map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Classe</label>
                  <select value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })} className="input text-sm mt-1">
                    <option value="">— Aucune —</option>
                    {filteredClasses.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Enseignant</label>
                <select value={form.teacher} onChange={(e) => setForm({ ...form, teacher: e.target.value })} className="input text-sm mt-1">
                  <option value="">— Aucun —</option>
                  {filteredTeachers.map((t) => (
                    <option key={t._id} value={t._id}>{t.lastName} {t.firstName}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Date de naissance</label>
                  <input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} className="input text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Lieu de naissance</label>
                  <input value={form.placeOfBirth} onChange={(e) => setForm({ ...form, placeOfBirth: e.target.value })} className="input text-sm mt-1" placeholder="Ex: Douala" />
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                <p className="text-xs font-bold text-gray-700 mb-2">Parent / Responsable</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Nom</label>
                    <input value={form.parent.name} onChange={(e) => setForm({ ...form, parent: { ...form.parent, name: e.target.value } })} className="input text-sm mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Téléphone</label>
                    <input value={form.parent.phone} onChange={(e) => setForm({ ...form, parent: { ...form.parent, phone: e.target.value } })} className="input text-sm mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Email</label>
                    <input type="email" value={form.parent.email || ''} onChange={(e) => setForm({ ...form, parent: { ...form.parent, email: e.target.value } })} className="input text-sm mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Relation</label>
                    <select value={form.parent.relation || 'pere'} onChange={(e) => setForm({ ...form, parent: { ...form.parent, relation: e.target.value } })} className="input text-sm mt-1">
                      <option value="pere">Père</option>
                      <option value="mere">Mère</option>
                      <option value="tuteur">Tuteur</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost flex-1 justify-center border border-gray-200">Annuler</button>
                <button type="submit" className="btn-primary flex-1 justify-center">{editing ? 'Enregistrer' : 'Ajouter'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
