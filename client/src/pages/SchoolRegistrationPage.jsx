import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { GraduationCap, ArrowLeft, CheckCircle2, Loader2, AlertCircle, Plus, Trash2, CreditCard } from 'lucide-react'
import PublicHeader from '../components/layout/PublicHeader'
import Footer from '../components/layout/Footer'
import { locationsApi, schoolRegistrationApi, platformApi } from '../lib/api'

export default function SchoolRegistrationPage() {
  const [params] = useSearchParams()
  const cycle = params.get('cycle') || 'Primaire'
  const plan = params.get('plan') || 'annual'
  const amount = Number(params.get('amount')) || 0
  const planLabel = plan === 'annual' ? 'Annuel' : 'Trimestriel'

  const [countries, setCountries] = useState([])
  const [cities, setCities] = useState([])
  const [neighborhoods, setNeighborhoods] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [paymentMethods, setPaymentMethods] = useState([])

  const [form, setForm] = useState({
    schoolName: '',
    directorName: '',
    country: '',
    city: '',
    neighborhood: '',
    whatsapp: '',
    email: '',
    paymentMethods: [{ accountName: '', accountNumber: '', provider: 'MTN Mobile Money' }],
  })

  useEffect(() => {
    locationsApi.countries().then((res) => setCountries(res.data || [])).catch(() => {})
    platformApi.getPaymentMethods().then((res) => setPaymentMethods(res.data || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (form.country) {
      locationsApi.cities(form.country).then((res) => setCities(res.data || [])).catch(() => {})
      setForm((f) => ({ ...f, city: '', neighborhood: '' }))
      setNeighborhoods([])
    }
  }, [form.country])

  useEffect(() => {
    if (form.city) {
      locationsApi.neighborhoods(form.city).then((res) => setNeighborhoods(res.data || [])).catch(() => {})
      setForm((f) => ({ ...f, neighborhood: '' }))
    }
  }, [form.city])

  const addPaymentMethod = () => {
    setForm({ ...form, paymentMethods: [...form.paymentMethods, { accountName: '', accountNumber: '', provider: '' }] })
  }

  const removePaymentMethod = (idx) => {
    setForm({ ...form, paymentMethods: form.paymentMethods.filter((_, i) => i !== idx) })
  }

  const updatePayment = (idx, field, value) => {
    const pm = [...form.paymentMethods]
    pm[idx] = { ...pm[idx], [field]: value }
    setForm({ ...form, paymentMethods: pm })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Validate gmail
    if (!form.email.includes('@')) {
      setError('Veuillez fournir une adresse email valide')
      return
    }
    if (form.paymentMethods.length === 0 || !form.paymentMethods[0].accountNumber) {
      setError('Veuillez ajouter au moins un moyen de paiement')
      return
    }

    setSubmitting(true)
    try {
      await schoolRegistrationApi.submit({
        cycle,
        plan: plan === 'trimestrial' ? 'trimestrial' : 'annual',
        amount,
        schoolName: form.schoolName,
        directorName: form.directorName,
        country: form.country,
        city: form.city,
        neighborhood: form.neighborhood || undefined,
        paymentMethods: form.paymentMethods.filter((p) => p.accountNumber),
        whatsapp: form.whatsapp,
        email: form.email,
      })
      setSubmitted(true)
    } catch (err) {
      setError(err.message)
    }
    setSubmitting(false)
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PublicHeader />
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-card-lg p-10">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 size={32} className="text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Demande envoyée avec succès !</h2>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              Votre demande de souscription pour le cycle <strong>{cycle}</strong> (plan <strong>{planLabel}</strong>) a été envoyée.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-left text-sm mb-6">
              <p className="text-blue-800 font-medium mb-1">📱 Vous serez contacté</p>
              <p className="text-blue-600 text-xs">Notre équipe vous contactera via <strong>WhatsApp</strong> et <strong>Gmail</strong> pour confirmer votre souscription.</p>
            </div>
            <Link to="/" className="btn-primary inline-flex items-center gap-2 text-sm">
              <ArrowLeft size={14} /> Retour à l'accueil
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader />
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link to="/tarifs" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6">
          <ArrowLeft size={14} /> Retour aux tarifs
        </Link>

        {/* Plan summary */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-xs uppercase font-medium">Plan sélectionné</p>
              <h2 className="text-lg font-bold mt-1">Cycle {cycle} — {planLabel}</h2>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{amount.toLocaleString()}</p>
              <p className="text-blue-200 text-xs">F CFA {plan === 'annual' ? '/ an' : '/ trimestre'}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-card-lg p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <GraduationCap size={20} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Formulaire de souscription</h1>
              <p className="text-xs text-gray-500">Remplissez les informations de votre établissement</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-5 flex items-center gap-2">
              <AlertCircle size={15} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* School info */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Nom de l'établissement *</label>
              <input required value={form.schoolName} onChange={(e) => setForm({ ...form, schoolName: e.target.value })} className="input text-sm" placeholder="Ex: Groupe Scolaire Les Champions" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Nom du directeur / responsable *</label>
              <input required value={form.directorName} onChange={(e) => setForm({ ...form, directorName: e.target.value })} className="input text-sm" placeholder="Ex: M. Jean Nkoulou" />
            </div>

            {/* Location cascading */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Pays *</label>
                <select required value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="input text-sm">
                  <option value="">Sélectionner...</option>
                  {countries.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Ville *</label>
                <select required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input text-sm" disabled={!form.country}>
                  <option value="">Sélectionner...</option>
                  {cities.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Quartier</label>
                <select value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} className="input text-sm" disabled={!form.city}>
                  <option value="">Sélectionner...</option>
                  {neighborhoods.map((n) => <option key={n._id} value={n._id}>{n.name}</option>)}
                </select>
              </div>
            </div>

            {/* Contact */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">WhatsApp du responsable * (avec indicatif)</label>
                <input required value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className="input text-sm" placeholder="+237 6XX XXX XXX" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Email du responsable *</label>
                <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input text-sm" placeholder="directeur@gmail.com" />
              </div>
            </div>

            {/* Payment methods */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-600">Moyens de paiement pour la souscription *</label>
                <button type="button" onClick={addPaymentMethod} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                  <Plus size={12} /> Ajouter
                </button>
              </div>
              <p className="text-xs text-gray-400 mb-3">Ajoutez vos numéros de compte Mobile Money pour recevoir les paiements</p>
              <div className="space-y-3">
                {form.paymentMethods.map((pm, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500">Compte #{idx + 1}</span>
                      {idx > 0 && (
                        <button type="button" onClick={() => removePaymentMethod(idx)} className="text-red-400 hover:text-red-600"><Trash2 size={13} /></button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input value={pm.provider} onChange={(e) => updatePayment(idx, 'provider', e.target.value)} className="input text-xs" placeholder="Ex: MTN Mobile Money" />
                      <input value={pm.accountName} onChange={(e) => updatePayment(idx, 'accountName', e.target.value)} className="input text-xs" placeholder="Nom du compte" />
                      <input value={pm.accountNumber} onChange={(e) => updatePayment(idx, 'accountNumber', e.target.value)} className="input text-xs" placeholder="Numéro du compte" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Platform payment methods info */}
            {paymentMethods.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard size={15} className="text-amber-600" />
                  <span className="text-sm font-bold text-amber-800">Comment effectuer votre paiement</span>
                </div>
                <p className="text-xs text-amber-700 mb-3">
                  Montant à régler : <strong>{amount.toLocaleString()} F CFA</strong> ({planLabel}).
                  Utilisez l'un des moyens ci-dessous et mentionnez le nom de votre école en référence.
                </p>
                <div className="space-y-2">
                  {paymentMethods.map((m) => (
                    <div key={m._id} className="bg-white border border-amber-100 rounded-lg p-3 flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        m.type === 'mobile_money' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        <CreditCard size={14} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-gray-900">{m.name}</div>
                        {m.accountNumber && (
                          <div className="text-xs text-gray-600 mt-0.5">
                            {m.accountName && <span className="font-medium">{m.accountName} · </span>}
                            <span className="font-mono">{m.accountNumber}</span>
                          </div>
                        )}
                        {m.instructions && <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{m.instructions}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={submitting} className="btn-primary w-full justify-center py-3 text-sm mt-4">
              {submitting ? (
                <><Loader2 size={16} className="animate-spin" /> Envoi en cours...</>
              ) : (
                <><GraduationCap size={16} /> Envoyer la demande de souscription</>
              )}
            </button>

            <p className="text-xs text-center text-gray-400">
              Votre demande sera examinée par l'administrateur. Vous serez contacté via WhatsApp et email.
            </p>
          </form>
        </div>
      </div>
      <Footer />
    </div>
  )
}
