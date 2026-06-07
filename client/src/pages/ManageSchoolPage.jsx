import { useEffect, useState } from 'react'
import {
  Globe, Users, CreditCard, Phone, FileText, Shield, Star, Gift, HelpCircle,
  Save, Loader2, Plus, Trash2, Image as ImageIcon, Upload, Check, X, Eye, EyeOff, Video,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { schoolPagesApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'

const TABS = [
  { id: 'about', label: 'À propos', icon: Users },
  { id: 'team', label: 'Équipe', icon: Users },
  { id: 'posts', label: 'Publications', icon: Globe },
  { id: 'payments', label: 'Paiements', icon: CreditCard },
  { id: 'contacts', label: 'Contacts', icon: Phone },
  { id: 'terms', label: 'Conditions', icon: FileText },
  { id: 'privacy', label: 'Confidentialité', icon: Shield },
  { id: 'reviews', label: 'Avis', icon: Star },
  { id: 'donate', label: 'Dons', icon: Gift },
  { id: 'help', label: 'Aide', icon: HelpCircle },
]

export default function ManageSchoolPage() {
  const { school } = useAuth()
  const schoolId = school?._id
  const [tab, setTab] = useState('about')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  // Page-level fetch — migrated to SWR cache.
  const pageQ = useCachedFetch(
    schoolId ? `/school-pages/${schoolId}?` : null,
    async () => (await schoolPagesApi.get(schoolId)).data || {},
    [schoolId],
  )
  const page = pageQ.data

  const savePage = async (updates) => {
    setSaving(true)
    setMsg('')
    try {
      const r = await schoolPagesApi.update(schoolId, { ...page, ...updates })
      pageQ.setData(r.data)
      cache.invalidate(`/school-pages/${schoolId}`)
      setMsg('✅ Sauvegardé')
      setTimeout(() => setMsg(''), 2000)
    } catch (e) { setMsg('❌ Erreur: ' + e.message) }
    setSaving(false)
  }

  if (!schoolId) return <div className="p-8 text-center text-gray-400">Aucune école associée</div>

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Page de l'établissement</h1>
        <p className="text-sm text-gray-500">Gérez le contenu public de votre école</p>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex items-center gap-1 transition-colors ${tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </div>

      {msg && <div className="text-sm font-medium text-center py-2">{msg}</div>}

      {tab === 'about' && <AboutEditor page={page} savePage={savePage} saving={saving} schoolId={schoolId} />}
      {tab === 'team' && <TeamEditor schoolId={schoolId} />}
      {tab === 'posts' && <PostsEditor schoolId={schoolId} />}
      {tab === 'payments' && <PaymentsEditor schoolId={schoolId} />}
      {tab === 'contacts' && <ContactsEditor page={page} savePage={savePage} saving={saving} />}
      {tab === 'terms' && <TextEditor label="Conditions d'utilisation" field="terms" page={page} savePage={savePage} saving={saving} />}
      {tab === 'privacy' && <TextEditor label="Politique de confidentialité" field="privacy" page={page} savePage={savePage} saving={saving} />}
      {tab === 'reviews' && <ReviewsEditor schoolId={schoolId} />}
      {tab === 'donate' && <DonateEditor page={page} savePage={savePage} saving={saving} />}
      {tab === 'help' && <TextEditor label="Aide" field="help" page={page} savePage={savePage} saving={saving} />}
    </div>
  )
}

/* ========== ABOUT ========== */
function AboutEditor({ page, savePage, saving, schoolId }) {
  const [content, setContent] = useState('')
  const [images, setImages] = useState([])

  useEffect(() => {
    setContent(page?.about?.content || '')
    setImages(page?.about?.images || [])
  }, [page])

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return
    try {
      const r = await schoolPagesApi.uploadImages(schoolId, files)
      if (r.data) setImages((prev) => [...prev, ...r.data])
    } catch (e) { alert(e.message) }
  }

  return (
    <div className="card p-5 space-y-4">
      <h3 className="text-sm font-bold text-gray-800">À propos de nous</h3>
      <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} className="input text-sm resize-none w-full" placeholder="Décrivez votre établissement..." />
      <div>
        <label className="text-xs font-medium text-gray-600 mb-2 block">Images</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {images.map((img, i) => (
            <div key={i} className="relative group">
              <img src={img} className="w-20 h-20 object-cover rounded-lg" />
              <button onClick={() => setImages(images.filter((_, j) => j !== i))} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100"><X size={10} /></button>
            </div>
          ))}
          <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-400">
            <Upload size={16} className="text-gray-400" />
            <input type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" />
          </label>
        </div>
      </div>
      <button onClick={() => savePage({ about: { content, images } })} disabled={saving} className="btn-primary text-sm">
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Sauvegarder
      </button>
    </div>
  )
}

/* ========== TEAM ========== */
function TeamEditor({ schoolId }) {
  const [form, setForm] = useState({ name: '', role: '', description: '' })
  const [photo, setPhoto] = useState(null)
  const [adding, setAdding] = useState(false)

  const teamQ = useCachedFetch(
    schoolId ? `/school-pages/${schoolId}/team?` : null,
    async () => (await schoolPagesApi.getTeam(schoolId)).data || [],
    [schoolId],
  )
  const members = teamQ.data || []
  const loading = teamQ.loading

  const handleAdd = async (e) => {
    e.preventDefault()
    setAdding(true)
    const fd = new FormData()
    fd.append('name', form.name)
    fd.append('role', form.role)
    fd.append('description', form.description)
    if (photo) fd.append('photo', photo)
    try {
      await schoolPagesApi.addTeamMember(schoolId, fd)
      setForm({ name: '', role: '', description: '' })
      setPhoto(null)
      cache.invalidate(`/school-pages/${schoolId}/team`)
      teamQ.refetch()
    } catch (e) { alert(e.message) }
    setAdding(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce membre ?')) return
    await schoolPagesApi.deleteTeamMember(id)
    cache.invalidate(`/school-pages/${schoolId}/team`)
    teamQ.refetch()
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="card p-4 space-y-3">
        <h3 className="text-sm font-bold text-gray-800">Ajouter un membre</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input text-sm" placeholder="Nom complet" />
          <input required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="input text-sm" placeholder="Poste / Fonction" />
        </div>
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input text-sm resize-none w-full" rows={3} placeholder="Description / Biographie..." />
        <div className="flex items-center gap-3">
          <label className="text-xs text-blue-600 cursor-pointer flex items-center gap-1 hover:underline">
            <ImageIcon size={12} /> {photo ? photo.name : 'Ajouter une photo'}
            <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files[0])} className="hidden" />
          </label>
          <button type="submit" disabled={adding} className="btn-primary text-sm ml-auto">
            {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Ajouter
          </button>
        </div>
      </form>

      {loading ? <div className="text-center py-8"><Loader2 size={20} className="animate-spin mx-auto text-blue-600" /></div> : (
        <div className="grid gap-2">
          {members.map((m) => (
            <div key={m._id} className="card p-3 flex items-center gap-3">
              {m.photo ? <img src={m.photo} className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">{m.name?.[0]}</div>}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{m.name}</p>
                <p className="text-xs text-blue-600">{m.role}</p>
              </div>
              <button onClick={() => handleDelete(m._id)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ========== POSTS ========== */
function PostsEditor({ schoolId }) {
  const [content, setContent] = useState('')
  const [files, setFiles] = useState(null)
  const [videoFile, setVideoFile] = useState(null)
  const [posting, setPosting] = useState(false)
  const [progress, setProgress] = useState(0)

  const postsQ = useCachedFetch(
    schoolId ? `/school-pages/${schoolId}/posts?` : null,
    async () => (await schoolPagesApi.getPosts(schoolId)).data || [],
    [schoolId],
  )
  const posts = postsQ.data || []
  const loading = postsQ.loading

  const handlePost = async (e) => {
    e.preventDefault()
    if (!content.trim()) return
    setPosting(true)
    setProgress(0)
    const fd = new FormData()
    fd.append('content', content)
    if (files) Array.from(files).forEach((f) => fd.append('images', f))
    if (videoFile) fd.append('video', videoFile)
    try {
      await schoolPagesApi.createPostWithProgress(schoolId, fd, setProgress)
      setContent('')
      setFiles(null)
      setVideoFile(null)
      cache.invalidate(`/school-pages/${schoolId}/posts`)
      postsQ.refetch()
    } catch (e) { alert(e.message) }
    setPosting(false)
    setProgress(0)
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette publication ?')) return
    await schoolPagesApi.deletePost(id)
    cache.invalidate(`/school-pages/${schoolId}/posts`)
    postsQ.refetch()
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handlePost} className="card p-4 space-y-3">
        <h3 className="text-sm font-bold text-gray-800">Nouvelle publication</h3>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} className="input text-sm resize-none w-full" placeholder="Quoi de neuf dans votre établissement ?" />
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-blue-600 cursor-pointer flex items-center gap-1 hover:underline">
            <ImageIcon size={12} /> Ajouter des images
            <input type="file" accept="image/*" multiple onChange={(e) => setFiles(e.target.files)} className="hidden" />
          </label>
          {files && <span className="text-xs text-gray-400">{files.length} image(s)</span>}
          <label className="text-xs text-purple-600 cursor-pointer flex items-center gap-1 hover:underline">
            <Video size={12} /> Ajouter une vidéo
            <input type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} className="hidden" />
          </label>
          {videoFile && <span className="text-xs text-gray-400 truncate max-w-[140px]">{videoFile.name}</span>}
          <button type="submit" disabled={posting} className="btn-primary text-sm ml-auto">
            {posting ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
            {posting && progress > 0 && progress < 100 ? ` ${progress}%` : ' Publier'}
          </button>
        </div>
        {posting && progress > 0 && (
          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div className="bg-blue-600 h-full transition-all duration-200" style={{ width: `${progress}%` }} />
          </div>
        )}
      </form>

      {loading ? <div className="text-center py-8"><Loader2 size={20} className="animate-spin mx-auto text-blue-600" /></div> : (
        <div className="grid gap-2">
          {posts.map((p) => (
            <div key={p._id} className="card p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-800 line-clamp-2">{p.content}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{new Date(p.createdAt).toLocaleDateString('fr-FR')} · {p.likes?.length || 0} likes · {p.comments?.length || 0} commentaires{p.type === 'video' ? ' · 🎬 vidéo' : ''}</p>
                </div>
                <button onClick={() => handleDelete(p._id)} className="text-red-400 hover:text-red-600 flex-shrink-0 ml-2"><Trash2 size={14} /></button>
              </div>
              {p.images?.length > 0 && (
                <div className="flex gap-1 mt-2">{p.images.slice(0, 3).map((img, i) => <img key={i} src={img} className="w-16 h-16 rounded object-cover" />)}</div>
              )}
              {p.type === 'video' && p.videoUrl && (
                <video src={p.videoUrl} className="mt-2 w-full max-w-xs rounded" controls preload="metadata" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ========== PAYMENTS ========== */
function PaymentsEditor({ schoolId }) {
  const [form, setForm] = useState({ className: '', totalAmount: '', installments: [{ label: '', amount: '', deadline: '' }] })
  const [adding, setAdding] = useState(false)

  const paymentsQ = useCachedFetch(
    schoolId ? `/school-pages/${schoolId}/payments?` : null,
    async () => (await schoolPagesApi.getPayments(schoolId)).data || [],
    [schoolId],
  )
  const mods = paymentsQ.data || []
  const loading = paymentsQ.loading

  const addInstallment = () => setForm({ ...form, installments: [...form.installments, { label: '', amount: '', deadline: '' }] })
  const removeInstallment = (i) => setForm({ ...form, installments: form.installments.filter((_, j) => j !== i) })
  const updateInstallment = (i, field, value) => {
    const inst = [...form.installments]
    inst[i] = { ...inst[i], [field]: value }
    setForm({ ...form, installments: inst })
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    setAdding(true)
    try {
      await schoolPagesApi.addPayment(schoolId, { ...form, totalAmount: Number(form.totalAmount), installments: form.installments.filter((i) => i.label).map((i) => ({ ...i, amount: Number(i.amount) })) })
      setForm({ className: '', totalAmount: '', installments: [{ label: '', amount: '', deadline: '' }] })
      cache.invalidate(`/school-pages/${schoolId}/payments`)
      paymentsQ.refetch()
    } catch (e) { alert(e.message) }
    setAdding(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ?')) return
    await schoolPagesApi.deletePayment(id)
    cache.invalidate(`/school-pages/${schoolId}/payments`)
    paymentsQ.refetch()
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="card p-4 space-y-3">
        <h3 className="text-sm font-bold text-gray-800">Ajouter une modalité de paiement</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input required value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} className="input text-sm" placeholder="Classe (ex: CM2)" />
          <input required type="number" value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} className="input text-sm" placeholder="Montant total (F CFA)" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-gray-600">Tranches</label>
            <button type="button" onClick={addInstallment} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Plus size={10} /> Ajouter tranche</button>
          </div>
          {form.installments.map((inst, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input value={inst.label} onChange={(e) => updateInstallment(i, 'label', e.target.value)} className="input text-xs flex-1" placeholder="Libellé (ex: 1ère tranche)" />
              <input type="number" value={inst.amount} onChange={(e) => updateInstallment(i, 'amount', e.target.value)} className="input text-xs w-28" placeholder="Montant" />
              <input value={inst.deadline} onChange={(e) => updateInstallment(i, 'deadline', e.target.value)} className="input text-xs w-32" placeholder="Échéance (opt.)" />
              {i > 0 && <button type="button" onClick={() => removeInstallment(i)} className="text-red-400"><Trash2 size={12} /></button>}
            </div>
          ))}
        </div>
        <button type="submit" disabled={adding} className="btn-primary text-sm">
          {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Ajouter
        </button>
      </form>

      {loading ? <div className="text-center py-8"><Loader2 size={20} className="animate-spin mx-auto text-blue-600" /></div> : (
        <div className="grid gap-2">
          {mods.map((m) => (
            <div key={m._id} className="card p-3 flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-900">{m.className}</span>
                <span className="text-xs text-gray-400 ml-2">{m.totalAmount?.toLocaleString()} F CFA</span>
                {m.installments?.length > 0 && <span className="text-xs text-blue-600 ml-2">({m.installments.length} tranches)</span>}
              </div>
              <button onClick={() => handleDelete(m._id)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ========== CONTACTS ========== */
function ContactsEditor({ page, savePage, saving }) {
  const [contacts, setContacts] = useState([])

  useEffect(() => { setContacts(page?.contacts || []) }, [page])

  const add = () => setContacts([...contacts, { type: 'whatsapp', value: '', label: '' }])
  const remove = (i) => setContacts(contacts.filter((_, j) => j !== i))
  const update = (i, field, value) => {
    const c = [...contacts]
    c[i] = { ...c[i], [field]: value }
    setContacts(c)
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-800">Contacts</h3>
        <button type="button" onClick={add} className="text-xs text-blue-600 flex items-center gap-1"><Plus size={12} /> Ajouter</button>
      </div>
      {contacts.map((c, i) => (
        <div key={i} className="flex gap-2 items-center">
          <select value={c.type} onChange={(e) => update(i, 'type', e.target.value)} className="input text-xs w-28">
            <option value="whatsapp">WhatsApp</option>
            <option value="phone">Téléphone</option>
            <option value="email">Email</option>
          </select>
          <input value={c.label} onChange={(e) => update(i, 'label', e.target.value)} className="input text-xs w-28" placeholder="Libellé" />
          <input value={c.value} onChange={(e) => update(i, 'value', e.target.value)} className="input text-xs flex-1" placeholder="Numéro / Adresse" />
          <button onClick={() => remove(i)} className="text-red-400"><Trash2 size={12} /></button>
        </div>
      ))}
      <button onClick={() => savePage({ contacts })} disabled={saving} className="btn-primary text-sm">
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Sauvegarder
      </button>
    </div>
  )
}

/* ========== TEXT EDITOR (terms/privacy/help) ========== */
function TextEditor({ label, field, page, savePage, saving }) {
  const [text, setText] = useState('')
  useEffect(() => { setText(page?.[field] || '') }, [page, field])

  return (
    <div className="card p-5 space-y-4">
      <h3 className="text-sm font-bold text-gray-800">{label}</h3>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} className="input text-sm resize-none w-full" placeholder={`Rédigez vos ${label.toLowerCase()}...`} />
      <button onClick={() => savePage({ [field]: text })} disabled={saving} className="btn-primary text-sm">
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Sauvegarder
      </button>
    </div>
  )
}

/* ========== REVIEWS EDITOR ========== */
function ReviewsEditor({ schoolId }) {
  const reviewsQ = useCachedFetch(
    schoolId ? `/school-pages/${schoolId}/reviews?` : null,
    async () => (await schoolPagesApi.getAllReviews(schoolId)).data || [],
    [schoolId],
  )
  const reviews = reviewsQ.data || []
  const loading = reviewsQ.loading

  const handleApprove = async (id) => {
    await schoolPagesApi.approveReview(id)
    cache.invalidate(`/school-pages/${schoolId}/reviews`)
    reviewsQ.refetch()
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cet avis ?')) return
    await schoolPagesApi.deleteReview(id)
    cache.invalidate(`/school-pages/${schoolId}/reviews`)
    reviewsQ.refetch()
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-gray-800">Gestion des avis</h3>
      {loading ? <div className="text-center py-8"><Loader2 size={20} className="animate-spin mx-auto text-blue-600" /></div> : reviews.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Aucun avis reçu</div>
      ) : (
        <div className="grid gap-2">
          {reviews.map((r) => (
            <div key={r._id} className="card p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{r.authorName}</span>
                  <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map((s) => <Star key={s} size={10} className={s <= r.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'} />)}</div>
                  {r.isApproved ? <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Publié</span> : <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">En attente</span>}
                </div>
                <p className="text-xs text-gray-600 line-clamp-1 mt-0.5">{r.content}</p>
              </div>
              <div className="flex items-center gap-1">
                {!r.isApproved && <button onClick={() => handleApprove(r._id)} className="w-7 h-7 bg-green-100 text-green-600 rounded-lg flex items-center justify-center hover:bg-green-200"><Check size={12} /></button>}
                <button onClick={() => handleDelete(r._id)} className="w-7 h-7 bg-red-50 text-red-400 rounded-lg flex items-center justify-center hover:bg-red-100"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ========== DONATE EDITOR ========== */
function DonateEditor({ page, savePage, saving }) {
  const [accounts, setAccounts] = useState([])
  useEffect(() => { setAccounts(page?.donationAccounts || []) }, [page])

  const add = () => setAccounts([...accounts, { accountName: '', accountNumber: '', bankName: '' }])
  const remove = (i) => setAccounts(accounts.filter((_, j) => j !== i))
  const update = (i, field, value) => {
    const a = [...accounts]
    a[i] = { ...a[i], [field]: value }
    setAccounts(a)
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-800">Comptes de donation</h3>
        <button type="button" onClick={add} className="text-xs text-blue-600 flex items-center gap-1"><Plus size={12} /> Ajouter</button>
      </div>
      {accounts.map((a, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input value={a.accountName} onChange={(e) => update(i, 'accountName', e.target.value)} className="input text-xs flex-1" placeholder="Nom du compte" />
          <input value={a.accountNumber} onChange={(e) => update(i, 'accountNumber', e.target.value)} className="input text-xs flex-1" placeholder="Numéro de compte" />
          <input value={a.bankName} onChange={(e) => update(i, 'bankName', e.target.value)} className="input text-xs w-32" placeholder="Banque" />
          <button onClick={() => remove(i)} className="text-red-400"><Trash2 size={12} /></button>
        </div>
      ))}
      <button onClick={() => savePage({ donationAccounts: accounts })} disabled={saving} className="btn-primary text-sm">
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Sauvegarder
      </button>
    </div>
  )
}
