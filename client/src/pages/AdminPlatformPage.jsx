import { useState, useEffect, useRef } from 'react'
import {
  Globe2, Plus, Trash2, CheckCircle, XCircle,
  Image, Film, Save, Loader2, Star,
  MessageCircle, CreditCard, Phone, Info,
} from 'lucide-react'
import { platformApi } from '../lib/api'
import { useAuth } from '../context/AuthContext'

const TABS = [
  { id: 'posts', label: 'Publications', icon: Globe2 },
  { id: 'about', label: 'À propos', icon: Info },
  { id: 'contacts', label: 'Contacts', icon: Phone },
  { id: 'support', label: 'Donations', icon: CreditCard },
  { id: 'experiences', label: 'Témoignages', icon: Star },
]

// ─── Posts Panel ─────────────────────────────────────────────────────────────
function PostsPanel() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', category: '', videoUrl: '', duration: '' })
  const [files, setFiles] = useState([])
  const fileRef = useRef()

  useEffect(() => {
    platformApi.getFeed(1).then((r) => setPosts(r.data || [])).finally(() => setLoading(false))
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => v && fd.append(k, v))
    files.forEach((f) => fd.append('images', f))
    try {
      const r = await platformApi.createPost(fd)
      if (r.success) {
        setPosts((p) => [r.data, ...p])
        setForm({ title: '', content: '', category: '', videoUrl: '', duration: '' })
        setFiles([])
      } else {
        alert(r.message || 'Erreur')
      }
    } catch (err) {
      alert(err.message)
    }
    setSubmitting(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette publication ?')) return
    await platformApi.deletePost(id)
    setPosts((p) => p.filter((x) => x._id !== id))
  }

  return (
    <div className="space-y-6">
      {/* Create form */}
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Plus size={14} className="text-blue-600" /> Nouvelle publication plateforme
        </h3>
        <form onSubmit={handleCreate} className="space-y-3">
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="input text-sm w-full"
            placeholder="Titre *"
          />
          <textarea
            required
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            rows={3}
            className="input text-sm resize-none w-full"
            placeholder="Contenu *"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="input text-sm"
            >
              <option value="">Catégorie</option>
              {['Éducation', 'Sport', 'Culture', 'Sciences', 'Technologie'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              value={form.videoUrl}
              onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
              className="input text-sm"
              placeholder="URL vidéo (optionnel)"
            />
            <input
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })}
              className="input text-sm"
              placeholder="Durée ex: 3:45"
            />
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => fileRef.current?.click()} className="btn-ghost text-sm border border-gray-200">
              <Image size={14} /> Images / Thumbnail
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files))} />
            {files.length > 0 && <span className="text-xs text-gray-500">{files.length} fichier(s)</span>}
          </div>
          <button type="submit" disabled={submitting} className="btn-primary text-sm">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Publier
          </button>
        </form>
      </div>

      {/* Posts list */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-gray-900">Publications existantes ({posts.length})</h3>
        {loading ? (
          <div className="text-center py-8"><Loader2 size={24} className="animate-spin text-blue-600 mx-auto" /></div>
        ) : posts.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Aucune publication</p>
        ) : (
          posts.map((p) => (
            <div key={p._id} className="bg-white border border-gray-100 rounded-xl p-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                {p.thumbnail || p.images?.[0] ? (
                  <img src={p.thumbnail || p.images[0]} className="w-16 h-12 rounded-lg object-cover flex-shrink-0" alt="" />
                ) : (
                  <div className="w-16 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    {p.type === 'video' ? <Film size={16} className="text-gray-400" /> : <Image size={16} className="text-gray-400" />}
                  </div>
                )}
                <div className="min-w-0">
                  {p.title && <div className="text-sm font-semibold text-gray-900 truncate">{p.title}</div>}
                  <p className="text-xs text-gray-500 line-clamp-2">{p.content}</p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                    {p.category && <span className="bg-gray-100 px-1.5 py-0.5 rounded">{p.category}</span>}
                    <span>{p.likes?.length || 0} j'aime</span>
                    <span>{p.comments?.length || 0} comm.</span>
                    <span>{p.views || 0} vues</span>
                  </div>
                </div>
              </div>
              <button onClick={() => handleDelete(p._id)} className="text-red-400 hover:text-red-600 p-1 flex-shrink-0">
                <Trash2 size={15} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── About Panel ─────────────────────────────────────────────────────────────
function AboutPanel({ platformData, refresh }) {
  const [content, setContent] = useState(platformData?.about?.content || '')
  const [saving, setSaving] = useState(false)
  const [files, setFiles] = useState([])
  const fileRef = useRef()

  const handleSave = async () => {
    setSaving(true)
    try {
      let images = platformData?.about?.images || []
      if (files.length > 0) {
        const r = await platformApi.uploadImages(files)
        images = r.data || images
      }
      await platformApi.update({ about: { content, images } })
      refresh()
    } catch (err) { alert(err.message) }
    setSaving(false)
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-bold text-gray-900">Contenu "À propos"</h3>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={8}
        className="input text-sm resize-none w-full"
        placeholder="Description de la plateforme..."
      />
      <div className="flex items-center gap-3 flex-wrap">
        <button type="button" onClick={() => fileRef.current?.click()} className="btn-ghost text-sm border border-gray-200">
          <Image size={14} /> Photos (À propos)
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => setFiles(Array.from(e.target.files))} />
        {files.length > 0 && <span className="text-xs text-gray-500">{files.length} fichier(s)</span>}
      </div>
      {platformData?.about?.images?.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {platformData.about.images.map((img, i) => (
            <img key={i} src={img} className="w-20 h-16 rounded-lg object-cover" alt="" />
          ))}
        </div>
      )}
      <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Sauvegarder
      </button>
    </div>
  )
}

// ─── Contacts Panel ───────────────────────────────────────────────────────────
function ContactsPanel({ platformData, refresh }) {
  const [contacts, setContacts] = useState(platformData?.contacts || [])
  const [saving, setSaving] = useState(false)
  const [help, setHelp] = useState(platformData?.help || { support: '', faq: '', privacy: '', terms: '' })

  const addContact = () => setContacts([...contacts, { type: 'phone', label: '', value: '' }])
  const removeContact = (i) => setContacts(contacts.filter((_, idx) => idx !== i))
  const updateContact = (i, key, val) => {
    const c = [...contacts]
    c[i] = { ...c[i], [key]: val }
    setContacts(c)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await platformApi.update({ contacts, help })
      refresh()
    } catch (err) { alert(err.message) }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">Coordonnées de contact</h3>
          <button onClick={addContact} className="btn-ghost text-sm border border-gray-200">
            <Plus size={13} /> Ajouter
          </button>
        </div>
        {contacts.map((c, i) => (
          <div key={i} className="grid grid-cols-3 gap-2 items-center">
            <select value={c.type} onChange={(e) => updateContact(i, 'type', e.target.value)} className="input text-sm">
              <option value="phone">Téléphone</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
            </select>
            <input value={c.label} onChange={(e) => updateContact(i, 'label', e.target.value)} className="input text-sm" placeholder="Label" />
            <div className="flex gap-1">
              <input value={c.value} onChange={(e) => updateContact(i, 'value', e.target.value)} className="input text-sm flex-1" placeholder="Valeur" />
              <button onClick={() => removeContact(i)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-gray-900">Sections Aide</h3>
        {[
          { key: 'support', label: 'Support' },
          { key: 'faq', label: 'FAQ' },
          { key: 'privacy', label: 'Confidentialité' },
          { key: 'terms', label: 'Conditions' },
        ].map(({ key, label }) => (
          <div key={key}>
            <label className="text-xs font-medium text-gray-700 mb-1 block">{label}</label>
            <textarea
              value={help[key] || ''}
              onChange={(e) => setHelp({ ...help, [key]: e.target.value })}
              rows={3}
              className="input text-sm resize-none w-full"
              placeholder={`Contenu pour "${label}"...`}
            />
          </div>
        ))}
      </div>

      <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Sauvegarder
      </button>
    </div>
  )
}

// ─── Donations Panel ──────────────────────────────────────────────────────────
function DonationsPanel({ platformData, refresh }) {
  const [accounts, setAccounts] = useState(platformData?.donationAccounts || [])
  const [desc, setDesc] = useState(platformData?.donationDescription || '')
  const [saving, setSaving] = useState(false)

  const addAccount = () => setAccounts([...accounts, { accountName: '', accountNumber: '', bankName: '' }])
  const removeAccount = (i) => setAccounts(accounts.filter((_, idx) => idx !== i))
  const updateAccount = (i, key, val) => {
    const a = [...accounts]
    a[i] = { ...a[i], [key]: val }
    setAccounts(a)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await platformApi.update({ donationAccounts: accounts, donationDescription: desc })
      refresh()
    } catch (err) { alert(err.message) }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">Comptes de donation</h3>
          <button onClick={addAccount} className="btn-ghost text-sm border border-gray-200">
            <Plus size={13} /> Ajouter
          </button>
        </div>
        {accounts.map((a, i) => (
          <div key={i} className="grid grid-cols-3 gap-2 items-center">
            <input value={a.accountName} onChange={(e) => updateAccount(i, 'accountName', e.target.value)} className="input text-sm" placeholder="Nom du compte" />
            <input value={a.bankName} onChange={(e) => updateAccount(i, 'bankName', e.target.value)} className="input text-sm" placeholder="Banque / Mobile Money" />
            <div className="flex gap-1">
              <input value={a.accountNumber} onChange={(e) => updateAccount(i, 'accountNumber', e.target.value)} className="input text-sm flex-1" placeholder="Numéro" />
              <button onClick={() => removeAccount(i)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}

        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Message de description</label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            className="input text-sm resize-none w-full"
            placeholder="Explication pour les donateurs..."
          />
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Sauvegarder
      </button>
    </div>
  )
}

// ─── Experiences Panel ────────────────────────────────────────────────────────
function ExperiencesPanel() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    platformApi.getAllExperiences().then((r) => setList(r.data || [])).finally(() => setLoading(false))
  }, [])

  const approve = async (id) => {
    await platformApi.approveExperience(id)
    setList((p) => p.map((x) => x._id === id ? { ...x, isApproved: true } : x))
  }
  const remove = async (id) => {
    if (!confirm('Supprimer ce témoignage ?')) return
    await platformApi.deleteExperience(id)
    setList((p) => p.filter((x) => x._id !== id))
  }

  if (loading) return <div className="text-center py-8"><Loader2 size={24} className="animate-spin text-blue-600 mx-auto" /></div>

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-gray-900">Témoignages ({list.length})</h3>
      {list.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Aucun témoignage soumis</p>
      ) : (
        list.map((exp) => (
          <div key={exp._id} className={`bg-white border rounded-xl p-4 ${exp.isApproved ? 'border-green-200' : 'border-gray-100'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-gray-900">{exp.authorName}</span>
                  <span className="text-[10px] text-yellow-500">{'★'.repeat(exp.rating)}</span>
                  {exp.isApproved
                    ? <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Approuvé</span>
                    : <span className="text-[10px] text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">En attente</span>}
                </div>
                <p className="text-xs text-gray-600 line-clamp-2">{exp.content}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {!exp.isApproved && (
                  <button onClick={() => approve(exp._id)} title="Approuver" className="text-green-500 hover:text-green-700 p-1">
                    <CheckCircle size={16} />
                  </button>
                )}
                <button onClick={() => remove(exp._id)} title="Supprimer" className="text-red-400 hover:text-red-600 p-1">
                  <XCircle size={16} />
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminPlatformPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('posts')
  const [platformData, setPlatformData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    platformApi.get().then((r) => setPlatformData(r.data || {})).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  if (user?.role !== 'super_admin') {
    return (
      <div className="p-8 text-center text-red-500">
        Accès réservé à l'administrateur.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Gestion de la plateforme</h1>
        <p className="text-sm text-gray-500 mt-0.5">Publications, contenu, contacts et donations KATD-SCHÜLE</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto scrollbar-hide">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.id
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-10"><Loader2 size={28} className="animate-spin text-blue-600 mx-auto" /></div>
      ) : (
        <>
          {tab === 'posts' && <PostsPanel />}
          {tab === 'about' && <AboutPanel platformData={platformData} refresh={load} />}
          {tab === 'contacts' && <ContactsPanel platformData={platformData} refresh={load} />}
          {tab === 'support' && <DonationsPanel platformData={platformData} refresh={load} />}
          {tab === 'experiences' && <ExperiencesPanel />}
        </>
      )}
    </div>
  )
}
