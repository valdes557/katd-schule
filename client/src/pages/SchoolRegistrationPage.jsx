import { useEffect, useState, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  GraduationCap, ArrowLeft, CheckCircle2, Loader2, AlertCircle,
  CreditCard, Upload, ImageIcon, Check, ChevronRight,
} from 'lucide-react'
import PublicHeader from '../components/layout/PublicHeader'
import Footer from '../components/layout/Footer'
import { locationsApi, schoolRegistrationApi, platformApi, plansApi } from '../lib/api'

const CYCLE_META = {
  Maternelle: { icon: '🌸', gradient: 'from-orange-500 to-amber-400', color: 'text-orange-600', ring: 'ring-orange-400', btn: 'bg-orange-500 hover:bg-orange-600' },
  Primaire:   { icon: '📚', gradient: 'from-blue-600 to-blue-400',    color: 'text-blue-600',   ring: 'ring-blue-500',   btn: 'bg-blue-600 hover:bg-blue-700' },
  Secondaire: { icon: '🎓', gradient: 'from-emerald-500 to-green-400', color: 'text-emerald-600', ring: 'ring-emerald-500', btn: 'bg-emerald-600 hover:bg-emerald-700' },
}

export default function SchoolRegistrationPage() {
  const [params] = useSearchParams()
  const fileRef = useRef()

  // Plans state
  const [plans, setPlans] = useState([])
  const [plansLoading, setPlansLoading] = useState(true)
  const [selected, setSelected] = useState(null) // { plan, billing: 'annual'|'trimestrial' }

  // Payment methods
  const [paymentMethods, setPaymentMethods] = useState([])

  // Form state
  const [step, setStep] = useState(1) // 1 = plan choice, 2 = form
  const [countries, setCountries] = useState([])
  const [cities, setCities] = useState([])
  const [neighborhoods, setNeighborhoods] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [proofFile, setProofFile] = useState(null)
  const [proofPreview, setProofPreview] = useState(null)
  const [billingMap, setBillingMap] = useState({}) // planId -> 'annual'|'trimestrial'

  const [form, setForm] = useState({
    schoolName: '', directorName: '',
    country: '', city: '', neighborhood: '',
    whatsapp: '', email: '',
  })

  useEffect(() => {
    plansApi.list()
      .then((r) => {
        const data = r.data || []
        setPlans(data)
        const initBilling = {}
        data.forEach((p) => { initBilling[p._id] = 'annual' })
        setBillingMap(initBilling)
      })
      .catch(() => {})
      .finally(() => setPlansLoading(false))

    platformApi.getPaymentMethods().then((r) => setPaymentMethods(r.data || [])).catch(() => {})
    locationsApi.countries().then((r) => setCountries(r.data || [])).catch(() => {})

    // Pre-select from URL params if coming from landing page
    const cycleParam = params.get('cycle')
    const planParam = params.get('plan')
    const amountParam = params.get('amount')
    if (cycleParam && planParam && amountParam) {
      setSelected({ cycle: cycleParam, billing: planParam, amount: Number(amountParam) })
      setStep(2)
    }
  }, [])

  useEffect(() => {
    if (form.country) {
      locationsApi.cities(form.country).then((r) => setCities(r.data || [])).catch(() => {})
      setForm((f) => ({ ...f, city: '', neighborhood: '' }))
      setNeighborhoods([])
    }
  }, [form.country])

  useEffect(() => {
    if (form.city) {
      locationsApi.neighborhoods(form.city).then((r) => setNeighborhoods(r.data || [])).catch(() => {})
      setForm((f) => ({ ...f, neighborhood: '' }))
    }
  }, [form.city])

  const handleProof = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setProofFile(file)
    setProofPreview(URL.createObjectURL(file))
  }

  const selectPlan = (plan, billing) => {
    const price = billing === 'annual' ? plan.annualPrice : plan.quarterlyPrice
    setSelected({ cycle: plan.cycle, billing, amount: price, planName: plan.name })
    setStep(2)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!proofFile) { setError('Veuillez joindre la preuve de paiement (image)'); return }

    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('cycle', selected.cycle)
      fd.append('plan', selected.billing)
      fd.append('amount', selected.amount)
      fd.append('schoolName', form.schoolName)
      fd.append('directorName', form.directorName)
      fd.append('country', form.country)
      fd.append('city', form.city)
      if (form.neighborhood) fd.append('neighborhood', form.neighborhood)
      fd.append('whatsapp', form.whatsapp)
      fd.append('email', form.email)
      fd.append('paymentProof', proofFile)

      await schoolRegistrationApi.submit(fd)
      setSubmitted(true)
    } catch (err) {
      setError(err.message)
    }
    setSubmitting(false)
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PublicHeader />
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xl p-10">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 size={32} className="text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Demande envoyée avec succès !</h2>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              Votre demande pour le cycle <strong>{selected?.cycle}</strong> ({selected?.billing === 'annual' ? 'Annuel' : 'Trimestriel'}) a bien été transmise à l'administrateur.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-left text-sm mb-6">
              <p className="text-blue-800 font-medium mb-1">📧 Prochaines étapes</p>
              <p className="text-blue-600 text-xs">L'administrateur examinera votre dossier et vous enverra vos identifiants de connexion par email une fois la demande approuvée.</p>
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

  // ── Step 1: Plan selection ─────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PublicHeader />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6">
            <ArrowLeft size={14} /> Retour
          </Link>
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Choisissez votre plan</h1>
            <p className="text-gray-500">Sélectionnez le cycle et la période de facturation adaptés à votre école</p>
          </div>

          {plansLoading ? (
            <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-blue-600" /></div>
          ) : plans.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-400 mb-4">Aucun plan disponible pour le moment.</p>
              <p className="text-sm text-gray-400">Contactez l'administrateur pour plus d'informations.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan) => {
                const meta = CYCLE_META[plan.cycle] || CYCLE_META.Primaire
                const billing = billingMap[plan._id] || 'annual'
                const price = billing === 'annual' ? plan.annualPrice : plan.quarterlyPrice
                return (
                  <div key={plan._id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl transition-all">
                    <div className={`bg-gradient-to-br ${meta.gradient} p-5 text-white`}>
                      <span className="text-3xl">{meta.icon}</span>
                      <h3 className="text-lg font-bold mt-1">{plan.cycle}</h3>
                      <p className="text-white/80 text-sm">{plan.name}</p>
                    </div>
                    <div className="p-5">
                      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-4">
                        <button
                          onClick={() => setBillingMap((m) => ({ ...m, [plan._id]: 'trimestrial' }))}
                          className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all ${billing === 'trimestrial' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
                        >Trimestriel</button>
                        <button
                          onClick={() => setBillingMap((m) => ({ ...m, [plan._id]: 'annual' }))}
                          className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all ${billing === 'annual' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
                        >Annuel <span className="text-green-500 font-bold ml-0.5">-17%</span></button>
                      </div>

                      <div className="mb-4">
                        <span className="text-3xl font-extrabold text-gray-900">{price?.toLocaleString()}</span>
                        <span className="text-sm text-gray-400 ml-1.5">F CFA {billing === 'annual' ? '/an' : '/trimestre'}</span>
                      </div>

                      {plan.features?.length > 0 && (
                        <div className="space-y-1.5 mb-5">
                          {plan.features.map((f) => (
                            <div key={f} className="flex items-center gap-2 text-sm text-gray-600">
                              <Check size={12} className="text-green-500 flex-shrink-0" /> {f}
                            </div>
                          ))}
                        </div>
                      )}

                      <button
                        onClick={() => selectPlan(plan, billing)}
                        className={`w-full flex items-center justify-center gap-2 font-semibold py-3 rounded-xl text-sm text-white transition-colors ${meta.btn}`}
                      >
                        Souscrire <ChevronRight size={15} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <Footer />
      </div>
    )
  }

  // ── Step 2: Registration form ──────────────────────────────────────────────
  const planLabel = selected?.billing === 'annual' ? 'Annuel' : 'Trimestriel'

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader />
      <div className="max-w-2xl mx-auto px-4 py-10">
        <button onClick={() => setStep(1)} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6">
          <ArrowLeft size={14} /> Changer de plan
        </button>

        {/* Plan summary banner */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 text-white mb-6 flex items-center justify-between">
          <div>
            <p className="text-blue-200 text-xs uppercase font-medium">Plan sélectionné</p>
            <h2 className="text-lg font-bold mt-0.5">Cycle {selected?.cycle} — {planLabel}</h2>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{selected?.amount?.toLocaleString()}</p>
            <p className="text-blue-200 text-xs">F CFA {selected?.billing === 'annual' ? '/ an' : '/ trimestre'}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-xl p-6 sm:p-8">
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
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Nom de l'établissement *</label>
              <input required value={form.schoolName} onChange={(e) => setForm({ ...form, schoolName: e.target.value })} className="input text-sm" placeholder="Ex: Groupe Scolaire Les Champions" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Nom du directeur / responsable *</label>
              <input required value={form.directorName} onChange={(e) => setForm({ ...form, directorName: e.target.value })} className="input text-sm" placeholder="Ex: M. Jean Nkoulou" />
            </div>

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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">WhatsApp (avec indicatif) *</label>
                <input required value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className="input text-sm" placeholder="+237 6XX XXX XXX" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Email du responsable *</label>
                <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input text-sm" placeholder="directeur@gmail.com" />
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
                  Montant à régler : <strong>{selected?.amount?.toLocaleString()} F CFA</strong> ({planLabel}).
                  Envoyez le paiement via l'un des moyens ci-dessous, puis joignez la preuve.
                </p>
                <div className="space-y-2">
                  {paymentMethods.map((m) => (
                    <div key={m._id} className="bg-white border border-amber-100 rounded-lg p-3 flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${m.type === 'mobile_money' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
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
                        {m.instructions && <p className="text-[11px] text-gray-400 mt-0.5">{m.instructions}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Payment proof upload */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                Preuve de paiement * <span className="text-gray-400 font-normal">(capture d'écran ou photo du reçu)</span>
              </label>
              <div
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${proofFile ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/30'}`}
              >
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleProof} />
                {proofPreview ? (
                  <div className="space-y-2">
                    <img src={proofPreview} alt="Preuve" className="max-h-40 mx-auto rounded-lg object-contain" />
                    <p className="text-xs text-green-600 font-medium">✅ {proofFile?.name}</p>
                    <p className="text-xs text-gray-400">Cliquez pour changer</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto">
                      <ImageIcon size={22} className="text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-600 font-medium">Cliquez pour uploader</p>
                    <p className="text-xs text-gray-400">JPG, PNG, WEBP — max 5 MB</p>
                  </div>
                )}
              </div>
            </div>

            <button type="submit" disabled={submitting} className="btn-primary w-full justify-center py-3.5 text-sm">
              {submitting ? (
                <><Loader2 size={16} className="animate-spin" /> Envoi en cours...</>
              ) : (
                <><Upload size={16} /> Envoyer ma demande de souscription</>
              )}
            </button>

            <p className="text-xs text-center text-gray-400">
              Votre demande sera examinée par l'administrateur sous 24h. Vos identifiants vous seront envoyés par email.
            </p>
          </form>
        </div>
      </div>
      <Footer />
    </div>
  )
}
