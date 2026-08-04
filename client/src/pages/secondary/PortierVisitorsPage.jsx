import { useEffect, useState } from 'react'
import { Users, UserPlus, LogOut, Loader2, Search, X, Clock } from 'lucide-react'
import { visitorsApi } from '../../lib/api'

const ID_TYPES = { cni: 'CNI', passeport: 'Passeport', permis: 'Permis', autre: 'Autre' }
const EMPTY_FORM = { name: '', phone: '', idType: '', idNumber: '', reason: '', visiting: '', note: '' }

/** Registre des visiteurs (portier) : enregistrement à l'entrée, pointage de sortie,
 *  journal du jour. Le SG et le principal consultent le même journal. */
export default function PortierVisitorsPage() {
  const [visitors, setVisitors] = useState([])
  const [stats, setStats] = useState({ total: 0, present: 0 })
  const [day, setDay] = useState('') // '' = aujourd'hui
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const params = {}
      if (day) params.day = day
      if (q) params.q = q
      const r = await visitorsApi.list(params)
      setVisitors(r.data || [])
      setStats(r.stats || { total: 0, present: 0 })
    } catch (e) { setErr(e.message) }
    setLoading(false)
  }

  useEffect(() => { load() }, [day]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    setErr('')
    if (!form.name.trim() || !form.reason.trim()) return setErr('Nom et motif requis')
    setBusy(true)
    try {
      await visitorsApi.create(form)
      setForm(EMPTY_FORM)
      setShowForm(false)
      await load()
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  const checkout = async (id) => {
    try {
      await visitorsApi.checkout(id)
      await load()
    } catch (e) { alert(e.message) }
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Users size={20} className="text-indigo-600" /> Registre des visiteurs</h1>
          <p className="text-sm text-gray-500">Enregistrez chaque visiteur à l'entrée et pointez sa sortie.</p>
        </div>
        <button onClick={() => { setShowForm(true); setErr('') }} className="btn-primary self-start whitespace-nowrap">
          <UserPlus size={16} /> Nouveau visiteur
        </button>
      </div>

      {/* Stats + filtres */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="card px-4 py-2 text-sm"><b>{stats.total}</b> visite{stats.total > 1 ? 's' : ''}</div>
        <div className="card px-4 py-2 text-sm text-orange-600"><b>{stats.present}</b> dans l'établissement</div>
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="input text-sm w-auto" />
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="Rechercher un nom…" className="input text-sm pl-8 w-44"
          />
        </div>
      </div>

      {/* Journal */}
      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>
      ) : visitors.length === 0 ? (
        <div className="card p-10 text-center text-sm text-gray-500">Aucun visiteur enregistré pour ce jour.</div>
      ) : (
        <div className="space-y-2">
          {visitors.map((v) => (
            <div key={v._id} className={`card p-4 ${!v.checkOutAt ? 'border-l-4 border-l-orange-400' : ''}`}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">{v.name}{v.phone ? <span className="text-xs font-normal text-gray-400"> · {v.phone}</span> : null}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{v.reason}{v.visiting ? <> — voit <b>{v.visiting}</b></> : null}</p>
                  {(v.idType || v.idNumber) && (
                    <p className="text-[11px] text-gray-400 mt-0.5">{ID_TYPES[v.idType] || 'Pièce'} {v.idNumber ? `n° ${v.idNumber}` : ''}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs whitespace-nowrap">
                  <span className="text-green-600 flex items-center gap-1"><Clock size={12} /> Entrée {v.checkInTime}</span>
                  {v.checkOutTime ? (
                    <span className="text-gray-500 flex items-center gap-1"><LogOut size={12} /> Sortie {v.checkOutTime}</span>
                  ) : (
                    <button onClick={() => checkout(v._id)} className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1">
                      <LogOut size={12} /> Pointer la sortie
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modale d'enregistrement */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !busy && setShowForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2"><UserPlus size={18} className="text-indigo-600" /> Enregistrer un visiteur</h3>
              <button onClick={() => !busy && setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            {err && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-2 text-xs">{err}</div>}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Nom complet *</label>
              <input value={form.name} onChange={set('name')} className="input w-full" placeholder="Nom du visiteur" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Téléphone</label>
              <input value={form.phone} onChange={set('phone')} className="input w-full" placeholder="6XX XX XX XX" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Pièce d'identité</label>
                <select value={form.idType} onChange={set('idType')} className="input w-full">
                  <option value="">—</option>
                  {Object.entries(ID_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">N° de la pièce</label>
                <input value={form.idNumber} onChange={set('idNumber')} className="input w-full" placeholder="N°" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Motif de la visite *</label>
              <input value={form.reason} onChange={set('reason')} className="input w-full" placeholder="Ex : retrait de bulletin, rendez-vous…" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Personne / service visité(e)</label>
              <input value={form.visiting} onChange={set('visiting')} className="input w-full" placeholder="Ex : Principal, secrétariat…" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Note</label>
              <input value={form.note} onChange={set('note')} className="input w-full" placeholder="Observation (facultatif)" />
            </div>
            <button onClick={submit} disabled={busy} className="btn-primary w-full justify-center">
              {busy ? <><Loader2 size={16} className="animate-spin" /> Enregistrement…</> : 'Enregistrer l\'entrée'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
