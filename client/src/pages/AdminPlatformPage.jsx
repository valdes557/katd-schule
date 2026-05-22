import { useState, useEffect, useRef } from 'react'
import {
  Globe2, Plus, Trash2, CheckCircle, XCircle,
  Image, Film, Save, Loader2, Star,
  MessageCircle, CreditCard, Phone, Info,
} from 'lucide-react'
import { platformApi, plansApi } from '../lib/api'
import { useAuth } from '../context/AuthContext'

const TABS = [
  { id: 'posts', label: 'Publications', icon: Globe2 },
  { id: 'about', label: 'À propos', icon: Info },
  { id: 'contacts', label: 'Contacts', icon: Phone },
  { id: 'support', label: 'Donations', icon: CreditCard },
  { id: 'experiences', label: 'Témoignages', icon: Star },
  { id: 'payments', label: 'Paiements', icon: CreditCard },
  { id: 'plans', label: 'Plans tarifaires', icon: Star },
]

// ─── Posts Panel ─────────────────────────────────────────────────────────────
const MEDIA_TYPES = [
  { id: 'photo', label: 'Photo', icon: '🖼️' },
  { id: 'video', label: 'Vidéo', icon: '🎬' },
  { id: 'audio', label: 'Audio', icon: '🎵' },
]
const CATEGORIES = ['Éducation', 'Sport', 'Culture', 'Sciences', 'Technologie']
const TYPE_ICON = { photo: '🖼️', video: '🎬', audio: '🎵', text: '📝' }

function PostsPanel() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [mediaType, setMediaType] = useState('photo')
  const [form, setForm] = useState({ title: '', content: '', category: '', videoUrl: '', duration: '' })
  const [imageFiles, setImageFiles] = useState([])
  const [audioFile, setAudioFile] = useState(null)
  const [videoFile, setVideoFile] = useState(null)
  const [previews, setPreviews] = useState([])
  const imageRef = useRef()
  const audioRef = useRef()
  const videoRef = useRef()

  useEffect(() => {
    platformApi.getFeed(1).then((r) => setPosts(r.data || [])).finally(() => setLoading(false))
  }, [])

  const handleImages = (e) => {
    const files = Array.from(e.target.files)
    setImageFiles(files)
    setPreviews(files.map((f) => URL.createObjectURL(f)))
  }

  const resetForm = () => {
    setForm({ title: '', content: '', category: '', videoUrl: '', duration: '' })
    setImageFiles([]); setAudioFile(null); setVideoFile(null); setPreviews([])
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    const fd = new FormData()
    fd.append('mediaType', mediaType)
    Object.entries(form).forEach(([k, v]) => v && fd.append(k, v))
    imageFiles.forEach((f) => fd.append('images', f))
    if (audioFile) fd.append('audio', audioFile)
    if (videoFile) fd.append('video', videoFile)
    try {
      const r = await platformApi.createPost(fd)
      if (r.success) { setPosts((p) => [r.data, ...p]); resetForm() }
      else alert(r.message || 'Erreur')
    } catch (err) { alert(err.message) }
    setSubmitting(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette publication ?')) return
    await platformApi.deletePost(id)
    setPosts((p) => p.filter((x) => x._id !== id))
  }

  return (
    <div className="space-y-6">
      {/* ── Create form ── */}
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Plus size={14} className="text-blue-600" /> Nouvelle publication multimédia
        </h3>

        {/* Media type selector */}
        <div className="flex gap-2 mb-4">
          {MEDIA_TYPES.map((t) => (
            <button
              key={t.id} type="button"
              onClick={() => { setMediaType(t.id); resetForm() }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                mediaType === t.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300'
              }`}
            >
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleCreate} className="space-y-3">
          <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input text-sm w-full" placeholder="Titre *" />
          <textarea required value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={3} className="input text-sm resize-none w-full" placeholder="Description *" />

          <div className="grid grid-cols-2 gap-3">
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input text-sm">
              <option value="">Catégorie</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} className="input text-sm" placeholder="Durée ex: 3:45 (optionnel)" />
          </div>

          {/* Media-type-specific upload */}
          {mediaType === 'photo' && (
            <div>
              <button type="button" onClick={() => imageRef.current?.click()} className="btn-ghost text-sm border border-dashed border-gray-300 w-full justify-center py-3 hover:border-blue-400">
                <Image size={15} className="text-blue-500" /> Sélectionner les photos (max 5)
              </button>
              <input ref={imageRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImages} />
              {previews.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {previews.map((p, i) => <img key={i} src={p} alt="" className="w-20 h-14 object-cover rounded-lg border border-gray-200" />)}
                </div>
              )}
            </div>
          )}

          {mediaType === 'video' && (
            <div className="space-y-2">
              <div>
                <input value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} className="input text-sm w-full" placeholder="URL YouTube / lien vidéo externe (optionnel)" />
              </div>
              <div className="text-xs text-gray-400 text-center">— ou uploader un fichier vidéo —</div>
              <button type="button" onClick={() => videoRef.current?.click()} className="btn-ghost text-sm border border-dashed border-gray-300 w-full justify-center py-3 hover:border-blue-400">
                <Film size={15} className="text-purple-500" /> {videoFile ? videoFile.name : 'Sélectionner une vidéo (MP4, MOV…)'}
              </button>
              <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} />
            </div>
          )}

          {mediaType === 'audio' && (
            <div>
              <button type="button" onClick={() => audioRef.current?.click()} className="btn-ghost text-sm border border-dashed border-gray-300 w-full justify-center py-3 hover:border-blue-400">
                <Star size={15} className="text-green-500" /> {audioFile ? audioFile.name : 'Sélectionner un fichier audio (MP3, WAV…)'}
              </button>
              <input ref={audioRef} type="file" accept="audio/*" className="hidden" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
              {audioFile && (
                <audio controls src={URL.createObjectURL(audioFile)} className="w-full mt-2 rounded-lg" />
              )}
            </div>
          )}

          <button type="submit" disabled={submitting} className="btn-primary text-sm">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Publier
          </button>
        </form>
      </div>

      {/* ── Posts list ── */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-gray-900">Publications ({posts.length})</h3>
        {loading ? (
          <div className="text-center py-8"><Loader2 size={24} className="animate-spin text-blue-600 mx-auto" /></div>
        ) : posts.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Aucune publication</p>
        ) : (
          posts.map((p) => (
            <div key={p._id} className="bg-white border border-gray-100 rounded-xl p-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-14 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {p.thumbnail || p.images?.[0]
                    ? <img src={p.thumbnail || p.images[0]} className="w-full h-full object-cover" alt="" />
                    : <span className="text-xl">{TYPE_ICON[p.type] || '📝'}</span>
                  }
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded font-medium text-gray-500">{p.type?.toUpperCase()}</span>
                    {p.category && <span className="text-[10px] bg-blue-50 px-1.5 py-0.5 rounded text-blue-600">{p.category}</span>}
                  </div>
                  {p.title && <div className="text-sm font-semibold text-gray-900 truncate">{p.title}</div>}
                  <p className="text-xs text-gray-500 line-clamp-1">{p.content}</p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                    <span>👍 {p.likes?.length || 0}</span>
                    <span>💬 {p.comments?.length || 0}</span>
                    <span>👁 {p.views || 0}</span>
                    <span>⬇️ {p.downloads || 0}</span>
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

// ─── Payment Methods Panel ───────────────────────────────────────────────────
function PaymentsPanel() {
  const [methods, setMethods] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'mobile_money', accountNumber: '', accountName: '', instructions: '', sortOrder: 0 })
  const [editId, setEditId] = useState(null)

  const load = () => {
    setLoading(true)
    platformApi.getAllPaymentMethods().then((r) => setMethods(r.data || [])).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const resetForm = () => {
    setForm({ name: '', type: 'mobile_money', accountNumber: '', accountName: '', instructions: '', sortOrder: 0 })
    setEditId(null)
    setShowForm(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editId) {
        await platformApi.updatePaymentMethod(editId, form)
      } else {
        await platformApi.createPaymentMethod(form)
      }
      load()
      resetForm()
    } catch (err) { alert(err.message) }
    setSaving(false)
  }

  const handleEdit = (m) => {
    setForm({ name: m.name, type: m.type, accountNumber: m.accountNumber, accountName: m.accountName, instructions: m.instructions, sortOrder: m.sortOrder || 0 })
    setEditId(m._id)
    setShowForm(true)
  }

  const toggleActive = async (m) => {
    await platformApi.updatePaymentMethod(m._id, { isActive: !m.isActive })
    load()
  }

  const remove = async (id) => {
    if (!window.confirm('Supprimer ce moyen de paiement ?')) return
    await platformApi.deletePaymentMethod(id)
    load()
  }

  const TYPE_LABELS = { mobile_money: 'Mobile Money', bank: 'Virement bancaire', cash: 'Espèces', other: 'Autre' }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Moyens de paiement</h3>
          <p className="text-xs text-gray-500 mt-0.5">Ces méthodes sont automatiquement affichées dans les formulaires d'inscription</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="btn-primary text-sm flex items-center gap-1.5">
          <Plus size={14} /> Ajouter
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3">
          <h4 className="text-sm font-bold text-gray-900">{editId ? 'Modifier' : 'Nouveau'} moyen de paiement</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Nom *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input text-sm w-full" placeholder="ex: MTN Mobile Money" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input text-sm w-full">
                <option value="mobile_money">Mobile Money</option>
                <option value="bank">Virement bancaire</option>
                <option value="cash">Espèces</option>
                <option value="other">Autre</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Numéro / IBAN</label>
              <input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} className="input text-sm w-full" placeholder="ex: 6 99 00 00 00" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Nom du compte</label>
              <input value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} className="input text-sm w-full" placeholder="ex: KATD-SCHÜLE" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Instructions de paiement</label>
            <textarea rows={2} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} className="input text-sm resize-none w-full" placeholder="Instructions affichées aux utilisateurs..." />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={resetForm} className="btn-ghost text-sm">Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm flex items-center gap-1.5">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {editId ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-blue-600" /></div>
      ) : methods.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-10">Aucun moyen de paiement configuré.</p>
      ) : (
        <div className="space-y-2">
          {methods.map((m) => (
            <div key={m._id} className={`bg-white border rounded-xl p-4 flex items-center gap-3 ${!m.isActive ? 'opacity-50' : ''}`}>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                m.type === 'mobile_money' ? 'bg-yellow-100 text-yellow-700' :
                m.type === 'bank' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
              }`}>
                <CreditCard size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{m.name}</span>
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{TYPE_LABELS[m.type] || m.type}</span>
                  {!m.isActive && <span className="text-[10px] bg-red-50 text-red-500 px-2 py-0.5 rounded-full">Inactif</span>}
                </div>
                {m.accountNumber && <p className="text-xs text-gray-500 mt-0.5">{m.accountName} · {m.accountNumber}</p>}
                {m.instructions && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{m.instructions}</p>}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => toggleActive(m)} title={m.isActive ? 'Désactiver' : 'Activer'} className={`p-1.5 rounded-lg transition-colors ${m.isActive ? 'text-green-500 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-50'}`}>
                  <CheckCircle size={15} />
                </button>
                <button onClick={() => handleEdit(m)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                  <Save size={15} />
                </button>
                <button onClick={() => remove(m._id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Plans Panel ─────────────────────────────────────────────────────
const CYCLES = ['Maternelle', 'Primaire', 'Secondaire']
const CYCLE_COLORS = { Maternelle: 'bg-orange-100 text-orange-700', Primaire: 'bg-blue-100 text-blue-700', Secondaire: 'bg-emerald-100 text-emerald-700' }
const DEFAULT_FEATURES = ['Gestion des élèves', 'Notes & Bulletins', 'Présence', 'Messagerie', 'Page publique']

function PlansPanel() {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ cycle: 'Primaire', name: '', quarterlyPrice: '', annualPrice: '', features: DEFAULT_FEATURES.join('\n'), isActive: true })

  const load = () => {
    setLoading(true)
    plansApi.listAll().then((r) => setPlans(r.data || [])).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const resetForm = () => {
    setForm({ cycle: 'Primaire', name: '', quarterlyPrice: '', annualPrice: '', features: DEFAULT_FEATURES.join('\n'), isActive: true })
    setEditId(null)
    setShowForm(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        quarterlyPrice: Number(form.quarterlyPrice),
        annualPrice: Number(form.annualPrice),
        features: form.features.split('\n').map((s) => s.trim()).filter(Boolean),
      }
      if (editId) { await plansApi.update(editId, payload) }
      else { await plansApi.create(payload) }
      load()
      resetForm()
    } catch (err) { alert(err.message) }
    setSaving(false)
  }

  const handleEdit = (p) => {
    setForm({
      cycle: p.cycle, name: p.name,
      quarterlyPrice: p.quarterlyPrice, annualPrice: p.annualPrice,
      features: (p.features || []).join('\n'), isActive: p.isActive,
    })
    setEditId(p._id)
    setShowForm(true)
  }

  const remove = async (id) => {
    if (!window.confirm('Supprimer ce plan ?')) return
    await plansApi.remove(id)
    load()
  }

  const toggle = async (p) => {
    await plansApi.update(p._id, { isActive: !p.isActive })
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Plans tarifaires</h3>
          <p className="text-xs text-gray-500 mt-0.5">Ces plans sont affichés sur la page d'accueil et dans le formulaire de souscription</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="btn-primary text-sm flex items-center gap-1.5">
          <Plus size={14} /> Nouveau plan
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3">
          <h4 className="text-sm font-bold text-gray-900">{editId ? 'Modifier' : 'Nouveau'} plan</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Cycle *</label>
              <select required value={form.cycle} onChange={(e) => setForm({ ...form, cycle: e.target.value })} className="input text-sm w-full">
                {CYCLES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Nom du plan *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input text-sm w-full" placeholder="Ex: Standard" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Prix trimestriel (F CFA) *</label>
              <input required type="number" min="0" value={form.quarterlyPrice} onChange={(e) => setForm({ ...form, quarterlyPrice: e.target.value })} className="input text-sm w-full" placeholder="Ex: 30000" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Prix annuel (F CFA) *</label>
              <input required type="number" min="0" value={form.annualPrice} onChange={(e) => setForm({ ...form, annualPrice: e.target.value })} className="input text-sm w-full" placeholder="Ex: 100000" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Fonctionnalités incluses <span className="text-gray-400 font-normal">(une par ligne)</span></label>
            <textarea rows={5} value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} className="input text-sm resize-none w-full font-mono" placeholder="Gestion des élèves&#10;Notes & Bulletins&#10;..." />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="planActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            <label htmlFor="planActive" className="text-xs text-gray-600">Plan actif (visible publiquement)</label>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={resetForm} className="btn-ghost text-sm">Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm flex items-center gap-1.5">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {editId ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-blue-600" /></div>
      ) : plans.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-10">Aucun plan créé.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {plans.map((p) => (
            <div key={p._id} className={`bg-white border rounded-xl p-4 space-y-2 ${!p.isActive ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CYCLE_COLORS[p.cycle] || 'bg-gray-100 text-gray-600'}`}>{p.cycle}</span>
                {!p.isActive && <span className="text-[10px] bg-red-50 text-red-500 border border-red-100 px-2 py-0.5 rounded-full">Inactif</span>}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{p.name}</p>
                <p className="text-xs text-gray-500">{p.quarterlyPrice?.toLocaleString()} F / trim · {p.annualPrice?.toLocaleString()} F / an</p>
              </div>
              {p.features?.length > 0 && (
                <ul className="space-y-0.5">
                  {p.features.slice(0, 3).map((f) => <li key={f} className="text-xs text-gray-500 flex items-center gap-1"><span className="text-green-500">✓</span>{f}</li>)}
                  {p.features.length > 3 && <li className="text-xs text-gray-400">+{p.features.length - 3} autres...</li>}
                </ul>
              )}
              <div className="flex items-center gap-1 pt-2 border-t border-gray-100">
                <button onClick={() => toggle(p)} title={p.isActive ? 'Désactiver' : 'Activer'} className={`p-1.5 rounded-lg ${p.isActive ? 'text-green-500 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-50'}`}><CheckCircle size={14} /></button>
                <button onClick={() => handleEdit(p)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"><Save size={14} /></button>
                <button onClick={() => remove(p._id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg ml-auto"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
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
          {tab === 'payments' && <PaymentsPanel />}
          {tab === 'plans' && <PlansPanel />}
        </>
      )}
    </div>
  )
}
