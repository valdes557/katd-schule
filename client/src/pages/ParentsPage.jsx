import { useEffect, useMemo, useState } from 'react'
import { studentsApi, classesApi } from '../lib/api'
import { Users, Search, UserPlus, KeyRound, X, Loader2, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function ParentsPage() {
  const { user, school } = useAuth()
  const subscribedCycle = user?.role === 'directeur' && school?.subscription?.cycle ? school.subscription.cycle : null
  const [rows, setRows] = useState([])
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [onlyWithout, setOnlyWithout] = useState(false)
  const [selected, setSelected] = useState([])
  const [linkEmail, setLinkEmail] = useState('')

  const [modal, setModal] = useState(null) // student
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)

  const fetch = async () => {
    setLoading(true)
    try {
      const [sRes, cRes] = await Promise.all([studentsApi.withParents(), classesApi.list()])
      setRows(sRes.data || [])
      setClasses(cRes.data || [])
    } catch (_) {}
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

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
      if (r.success) { setResult(r); fetch() } else alert(r.message || 'Erreur')
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Users size={20} className="text-blue-600" /> Parents / Responsables
          </h1>
          <p className="text-sm text-gray-500">Créez et associez les comptes parents aux élèves. Envoi des identifiants via WhatsApp.</p>
        </div>
      </div>

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
            onClick={async () => { try { await studentsApi.linkParent(linkEmail, selected); setSelected([]); setLinkEmail(''); fetch() } catch (e) { alert(e.message) } }}
            disabled={!linkEmail || selected.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
          >Associer à cet email</button>
          <button onClick={() => setSelected([])} className="text-xs text-gray-600 hover:underline">Effacer la sélection</button>
        </div>
      )}

      <div className="card overflow-x-auto">
        {loading ? (
          <div className="text-center py-12"><Loader2 size={22} className="animate-spin text-blue-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">Aucun élève trouvé</div>
        ) : (
          <table className="w-full">
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
        )}
      </div>

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
    </div>
  )
}
