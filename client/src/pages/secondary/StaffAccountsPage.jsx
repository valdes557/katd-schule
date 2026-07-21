import { useState } from 'react'
import {
  Shield, Plus, Loader2, AlertCircle, Copy, CheckCircle2, KeyRound,
  Ban, Trash2, Pencil, X, MessageCircle,
} from 'lucide-react'
import { staffAccountsApi } from '../../lib/api'
import { useCachedFetch } from '../../hooks/useCachedFetch'
import { cache } from '../../lib/cache'

const ROLE_OPTIONS = [
  { value: 'vice_principal', label: 'Vice-Principal' },
  { value: 'surveillant_general', label: 'Surveillant Général' },
  { value: 'caissiere', label: 'Caissière' },
  { value: 'secretaire', label: 'Secrétaire' },
  { value: 'portier', label: 'Portier' },
]
const ROLE_LABELS = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.value, r.label]))

function CredentialsCard({ credentials, whatsappLink, onClose }) {
  const [copied, setCopied] = useState(false)
  const text = `Email : ${credentials.email}\nMot de passe : ${credentials.password}${credentials.matricule ? `\nMatricule : ${credentials.matricule}` : ''}`
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* noop */ }
  }
  return (
    <div className="bg-green-50 border border-green-300 rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-green-800 flex items-center gap-2"><CheckCircle2 size={16} /> Identifiants de connexion</p>
        <button onClick={onClose} className="text-green-700 hover:text-green-900"><X size={16} /></button>
      </div>
      <p className="text-xs text-green-700">⚠️ Notez ces identifiants maintenant : le mot de passe ne sera plus affiché.</p>
      <div className="bg-white rounded-lg p-3 text-sm space-y-1">
        <p><span className="text-gray-500">Email :</span> <span className="font-mono font-semibold">{credentials.email}</span></p>
        <p><span className="text-gray-500">Mot de passe :</span> <span className="font-mono font-semibold">{credentials.password}</span></p>
        {credentials.matricule && <p><span className="text-gray-500">Matricule :</span> <span className="font-mono font-semibold">{credentials.matricule}</span></p>}
      </div>
      <div className="flex gap-2">
        <button onClick={copy} className="flex items-center gap-1.5 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg">
          <Copy size={13} /> {copied ? 'Copié !' : 'Copier'}
        </button>
        {whatsappLink && (
          <a href={whatsappLink} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg">
            <MessageCircle size={13} /> Envoyer par WhatsApp
          </a>
        )}
      </div>
    </div>
  )
}

export default function StaffAccountsPage() {
  const listQ = useCachedFetch('/staff-accounts', async () => {
    const res = await staffAccountsApi.list()
    return res.data || []
  }, [])

  const [showModal, setShowModal] = useState(false)
  const [editMember, setEditMember] = useState(null)
  const [form, setForm] = useState({ role: 'vice_principal', firstName: '', lastName: '', email: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [credentials, setCredentials] = useState(null)

  const members = listQ.data || []
  const refresh = () => { cache.invalidate('/staff-accounts'); listQ.refetch() }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      if (editMember) {
        await staffAccountsApi.update(editMember._id, { name: `${form.lastName} ${form.firstName}`.trim(), phone: form.phone, role: form.role })
        setShowModal(false)
      } else {
        const res = await staffAccountsApi.create(form)
        setCredentials({ credentials: res.credentials, whatsappLink: res.whatsappLink })
        setShowModal(false)
      }
      setForm({ role: 'vice_principal', firstName: '', lastName: '', email: '', phone: '' })
      setEditMember(null)
      refresh()
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const resetPassword = async (m) => {
    if (!window.confirm(`Regénérer le mot de passe de ${m.name} ?`)) return
    try {
      const res = await staffAccountsApi.resetPassword(m._id)
      setCredentials({ credentials: res.credentials, whatsappLink: null })
    } catch (err) { alert(err.message) }
  }

  const toggleActive = async (m) => {
    try { await staffAccountsApi.toggleActive(m._id); refresh() } catch (err) { alert(err.message) }
  }

  const remove = async (m) => {
    if (!window.confirm(`Supprimer définitivement le compte de ${m.name} (${ROLE_LABELS[m.role] || m.role}) ?`)) return
    try { await staffAccountsApi.remove(m._id); refresh() } catch (err) { alert(err.message) }
  }

  const openEdit = (m) => {
    const [lastName = '', ...rest] = (m.name || '').split(' ')
    setEditMember(m)
    setForm({ role: m.role, firstName: rest.join(' '), lastName, email: m.email, phone: m.phone || '' })
    setShowModal(true)
  }

  if (listQ.loading) return <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Shield size={20} className="text-indigo-600" /> Membres administratifs</h1>
          <p className="text-sm text-gray-500">Vice-Principal, Surveillant Général, Caissière, Secrétaire et Portier de votre établissement</p>
        </div>
        <button onClick={() => { setEditMember(null); setForm({ role: 'vice_principal', firstName: '', lastName: '', email: '', phone: '' }); setShowModal(true) }} className="btn-primary text-sm self-start"><Plus size={15} /> Créer un membre</button>
      </div>

      {credentials && <CredentialsCard credentials={credentials.credentials} whatsappLink={credentials.whatsappLink} onClose={() => setCredentials(null)} />}

      {members.length === 0 ? (
        <div className="card p-10 text-center">
          <Shield size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">Aucun membre administratif pour le moment.</p>
          <p className="text-xs text-gray-400 mt-1">Créez les comptes de votre équipe : ils recevront leurs identifiants par email.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Fonction</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Matricule</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m._id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{m.name}</td>
                  <td className="px-4 py-3"><span className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full">{ROLE_LABELS[m.role] || m.role}</span></td>
                  <td className="px-4 py-3 text-gray-600">{m.email}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{m.matricule || '—'}</td>
                  <td className="px-4 py-3">
                    {m.isActive === false
                      ? <span className="text-xs font-semibold bg-red-50 text-red-600 px-2 py-1 rounded-full">Bloqué</span>
                      : <span className="text-xs font-semibold bg-green-50 text-green-600 px-2 py-1 rounded-full">Actif</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => openEdit(m)} title="Modifier" className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600"><Pencil size={15} /></button>
                      <button onClick={() => resetPassword(m)} title="Regénérer le mot de passe" className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600"><KeyRound size={15} /></button>
                      <button onClick={() => toggleActive(m)} title={m.isActive === false ? 'Débloquer' : 'Bloquer'} className="p-1.5 rounded-lg hover:bg-orange-50 text-orange-600">
                        {m.isActive === false ? <CheckCircle2 size={15} /> : <Ban size={15} />}
                      </button>
                      <button onClick={() => remove(m)} title="Supprimer" className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{editMember ? 'Modifier le membre' : 'Créer un membre administratif'}</h2>
              <button type="button" onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-600">Fonction *</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="input mt-1" required>
                {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600">Nom *</label>
                <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="input mt-1" required />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Prénom *</label>
                <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="input mt-1" required />
              </div>
            </div>
            {!editMember && (
              <div>
                <label className="text-xs font-semibold text-gray-600">Email *</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input mt-1" required />
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-gray-600">Téléphone (WhatsApp)</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input mt-1" placeholder="237 6XX XX XX XX" />
            </div>
            {!editMember && <p className="text-[11px] text-gray-400">Un mot de passe sera généré automatiquement et envoyé par email. Vous pourrez aussi le copier ou l'envoyer via WhatsApp.</p>}

            <button type="submit" disabled={saving} className="btn-primary w-full justify-center text-sm">
              {saving ? <Loader2 size={15} className="animate-spin" /> : (editMember ? 'Enregistrer' : 'Créer le compte')}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
