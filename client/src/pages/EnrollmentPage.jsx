import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { GraduationCap, Upload, CheckCircle2, Loader2, ArrowLeft, AlertCircle, MapPin } from 'lucide-react'
import PublicHeader from '../components/layout/PublicHeader'
import Footer from '../components/layout/Footer'
import { enrollmentApi, schoolsApi } from '../lib/api'

export default function EnrollmentPage() {
  const { schoolId } = useParams()
  const [school, setSchool] = useState(null)
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
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
    classId: '',
  })
  const [paymentFile, setPaymentFile] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [schoolRes, classesRes] = await Promise.all([
          schoolsApi.get(schoolId),
          enrollmentApi.getClasses(schoolId),
        ])
        setSchool(schoolRes.data)
        setClasses(classesRes.data || [])
      } catch (e) { setError('École non trouvée') }
      setLoading(false)
    }
    load()
  }, [schoolId])

  const selectedClass = classes.find((c) => c._id === form.classId)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!paymentFile) {
      setError('Veuillez uploader la preuve de paiement')
      return
    }

    setSubmitting(true)
    try {
      const formData = new FormData()
      Object.entries(form).forEach(([key, val]) => {
        if (key === 'classId') formData.append('classId', val)
        else formData.append(key, val)
      })
      formData.append('schoolId', schoolId)
      formData.append('paymentProof', paymentFile)

      await enrollmentApi.submit(formData)
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
            <h2 className="text-xl font-bold text-gray-900 mb-3">Demande envoyée avec succès !</h2>
            <p className="text-sm text-gray-600 leading-relaxed mb-6">
              Votre demande d'inscription est <strong className="text-orange-600">en attente d'approbation</strong> par le directeur de l'établissement. 
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

            {/* Price display */}
            {selectedClass && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-700 font-medium">Frais d'inscription pour {selectedClass.name}</p>
                  <p className="text-xs text-green-600 mt-0.5">Cycle {selectedClass.cycle} — Niveau {selectedClass.level}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-green-700">{selectedClass.enrollmentFee?.toLocaleString() || 0}</p>
                  <p className="text-xs text-green-600">F CFA</p>
                </div>
              </div>
            )}

            {/* Payment proof */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Preuve de paiement *</label>
              <p className="text-xs text-gray-400 mb-2">Uploadez une capture d'écran ou photo du reçu de paiement (PDF, JPG, PNG)</p>
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-5 text-center hover:border-blue-300 transition-colors cursor-pointer relative">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setPaymentFile(e.target.files[0])}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                {paymentFile ? (
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <CheckCircle2 size={16} />
                    <span className="text-sm font-medium">{paymentFile.name}</span>
                  </div>
                ) : (
                  <div className="text-gray-400">
                    <Upload size={24} className="mx-auto mb-2" />
                    <p className="text-sm">Cliquez pour sélectionner un fichier</p>
                    <p className="text-xs mt-1">Max 5 Mo</p>
                  </div>
                )}
              </div>
            </div>

            {/* Submit */}
            <button type="submit" disabled={submitting} className="btn-primary w-full justify-center py-3 text-sm mt-4">
              {submitting ? (
                <><Loader2 size={16} className="animate-spin" /> Envoi en cours...</>
              ) : (
                <><GraduationCap size={16} /> Confirmer l'inscription</>
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
