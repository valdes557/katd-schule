import { useEffect, useState } from 'react'
import {
  Mail, Loader2, Plus, X, Search, Archive, ArchiveRestore, Trash2,
  ArrowDownLeft, ArrowUpRight, Paperclip, FileText,
} from 'lucide-react'
import { mailsApi } from '../../lib/api'

const EMPTY_FORM = { direction: 'entrant', reference: '', subject: '', correspondent: '', category: '', mailDate: '', note: '', file: null }

/** Registre du courrier (secrétariat) : réception/expédition, classement par
 *  catégorie, pièce scannée, archivage et recherche. */
export default function SecretaireCourrierPage() {
  const [mails, setMails] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [direction, setDirection] = useState('')
  const [category, setCategory] = useState('')
  const [archived, setArchived] = useState('false')
  const [q, setQ] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const params = {}
      if (direction) params.direction = direction
      if (category) params.category = category
      if (archived) params.archived = archived
      if (q) params.q = q
      const r = await mailsApi.list(params)
      setMails(r.data || [])
      setCategories(r.categories || [])
    } catch (e) { setErr(e.message) }
    setLoading(false)
  }

  useEffect(() => { load() }, [direction, category, archived]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    setErr('')
    if (!form.subject.trim() || !form.correspondent.trim()) return setErr('Objet et correspondant requis')
    setBusy(true)
    try {
      await mailsApi.create(form)
      setForm(EMPTY_FORM)
      setShowForm(false)
      await load()
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  const toggleArchive = async (m) => {
    try {
      await mailsApi.archive(m._id, !m.archived)
      await load()
    } catch (e) { alert(e.message) }
  }

  const remove = async (m) => {
    if (!confirm(`Supprimer le courrier « ${m.subject} » ?`)) return
    try {
      await mailsApi.remove(m._id)
      await load()
    } catch (e) { alert(e.message) }
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Mail size={20} className="text-indigo-600" /> Registre du courrier</h1>
          <p className="text-sm text-gray-500">Réception, classement, archivage et recherche du courrier.</p>
        </div>
        <button onClick={() => { setShowForm(true); setErr('') }} className="btn-primary self-start whitespace-nowrap">
          <Plus size={16} /> Enregistrer un courrier
        </button>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={direction} onChange={(e) => setDirection(e.target.value)} className="input text-sm w-auto">
          <option value="">Entrant + sortant</option>
          <option value="entrant">Entrant</option>
          <option value="sortant">Sortant</option>
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="input text-sm w-auto">
          <option value="">Toutes catégories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={archived} onChange={(e) => setArchived(e.target.value)} className="input text-sm w-auto">
          <option value="false">Actifs</option>
          <option value="true">Archivés</option>
          <option value="">Tous</option>
        </select>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="Objet, correspondant, réf…" className="input text-sm pl-8 w-52"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>
      ) : mails.length === 0 ? (
        <div className="card p-10 text-center text-sm text-gray-500">Aucun courrier enregistré.</div>
      ) : (
        <div className="space-y-2">
          {mails.map((m) => (
            <div key={m._id} className={`card p-4 ${m.archived ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${m.direction === 'entrant' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                  {m.direction === 'entrant' ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-gray-900">{m.subject}</p>
                    {m.reference && <span className="text-[10px] font-mono bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">Réf. {m.reference}</span>}
                    <span className="text-[10px] bg-indigo-50 text-indigo-600 rounded-full px-2 py-0.5 font-medium">{m.category}</span>
                    {m.archived && <span className="text-[10px] bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">Archivé</span>}
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {m.direction === 'entrant' ? 'De' : 'À'} : <b>{m.correspondent}</b> · {new Date(m.mailDate).toLocaleDateString('fr-FR')}
                  </p>
                  {m.note && <p className="text-[11px] text-gray-400 mt-0.5">{m.note}</p>}
                  {m.scanUrl && (
                    <a href={m.scanUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline mt-1">
                      <FileText size={12} /> {m.scanName || 'Pièce scannée'}
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => toggleArchive(m)} title={m.archived ? 'Désarchiver' : 'Archiver'} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                    {m.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                  </button>
                  <button onClick={() => remove(m)} title="Supprimer" className="p-1.5 rounded-lg hover:bg-red-50 text-red-400">
                    <Trash2 size={15} />
                  </button>
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
              <h3 className="font-bold text-gray-900 flex items-center gap-2"><Mail size={18} className="text-indigo-600" /> Enregistrer un courrier</h3>
              <button onClick={() => !busy && setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            {err && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-2 text-xs">{err}</div>}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Sens *</label>
                <select value={form.direction} onChange={set('direction')} className="input w-full">
                  <option value="entrant">Entrant</option>
                  <option value="sortant">Sortant</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Référence</label>
                <input value={form.reference} onChange={set('reference')} className="input w-full" placeholder="N° d'ordre" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Objet *</label>
              <input value={form.subject} onChange={set('subject')} className="input w-full" placeholder="Objet du courrier" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">{form.direction === 'entrant' ? 'Expéditeur *' : 'Destinataire *'}</label>
              <input value={form.correspondent} onChange={set('correspondent')} className="input w-full" placeholder="Nom / organisme" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Catégorie</label>
                <input value={form.category} onChange={set('category')} className="input w-full" placeholder="Ex : MINESEC, Parents…" list="mail-categories" />
                <datalist id="mail-categories">
                  {categories.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Date du courrier</label>
                <input type="date" value={form.mailDate} onChange={set('mailDate')} className="input w-full" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Note</label>
              <input value={form.note} onChange={set('note')} className="input w-full" placeholder="Observation (facultatif)" />
            </div>
            <div>
              <label className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer font-medium">
                <Paperclip size={13} /> {form.file ? form.file.name : 'Joindre la pièce scannée'}
                <input type="file" className="hidden" onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] || null }))} />
              </label>
            </div>
            <button onClick={submit} disabled={busy} className="btn-primary w-full justify-center">
              {busy ? <><Loader2 size={16} className="animate-spin" /> Enregistrement…</> : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
