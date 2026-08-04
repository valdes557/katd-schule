import { useEffect, useState } from 'react'
import {
  FolderOpen, Loader2, Plus, X, Paperclip, Send, CheckCircle2, XCircle,
  Search, Trash2, FileText, ChevronDown, ChevronUp,
} from 'lucide-react'
import { teacherFilesApi } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'

const STATUS = {
  recu: { label: 'Reçu', cls: 'bg-gray-100 text-gray-600' },
  verifie: { label: 'Vérifié', cls: 'bg-blue-100 text-blue-700' },
  transmis: { label: 'Transmis au Principal', cls: 'bg-amber-100 text-amber-700' },
  valide: { label: 'Validé', cls: 'bg-green-100 text-green-700' },
  rejete: { label: 'Rejeté', cls: 'bg-red-100 text-red-700' },
}

/** Dossiers administratifs des enseignants : la secrétaire reçoit et vérifie les
 *  pièces puis transmet au Principal, qui valide ou rejette. */
export default function SecretaireDossiersPage() {
  const { user } = useAuth()
  const isPrincipal = ['directeur', 'super_admin'].includes(user?.role)
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(null) // dossier déplié
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ teacherName: '', subjectTaught: '', note: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusFilter) params.status = statusFilter
      if (q) params.q = q
      const r = await teacherFilesApi.list(params)
      setFiles(r.data || [])
    } catch (e) { setErr(e.message) }
    setLoading(false)
  }

  useEffect(() => { load() }, [statusFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const create = async () => {
    setErr('')
    if (!form.teacherName.trim()) return setErr('Nom de l\'enseignant requis')
    setBusy(true)
    try {
      await teacherFilesApi.create(form)
      setForm({ teacherName: '', subjectTaught: '', note: '' })
      setShowForm(false)
      await load()
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  const addPiece = async (fileDoc, inputEl) => {
    const f = inputEl.files?.[0]
    if (!f) return
    const label = prompt('Libellé de la pièce (ex : Diplôme, CNI, CV…)', f.name) || f.name
    try {
      await teacherFilesApi.addAttachment(fileDoc._id, label, f)
      await load()
    } catch (e) { alert(e.message) }
    inputEl.value = ''
  }

  const toggleCheck = async (fileDoc, att) => {
    try {
      await teacherFilesApi.checkAttachment(fileDoc._id, att._id, !att.checked)
      await load()
    } catch (e) { alert(e.message) }
  }

  const setStatus = async (fileDoc, status) => {
    let note = ''
    if (['valide', 'rejete'].includes(status)) {
      note = prompt(status === 'valide' ? 'Note de validation (facultatif)' : 'Motif du rejet') || ''
      if (status === 'rejete' && !note) return
    }
    try {
      await teacherFilesApi.setStatus(fileDoc._id, status, note)
      await load()
    } catch (e) { alert(e.message) }
  }

  const remove = async (fileDoc) => {
    if (!confirm(`Supprimer le dossier de ${fileDoc.teacherName} ?`)) return
    try {
      await teacherFilesApi.remove(fileDoc._id)
      await load()
    } catch (e) { alert(e.message) }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><FolderOpen size={20} className="text-indigo-600" /> Dossiers enseignants</h1>
          <p className="text-sm text-gray-500">Réception, vérification des pièces et transmission au Principal.</p>
        </div>
        <button onClick={() => { setShowForm(true); setErr('') }} className="btn-primary self-start whitespace-nowrap">
          <Plus size={16} /> Nouveau dossier
        </button>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input text-sm w-auto">
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="Rechercher un enseignant…" className="input text-sm pl-8 w-52"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>
      ) : files.length === 0 ? (
        <div className="card p-10 text-center text-sm text-gray-500">Aucun dossier enseignant.</div>
      ) : (
        <div className="space-y-2">
          {files.map((f) => {
            const st = STATUS[f.status] || STATUS.recu
            const isOpen = open === f._id
            const allChecked = f.attachments.length > 0 && f.attachments.every((a) => a.checked)
            return (
              <div key={f._id} className="card">
                <button onClick={() => setOpen(isOpen ? null : f._id)} className="w-full flex items-center gap-3 p-4 text-left">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900">{f.teacherName}{f.subjectTaught ? <span className="text-xs font-normal text-gray-400"> · {f.subjectTaught}</span> : null}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{f.attachments.length} pièce{f.attachments.length > 1 ? 's' : ''} · créé le {new Date(f.createdAt).toLocaleDateString('fr-FR')}{f.createdBy?.name ? ` par ${f.createdBy.name}` : ''}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${st.cls}`}>{st.label}</span>
                  {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                    {f.note && <p className="text-xs text-gray-500">{f.note}</p>}

                    {/* Checklist des pièces */}
                    <div>
                      <p className="text-[11px] font-bold text-gray-500 uppercase mb-1.5">Pièces du dossier</p>
                      {f.attachments.length === 0 && <p className="text-xs text-gray-400">Aucune pièce jointe.</p>}
                      <div className="space-y-1">
                        {f.attachments.map((a) => (
                          <div key={a._id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5">
                            <input
                              type="checkbox" checked={!!a.checked}
                              disabled={['valide', 'rejete'].includes(f.status)}
                              onChange={() => toggleCheck(f, a)}
                              className="accent-indigo-600"
                              title="Pièce vérifiée"
                            />
                            <FileText size={13} className="text-gray-400 flex-shrink-0" />
                            <a href={a.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline flex-1 truncate">{a.label}</a>
                            {a.checked && <span className="text-[10px] text-green-600 font-semibold">Vérifiée</span>}
                          </div>
                        ))}
                      </div>
                      {!['valide', 'rejete'].includes(f.status) && (
                        <label className="mt-2 inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer font-medium">
                          <Paperclip size={13} /> Ajouter une pièce
                          <input type="file" className="hidden" onChange={(e) => addPiece(f, e.target)} />
                        </label>
                      )}
                    </div>

                    {/* Historique du workflow */}
                    {f.statusHistory?.length > 1 && (
                      <div className="text-[11px] text-gray-400">
                        {f.statusHistory.map((h, i) => (
                          <div key={i}>{STATUS[h.status]?.label || h.status} — {new Date(h.at).toLocaleDateString('fr-FR')}{h.by?.name ? ` par ${h.by.name}` : ''}{h.note ? ` · ${h.note}` : ''}</div>
                        ))}
                      </div>
                    )}
                    {f.decisionNote && ['valide', 'rejete'].includes(f.status) && (
                      <p className={`text-xs font-medium ${f.status === 'valide' ? 'text-green-600' : 'text-red-600'}`}>Décision : {f.decisionNote}</p>
                    )}

                    {/* Actions selon le statut et le rôle */}
                    <div className="flex flex-wrap gap-2">
                      {f.status === 'recu' && (
                        <button onClick={() => setStatus(f, 'verifie')} disabled={!allChecked} title={!allChecked ? 'Cochez toutes les pièces pour marquer le dossier vérifié' : ''} className="btn-ghost text-xs border border-blue-200 text-blue-700 disabled:opacity-40">
                          <CheckCircle2 size={13} /> Marquer vérifié
                        </button>
                      )}
                      {['recu', 'verifie'].includes(f.status) && (
                        <button onClick={() => setStatus(f, 'transmis')} className="btn-ghost text-xs border border-amber-200 text-amber-700">
                          <Send size={13} /> Transmettre au Principal
                        </button>
                      )}
                      {isPrincipal && f.status === 'transmis' && (
                        <>
                          <button onClick={() => setStatus(f, 'valide')} className="btn-ghost text-xs border border-green-200 text-green-700">
                            <CheckCircle2 size={13} /> Valider
                          </button>
                          <button onClick={() => setStatus(f, 'rejete')} className="btn-ghost text-xs border border-red-200 text-red-700">
                            <XCircle size={13} /> Rejeter
                          </button>
                        </>
                      )}
                      <button onClick={() => remove(f)} className="btn-ghost text-xs border border-gray-200 text-gray-500 ml-auto">
                        <Trash2 size={13} /> Supprimer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modale de création */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !busy && setShowForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2"><Plus size={18} className="text-indigo-600" /> Nouveau dossier enseignant</h3>
              <button onClick={() => !busy && setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            {err && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-2 text-xs">{err}</div>}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Nom de l'enseignant *</label>
              <input value={form.teacherName} onChange={(e) => setForm((x) => ({ ...x, teacherName: e.target.value }))} className="input w-full" placeholder="Nom complet" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Matière enseignée</label>
              <input value={form.subjectTaught} onChange={(e) => setForm((x) => ({ ...x, subjectTaught: e.target.value }))} className="input w-full" placeholder="Ex : Mathématiques" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Note</label>
              <input value={form.note} onChange={(e) => setForm((x) => ({ ...x, note: e.target.value }))} className="input w-full" placeholder="Observation (facultatif)" />
            </div>
            <button onClick={create} disabled={busy} className="btn-primary w-full justify-center">
              {busy ? <><Loader2 size={16} className="animate-spin" /> Création…</> : 'Créer le dossier'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
