import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Camera, Save, Loader2, School, MapPin, Phone, Mail, Globe,
  CheckCircle, AlertCircle, Info, Eye,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { schoolsApi, locationsApi } from '../lib/api'

const CYCLES = ['Maternelle', 'Primaire', 'Secondaire']
const CYCLE_COLORS = {
  Maternelle: 'bg-orange-100 text-orange-700 border-orange-200',
  Primaire: 'bg-blue-100 text-blue-700 border-blue-200',
  Secondaire: 'bg-green-100 text-green-700 border-green-200',
}

function CreateSchoolForm({ onCreated }) {
  const { setSchool: setCtxSchool } = useAuth()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const logoRef = useRef()
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState('')
  const [cForm, setCForm] = useState({ name: '', description: '', cycles: [], phone: '', email: '' })

  const toggleCycle = (c) => setCForm((f) => ({ ...f, cycles: f.cycles.includes(c) ? f.cycles.filter((x) => x !== c) : [...f.cycles, c] }))

  const handleCreate = async (e) => {
    e.preventDefault()
    if (cForm.cycles.length === 0) { setError('Sélectionnez au moins un cycle'); return }
    setSaving(true); setError('')
    try {
      const fd = new FormData()
      fd.append('name', cForm.name)
      fd.append('description', cForm.description)
      fd.append('cycles', JSON.stringify(cForm.cycles))
      fd.append('phone', cForm.phone)
      fd.append('email', cForm.email)
      fd.append('contact', JSON.stringify({ email: cForm.email, phone: cForm.phone }))
      if (logoFile) fd.append('logo', logoFile)
      const r = await schoolsApi.create(fd)
      if (r.success || r.data) {
        setCtxSchool(r.data)
        localStorage.setItem('katd_school', JSON.stringify(r.data))
        onCreated(r.data)
      } else {
        setError(r.message || 'Erreur lors de la création')
      }
    } catch (err) { setError(err.message) }
    setSaving(false)
  }

  return (
    <div className="max-w-xl mx-auto py-10 animate-fade-in">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <School size={28} className="text-blue-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900">Créer votre école</h2>
        <p className="text-sm text-gray-500">Remplissez les informations pour créer le profil de votre établissement</p>
      </div>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4 flex items-center gap-2"><AlertCircle size={15} /> {error}</div>}
      <form onSubmit={handleCreate} className="bg-white border border-gray-100 rounded-xl p-6 space-y-4">
        {/* Logo */}
        <div className="flex items-center gap-4">
          <div onClick={() => logoRef.current?.click()} className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-300 hover:border-blue-400 cursor-pointer flex items-center justify-center overflow-hidden flex-shrink-0 transition-colors">
            {logoPreview ? <img src={logoPreview} className="w-full h-full object-cover" /> : <Camera size={24} className="text-gray-300" />}
          </div>
          <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setLogoFile(f); setLogoPreview(URL.createObjectURL(f)) } }} />
          <div>
            <p className="text-xs font-medium text-gray-600">Photo / Logo de l'école</p>
            <p className="text-[10px] text-gray-400">JPG, PNG — max 5 Mo</p>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Nom de l'établissement *</label>
          <input required value={cForm.name} onChange={(e) => setCForm({ ...cForm, name: e.target.value })} className="input text-sm" placeholder="Ex: Groupe Scolaire Les Champions" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
          <textarea rows={3} value={cForm.description} onChange={(e) => setCForm({ ...cForm, description: e.target.value })} className="input text-sm resize-none" placeholder="Présentation de votre établissement..." />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Cycles d'enseignement *</label>
          <div className="flex gap-3">
            {CYCLES.map((c) => (
              <button key={c} type="button" onClick={() => toggleCycle(c)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${cForm.cycles.includes(c) ? CYCLE_COLORS[c] + ' border-current' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Téléphone</label>
            <input value={cForm.phone} onChange={(e) => setCForm({ ...cForm, phone: e.target.value })} className="input text-sm" placeholder="+237 6XX XXX XXX" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Email</label>
            <input type="email" value={cForm.email} onChange={(e) => setCForm({ ...cForm, email: e.target.value })} className="input text-sm" placeholder="contact@ecole.cm" />
          </div>
        </div>
        <button type="submit" disabled={saving} className="btn-primary w-full justify-center py-3 text-sm">
          {saving ? <><Loader2 size={14} className="animate-spin" /> Création en cours...</> : <><Save size={14} /> Créer mon école</>}
        </button>
      </form>
    </div>
  )
}

export default function DashboardSchoolProfilePage() {
  const { school: ctxSchool, user } = useAuth()
  const navigate = useNavigate()

  const [school, setSchool] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState('')
  const logoRef = useRef()

  const [form, setForm] = useState({
    name: '', description: '', phone: '', email: '',
    website: '',
    city: '', neighborhood: '', country: 'Cameroun',
    cycles: [],
  })

  const [countries, setCountries] = useState([])
  const [cities, setCities] = useState([])
  const [neighborhoods, setNeighborhoods] = useState([])
  const [selCountry, setSelCountry] = useState('')
  const [selCity, setSelCity] = useState('')
  const [selNeighborhood, setSelNeighborhood] = useState('')

  useEffect(() => {
    locationsApi.countries().then((r) => setCountries(r.data || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (selCountry) locationsApi.cities(selCountry).then((r) => { setCities(r.data || []); setNeighborhoods([]) }).catch(() => {})
  }, [selCountry])

  useEffect(() => {
    if (selCity) locationsApi.neighborhoods(selCity).then((r) => setNeighborhoods(r.data || [])).catch(() => {})
  }, [selCity])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const r = await schoolsApi.mine()
        if (r.success && r.data) {
          const s = r.data
          setSchool(s)
          setLogoPreview(s.logo || '')
          setForm({
            name: s.name || '',
            description: s.description || '',
            phone: s.phone || '',
            email: s.email || s.contact?.email || '',
            website: s.contact?.website || '',
            city: s.address?.city || '',
            neighborhood: s.address?.neighborhood || '',
            country: s.address?.country || 'Cameroun',
            cycles: s.cycles || [],
          })
        }
      } catch (_) {}
      setLoading(false)
    }
    load()
  }, [])

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const toggleCycle = (c) => {
    setForm((f) => ({
      ...f,
      cycles: f.cycles.includes(c) ? f.cycles.filter((x) => x !== c) : [...f.cycles, c],
    }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!school) return
    setSaving(true)
    setMsg(null)
    try {
      const fd = new FormData()
      fd.append('name', form.name)
      fd.append('description', form.description)
      fd.append('phone', form.phone)
      fd.append('email', form.email)
      fd.append('address', JSON.stringify({
        country: selCountry ? (countries.find((c) => c._id === selCountry)?.name || form.country) : form.country,
        city: selCity ? (cities.find((c) => c._id === selCity)?.name || form.city) : form.city,
        neighborhood: selNeighborhood ? (neighborhoods.find((n) => n._id === selNeighborhood)?.name || form.neighborhood) : form.neighborhood,
      }))
      fd.append('contact', JSON.stringify({ email: form.email, phone: form.phone, website: form.website }))
      fd.append('cycles', JSON.stringify(form.cycles))
      if (logoFile) fd.append('logo', logoFile)

      const r = await schoolsApi.setup(school._id, fd)
      if (r.success) {
        setSchool(r.data)
        setLogoFile(null)
        setLogoPreview(r.data.logo || logoPreview)
        setMsg({ type: 'success', text: 'Profil de l\'école mis à jour avec succès !' })
      } else {
        setMsg({ type: 'error', text: r.message || 'Erreur lors de la sauvegarde' })
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
    setSaving(false)
    setTimeout(() => setMsg(null), 4000)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 size={28} className="animate-spin text-blue-600" />
    </div>
  )

  if (!school) return <CreateSchoolForm onCreated={(s) => { setSchool(s); setLogoPreview(s.logo || ''); setForm({ name: s.name || '', description: s.description || '', phone: s.phone || '', email: s.email || '', website: '', city: s.address?.city || '', neighborhood: s.address?.neighborhood || '', country: s.address?.country || 'Cameroun', cycles: s.cycles || [] }) }} />

  const initials = school.name?.split(' ').map((w) => w[0]).join('').slice(0, 3).toUpperCase() || '?'

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mon École</h1>
          <p className="text-sm text-gray-500">Configurez le profil public de votre établissement</p>
        </div>
        <a
          href={`/ecole/${school._id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost text-sm border border-gray-200 flex items-center gap-2"
        >
          <Eye size={14} /> Voir la page publique
        </a>
      </div>

      {/* Subscription banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-4 text-white flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-blue-200 uppercase font-semibold tracking-wide">Plan de souscription</p>
          <p className="font-bold text-lg capitalize mt-0.5">{school.subscription?.plan || 'Standard'}</p>
          <p className="text-blue-200 text-xs mt-0.5">
            Cycle · {school.subscription?.cycle || school.cycles?.[0] || 'Non défini'} &nbsp;·&nbsp;
            Statut :{' '}
            <span className={school.subscription?.status === 'active' ? 'text-green-300' : 'text-red-300'}>
              {school.subscription?.status === 'active' ? 'Actif' : school.subscription?.status || 'Inconnu'}
            </span>
          </p>
        </div>
        <div className="text-right text-xs text-blue-200">
          {school.subscription?.endDate && (
            <span>Expire le {new Date(school.subscription.endDate).toLocaleDateString('fr-FR')}</span>
          )}
        </div>
      </div>

      {/* Message */}
      {msg && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium ${
          msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {msg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {msg.text}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        {/* ── Logo ── */}
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Camera size={15} className="text-blue-600" /> Photo de l'école
          </h3>
          <div className="flex items-center gap-5">
            <div
              onClick={() => logoRef.current?.click()}
              className="relative w-24 h-24 rounded-2xl overflow-hidden cursor-pointer group border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors flex-shrink-0"
            >
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                  {initials}
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={20} className="text-white" />
              </div>
            </div>
            <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            <div>
              <button type="button" onClick={() => logoRef.current?.click()} className="btn-ghost text-sm border border-gray-200 mb-1">
                <Camera size={13} /> Changer la photo
              </button>
              <p className="text-xs text-gray-400">JPG, PNG recommandé · Max 5 Mo</p>
              {logoFile && <p className="text-xs text-blue-600 mt-1">✓ {logoFile.name}</p>}
            </div>
          </div>
        </div>

        {/* ── Basic info ── */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <School size={15} className="text-blue-600" /> Informations de base
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Nom de l'établissement *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input text-sm w-full"
                placeholder="Ex: École Primaire Les Petits Génies"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Description / Présentation</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                className="input text-sm resize-none w-full"
                placeholder="Décrivez votre établissement, sa vision, ses valeurs..."
              />
            </div>
          </div>
        </div>

        {/* ── Cycles ── */}
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-2">
            <Info size={15} className="text-blue-600" /> Cycles d'enseignement
          </h3>
          <p className="text-xs text-gray-400 mb-3">Sélectionnez les cycles correspondant à votre souscription</p>
          <div className="flex gap-3 flex-wrap">
            {CYCLES.map((c) => (
              <button
                key={c} type="button"
                onClick={() => toggleCycle(c)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                  form.cycles.includes(c)
                    ? CYCLE_COLORS[c] + ' border-current'
                    : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* ── Address ── */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <MapPin size={15} className="text-blue-600" /> Localisation
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Pays</label>
              {countries.length > 0 ? (
                <select value={selCountry} onChange={(e) => { setSelCountry(e.target.value); setSelCity(''); setSelNeighborhood('') }} className="input text-sm w-full">
                  <option value="">{form.country || 'Sélectionner'}</option>
                  {countries.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              ) : (
                <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="input text-sm w-full" placeholder="Pays" />
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Ville</label>
              {cities.length > 0 ? (
                <select value={selCity} onChange={(e) => { setSelCity(e.target.value); setSelNeighborhood('') }} className="input text-sm w-full">
                  <option value="">{form.city || 'Sélectionner'}</option>
                  {cities.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              ) : (
                <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input text-sm w-full" placeholder="Ville" />
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Quartier</label>
              {neighborhoods.length > 0 ? (
                <select value={selNeighborhood} onChange={(e) => setSelNeighborhood(e.target.value)} className="input text-sm w-full">
                  <option value="">{form.neighborhood || 'Sélectionner'}</option>
                  {neighborhoods.map((n) => <option key={n._id} value={n._id}>{n.name}</option>)}
                </select>
              ) : (
                <input value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} className="input text-sm w-full" placeholder="Quartier" />
              )}
            </div>
          </div>
        </div>

        {/* ── Contact ── */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <Phone size={15} className="text-blue-600" /> Coordonnées
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block flex items-center gap-1"><Phone size={10} /> Téléphone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input text-sm w-full" placeholder="+237 6XX XXX XXX" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block flex items-center gap-1"><Mail size={10} /> Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input text-sm w-full" placeholder="contact@ecole.cm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block flex items-center gap-1"><Globe size={10} /> Site web</label>
              <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="input text-sm w-full" placeholder="https://..." />
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/dashboard/page-ecole')}
            className="btn-ghost text-sm border border-gray-200"
          >
            Gérer le contenu détaillé →
          </button>
          <button type="submit" disabled={saving} className="btn-primary text-sm px-6">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </form>
    </div>
  )
}
