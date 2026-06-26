import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { GraduationCap, Upload, CheckCircle2, Loader2, ArrowLeft, AlertCircle, MapPin, Banknote, Copy, Phone } from 'lucide-react'
import PublicHeader from '../components/layout/PublicHeader'
import Footer from '../components/layout/Footer'
import { enrollmentApi, schoolsApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'

export default function EnrollmentPage() {
  const { schoolId } = useParams()
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    placeOfBirth: '',
    gender: '',
    email: '',
    phone: '',
    fatherName: '',
    motherName: '',
    fatherPhone: '',
    classId: '',
    momoPhone: '',
    momoOperator: 'mtn',
  })
  const [paymentFile, setPaymentFile] = useState(null)
  const [statusMsg, setStatusMsg] = useState('')
  const [photoFile, setPhotoFile] = useState(null)

  // Bundle school + classes into one cache entry (single spinner, same schoolId key)
  const dataQ = useCachedFetch(`/enrollment/${schoolId}/init`, async () => {
    const [schoolRes, classesRes] = await Promise.all([
      schoolsApi.get(schoolId),
      enrollmentApi.getClasses(schoolId),
    ])
    return { school: schoolRes.data, classes: classesRes.data || [] }
  }, [schoolId])

  const school = dataQ.data?.school || null
  const classes = dataQ.data?.classes || []
  const loading = dataQ.loading

  const selectedClass = classes.find((c) => c._id === form.classId)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const fee = selectedClass?.enrollmentFee || school?.enrollmentFee || 0
    if (fee <= 0) { setError("Le montant des frais d'inscription n'est pas défini pour cette classe"); return }
    if (!form.classId) { setError('Veuillez choisir une classe'); return }
    if (!form.momoPhone.trim()) { setError('Veuillez saisir votre numéro Mobile Money'); return }
    if (!form.momoOperator) { setError('Veuillez choisir votre opérateur Mobile Money'); return }

    setSubmitting(true)
    setStatusMsg('Initialisation du paiement...')
    try {
      // 1) Paiement SEBPay (crédite le portefeuille du directeur)
      const initRes = await paymentsApi.initiateEnrollment({
        schoolId: school?._id,
        classId: form.classId,
        amount: fee,
        studentName: (form.firstName + ' ' + form.lastName).trim(),
        payerName: form.fatherName || form.motherName || '',
        payerEmail: form.email,
        phone: form.momoPhone.trim(),
        operator: form.momoOperator,
      })
      const reference = initRes.reference
      setStatusMsg('Validez le paiement sur votre téléphone Mobile Money, puis patientez...')

      let approved = false
      for (let i = 0; i < 45 && !approved; i++) {
        await new Promise((r) => setTimeout(r, 4000))
        try {
          const st = await paymentsApi.status(reference)
          if (st.status === 'approved') approved = true
          else if (st.status === 'rejected') { setError('Paiement rejeté ou annulé. Réessayez.'); setSubmitting(false); setStatusMsg(''); return }
        } catch (e2) { /* continue */ }
      }
      if (!approved) { setError("Paiement non confirmé à temps. Si vous avez payé, contactez l'école."); setSubmitting(false); setStatusMsg(''); return }

      // 2) Création de la demande d'inscription avec la référence de paiement
      setStatusMsg("Enregistrement de l'inscription...")
      const formData = new FormData()
      formData.append('firstName', form.firstName)
      formData.append('lastName', form.lastName)
      formData.append('dateOfBirth', form.dateOfBirth)
      formData.append('placeOfBirth', form.placeOfBirth)
      formData.append('gender', form.gender)
      formData.append('email', form.email)
      formData.append('phone', form.phone)
      formData.append('fatherName', form.fatherName)
      formData.append('motherName', form.motherName)
      formData.append('fatherPhone', form.fatherPhone)
      formData.append('schoolId', school?._id)
      formData.append('classId', form.classId)
      formData.append('paymentReference', reference)
      if (photoFile) formData.append('photo', photoFile)
      await enrollmentApi.submit(formData)
      setStatusMsg('')
      setSubmitted(true)
    } catch (err) {
      setError(err.message)
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PublicHeader />
        <div className="flex items-center justify-center py-32">
          <Loader2 size={28} className="animate-spin text-blue-600" />
        </div>
      </div>
    )
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
            <h2 className="text-xl font-bold text-gray-900 mb-3">Paiement réussi — Inscription enregistrée !</h2>
            <p className="text-sm text-gray-600 leading-relaxed mb-6">
              Votre paiement a été confirmé et votre demande d'inscription est <strong className="text-orange-600">en attente d'approbation</strong> par le directeur.
              Vous recevrez un email de confirmation avec vos identifiants de connexion dès que votre inscription sera approuvée.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-left text-sm">
              <p className="text-blue-800 font-medium mb-1">📧 Vérifiez votre boîte email</p>
              <p className="text-blue-600 text-xs">Un email vous sera envoyé à <strong>{form.email}</strong> après approbation.</p>
            </div>
            <Link to="/" className="btn-primary mt-6 inline-flex items-center gap-2 text-sm">
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
        <Link to="/ecoles" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6">
          <ArrowLeft size={14} /> Retour aux écoles
        </Link>

        {/* School header */}
        {school && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
              {(school.name || '').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{school.name}</h2>
              <p className="text-sm text-gray-500 flex items-center gap-1"><MapPin size={12} /> {school.address?.city || 'Cameroun'}</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-card-lg p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <GraduationCap size={20} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Inscription en ligne</h1>
              <p className="text-xs text-gray-500">Remplissez le formulaire ci-dessous pour vous inscrire</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-5 flex items-center gap-2">
              <AlertCircle size={15} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Personal info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Nom *</label>
                <input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="input text-sm" placeholder="Ex: MBARGA" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Prénom *</label>
                <input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="input text-sm" placeholder="Ex: Amara" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Date de naissance *</label>
                <input required type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} className="input text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Lieu de naissance *</label>
                <input required value={form.placeOfBirth} onChange={(e) => setForm({ ...form, placeOfBirth: e.target.value })} className="input text-sm" placeholder="Ex: Yaoundé" />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Sexe *</label>
              <div className="flex gap-4">
                {[{ key: 'M', label: 'Masculin' }, { key: 'F', label: 'Féminin' }].map((g) => (
                  <label key={g.key} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="gender" value={g.key} checked={form.gender === g.key} onChange={(e) => setForm({ ...form, gender: e.target.value })} required className="accent-blue-600" />
                    <span className="text-sm text-gray-700">{g.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Photo de l'élève</label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center flex-shrink-0 border border-gray-200">
                  {photoFile ? (
                    <img src={URL.createObjectURL(photoFile)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <GraduationCap size={28} className="text-gray-300" />
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                    className="text-xs text-gray-500 file:mr-2 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-600 file:text-xs file:font-medium hover:file:bg-blue-100 file:cursor-pointer"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Photo d'identité de l'élève (JPG, PNG). Facultatif.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Email *</label>
                <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input text-sm" placeholder="votre@email.com" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Téléphone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input text-sm" placeholder="+237 6XX XXX XXX" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Nom du père</label>
                <input value={form.fatherName} onChange={(e) => setForm({ ...form, fatherName: e.target.value })} className="input text-sm" placeholder="Ex: MBARGA Paul" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Nom de la mère</label>
                <input value={form.motherName} onChange={(e) => setForm({ ...form, motherName: e.target.value })} className="input text-sm" placeholder="Ex: NGO MIMI" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Numéro du père (WhatsApp de préférence)</label>
              <input value={form.fatherPhone} onChange={(e) => setForm({ ...form, fatherPhone: e.target.value })} className="input text-sm" placeholder="Ex: +237 6XX XXX XXX" />
            </div>

            {/* Class selection */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Classe souhaitée *</label>
              <select required value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })} className="input text-sm">
                <option value="">Sélectionner une classe...</option>
                {classes.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} ({c.level}) — {c.enrollmentFee?.toLocaleString() || 0} F CFA
                  </option>
                ))}
              </select>
            </div>

            {/* Price display — use class fee, fallback to school-level fee */}
            {(selectedClass || school?.enrollmentFee > 0) && (() => {
              const fee = selectedClass?.enrollmentFee || school?.enrollmentFee || 0
              return (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-green-700 font-medium">Frais d'inscription{selectedClass ? ` pour ${selectedClass.name}` : ''}</p>
                    {selectedClass && <p className="text-xs text-green-600 mt-0.5">Cycle {selectedClass.cycle} — Niveau {selectedClass.level}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-green-700">{fee.toLocaleString()}</p>
                    <p className="text-xs text-green-600">F CFA</p>
                  </div>
                </div>
              )
            })()}

            {/* Mobile Money accounts — where to send the payment */}
            {school?.mobileMoneyAccounts?.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Banknote size={16} className="text-blue-600" />
                  <h3 className="text-sm font-bold text-blue-900">Où envoyer le paiement</h3>
                </div>
                <p className="text-xs text-blue-700">Effectuez le paiement sur l'un des comptes ci-dessous, puis uploadez la capture du reçu.</p>
                <div className="space-y-2">
                  {school.mobileMoneyAccounts.map((acc, i) => (
                    <div key={i} className="bg-white rounded-lg border border-blue-100 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-gray-900 truncate">{acc.operator}</p>
                          {acc.accountName && <p className="text-xs text-gray-500 truncate">{acc.accountName}</p>}
                          <p className="text-sm font-mono font-semibold text-blue-700 mt-1 select-all">{acc.accountNumber}</p>
                          {acc.instructions && <p className="text-[11px] text-gray-500 italic mt-1">{acc.instructions}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => { navigator.clipboard?.writeText(acc.accountNumber); }}
                          className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1"
                          title="Copier le numéro"
                        >
                          <Copy size={11} /> Copier
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Paiement Mobile Money (SEBPay) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Opérateur Mobile Money *</label>
                <select value={form.momoOperator} onChange={(e) => setForm({ ...form, momoOperator: e.target.value })} className="input text-sm">
                  <option value="mtn">MTN Mobile Money</option>
                  <option value="moov">Moov Money</option>
                  <option value="celtiis">Celtiis Cash</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Numéro Mobile Money *</label>
                <input type="tel" value={form.momoPhone} onChange={(e) => setForm({ ...form, momoPhone: e.target.value })} className="input text-sm" placeholder="Ex: 01 97 00 00 00" />
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
              <Banknote size={16} className="text-blue-600 mt-0.5" />
              <p className="text-xs text-blue-800 leading-relaxed">
                Le paiement est automatique : validez la demande sur votre téléphone. Dès confirmation,
                votre inscription est enregistrée et les frais sont versés au directeur de l'école.
              </p>
            </div>
            {statusMsg && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> {statusMsg}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={submitting} className="btn-primary w-full justify-center py-3 text-sm mt-4">
              {submitting ? (
                <><Loader2 size={16} className="animate-spin" /> Envoi en cours...</>
              ) : (
                <><GraduationCap size={16} /> Payer et confirmer l'inscription</>
              )}
            </button>

            <p className="text-xs text-center text-gray-400">
              En soumettant ce formulaire, votre demande sera en attente d'approbation par le directeur de l'école.
            </p>
          </form>
        </div>
      </div>
      <Footer />
    </div>
  )
}