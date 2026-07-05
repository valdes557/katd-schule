import { useEffect, useState } from 'react'
import {
  Briefcase, Plus, Trash2, Edit2, X, Loader2, Users, CheckCircle2, XCircle,
  Mail, MessageCircle, FileText, Clock,
} from 'lucide-react'
import { recruitmentApi } from '../lib/api'

const EMPTY = { title: '', description: '', poste: '', location: '', contractType: 'CDI', deadline: '', status: 'published' }
const STATUS_BADGE = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
}
const STATUS_LABEL = { pending: 'En attente', approved: 'Approuvée', rejected: 'Rejetée' }

export default function RecruitmentPage() {
  const [tab, setTab] = useState('annonces')
  const [posts, setPosts] = useState([])
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [p, a] = await Promise.all([recruitmentApi.list(), recruitmentApi.applications()])
      setPosts(p.data || [])
      setApplications(a.data || [])
    } catch (_) {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openCreate = () => { setEditing(null); setForm(EMPTY); setShowModal(true) }
  const openEdit = (p) => {
    setEditing(p)
    setForm({
      title: p.title || '', description: p.description || '', poste: p.poste || '',
      location: p.location || '', contractType: p.contractType || 'CDI',
      deadline: p.deadline ? p.deadline.slice(0, 10) : '', status: p.status || 'published',
    })
    setShowModal(true)
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, deadline: form.deadline || undefined }
      const r = editing ? await recruitmentApi.update(editing._id, payload) : await recruitmentApi.create(payload)
      if (r.success) { setShowModal(false); load() } else alert(r.message || 'Erreur')
    } catch (err) { alert(err.message) }
    setSaving(false)
  }

  const remove = async (id) => {
    if (!confirm('Supprimer cette annonce et ses candidatures ?')) return
    try { await recruitmentApi.remove(id); load() } catch (err) { alert(err.message) }
  }

  const decide = async (app, approved) => {
    const reason = prompt(approved ? 'Message d\'approbation (optionnel) :' : 'Motif du rejet (optionnel) :') ?? ''
    try {
      const r = approved ? await recruitmentApi.approve(app._id, reason) : await recruitmentApi.reject(app._id, reason)
      if (r.success) load()
    } catch (err) { alert(err.message) }
  }

  const waLink = (num) => `https://wa.me/${String(num || '').replace(/[^0-9]/g, '')}`

  const appsByPost = (postId) => applications.filter((a) => (a.post?._id || a.post) === postId)

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Briefcase size={22} className="text-blue-600" /> Gestion du recrutement</h1>
          <p className="text-sm text-gray-500">Publiez des annonces et gérez les candidatures reçues</p>
        </div>
        {tab === 'annonces' && (
          <button onClick={openCreate} className="btn-primary text-sm self-start"><Plus size={15} /> Nouvelle annonce</button>
        )}
      </div>

      {/* Onglets */}
      <div className="flex gap-2 border-b border-gray-100">
        {[
          { v: 'annonces', l: `Annonces (${posts.length})`, icon: Briefcase },
          { v: 'candidatures', l: `Candidatures (${applications.length})`, icon: Users },
        ].map((t) => (
          <button key={t.v} onClick={() => setTab(t.v)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.v ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <t.icon size={15} /> {t.l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-blue-600" /></div>
      ) : tab === 'annonces' ? (
        <div className="space-y-3">
          {posts.length === 0 ? (
            <div className="text-center py-14 text-gray-400">
              <Briefcase size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucune annonce. Cliquez sur « Nouvelle annonce ».</p>
            </div>
          ) : posts.map((p) => (
            <div key={p._id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-900">{p.title}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${p.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.status === 'published' ? 'Publiée' : 'Clôturée'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{[p.poste, p.location, p.contractType].filter(Boolean).join(' · ')}</p>
                  <p className="text-sm text-gray-600 mt-2 line-clamp-2">{p.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Users size={12} /> {p.applicantCount || 0} candidature(s)</span>
                    {p.deadline && <span className="flex items-center gap-1"><Clock size={12} /> Échéance : {new Date(p.deadline).toLocaleDateString('fr-FR')}</span>}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(p)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg" title="Modifier"><Edit2 size={15} /></button>
                  <button onClick={() => remove(p._id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg" title="Supprimer"><Trash2 size={15} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {applications.length === 0 ? (
            <div className="text-center py-14 text-gray-400">
              <Users size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucune candidature reçue pour le moment.</p>
            </div>
          ) : applications.map((a) => (
            <div key={a._id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-900">{a.fullName}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Pour : <strong>{a.post?.title || '—'}</strong></p>
                  {a.message && <p className="text-sm text-gray-600 mt-2">{a.message}</p>}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <a href={`mailto:${a.email}`} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg hover:bg-blue-100"><Mail size={12} /> {a.email}</a>
                    <a href={waLink(a.whatsapp)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-lg hover:bg-green-100"><MessageCircle size={12} /> WhatsApp</a>
                    {a.cvUrl && <a href={a.cvUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-lg hover:bg-gray-200"><FileText size={12} /> Voir le CV</a>}
                  </div>
                </div>
                {a.status === 'pending' && (
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button onClick={() => decide(a, true)} className="inline-flex items-center gap-1 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700"><CheckCircle2 size={13} /> Approuver</button>
                    <button onClick={() => decide(a, false)} className="inline-flex items-center gap-1 text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600"><XCircle size={13} /> Rejeter</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modale créer/éditer */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">{editing ? 'Modifier l\'annonce' : 'Nouvelle annonce de recrutement'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
            </div>
            <form onSubmit={save} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Titre de l'annonce *</label>
                <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input text-sm mt-1 w-full" placeholder="Recrutement enseignant de mathématiques" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Poste</label>
                  <input value={form.poste} onChange={(e) => setForm({ ...form, poste: e.target.value })} className="input text-sm mt-1 w-full" placeholder="Enseignant" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Type de contrat</label>
                  <select value={form.contractType} onChange={(e) => setForm({ ...form, contractType: e.target.value })} className="input text-sm mt-1 w-full">
                    {['CDI', 'CDD', 'Stage', 'Vacation', 'Autre'].map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Lieu</label>
                  <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="input text-sm mt-1 w-full" placeholder="Ville / quartier" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Date limite</label>
                  <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="input text-sm mt-1 w-full" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Description *</label>
                <textarea required rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input text-sm mt-1 w-full" placeholder="Missions, profil recherché, conditions..." />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Statut</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input text-sm mt-1 w-full">
                  <option value="published">Publiée (visible sur les News)</option>
                  <option value="closed">Clôturée (masquée)</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost flex-1 justify-center border border-gray-200">Annuler</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} {editing ? 'Enregistrer' : 'Publier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
