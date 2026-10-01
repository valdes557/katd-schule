import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bot, Plus, Loader2, AlertCircle, X, Clock, CalendarCheck, FileText,
  Play, CheckCircle2, Trash2, Ban, Radio, Sparkles, Volume2, VolumeX, Mic, HelpCircle, BookOpen,
  Edit3, Calendar, ChevronLeft, ChevronRight, Search, Image as ImageIcon, Zap, Trash,
} from 'lucide-react'
import { aiCoursesApi, classesApi } from '../../lib/api'
import { useCachedFetch } from '../../hooks/useCachedFetch'
import { cache } from '../../lib/cache'
import { useAuth } from '../../context/AuthContext'
import { speakText, stopSpeaking, isSpeechSynthesisSupported } from '../../lib/speechService'

// Cours de l'IA enseignante autonome (F2 Secondaire).
// - Professeur : programme un cours (texte ou PDF, heure + durée) pour SES classes,
//   modifie/annule tant qu'il est planifié ou en décompte.
// - Élève / Parent : voient les cours de la classe (à venir, en direct, terminés).
// - VP / Directeur : supervision de tous les cours de l'école.
const STATUS_META = {
  planifie: { label: 'Planifié', cls: 'bg-blue-50 text-blue-700 border-blue-200', icon: CalendarCheck },
  generation: { label: 'Préparation IA...', cls: 'bg-purple-50 text-purple-700 border-purple-200', icon: Sparkles },
  pret: { label: 'Prêt', cls: 'bg-teal-50 text-teal-700 border-teal-200', icon: CheckCircle2 },
  en_cours: { label: 'EN DIRECT', cls: 'bg-red-50 text-red-600 border-red-200 animate-pulse', icon: Radio },
  termine: { label: 'Terminé', cls: 'bg-gray-100 text-gray-600 border-gray-200', icon: CheckCircle2 },
  annule: { label: 'Annulé', cls: 'bg-gray-50 text-gray-400 border-gray-200', icon: Ban },
  erreur: { label: 'Erreur', cls: 'bg-red-50 text-red-700 border-red-200', icon: AlertCircle },
}

// Valeur par défaut du champ datetime-local : dans 30 min, arrondi au quart d'heure
function defaultScheduledAt() {
  const d = new Date(Date.now() + 30 * 60 * 1000)
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function defaultTodayDate() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function createInitialBatchSlots(dateStr, count, classesList) {
  const defaultTimes = ['08:00', '10:00', '13:30', '15:30', '17:00', '18:30']
  const slots = []
  for (let i = 0; i < count; i++) {
    const time = defaultTimes[i % defaultTimes.length] || '08:00'
    slots.push({
      time,
      classId: classesList[0]?._id || '',
      subject: '',
      title: '',
      sourceType: 'ai_generate',
      durationMinutes: 50,
      qaDurationMinutes: 10,
      language: 'fr-FR',
      voice: i % 2 === 0 ? 'female' : 'male',
      sourceText: '',
      nextCourseTitle: '',
      nextCourseInstructions: '',
    })
  }
  return slots
}

export default function AiCoursesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const role = user?.role
  const canCreate = ['enseignant', 'directeur', 'super_admin', 'vice_principal'].includes(role)

  const [showModal, setShowModal] = useState(false)
  const [editingCourseId, setEditingCourseId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [generatingDraft, setGeneratingDraft] = useState(false)

  const emptyForm = {
    classId: '', subject: '', title: '', sourceType: 'ai_generate', sourceText: '',
    pdf: null, images: [], existingImages: [], scheduledAt: defaultScheduledAt(), durationMinutes: 45,
    language: 'fr-FR', voice: 'female', qaDurationMinutes: 10,
    nextCourseTitle: '', nextCourseDate: '', nextCourseInstructions: '',
    nextCourseSourceType: 'none', nextCourseSourceText: '', nextPdf: null,
  }
  const [form, setForm] = useState(emptyForm)
  const [testingVoice, setTestingVoice] = useState(false)

  // Mode Programmation de la Journée (Multi-cours par jour sans restriction)
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [batchDate, setBatchDate] = useState(defaultTodayDate())
  const [batchCourses, setBatchCourses] = useState([])
  const [activeBatchIndex, setActiveBatchIndex] = useState(0)
  const [batchSaving, setBatchSaving] = useState(false)
  const [batchError, setBatchError] = useState('')

  const classesQ = useCachedFetch(canCreate ? '/classes?' : null, async () => (await classesApi.list()).data || [], [])
  const classes = classesQ.data || []

  const coursesQ = useCachedFetch('/ai-courses?', async () => (await aiCoursesApi.list()).data || [], [])
  const courses = coursesQ.data || []

  // Filtres & Pagination
  const [statusFilter, setStatusFilter] = useState('all') // 'all', 'en_cours', 'planifie', 'termine'
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const refresh = () => { cache.invalidate('/ai-courses'); coursesQ.refetch() }

  const filteredCourses = courses.filter((c) => {
    if (statusFilter === 'en_cours' && c.status !== 'en_cours') return false
    if (statusFilter === 'planifie' && !['planifie', 'generation', 'pret'].includes(c.status)) return false
    if (statusFilter === 'termine' && c.status !== 'termine') return false

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const titleMatch = (c.title || '').toLowerCase().includes(q)
      const subjectMatch = (c.subject || '').toLowerCase().includes(q)
      const classMatch = (c.class?.name || '').toLowerCase().includes(q)
      const teacherMatch = (c.teacherName || '').toLowerCase().includes(q)
      if (!titleMatch && !subjectMatch && !classMatch && !teacherMatch) return false
    }
    return true
  })

  const countAll = courses.length
  const countLive = courses.filter((c) => c.status === 'en_cours').length
  const countUpcoming = courses.filter((c) => ['planifie', 'generation', 'pret'].includes(c.status)).length
  const countFinished = courses.filter((c) => c.status === 'termine').length

  const totalPages = Math.max(1, Math.ceil(filteredCourses.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * pageSize
  const paginatedCourses = filteredCourses.slice(startIndex, startIndex + pageSize)

  const handleStatusFilterChange = (filter) => {
    setStatusFilter(filter)
    setCurrentPage(1)
  }

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value)
    setCurrentPage(1)
  }

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return
    setCurrentPage(newPage)
  }

  const openCreate = () => {
    stopSpeaking()
    setTestingVoice(false)
    setEditingCourseId(null)
    setForm({ ...emptyForm, scheduledAt: defaultScheduledAt() })
    setError('')
    setShowModal(true)
  }

  const openEdit = async (course) => {
    stopSpeaking()
    setTestingVoice(false)
    setError('')
    setEditingCourseId(course._id)
    try {
      const res = await aiCoursesApi.get(course._id)
      const c = res.data
      const pad = (n) => String(n).padStart(2, '0')
      const formatDt = (dt) => {
        if (!dt) return ''
        const d = new Date(dt)
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
      }
      setForm({
        classId: c.class?._id || c.class || '',
        subject: c.subject || '',
        title: c.title || '',
        sourceType: c.sourceType || 'ai_generate',
        sourceText: c.sourceText || '',
        pdf: null,
        images: [],
        existingImages: c.images || [],
        scheduledAt: formatDt(c.scheduledAt),
        durationMinutes: c.durationMinutes || 45,
        qaDurationMinutes: c.qaDurationMinutes ?? 10,
        language: c.language || 'fr-FR',
        voice: c.voice || 'female',
        nextCourseTitle: c.nextCourseTitle || '',
        nextCourseDate: formatDt(c.nextCourseDate),
        nextCourseInstructions: c.nextCourseInstructions || '',
        nextCourseSourceType: c.nextCourseSourceType || 'none',
        nextCourseSourceText: c.nextCourseSourceText || '',
        nextPdf: null,
      })
      setShowModal(true)
    } catch (err) {
      alert("Impossible de charger les données du cours : " + err.message)
    }
  }

  const handleCloseModal = () => {
    stopSpeaking()
    setTestingVoice(false)
    setEditingCourseId(null)
    setShowModal(false)
  }

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const totalCount = (form.existingImages?.length || 0) + (form.images?.length || 0) + files.length
    if (totalCount > 5) {
      alert("Vous pouvez associer au maximum 5 images/illustrations par cours.")
      return
    }
    setForm((prev) => ({
      ...prev,
      images: [...(prev.images || []), ...files],
    }))
  }

  const handleRemoveNewImage = (index) => {
    setForm((prev) => ({
      ...prev,
      images: (prev.images || []).filter((_, i) => i !== index),
    }))
  }

  const handleRemoveExistingImage = (index) => {
    setForm((prev) => ({
      ...prev,
      existingImages: (prev.existingImages || []).filter((_, i) => i !== index),
    }))
  }

  const handleAutoDraft = async () => {
    if (!form.title.trim() || !form.subject.trim()) {
      setError("Indiquez au moins la matière et le titre du cours pour lancer la rédaction IA.")
      return
    }
    const selectedClass = classes.find((c) => String(c._id) === String(form.classId))
    setError('')
    setGeneratingDraft(true)
    try {
      const res = await aiCoursesApi.generateContent({
        title: form.title.trim(),
        subject: form.subject.trim(),
        level: selectedClass?.level || '',
        className: selectedClass?.name || '',
        durationMinutes: form.durationMinutes || 45,
        language: form.language || 'fr-FR',
        images: form.existingImages || [],
      })
      if (res.data?.content) {
        setForm((prev) => ({
          ...prev,
          sourceText: res.data.content,
        }))
      }
    } catch (err) {
      setError("Erreur lors de la rédaction automatique : " + err.message)
    }
    setGeneratingDraft(false)
  }

  const openBatchModal = () => {
    stopSpeaking()
    setTestingVoice(false)
    setBatchError('')
    if (!batchCourses.length) {
      setBatchCourses(createInitialBatchSlots(batchDate, 3, classes))
    }
    setActiveBatchIndex(0)
    setShowBatchModal(true)
  }

  const addBatchSlot = () => {
    setBatchCourses((prev) => {
      const idx = prev.length
      const defaultTimes = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00']
      const newSlot = {
        time: defaultTimes[idx % defaultTimes.length] || '08:00',
        classId: classes[0]?._id || '',
        subject: '',
        title: '',
        sourceType: 'ai_generate',
        durationMinutes: 50,
        qaDurationMinutes: 10,
        language: 'fr-FR',
        voice: idx % 2 === 0 ? 'female' : 'male',
        sourceText: '',
        nextCourseTitle: '',
        nextCourseInstructions: '',
      }
      return [...prev, newSlot]
    })
    setActiveBatchIndex(batchCourses.length)
  }

  const removeBatchSlot = (indexToRemove) => {
    if (batchCourses.length <= 1) {
      alert("Vous devez programmer au moins 1 cours.")
      return
    }
    setBatchCourses((prev) => prev.filter((_, idx) => idx !== indexToRemove))
    if (activeBatchIndex >= indexToRemove && activeBatchIndex > 0) {
      setActiveBatchIndex(activeBatchIndex - 1)
    }
  }

  const handleBatchDateChange = (newDate) => {
    setBatchDate(newDate)
  }

  const updateBatchSlot = (index, patch) => {
    setBatchCourses((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], ...patch }
      return copy
    })
  }

  const handleTestVoice = () => {
    if (testingVoice) {
      stopSpeaking()
      setTestingVoice(false)
      return
    }
    const sample = form.language === 'en-US'
      ? "Hello students! This is a preview of my voice for our upcoming live lesson."
      : "Bonjour chers élèves ! Voici un extrait de ma voix pour notre prochain cours en classe."
    setTestingVoice(true)
    speakText(sample, {
      lang: form.language,
      gender: form.voice,
      onEnd: () => setTestingVoice(false),
      onError: () => setTestingVoice(false),
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.sourceType === 'text' && form.sourceText.trim().length < 200) {
      setError('Le contenu du cours est trop court (200 caractères minimum).')
      return
    }
    if (form.sourceType === 'pdf' && !form.pdf && !editingCourseId) {
      setError('Sélectionnez le fichier PDF du cours.')
      return
    }
    setSaving(true)
    stopSpeaking()
    setTestingVoice(false)
    try {
      const payload = {
        ...form,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        nextCourseDate: form.nextCourseDate ? new Date(form.nextCourseDate).toISOString() : undefined,
      }
      if (editingCourseId) {
        await aiCoursesApi.update(editingCourseId, payload)
      } else {
        await aiCoursesApi.create(payload)
      }
      setShowModal(false)
      setEditingCourseId(null)
      refresh()
    } catch (e2) { setError(e2.message) }
    setSaving(false)
  }

  const handleBatchSubmit = async (e) => {
    e.preventDefault()
    setBatchError('')
    for (let i = 0; i < batchCourses.length; i++) {
      const c = batchCourses[i]
      if (!c.classId || !c.subject.trim() || !c.title.trim() || !c.time) {
        setBatchError(`Cours n°${i + 1} : Tous les champs (classe, matière, titre, heure) doivent être renseignés.`)
        setActiveBatchIndex(i)
        return
      }
      if (c.sourceType === 'text' && c.sourceText.trim().length < 200) {
        setBatchError(`Cours n°${i + 1} (« ${c.title || 'Sans titre'} ») : Le contenu du cours est trop court (200 caractères minimum). Ou sélectionnez l'option 'Rédigé par l'IA'.`)
        setActiveBatchIndex(i)
        return
      }
    }

    setBatchSaving(true)
    try {
      const payload = batchCourses.map((c) => ({
        classId: c.classId,
        subject: c.subject.trim(),
        title: c.title.trim(),
        sourceType: c.sourceType || 'ai_generate',
        scheduledAt: new Date(`${batchDate}T${c.time}:00`).toISOString(),
        durationMinutes: Number(c.durationMinutes) || 50,
        qaDurationMinutes: Number(c.qaDurationMinutes) || 10,
        language: c.language || 'fr-FR',
        voice: c.voice || 'female',
        sourceText: c.sourceText.trim(),
        nextCourseTitle: (c.nextCourseTitle || '').trim(),
        nextCourseInstructions: (c.nextCourseInstructions || '').trim(),
      }))

      await aiCoursesApi.createBatch(payload)
      setShowBatchModal(false)
      refresh()
    } catch (err) {
      setBatchError(err.message)
    }
    setBatchSaving(false)
  }

  const handleCancel = async (id) => {
    if (!confirm('Annuler ce cours ? Les élèves ne le verront plus.')) return
    try { await aiCoursesApi.cancel(id); refresh() } catch (e) { alert(e.message) }
  }
  const handleDelete = async (id) => {
    if (!confirm('Supprimer définitivement ce cours ? Les questions et historiques associés seront également effacés.')) return
    try { await aiCoursesApi.remove(id); refresh() } catch (e) { alert(e.message) }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Bot size={22} className="text-purple-600" /> Cours IA
          </h1>
          <p className="text-sm text-gray-500">
            {canCreate
              ? "Programmez un cours : l'IA enseignante le donne en direct à l'heure prévue, puis répond aux questions des élèves."
              : "Suivez les cours donnés en direct par l'IA enseignante et posez vos questions à la fin."}
          </p>
        </div>
        {canCreate && (
          <div className="flex items-center gap-2 flex-wrap self-start">
            <button onClick={openCreate} className="btn-primary text-sm flex items-center gap-1.5 shadow-sm">
              <Plus size={15} /> Programmer un cours
            </button>
            <button
              onClick={openBatchModal}
              className="btn-ghost border border-purple-300 text-purple-800 bg-purple-50 hover:bg-purple-100 text-sm flex items-center gap-1.5 font-medium shadow-xs"
            >
              <CalendarCheck size={15} className="text-purple-600" /> Programmer ma journée (multi-cours)
            </button>
          </div>
        )}
      </div>

      {/* Barre de filtres et recherche */}
      {courses.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-gray-200/80 shadow-xs">
          {/* Onglets rapides de statut */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => handleStatusFilterChange('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 ${
                statusFilter === 'all'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Tous ({countAll})
            </button>
            {countLive > 0 && (
              <button
                type="button"
                onClick={() => handleStatusFilterChange('en_cours')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 flex items-center gap-1.5 ${
                  statusFilter === 'en_cours'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                }`}
              >
                <Radio size={12} className="animate-pulse" /> En direct ({countLive})
              </button>
            )}
            <button
              type="button"
              onClick={() => handleStatusFilterChange('planifie')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 ${
                statusFilter === 'planifie'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              À venir ({countUpcoming})
            </button>
            <button
              type="button"
              onClick={() => handleStatusFilterChange('termine')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 ${
                statusFilter === 'termine'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Terminés ({countFinished})
            </button>
          </div>

          {/* Recherche */}
          <div className="relative min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Rechercher (matière, titre, classe)..."
              className="input text-xs pl-8 pr-7 py-1.5 w-full"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setCurrentPage(1) }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                title="Effacer la recherche"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {coursesQ.loading ? (
        <div className="text-center py-16"><Loader2 size={24} className="animate-spin mx-auto text-purple-600" /></div>
      ) : courses.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Bot size={36} className="mx-auto mb-3 opacity-30" />
          <p>Aucun cours IA {canCreate ? 'programmé' : 'pour votre classe'}</p>
        </div>
      ) : paginatedCourses.length === 0 ? (
        <div className="card p-8 text-center text-gray-500 space-y-2">
          <p className="text-sm font-medium">Aucun cours ne correspond à vos filtres de recherche.</p>
          <button
            type="button"
            onClick={() => { setStatusFilter('all'); setSearchQuery(''); setCurrentPage(1) }}
            className="btn-ghost border border-gray-300 text-xs inline-flex items-center gap-1"
          >
            Réinitialiser les filtres
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {paginatedCourses.map((c) => {
            const meta = STATUS_META[c.status] || STATUS_META.planifie
            const Icon = meta.icon
            const canOpen = ['en_cours', 'termine'].includes(c.status) ||
              (canCreate && ['pret', 'planifie', 'generation', 'erreur'].includes(c.status))
            const currentUserId = String(user?.id || user?._id || '')
            const courseTeacherId = String(c.teacher?._id || c.teacher || '')
            const isTeacherMatch = Boolean(currentUserId && courseTeacherId && currentUserId === courseTeacherId) || (c.teacherName && user?.name && c.teacherName === user.name)
            const isOwner = ['directeur', 'super_admin', 'vice_principal'].includes(role) ||
              (role === 'enseignant' && (isTeacherMatch || !courseTeacherId)) ||
              (canCreate && !courseTeacherId)
            return (
              <div key={c._id} className="card p-4 hover:border-purple-200 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mb-1">
                      <span className={`font-semibold border rounded-full px-2 py-0.5 flex items-center gap-1 ${meta.cls}`}>
                        <Icon size={11} /> {meta.label}
                      </span>
                      <span className="font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-2 py-0.5">{c.subject}</span>
                      {c.class?.name && <span className="badge badge-blue">{c.class.name}</span>}
                      {c.teacherName && <span>· {c.teacherName}</span>}
                    </div>
                    <h3 className="text-sm font-bold text-gray-900">{c.title}</h3>
                    <div className="flex flex-wrap items-center gap-2.5 text-xs text-gray-500 mt-1">
                      <span className="flex items-center gap-1">
                        <CalendarCheck size={12} />
                        {new Date(c.scheduledAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        {' à '}
                        {new Date(c.scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="flex items-center gap-1"><Clock size={12} /> {c.durationMinutes} min</span>
                      <span className="flex items-center gap-1 text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                        <Volume2 size={11} /> {c.voice === 'male' ? 'Voix homme' : 'Voix femme'} ({c.language === 'en-US' ? 'EN' : 'FR'})
                      </span>
                      <span className="flex items-center gap-1 text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                        <Mic size={11} /> {c.qaDurationMinutes ?? 10} min Q&R
                      </span>
                      {c.sourceType === 'pdf' && <span className="flex items-center gap-1"><FileText size={12} /> PDF</span>}
                      {c.questionCount > 0 && <span>{c.questionCount} question{c.questionCount > 1 ? 's' : ''}</span>}
                    </div>
                    {c.nextCourseTitle && (
                      <div className="mt-2 text-xs text-blue-800 bg-blue-50/70 border border-blue-200/60 rounded-md px-2.5 py-1 flex items-center gap-1.5">
                        <BookOpen size={12} className="text-blue-600 shrink-0" />
                        <span>Prochain cours : <strong>{c.nextCourseTitle}</strong></span>
                      </div>
                    )}
                    {c.status === 'erreur' && isOwner && (
                      <p className="text-xs text-red-600 mt-1">Ce cours n'a pas pu être diffusé.</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0 flex-wrap items-center">
                    {canOpen && (
                      <button
                        onClick={() => navigate(`/dashboard/ia-cours/${c._id}/live`)}
                        className={`text-xs flex items-center gap-1 ${c.status === 'en_cours' ? 'btn-primary' : 'btn-ghost border border-gray-200'}`}
                      >
                        <Play size={13} />
                        {c.status === 'en_cours' ? 'Rejoindre le direct' : c.status === 'termine' ? 'Relire le cours' : 'Aperçu'}
                      </button>
                    )}
                    {isOwner && ['planifie', 'generation', 'pret', 'en_cours'].includes(c.status) && (
                      <button
                        onClick={() => openEdit(c)}
                        className="btn-ghost border border-purple-200 text-purple-700 hover:bg-purple-50 text-xs flex items-center gap-1"
                        title="Modifier ce cours"
                      >
                        <Edit3 size={13} /> Éditer
                      </button>
                    )}
                    {isOwner && ['planifie', 'generation', 'pret'].includes(c.status) && (
                      <button onClick={() => handleCancel(c._id)} className="btn-ghost border border-amber-200 text-amber-700 text-xs flex items-center gap-1">
                        <Ban size={13} /> Annuler
                      </button>
                    )}
                    {isOwner && ['planifie', 'termine', 'annule', 'erreur'].includes(c.status) && (
                      <button
                        type="button"
                        onClick={() => handleDelete(c._id)}
                        className="btn-ghost border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 text-xs flex items-center gap-1.5 transition-colors px-2.5 py-1.5 rounded-lg font-medium shadow-sm"
                        title="Supprimer ce cours"
                      >
                        <Trash2 size={13} className="text-red-600 shrink-0" />
                        <span>Supprimer</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination en bas de page */}
      {!coursesQ.loading && filteredCourses.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-gray-600 border-t border-gray-100">
          <div>
            Affichage de <span className="font-semibold text-gray-900">{startIndex + 1}</span> à{' '}
            <span className="font-semibold text-gray-900">{Math.min(startIndex + pageSize, filteredCourses.length)}</span> sur{' '}
            <span className="font-semibold text-gray-900">{filteredCourses.length}</span> cours
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handlePageChange(safeCurrentPage - 1)}
                disabled={safeCurrentPage <= 1}
                className="btn-ghost border border-gray-200 px-2 py-1 text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 rounded-lg"
                title="Page précédente"
              >
                <ChevronLeft size={14} /> Précédent
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                  if (
                    totalPages > 7 &&
                    pageNum !== 1 &&
                    pageNum !== totalPages &&
                    Math.abs(pageNum - safeCurrentPage) > 1
                  ) {
                    if (pageNum === 2 || pageNum === totalPages - 1) {
                      return <span key={pageNum} className="px-1 text-gray-400">...</span>
                    }
                    return null
                  }

                  const isActive = pageNum === safeCurrentPage
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => handlePageChange(pageNum)}
                      className={`min-w-[28px] h-7 px-2 flex items-center justify-center font-medium rounded-lg text-xs transition-colors ${
                        isActive
                          ? 'bg-purple-600 text-white shadow-xs font-bold'
                          : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={() => handlePageChange(safeCurrentPage + 1)}
                disabled={safeCurrentPage >= totalPages}
                className="btn-ghost border border-gray-200 px-2 py-1 text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 rounded-lg"
                title="Page suivante"
              >
                Suivant <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modale de programmation */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Bot size={18} className="text-purple-600" />
                {editingCourseId ? 'Modifier le cours IA' : 'Programmer un cours IA'}
              </h3>
              <button onClick={handleCloseModal} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Classe</label>
                  <select required value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })} className="input text-sm mt-1">
                    <option value="">Sélectionner...</option>
                    {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Matière</label>
                  <input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Mathématiques" className="input text-sm mt-1" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600">Titre du cours</label>
                <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex. Théorème de Pythagore" className="input text-sm mt-1" />
              </div>

              {/* Voix et Langue de l'IA avec prévisualisation sonore */}
              <div className="bg-purple-50/70 border border-purple-200/90 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                    <Volume2 size={15} className="text-purple-600" /> Langue & Voix de l'IA enseignante
                  </span>
                  {isSpeechSynthesisSupported() && (
                    <button
                      type="button"
                      onClick={handleTestVoice}
                      className={`text-xs px-2.5 py-1 rounded-full border flex items-center gap-1.5 font-medium transition-all ${
                        testingVoice
                          ? 'bg-purple-600 text-white border-purple-600 animate-pulse'
                          : 'bg-white text-purple-700 border-purple-300 hover:bg-purple-100/50 shadow-sm'
                      }`}
                    >
                      {testingVoice ? <VolumeX size={12} /> : <Volume2 size={12} />}
                      {testingVoice ? 'Arrêter le test' : 'Tester la voix'}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-700">Langue de diffusion</label>
                    <select
                      value={form.language}
                      onChange={(e) => setForm({ ...form, language: e.target.value })}
                      className="input text-sm mt-1 bg-white"
                    >
                      <option value="fr-FR">🇫🇷 Français</option>
                      <option value="en-US">🇬🇧 Anglais</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700">Voix de l'IA</label>
                    <select
                      value={form.voice}
                      onChange={(e) => setForm({ ...form, voice: e.target.value })}
                      className="input text-sm mt-1 bg-white"
                    >
                      <option value="female">👩 Voix féminine naturelle</option>
                      <option value="male">👨 Voix masculine naturelle</option>
                    </select>
                  </div>
                </div>
                <p className="text-[11px] text-purple-700/80">
                  L'IA diffusera oralement toute la leçon et répondra vocalement aux élèves avec cette voix synchronisée.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="text-xs font-medium text-gray-600">Date & heure début</label>
                  <input required type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} className="input text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Durée du cours (min)</label>
                  <input required type="number" min={5} max={240} value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })} className="input text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                    <Mic size={13} className="text-indigo-600" /> Temps questions (min)
                  </label>
                  <input required type="number" min={0} max={60} value={form.qaDurationMinutes} onChange={(e) => setForm({ ...form, qaDurationMinutes: Number(e.target.value) })} className="input text-sm mt-1" />
                </div>
              </div>

              {/* Source du contenu : IA autonome, texte saisi ou PDF */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-gray-700">Contenu pédagogique & Déroulement</label>
                  {form.sourceType === 'ai_generate' && (
                    <button
                      type="button"
                      onClick={handleAutoDraft}
                      disabled={generatingDraft}
                      className="text-xs px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 flex items-center gap-1 font-semibold transition-all disabled:opacity-50"
                    >
                      {generatingDraft ? <Loader2 size={12} className="animate-spin text-purple-600" /> : <Zap size={12} className="text-purple-600" />}
                      {generatingDraft ? "Rédaction par l'IA..." : "⚡ Rédiger et prévisualiser"}
                    </button>
                  )}
                </div>

                <div className="flex gap-1.5 flex-wrap">
                  {[
                    ['ai_generate', "✨ Rédigé par l'IA (automatique)"],
                    ['text', 'Saisir le texte manuellement'],
                    ['pdf', 'Importer un support PDF'],
                  ].map(([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setForm({ ...form, sourceType: v })}
                      className={`text-xs px-3 py-1.5 rounded-xl border transition-all ${
                        form.sourceType === v
                          ? 'bg-purple-600 text-white border-purple-600 font-semibold shadow-xs'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>

                {form.sourceType === 'ai_generate' && (
                  <div className="mt-2.5 bg-purple-50/60 border border-purple-200/80 rounded-xl p-3 space-y-2">
                    <p className="text-xs text-purple-900 leading-relaxed">
                      💡 <strong>Génération intelligente :</strong> L'IA effectue des recherches rigoureuses et rédige le cours complet adapté au niveau de la classe sélectionnée, avec une introduction, des explications pas-à-pas, des exemples concrets et un résumé oral.
                    </p>
                    <textarea
                      rows={4}
                      value={form.sourceText}
                      onChange={(e) => setForm({ ...form, sourceText: e.target.value })}
                      placeholder="Notes, mots-clés ou consignes spécifiques pour l'IA (optionnel). Laissez vide pour une rédaction autonome complète..."
                      className="input text-xs w-full bg-white"
                    />
                    <div className="flex items-center justify-between text-[11px] text-purple-700">
                      <span>{form.sourceText ? `${form.sourceText.length} caractères de notes` : "L'IA rédigera automatiquement le cours 5 min avant l'heure"}</span>
                      {form.title && form.subject && (
                        <button
                          type="button"
                          onClick={handleAutoDraft}
                          disabled={generatingDraft}
                          className="font-semibold underline hover:text-purple-900"
                        >
                          Cliquez ici pour voir la rédaction maintenant
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {form.sourceType === 'text' && (
                  <textarea
                    rows={5}
                    value={form.sourceText}
                    onChange={(e) => setForm({ ...form, sourceText: e.target.value })}
                    placeholder="Collez ou rédigez ici le contenu complet du cours (200 caractères minimum). L'IA développera et dispensera cette leçon oralement..."
                    className="input text-sm mt-2"
                  />
                )}

                {form.sourceType === 'pdf' && (
                  <div className="mt-2">
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setForm({ ...form, pdf: e.target.files?.[0] || null })}
                      className="text-sm w-full border border-dashed border-gray-300 rounded-lg p-3"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">PDF texte uniquement (pas de document scanné).</p>
                  </div>
                )}
              </div>

              {/* Schémas, Figures & Images démonstratives */}
              <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <ImageIcon size={15} className="text-amber-700" /> Schémas, Figures & Images explicatives (max 5)
                  </span>
                  <label className="btn-ghost bg-white border border-amber-300 text-amber-900 text-xs py-1 px-2.5 rounded-lg cursor-pointer hover:bg-amber-100 flex items-center gap-1 font-medium shadow-xs">
                    <Plus size={12} /> Ajouter une image
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </label>
                </div>
                <p className="text-[11px] text-amber-800 leading-normal">
                  Ajoutez des photos, figures, graphiques ou schémas. L'IA les analysera et les expliquera aux élèves point par point durant la diffusion comme un être humain.
                </p>

                {/* Vignettes d'images existantes et nouvelles */}
                {((form.existingImages && form.existingImages.length > 0) || (form.images && form.images.length > 0)) ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                    {(form.existingImages || []).map((img, idx) => (
                      <div key={`existing-${idx}`} className="relative group rounded-xl border border-amber-200 overflow-hidden bg-white shadow-xs">
                        <img src={img.url} alt={img.name || 'Illustration'} className="h-20 w-full object-cover" />
                        <div className="p-1.5 text-[10px] truncate text-gray-700 font-medium">{img.name || `Figure ${idx + 1}`}</div>
                        <button
                          type="button"
                          onClick={() => handleRemoveExistingImage(idx)}
                          className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-80 hover:opacity-100 shadow-xs"
                          title="Supprimer"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                    {(form.images || []).map((file, idx) => (
                      <div key={`new-${idx}`} className="relative group rounded-xl border border-amber-300 overflow-hidden bg-white shadow-xs">
                        <img src={URL.createObjectURL(file)} alt={file.name} className="h-20 w-full object-cover" />
                        <div className="p-1.5 text-[10px] truncate text-gray-700 font-medium">{file.name}</div>
                        <button
                          type="button"
                          onClick={() => handleRemoveNewImage(idx)}
                          className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-80 hover:opacity-100 shadow-xs"
                          title="Supprimer"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border border-dashed border-amber-300/80 rounded-xl p-3 text-center text-xs text-amber-800/70">
                    Aucune image attachée pour le moment.
                  </div>
                )}
              </div>

              {/* Formulaire du prochain cours & consignes */}
              <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                  <BookOpen size={15} className="text-blue-600" /> Annonce du prochain cours & devoirs (optionnel)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-xs font-medium text-gray-700">Titre du prochain cours</label>
                    <input
                      value={form.nextCourseTitle}
                      onChange={(e) => setForm({ ...form, nextCourseTitle: e.target.value })}
                      placeholder="Ex. Applications du théorème & exercices"
                      className="input text-sm mt-1 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700">Date prévue du prochain cours</label>
                    <input
                      type="datetime-local"
                      value={form.nextCourseDate}
                      onChange={(e) => setForm({ ...form, nextCourseDate: e.target.value })}
                      className="input text-sm mt-1 bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">Consignes & devoirs pour les élèves</label>
                  <textarea
                    rows={2}
                    value={form.nextCourseInstructions}
                    onChange={(e) => setForm({ ...form, nextCourseInstructions: e.target.value })}
                    placeholder="Ex. Faire les exercices 2 et 4 p. 65 pour la prochaine séance..."
                    className="input text-sm mt-1 bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">Support pédagogique pour le prochain cours</label>
                  <div className="flex gap-2 mt-1">
                    {[['none', 'Aucun'], ['text', 'Texte'], ['pdf', 'Fichier PDF']].map(([v, l]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setForm({ ...form, nextCourseSourceType: v })}
                        className={`text-xs px-2.5 py-1 rounded-full border ${form.nextCourseSourceType === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  {form.nextCourseSourceType === 'text' && (
                    <textarea
                      rows={3}
                      value={form.nextCourseSourceText}
                      onChange={(e) => setForm({ ...form, nextCourseSourceText: e.target.value })}
                      placeholder="Collez ou saisissez ici le texte ou résumé préparatoire du prochain cours..."
                      className="input text-sm mt-2 bg-white"
                    />
                  )}
                  {form.nextCourseSourceType === 'pdf' && (
                    <div className="mt-2">
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => setForm({ ...form, nextPdf: e.target.files?.[0] || null })}
                        className="text-xs w-full border border-dashed border-gray-300 rounded-lg p-2.5 bg-white"
                      />
                      <p className="text-[11px] text-gray-400 mt-1">Fichier PDF que les élèves pourront consulter pour préparer la séance.</p>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-blue-700/80">
                  À la fin du cours, l'IA annoncera vocalement cette prochaine étape et affichera les devoirs.
                </p>
              </div>

              <p className="text-[11px] text-gray-500 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
                L'IA prépare la leçon 5 minutes avant l'heure — programmez au moins 10 minutes à l'avance.
                Le cours démarre automatiquement et les élèves peuvent poser des questions à la voix ou par écrit.
              </p>

              {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleCloseModal} className="btn-ghost flex-1 justify-center border border-gray-200">Annuler</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : editingCourseId ? <CheckCircle2 size={15} /> : <Sparkles size={15} />}
                  {editingCourseId ? 'Enregistrer les modifications' : 'Programmer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale de programmation journalière complète (Multi-cours) */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-2xl p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <CalendarCheck size={20} className="text-purple-600" /> Programmer ma journée de cours IA
                </h3>
                <p className="text-xs text-gray-500">Planifiez tous vos cours de la journée en une seule étape.</p>
              </div>
              <button onClick={() => setShowBatchModal(false)} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
            </div>

            <form onSubmit={handleBatchSubmit} className="space-y-4">
              {/* Paramètres globaux de la journée */}
              <div className="bg-purple-50/70 border border-purple-200/90 rounded-2xl p-3.5 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                      <Calendar size={14} className="text-purple-600" /> Date de la journée de cours
                    </label>
                    <input
                      type="date"
                      required
                      min={defaultTodayDate()}
                      value={batchDate}
                      onChange={(e) => handleBatchDateChange(e.target.value)}
                      className="input text-sm mt-1 bg-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-purple-900 block">
                      Gestion des cours ({batchCourses.length} cours programmés)
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        type="button"
                        onClick={addBatchSlot}
                        className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-xs"
                      >
                        <Plus size={13} /> Ajouter un cours
                      </button>
                      {batchCourses.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeBatchSlot(activeBatchIndex)}
                          className="btn-ghost border border-red-200 text-red-600 hover:bg-red-50 text-xs py-1.5 px-3 flex items-center gap-1 shadow-xs"
                          title="Supprimer ce cours"
                        >
                          <Trash size={13} /> Supprimer cours n°{activeBatchIndex + 1}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Onglets des cours de la journée */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-semibold text-purple-800 uppercase tracking-wider block">
                      Sélectionner le cours à configurer :
                    </label>
                    <button
                      type="button"
                      onClick={addBatchSlot}
                      className="text-xs text-purple-700 hover:text-purple-900 font-semibold flex items-center gap-1"
                    >
                      <Plus size={12} /> Nouveau créneau
                    </button>
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {batchCourses.map((c, idx) => {
                      const isComplete = c.classId && c.subject.trim() && c.title.trim() && (c.sourceType === 'ai_generate' || c.sourceText.trim().length >= 200)
                      const isActive = activeBatchIndex === idx
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveBatchIndex(idx)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 flex items-center gap-1.5 border transition-all ${
                            isActive
                              ? 'bg-purple-700 text-white border-purple-700 shadow-sm'
                              : isComplete
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <span>Cours {idx + 1} ({c.time})</span>
                          {isComplete && <CheckCircle2 size={12} className={isActive ? 'text-emerald-300' : 'text-emerald-600'} />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Formulaire du cours actif dans la journée */}
              {batchCourses[activeBatchIndex] && (
                <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-purple-600" />
                      Configuration du Cours n°{activeBatchIndex + 1}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      Progression : {batchCourses.filter((x) => x.title && x.subject && (x.sourceType === 'ai_generate' || x.sourceText.trim().length >= 200)).length} / {batchCourses.length} cours prêts
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-700">Heure de début</label>
                      <input
                        type="time"
                        required
                        value={batchCourses[activeBatchIndex].time}
                        onChange={(e) => updateBatchSlot(activeBatchIndex, { time: e.target.value })}
                        className="input text-sm mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700">Classe assignée</label>
                      <select
                        required
                        value={batchCourses[activeBatchIndex].classId}
                        onChange={(e) => updateBatchSlot(activeBatchIndex, { classId: e.target.value })}
                        className="input text-sm mt-1"
                      >
                        <option value="">Sélectionner...</option>
                        {classes.map((cl) => <option key={cl._id} value={cl._id}>{cl.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700">Matière</label>
                      <input
                        required
                        value={batchCourses[activeBatchIndex].subject}
                        onChange={(e) => updateBatchSlot(activeBatchIndex, { subject: e.target.value })}
                        placeholder="Ex. Histoire-Géo"
                        className="input text-sm mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-700">Titre du cours</label>
                    <input
                      required
                      value={batchCourses[activeBatchIndex].title}
                      onChange={(e) => updateBatchSlot(activeBatchIndex, { title: e.target.value })}
                      placeholder="Ex. La Révolution industrielle"
                      className="input text-sm mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label className="text-xs font-medium text-gray-700">Durée (min)</label>
                      <input
                        type="number"
                        min={5}
                        max={240}
                        value={batchCourses[activeBatchIndex].durationMinutes}
                        onChange={(e) => updateBatchSlot(activeBatchIndex, { durationMinutes: Number(e.target.value) })}
                        className="input text-sm mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700">Q&R (min)</label>
                      <input
                        type="number"
                        min={0}
                        max={60}
                        value={batchCourses[activeBatchIndex].qaDurationMinutes}
                        onChange={(e) => updateBatchSlot(activeBatchIndex, { qaDurationMinutes: Number(e.target.value) })}
                        className="input text-sm mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700">Langue</label>
                      <select
                        value={batchCourses[activeBatchIndex].language}
                        onChange={(e) => updateBatchSlot(activeBatchIndex, { language: e.target.value })}
                        className="input text-sm mt-1"
                      >
                        <option value="fr-FR">🇫🇷 Français</option>
                        <option value="en-US">🇬🇧 Anglais</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700">Voix de l'IA</label>
                      <select
                        value={batchCourses[activeBatchIndex].voice}
                        onChange={(e) => updateBatchSlot(activeBatchIndex, { voice: e.target.value })}
                        className="input text-sm mt-1"
                      >
                        <option value="female">👩 Femme</option>
                        <option value="male">👨 Homme</option>
                      </select>
                    </div>
                  </div>

                  {/* Mode de rédaction du cours */}
                  <div>
                    <label className="text-xs font-medium text-gray-700">Mode pédagogique</label>
                    <div className="flex gap-2 mt-1 mb-2">
                      {[
                        ['ai_generate', "✨ Rédigé par l'IA (automatique)"],
                        ['text', 'Texte manuel'],
                      ].map(([st, label]) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => updateBatchSlot(activeBatchIndex, { sourceType: st })}
                          className={`text-xs px-3 py-1.5 rounded-xl border transition-all ${
                            (batchCourses[activeBatchIndex].sourceType || 'ai_generate') === st
                              ? 'bg-purple-600 text-white border-purple-600 font-semibold shadow-xs'
                              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {(batchCourses[activeBatchIndex].sourceType || 'ai_generate') === 'ai_generate' ? (
                      <div className="bg-purple-50/50 border border-purple-200/70 rounded-xl p-2.5">
                        <p className="text-[11px] text-purple-900 mb-1.5">
                          💡 L'IA recherchera et rédigera le cours complet adapté au niveau de la classe. Vous pouvez laisser vide ou inscrire des instructions spécifiques :
                        </p>
                        <textarea
                          rows={2}
                          value={batchCourses[activeBatchIndex].sourceText}
                          onChange={(e) => updateBatchSlot(activeBatchIndex, { sourceText: e.target.value })}
                          placeholder="Mots-clés, points clés ou plan recommandé pour l'IA (optionnel)..."
                          className="input text-xs bg-white"
                        />
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] text-gray-500">Texte complet rédigé :</span>
                          <span className={`text-[11px] ${batchCourses[activeBatchIndex].sourceText.trim().length >= 200 ? 'text-emerald-600 font-semibold' : 'text-gray-400'}`}>
                            {batchCourses[activeBatchIndex].sourceText.trim().length} / 200 caractères min
                          </span>
                        </div>
                        <textarea
                          rows={4}
                          value={batchCourses[activeBatchIndex].sourceText}
                          onChange={(e) => updateBatchSlot(activeBatchIndex, { sourceText: e.target.value })}
                          placeholder="Collez ici les notions du cours (200 caractères minimum)..."
                          className="input text-sm"
                        />
                      </div>
                    )}
                  </div>

                  {/* Consignes prochain cours optionnel */}
                  <div className="bg-blue-50/50 border border-blue-200/60 rounded-xl p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-medium text-blue-900">Titre du prochain cours (optionnel)</label>
                      <input
                        value={batchCourses[activeBatchIndex].nextCourseTitle}
                        onChange={(e) => updateBatchSlot(activeBatchIndex, { nextCourseTitle: e.target.value })}
                        placeholder="Thème suivant..."
                        className="input text-xs mt-0.5 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-blue-900">Devoirs / Consignes (optionnel)</label>
                      <input
                        value={batchCourses[activeBatchIndex].nextCourseInstructions}
                        onChange={(e) => updateBatchSlot(activeBatchIndex, { nextCourseInstructions: e.target.value })}
                        placeholder="Exercices à préparer..."
                        className="input text-xs mt-0.5 bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {batchError && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{batchError}</p>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowBatchModal(false)} className="btn-ghost flex-1 justify-center border border-gray-200">
                  Annuler
                </button>
                <button type="submit" disabled={batchSaving} className="btn-primary flex-1 justify-center">
                  {batchSaving ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                  Programmer les {batchCourses.length} cours de la journée
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
