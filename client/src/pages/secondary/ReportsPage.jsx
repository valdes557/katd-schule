import { useState } from 'react'
import {
  FileText, Loader2, Plus, X, AlertCircle, Inbox, Send, Trash2, MailOpen,
} from 'lucide-react'
import { reportsApi } from '../../lib/api'
import { useCachedFetch } from '../../hooks/useCachedFetch'
import { cache } from '../../lib/cache'
import { useAuth } from '../../context/AuthContext'
import { roleLabel, isSecondarySchool } from '../../lib/roleLabels'

/**
 * Rapports internes :
 * - /dashboard/rapports-recus : boîte de réception (principal + vice-principal)
 * - /dashboard/mes-rapports : envoi + suivi (tous les autres membres)
 * Une seule page, rendu selon le rôle.
 */
export default function ReportsPage() {
  const { user, school } = useAuth()
  const isInbox = ['directeur', 'vice_principal', 'super_admin'].includes(user?.role)

  const inboxQ = useCachedFetch(isInbox ? '/reports/inbox' : null, async () => {
    if (!isInbox) return []
    return (await reportsApi.inbox()).data || []
  }, [isInbox])
  const mineQ = useCachedFetch('/reports/mine', async () => (await reportsApi.mine()).data || [], [])

  const [showModal, setShowModal] = useState(false)
  const [openReport, setOpenReport] = useState(null)
  const [form, setForm] = useState({ toRole: 'directeur', subject: '', body: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const inbox = inboxQ.data || []
  const mine = mineQ.data || []

  const refresh = () => {
    cache.invalidate('/reports')
    if (isInbox) inboxQ.refetch()
    mineQ.refetch()
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      await reportsApi.send(form)
      setShowModal(false)
      setForm({ toRole: 'directeur', subject: '', body: '' })
      refresh()
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const open = async (r) => {
    setOpenReport(r)
    if (isInbox && !r.readAt) {
      try { await reportsApi.markRead(r._id); refresh() } catch { /* noop */ }
    }
  }

  const removeMine = async (r) => {
    if (!window.confirm('Supprimer ce rapport (non lu) ?')) return
    try { await reportsApi.remove(r._id); refresh() } catch (err) { alert(err.message) }
  }

  const loading = (isInbox && inboxQ.loading) || mineQ.loading
  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>

  const principalLabel = isSecondarySchool(school) ? 'Principal' : 'Directeur'

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><FileText size={20} className="text-indigo-600" /> Rapports</h1>
          <p className="text-sm text-gray-500">
            {isInbox ? `Rapports adressés au ${user?.role === 'vice_principal' ? 'Vice-Principal' : principalLabel}` : `Envoyez vos rapports au ${principalLabel} ou au Vice-Principal`}
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary text-sm self-start"><Plus size={15} /> Envoyer un rapport</button>
      </div>

      {/* Boîte de réception (principal / VP) */}
      {isInbox && (
        <div className="card">
          <div className="px-4 py-2.5 border-b bg-gray-50 flex items-center gap-2">
            <Inbox size={15} className="text-indigo-600" />
            <h3 className="text-sm font-bold text-gray-800">Boîte de réception ({inbox.length})</h3>
            {inbox.filter((r) => !r.readAt).length > 0 && (
              <span className="text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">{inbox.filter((r) => !r.readAt).length} non lu(s)</span>
            )}
          </div>
          {inbox.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-400">Aucun rapport reçu.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {inbox.map((r) => (
                <button key={r._id} onClick={() => open(r)} className={`w-full text-left p-4 hover:bg-gray-50 flex items-start gap-3 ${!r.readAt ? 'bg-indigo-50/50' : ''}`}>
                  <MailOpen size={16} className={`mt-0.5 flex-shrink-0 ${!r.readAt ? 'text-indigo-600' : 'text-gray-300'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${!r.readAt ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>{r.subject}</span>
                      {!r.readAt && <span className="text-[9px] font-bold bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">NOUVEAU</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {r.from?.name} ({roleLabel(r.fromRole, school)}) · {new Date(r.createdAt).toLocaleDateString('fr-FR')} {new Date(r.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{r.body}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mes envois */}
      <div className="card">
        <div className="px-4 py-2.5 border-b bg-gray-50 flex items-center gap-2">
          <Send size={15} className="text-gray-500" />
          <h3 className="text-sm font-bold text-gray-800">Mes rapports envoyés ({mine.length})</h3>
        </div>
        {mine.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-400">Vous n'avez envoyé aucun rapport.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {mine.map((r) => (
              <div key={r._id} className="p-4 flex items-start gap-3">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setOpenReport(r)}>
                  <p className="text-sm font-medium text-gray-800">{r.subject}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    À : {r.toRole === 'vice_principal' ? 'Vice-Principal' : principalLabel} · {new Date(r.createdAt).toLocaleDateString('fr-FR')}
                    {r.readAt
                      ? <span className="text-green-600 font-semibold ml-2">✓✓ Lu</span>
                      : <span className="text-gray-400 ml-2">Non lu</span>}
                  </p>
                </div>
                {!r.readAt && (
                  <button onClick={() => removeMine(r)} title="Supprimer" className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 flex-shrink-0"><Trash2 size={14} /></button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lecture d'un rapport */}
      {openReport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setOpenReport(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-lg p-5 space-y-3 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{openReport.subject}</h2>
              <button onClick={() => setOpenReport(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <p className="text-xs text-gray-500">
              {openReport.from?.name ? `De : ${openReport.from.name} (${roleLabel(openReport.fromRole, school)}) · ` : ''}
              {new Date(openReport.createdAt).toLocaleString('fr-FR')}
            </p>
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap">{openReport.body}</div>
          </div>
        </div>
      )}

      {/* Modale envoi */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Envoyer un rapport</h2>
              <button type="button" onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-gray-600">Destinataire *</label>
              <select value={form.toRole} onChange={(e) => setForm({ ...form, toRole: e.target.value })} className="input mt-1">
                <option value="directeur">{principalLabel}</option>
                <option value="vice_principal">Vice-Principal</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Objet *</label>
              <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="input mt-1" required placeholder="Objet du rapport" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Contenu *</label>
              <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="input mt-1 min-h-[140px]" required placeholder="Rédigez votre rapport…" />
            </div>
            <button type="submit" disabled={saving} className="btn-primary w-full justify-center text-sm">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Envoyer
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
