import { useMemo, useState } from 'react'
import { studentsApi, classesApi, parentsApi } from '../lib/api'
import { Users, Search, UserPlus, KeyRound, X, Loader2, CheckCircle2, Edit2, Trash2, GraduationCap, Plus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'

export default function ParentsPage() {
  const { user, school } = useAuth()
  const subscribedCycle = user?.role === 'directeur' && school?.subscription?.cycle ? school.subscription.cycle : null
  const [tab, setTab] = useState('students')

  // ── Données partagées ──
  const rowsQ = useCachedFetch('/students/with-parents', async () => (await studentsApi.withParents()).data || [], [])
  const classesQ = useCachedFetch('/classes?', async () => (await classesApi.list()).data || [], [])
  const parentsQ = useCachedFetch('/parents', async () => (await parentsApi.list()).data || [], [])

  const rows = rowsQ.data || []
  const classes = classesQ.data || []
  const parents = parentsQ.data || []

  const refreshAll = () => {
    cache.invalidate('/students'); cache.invalidate('/parents')
    rowsQ.refetch(); parentsQ.refetch()
  }

  // ════════════════ ONGLET « PAR ÉLÈVE » ════════════════
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [onlyWithout, setOnlyWithout] = useState(false)
  const [selected, setSelected] = useState([])
  const [linkEmail, setLinkEmail] = useState('')
  const [modal, setModal] = useState(null) // student
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)

  const filtered = useMemo(() => {
    return (rows || [])
      .filter((r) => !classFilter || r.class?._id === classFilter)
      .filter((r) => !onlyWithout || !r.parentUser)
      .filter((r) => {
        const q = search.trim().toLowerCase()
        if (!q) return true
        return (
          (r.firstName || '').toLowerCase().includes(q) ||
          (r.lastName || '').toLowerCase().includes(q) ||
          (r.matricule || '').toLowerCase().includes(q) ||
          (r.class?.name || '').toLowerCase().includes(q)
        )
      })
  }, [rows, classFilter, onlyWithout, search])

  const openModal = (s) => {
    setModal(s)
    setForm({ name: s.parent?.name || '', email: s.parent?.email || '', phone: s.parent?.phone || '', password: '' })
    setResult(null)
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const r = await studentsApi.createParentAccount(modal._id, form)
      if (r.success) { setResult(r); refreshAll() } else alert(r.message || 'Erreur')
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  // ════════════════ ONGLET « GESTION DES PARENTS » ════════════════
  const [pModal, setPModal] = useState(null) // { mode: 'create' | 'edit', parent? }
  const [pForm, setPForm] = useState({ name: '', email: '', phone: '', password: '', studentIds: [] })
  const [pStudentSearch, setPStudentSearch] = useState('')
  const [pSaving, setPSaving] = useState(false)
  const [pError, setPError] = useState('')
  const [pResult, setPResult] = useState(null)

  const openCreateParent = () => {
    setPModal({ mode: 'create' })
    setPForm({ name: '', email: '', phone: '', password: '', studentIds: [] })
    setPStudentSearch(''); setPError(''); setPResult(null)
  }

  const openEditParent = (p) => {
    setPModal({ mode: 'edit', parent: p })
    setPForm({ name: p.name || '', email: p.email || '', phone: p.phone || '', password: '', studentIds: (p.children || []).map((c) => c._id) })
    setPStudentSearch(''); setPError(''); setPResult(null)
  }

  const togglePStudent = (id) => {
    setPForm((prev) => ({
      ...prev,
      studentIds: prev.studentIds.includes(id) ? prev.studentIds.filter((x) => x !== id) : [...prev.studentIds, id],
    }))
  }

  const submitParent = async (e) => {
    e.preventDefault()
    setPError('')
    if (!pForm.name.trim() || !pForm.email.trim()) { setPError('Nom et email requis.'); return }
    setPSaving(true)
    try {
      if (pModal.mode === 'create') {
        const r = await parentsApi.create({
          name: pForm.name, email: pForm.email, phone: pForm.phone,
          password: pForm.password || undefined, studentIds: pForm.studentIds,
        })
        setPResult(r.data)
        refreshAll()
      } else {
        const id = pModal.parent._id
        await parentsApi.update(id, {
          name: pForm.name, email: pForm.email, phone: pForm.phone,
          ...(pForm.password ? { password: pForm.password } : {}),
        })
        await parentsApi.setStudents(id, pForm.studentIds)
        refreshAll()
        setPModal(null)
      }
    } catch (err) {
      setPError(err.message || 'Erreur')
    }
    setPSaving(false)
  }

  const deleteParent = async (p) => {
    if (!confirm(`Supprimer définitivement le parent « ${p.name} » ? Son email pourra être réutilisé et ses élèves seront détachés.`)) return
    try {
      await parentsApi.remove(p._id)
      refreshAll()
    } catch (err) { alert(err.message) }
  }

  // Liste d'élèves filtrée pour le sélecteur dans les modales parent
  const selectableStudents = useMemo(() => {
    const q = pStudentSearch.trim().toLowerCase()
    return (rows || []).filter((r) => {
      if (!q) return true
      return `${r.lastName} ${r.firstName} ${r.matricule} ${r.class?.name || ''}`.toLowerCase().includes(q)
    })
  }, [rows, pStudentSearch])

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Users size={20} className="text-blue-600" /> Parents / Responsables
          </h1>
          <p className="text-sm text-gray-500">Gérez les comptes parents et associez-les aux élèves.</p>
        </div>
        {tab === 'parents' && (
          <button onClick={openCreateParent} className="btn-primary text-sm"><Plus size={15} /> Nouveau parent</button>
        )}
      </div>

      {/* Onglets */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { id: 'students', label: 'Par élève' },
          { id: 'parents', label: 'Gestion des parents' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'students' ? (
        <>
          <div className="card p-3 flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher élève / classe / matricule" className="input pl-9 text-sm" />
            </div>
            <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="input text-sm w-auto">
              <option value="">Toutes les classes</option>
              {classes
                .filter((c) => (subscribedCycle ? c.cycle === subscribedCycle : true))
                .map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
            <label className="text-xs text-gray-600 flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={onlyWithout} onChange={(e) => setOnlyWithout(e.target.checked)} className="accent-blue-600" />
              Sans compte parent
            </label>
          </div>

          {selected.length > 0 && (
            <div className="card p-3 flex flex-wrap gap-2 items-center border-blue-200">
              <div className="text-xs text-gray-600">{selected.length} élève(s) sélectionné(s)</div>
              <input value={linkEmail} onChange={(e) => setLinkEmail(e.target.value)} type="email" placeholder="Email du compte parent existant" className="input text-sm w-72" />
              <button
                onClick={async () => { try { await studentsApi.linkParent(linkEmail, selected); setSelected([]); setLinkEmail(''); refreshAll() } catch (e) { alert(e.message) } }}
                disabled={!linkEmail || selected.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
              >Associer à cet email</button>
              <button onClick={() => setSelected([])} className="text-xs text-gray-600 hover:underline">Effacer la sélection</button>
            </div>
          )}

          <div className="card overflow-x-auto">
            {rowsQ.loading ? (
              <div className="text-center py-12"><Loader2 size={22} className="animate-spin text-blue-600" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-400">Aucun élève trouvé</div>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-3 py-3"><input type="checkbox" checked={filtered.length > 0 && selected.length === filtered.length} onChange={(e) => setSelected(e.target.checked ? filtered.map((s) => s._id) : [])} /></th>
                    {['Matricule', 'Nom', 'Classe', 'Compte parent', 'Actions'].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((s) => (
                    <tr key={s._id} className="hover:bg-gray-50">
                      <td className="px-3 py-3 text-center"><input type="checkbox" checked={selected.includes(s._id)} onChange={(e) => setSelected((prev) => e.target.checked ? [...prev, s._id] : prev.filter((id) => id !== s._id))} /></td>
                      <td className="px-4 py-3 text-xs font-mono text-gray-600">{s.matricule}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.lastName} {s.firstName}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{s.class?.name || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{s.parentUser ? (<span className="text-green-700">✔ {s.parentUser.email}</span>) : '—'}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => openModal(s)} className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1">
                          <KeyRound size={12} /> {s.parentUser ? 'Associer' : 'Créer le compte'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </>
      ) : (
        /* ════════ ONGLET GESTION DES PARENTS ════════ */
        <div className="card overflow-x-auto">
          {parentsQ.loading ? (
            <div className="text-center py-12"><Loader2 size={22} className="animate-spin text-blue-600" /></div>
          ) : parents.length === 0 ? (
            <div className="text-center py-12 text-gray-400">Aucun parent enregistré. Cliquez sur « Nouveau parent ».</div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Nom', 'Email', 'Téléphone', 'Enfants associés', 'Actions'].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {parents.map((p) => (
                  <tr key={p._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{p.email}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{p.phone || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {p.children?.length > 0 ? (
                        <span className="inline-flex items-center gap-1 flex-wrap">
                          {p.children.map((c) => (
                            <span key={c._id} className="bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-2 py-0.5">{c.lastName} {c.firstName}</span>
                          ))}
                        </span>
                      ) : <span className="text-gray-400">Aucun</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEditParent(p)} title="Modifier" className="p-1.5 rounded hover:bg-blue-50 text-blue-600"><Edit2 size={14} /></button>
                        <button onClick={() => deleteParent(p)} title="Supprimer" className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}

      {/* Modal : créer compte parent par élève (onglet par élève) */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <KeyRound size={18} className="text-green-600" /> {modal.parentUser ? 'Associer ce parent' : 'Créer un compte parent'} — {modal.lastName} {modal.firstName}
              </h3>
              <button onClick={() => setModal(null)} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
            </div>

            {result ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                  <CheckCircle2 size={32} className="text-green-500 mx-auto mb-2" />
                  <p className="text-sm font-bold text-green-800">{result.message}</p>
                </div>
                {!result.data?.linked && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs">
                    <p className="font-bold text-gray-700">📋 Identifiants :</p>
                    <p className="mt-1">📧 Email : <strong>{result.data?.email}</strong></p>
                    <p>🔑 Mot de passe : <strong>{result.data?.rawPassword}</strong></p>
                    {result.data?.whatsappLink && (
                      <a href={result.data.whatsappLink} target="_blank" rel="noopener" className="inline-flex items-center gap-2 text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg mt-2">
                        Envoyer via WhatsApp
                      </a>
                    )}
                  </div>
                )}
                <button onClick={() => setModal(null)} className="btn-primary w-full justify-center">Fermer</button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Nom du parent</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input text-sm mt-1 w-full" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Email *</label>
                  <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input text-sm mt-1 w-full" placeholder="email@exemple.com" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Téléphone</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input text-sm mt-1 w-full" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Mot de passe <span className="text-gray-400">(laisser vide = auto)</span></label>
                  <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input text-sm mt-1 w-full" placeholder="Auto si vide" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setModal(null)} className="btn-ghost flex-1 justify-center">Annuler</button>
                  <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} {modal.parentUser ? 'Associer' : 'Créer le compte'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal : créer / modifier un parent (onglet gestion) */}
      {pModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Users size={18} className="text-blue-600" /> {pModal.mode === 'create' ? 'Nouveau parent' : `Modifier — ${pModal.parent.name}`}
              </h3>
              <button onClick={() => setPModal(null)} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
            </div>

            {pResult ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                  <CheckCircle2 size={32} className="text-green-500 mx-auto mb-2" />
                  <p className="text-sm font-bold text-green-800">Compte parent créé</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs">
                  <p className="font-bold text-gray-700">📋 Identifiants :</p>
                  <p className="mt-1">📧 Email : <strong>{pResult.email}</strong></p>
                  <p>🔑 Mot de passe : <strong>{pResult.rawPassword}</strong></p>
                </div>
                <button onClick={() => setPModal(null)} className="btn-primary w-full justify-center">Fermer</button>
              </div>
            ) : (
              <form onSubmit={submitParent} className="space-y-3">
                {pError && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{pError}</div>}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Nom *</label>
                    <input required value={pForm.name} onChange={(e) => setPForm({ ...pForm, name: e.target.value })} className="input text-sm mt-1 w-full" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Téléphone</label>
                    <input value={pForm.phone} onChange={(e) => setPForm({ ...pForm, phone: e.target.value })} className="input text-sm mt-1 w-full" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Email *</label>
                  <input required type="email" value={pForm.email} onChange={(e) => setPForm({ ...pForm, email: e.target.value })} className="input text-sm mt-1 w-full" placeholder="email@exemple.com" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">
                    Mot de passe {pModal.mode === 'create' ? <span className="text-gray-400">(laisser vide = auto)</span> : <span className="text-gray-400">(laisser vide = inchangé)</span>}
                  </label>
                  <input value={pForm.password} onChange={(e) => setPForm({ ...pForm, password: e.target.value })} className="input text-sm mt-1 w-full" placeholder={pModal.mode === 'create' ? 'Auto si vide' : 'Inchangé si vide'} />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600">Élèves associés ({pForm.studentIds.length})</label>
                  <div className="relative mt-1">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={pStudentSearch} onChange={(e) => setPStudentSearch(e.target.value)} placeholder="Rechercher un élève..." className="input pl-8 text-xs w-full" />
                  </div>
                  <div className="mt-1 max-h-44 overflow-y-auto border border-gray-200 rounded-xl p-2 space-y-1">
                    {selectableStudents.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-3">Aucun élève</p>
                    ) : selectableStudents.map((s) => (
                      <label key={s._id} className="flex items-center gap-2 text-xs py-1 px-2 rounded hover:bg-gray-50 cursor-pointer">
                        <input type="checkbox" className="accent-blue-600" checked={pForm.studentIds.includes(s._id)} onChange={() => togglePStudent(s._id)} />
                        <GraduationCap size={13} className="text-gray-400" />
                        <span className="truncate">{s.lastName} {s.firstName}</span>
                        <span className="text-gray-400 ml-auto">{s.class?.name || '—'}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setPModal(null)} className="btn-ghost flex-1 justify-center">Annuler</button>
                  <button type="submit" disabled={pSaving} className="btn-primary flex-1 justify-center">
                    {pSaving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} {pModal.mode === 'create' ? 'Créer le parent' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
