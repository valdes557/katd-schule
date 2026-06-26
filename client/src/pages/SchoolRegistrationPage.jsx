import { useEffect, useState, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  GraduationCap, ArrowLeft, CheckCircle2, Loader2, AlertCircle,
  CreditCard, Upload, ImageIcon, Check, ChevronRight,
} from 'lucide-react'
import PublicHeader from '../components/layout/PublicHeader'
import Footer from '../components/layout/Footer'
import { locationsApi, schoolRegistrationApi, platformApi, plansApi, paymentsApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { dialCodeFor } from '../data/countryDialCodes'

const CYCLE_META = {
  Maternelle: { icon: '🌸', gradient: 'from-orange-500 to-amber-400', color: 'text-orange-600', ring: 'ring-orange-400', btn: 'bg-orange-500 hover:bg-orange-600' },
  Primaire:   { icon: '📚', gradient: 'from-blue-600 to-blue-400',    color: 'text-blue-600',   ring: 'ring-blue-500',   btn: 'bg-blue-600 hover:bg-blue-700' },
  Secondaire: { icon: '🎓', gradient: 'from-emerald-500 to-green-400', color: 'text-emerald-600', ring: 'ring-emerald-500', btn: 'bg-emerald-600 hover:bg-emerald-700' },
}

export default function SchoolRegistrationPage() {
  const [params] = useSearchParams()
  const fileRef = useRef()

  const [selected, setSelected] = useState(null) // { plan, billing: 'annual'|'trimestrial' }

  // Form state
  const [step, setStep] = useState(1) // 1 = plan choice, 2 = form
  const [cities, setCities] = useState([])
  const [neighborhoods, setNeighborhoods] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [proofFile, setProofFile] = useState(null)
  const [proofPreview, setProofPreview] = useState(null)
  const [statusMsg, setStatusMsg] = useState('')
  const [billingMap, setBillingMap] = useState({}) // planId -> 'annual'|'trimestrial'

  const [form, setForm] = useState({
    schoolName: '', directorName: '',
    country: '', city: '', neighborhood: '',
    whatsapp: '', email: '',
    phone: '', operator: 'mtn',
  })

  // Stable on-mount fetches
  const plansQ = useCachedFetch('/plans', async () => {
    const r = await plansApi.list()
    return (r.data || []).filter((p) => p.cycle !== 'Maternelle') // Maternelle fusionnée dans Primaire
  }, [])
  const paymentMethodsQ = useCachedFetch('/platform/payment-methods', async () => (await platformApi.getPaymentMethods()).data || [], [])
  const countriesQ = useCachedFetch('/locations/countries', async () => (await locationsApi.countries()).data || [], [])

  const plans = plansQ.data || []
  const paymentMethods = paymentMethodsQ.data || []
  const countries = countriesQ.data || []
  const plansLoading = plansQ.loading

  // Indicatif téléphonique du pays sélectionné (ex: +237). form.whatsapp ne contient
  // que la partie locale ; l'indicatif est ajouté automatiquement à l'envoi.
  const selectedCountry = countries.find((c) => c._id === form.country)
  const dialCode = dialCodeFor(selectedCountry)

  // Initialise billingMap once plans are loaded
  useEffect(() => {
    if (plans.length > 0 && Object.keys(billingMap).length === 0) {
      const initBilling = {}
      plans.forEach((p) => { initBilling[p._id] = 'annual' })
      setBillingMap(initBilling)
    }
  }, [plans, billingMap])

  // Pre-select from URL params if coming from landing page
  useEffect(() => {
    const cycleParam = params.get('cycle')
    const planParam = params.get('plan')
    const amountParam = params.get('amount')
    if (cycleParam && planParam && amountParam) {
      setSelected({ cycle: cycleParam, billing: planParam, amount: Number(amountParam) })
      setStep(2)
    }
  }, [])

  // Cascading location loads (depend on user selection — keep as local state)
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
    if (!form.phone.trim()) { setError('Veuillez saisir votre numéro Mobile Money'); return }
    if (!form.operator) { setError('Veuillez choisir votre opérateur Mobile Money'); return }

    setSubmitting(true)
    setStatusMsg('Initialisation du paiement...')
    try {
      const whatsappFull = dialCode && !form.whatsapp.trim().startsWith('+')
        ? `${dialCode} ${form.whatsapp.trim()}`
        : form.whatsapp.trim()
      const phoneFull = dialCode && !form.phone.trim().startsWith('+')
        ? `${dialCode} ${form.phone.trim()}`
        : form.phone.trim()

      const initRes = await paymentsApi.initiateSubscription({
        schoolName: form.schoolName,
        directorName: form.directorName,
        email: form.email,
        whatsapp: whatsappFull,
        cycle: selected.cycle,
        plan: selected.billing,
        countryName: form.country,
        cityName: form.city,
        neighborhoodName: form.neighborhood,
        phone: phoneFull,
        operator: form.operator,
      })
      const reference = initRes.reference
      setStatusMsg('Validez le paiement sur votre téléphone Mobile Money, puis patientez...')

      // Polling du statut (jusqu'à ~3 min)
      let done = false
      for (let i = 0; i < 45 && !done; i++) {
        await new Promise((r) => setTimeout(r, 4000))
        try {
          const st = await paymentsApi.status(reference)
          if (st.status === 'approved') {
            done = true
            setSubmitted(true)
          } else if (st.status === 'rejected') {
            done = true
            setError('Le paiement a été rejeté ou annulé. Veuillez réessayer.')
          }
        } catch (e) { /* continue polling */ }
      }
      if (!done) {
        setError("Le paiement n'a pas été confirmé à temps. Si vous avez payé, vos identifiants arriveront par email dès confirmation.")
      }
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
            <h2 className="text-xl font-bold text-gray-900 mb-3">Paiement réussi — Compte créé !</h2>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              Votre demande pour le cycle <strong>{selected?.cycle}</strong> ({selected?.billing === 'annual' ? 'Annuel' : 'Trimestriel'}) a été réglée avec succès. Votre compte directeur a été créé automatiquement.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-left text-sm mb-6">
              <p className="text-blue-800 font-medium mb-1">📧 Prochaines étapes</p>
              <p className="text-blue-600 text-xs">Vos identifiants de connexion (email + mot de passe) viennent d'être envoyés à votre adresse email. Pensez à vérifier vos spams, puis connectez-vous et changez votre mot de passe.</p>
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
                      <h3 className="text-lg font-bold mt-1">{plan.cycle === 'Primaire' ? 'Primaire/Maternelle' : plan.cycle}</h3>
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
                <label className="text-xs font-medium text-gray-600 mb-1 block">WhatsApp *</label>
                {dialCode ? (
                  <div className="flex items-stretch">
                    <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-200 bg-gray-50 text-sm font-semibold text-gray-700 select-none">
                      {dialCode}
                    </span>
                    <input
                      required
                      value={form.whatsapp}
                      onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                      className="input text-sm rounded-l-none"
                      placeholder="6XX XXX XXX"
                      inputMode="tel"
                    />
                  </div>
                ) : (
                  <input
                    required
                    value={form.whatsapp}
                    onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                    className="input text-sm"
                    placeholder={form.country ? 'Numéro avec indicatif (ex: +237 6XX XXX XXX)' : 'Choisissez d’abord votre pays'}
                    inputMode="tel"
                  />
                )}
                {dialCode && <p className="text-[11px] text-gray-400 mt-1">Indicatif {dialCode} ajouté automatiquement</p>}
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

            {/* Paiement Mobile Money (SEBPay) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Opérateur Mobile Money *</label>
                <select
                  value={form.operator}
                  onChange={(e) => setForm({ ...form, operator: e.target.value })}
                  className="input w-full"
                >
                  <option value="mtn">MTN Mobile Money</option>
                  <option value="moov">Moov Money</option>
                  <option value="celtiis">Celtiis Cash</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Numéro Mobile Money *</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Ex: 01 97 00 00 00"
                  className="input w-full"
                />
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2">
              <CreditCard size={16} className="text-blue-600 mt-0.5" />
              <p className="text-xs text-blue-800 leading-relaxed">
                Vous serez débité de <b>{selected?.amount?.toLocaleString('fr-FR')} FCFA</b> via Mobile Money.
                Validez la demande de paiement sur votre téléphone. Dès confirmation, votre compte directeur
                est créé automatiquement et vos identifiants vous sont envoyés par email.
              </p>
            </div>
            {statusMsg && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> {statusMsg}
              </div>
            )}

            <button type="submit" disabled={submitting} className="btn-primary w-full justify-center py-3.5 text-sm">
              {submitting ? (
                <><Loader2 size={16} className="animate-spin" /> Envoi en cours...</>
              ) : (
                <><Upload size={16} /> Envoyer ma demande de souscription</>
              )}
            </button>

            <p className="text-xs text-center text-gray-400">
              Le paiement est traité automatiquement. Dès confirmation, votre compte directeur est créé et vos identifiants envoyés par email.
            </p>
          </form>
        </div>
      </div>
      <Footer />
    </div>
  )
}