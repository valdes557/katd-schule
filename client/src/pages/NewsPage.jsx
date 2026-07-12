import { useEffect, useState } from 'react'
import { Link, useLocation, useOutletContext } from 'react-router-dom'
import {
  Newspaper, Briefcase, GraduationCap, PlayCircle, MapPin, Clock, X, Loader2, ArrowLeft, Send,
  CheckCircle2, Upload, Building2, MessageCircle, Mail, FileText, DollarSign, BookOpen,
} from 'lucide-react'
import { recruitmentApi, newsApi } from '../lib/api'

const EMPTY_APP = { fullName: '', email: '', whatsapp: '', message: '', cv: null }

// Métadonnées d'affichage par type de contenu du feed
const KIND_META = {
  recrutement: { label: 'Recrutement', icon: Briefcase, color: 'text-blue-600 bg-blue-50' },
  repetition: { label: 'Répétition', icon: GraduationCap, color: 'text-indigo-600 bg-indigo-50' },
  demo: { label: 'Démo', icon: PlayCircle, color: 'text-rose-600 bg-rose-50' },
  pub: { label: 'Publicité', icon: PlayCircle, color: 'text-amber-600 bg-amber-50' },
}

const waLink = (num) => `https://wa.me/${String(num || '').replace(/[^0-9]/g, '')}`

export default function NewsPage() {
  const { pathname } = useLocation()
  const inUserSpace = pathname.startsWith('/u')
  const ctx = useOutletContext() // { markNewsSeen } quand rendu dans /u
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(EMPTY_APP)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    (async () => {
      try { const r = await newsApi.publicFeed(); setFeed(r.data || []) } catch (_) {}
      setLoading(false)
    })()
    // Marque les News comme vues (badges -> 0) sur toutes les surfaces
    const now = String(Date.now())
    try { localStorage.setItem('u_news_seen', now); localStorage.setItem('home_news_seen', now) } catch (_) {}
    ctx?.markNewsSeen?.()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const openItem = (p) => { setSelected(p); setForm(EMPTY_APP); setSent(false) }

  const submitApplication = async (e) => {
    e.preventDefault()
    setSending(true)
    try {
      const r = await recruitmentApi.apply(selected._id, form)
      if (r.success) setSent(true)
      else alert(r.message || 'Erreur')
    } catch (err) { alert(err.message) }
    setSending(false)
  }

  const renderCard = (p) => {
    const meta = KIND_META[p.kind] || KIND_META.demo
    const isMedia = p.kind === 'demo' || p.kind === 'pub'
    return (
      <button key={`${p.kind}-${p._id}`} onClick={() => openItem(p)} className="card overflow-hidden text-left hover:shadow-md transition-shadow">
        {(p.photo || (isMedia && p.type === 'image' && p.mediaUrl)) && (
          <img src={p.photo || p.mediaUrl} alt="" className="w-full h-36 object-cover" />
        )}
        {isMedia && p.type === 'video' && p.mediaUrl && (
          <div className="w-full h-36 bg-black flex items-center justify-center"><PlayCircle size={40} className="text-white/80" /></div>
        )}
        <div className="p-4">
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2 ${meta.color}`}>
            <meta.icon size={11} /> {meta.label}
          </span>
          <p className="font-bold text-gray-900 leading-tight">{p.title}</p>
          {p.kind === 'recrutement' && <p className="text-xs text-gray-500 mt-1">{[p.poste, p.contractType].filter(Boolean).join(' · ')}</p>}
          {p.kind === 'repetition' && <p className="text-xs text-gray-500 mt-1">{[p.subjects, p.price].filter(Boolean).join(' · ')}</p>}
          <p className="text-sm text-gray-600 mt-2 line-clamp-2">{p.description}</p>
          <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
            {(p.school?.name || p.teacherName) && <span className="flex items-center gap-1 truncate"><Building2 size={12} /> {p.school?.name || p.teacherName}</span>}
            {p.location && <span className="flex items-center gap-1"><MapPin size={12} /> {p.location}</span>}
          </div>
        </div>
      </button>
    )
  }

  const ads = feed.filter((p) => p.kind === 'pub')
  const rest = feed.filter((p) => p.kind !== 'pub')

  const list = (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Newspaper size={22} className="text-amber-600" />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Actualités & News</h1>
          <p className="text-sm text-gray-500">Recrutements, cours de répétition et démonstrations de l'application</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-amber-600" /></div>
      ) : feed.length === 0 ? (
        <div className="text-center py-14 text-gray-400">
          <Newspaper size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucune actualité pour le moment.</p>
        </div>
      ) : (
        <>
          {/* Section dédiée aux vidéos publicitaires */}
          {ads.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <PlayCircle size={16} className="text-amber-600" /> 🎬 Vidéos publicitaires
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {ads.map(renderCard)}
              </div>
            </div>
          )}

          {rest.length > 0 && (
            <div className="space-y-3">
              {ads.length > 0 && <h2 className="text-sm font-bold text-gray-800 pt-2">Actualités & démonstrations</h2>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {rest.map(renderCard)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )

  // Contenu de la modale de détail selon le type
  const renderDetail = () => {
    if (!selected) return null
    const p = selected

    if (p.kind === 'recrutement') {
      return (
        <>
          <p className="text-xs text-gray-500 mb-1">{p.school?.name} · {[p.poste, p.location, p.contractType].filter(Boolean).join(' · ')}</p>
          <p className="text-sm text-gray-700 whitespace-pre-line mb-4">{p.description}</p>
          {sent ? (
            <div className="text-center py-6">
              <CheckCircle2 size={44} className="text-green-500 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-800">Candidature envoyée !</p>
              <p className="text-xs text-gray-500 mt-1">L'établissement vous contactera par email ou WhatsApp.</p>
              <button onClick={() => setSelected(null)} className="btn-primary mt-4 justify-center w-full text-sm">Fermer</button>
            </div>
          ) : (
            <form onSubmit={submitApplication} className="space-y-3 border-t border-gray-100 pt-4">
              <p className="text-sm font-semibold text-gray-800">Postuler à cette offre</p>
              <div>
                <label className="text-xs font-medium text-gray-600">Nom complet *</label>
                <input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="input text-sm mt-1 w-full" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Email *</label>
                  <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input text-sm mt-1 w-full" placeholder="vous@email.com" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">WhatsApp *</label>
                  <input required value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className="input text-sm mt-1 w-full" placeholder="+237 6XX XXX XXX" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Message (optionnel)</label>
                <textarea rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="input text-sm mt-1 w-full" placeholder="Présentez-vous en quelques mots..." />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">CV (PDF ou image)</label>
                <label className="mt-1 flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 text-sm text-gray-500">
                  <Upload size={15} />
                  <span className="truncate">{form.cv ? form.cv.name : 'Choisir un fichier...'}</span>
                  <input type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => setForm({ ...form, cv: e.target.files?.[0] || null })} />
                </label>
              </div>
              <button type="submit" disabled={sending} className="btn-primary w-full justify-center">
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Envoyer ma candidature
              </button>
            </form>
          )}
        </>
      )
    }

    if (p.kind === 'repetition') {
      return (
        <>
          {p.photo && <img src={p.photo} alt="" className="w-full h-48 object-cover rounded-xl mb-3" />}
          <p className="text-xs text-gray-500 mb-2">{p.teacherName}{p.school?.name ? ` · ${p.school.name}` : ''}</p>
          <div className="flex flex-wrap gap-3 mb-3 text-xs text-gray-500">
            {p.subjects && <span className="flex items-center gap-1"><BookOpen size={13} /> {p.subjects}</span>}
            {p.price && <span className="flex items-center gap-1"><DollarSign size={13} /> {p.price}</span>}
            {p.location && <span className="flex items-center gap-1"><MapPin size={13} /> {p.location}</span>}
            {p.schedule && <span className="flex items-center gap-1"><Clock size={13} /> {p.schedule}</span>}
          </div>
          <p className="text-sm text-gray-700 whitespace-pre-line mb-4">{p.description}</p>
          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm font-semibold text-gray-800 mb-2">Contacter l'enseignant</p>
            <div className="flex flex-wrap gap-2">
              {p.contactWhatsapp && (
                <a href={waLink(p.contactWhatsapp)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                  <MessageCircle size={15} /> WhatsApp
                </a>
              )}
              {p.contactEmail && (
                <a href={`mailto:${p.contactEmail}`} className="inline-flex items-center gap-1.5 text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                  <Mail size={15} /> Email
                </a>
              )}
              {!p.contactWhatsapp && !p.contactEmail && <p className="text-xs text-gray-400">Aucun contact fourni.</p>}
            </div>
          </div>
        </>
      )
    }

    // demo (contenu admin : vidéo / pdf / image / lien)
    return (
      <>
        <p className="text-sm text-gray-700 whitespace-pre-line mb-4">{p.description}</p>
        {p.type === 'video' && p.mediaUrl && (
          <video src={p.mediaUrl} controls className="w-full rounded-xl bg-black max-h-[60vh]" />
        )}
        {p.type === 'image' && p.mediaUrl && (
          <img src={p.mediaUrl} alt="" className="w-full rounded-xl" />
        )}
        {p.type === 'pdf' && p.mediaUrl && (
          <a href={p.mediaUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm bg-rose-600 text-white px-4 py-2 rounded-lg hover:bg-rose-700">
            <FileText size={15} /> Ouvrir le PDF
          </a>
        )}
        {p.link && (
          <a href={p.link} target="_blank" rel="noreferrer" className="block mt-3 text-sm text-blue-600 hover:underline break-all">{p.link}</a>
        )}
      </>
    )
  }

  const body = (
    <>
      {list}

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-gray-900">{selected.title}</h3>
              <button onClick={() => setSelected(null)} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
            </div>
            {renderDetail()}
          </div>
        </div>
      )}
    </>
  )

  if (inUserSpace) return body

  // Page publique autonome (route /news)
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5"><ArrowLeft size={16} /> Retour à l'accueil</Link>
        {body}
      </div>
    </div>
  )
}
