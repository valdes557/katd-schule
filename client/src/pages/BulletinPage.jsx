import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Printer, Loader2, AlertCircle, Calendar } from 'lucide-react'
import html2pdf from 'html2pdf.js'
import { gradesApi, parentApi, studentsApi } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import BulletinView from '../components/BulletinView'

const TERMS = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3']

export default function BulletinPage() {
  const { studentId: paramId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [studentId, setStudentId] = useState(paramId || '')
  const [children, setChildren] = useState([])
  const [students, setStudents] = useState([]) // for director/teacher
  const [term, setTerm] = useState(searchParams.get('term') || 'Trimestre 1')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Load list of accessible students depending on role
  useEffect(() => {
    (async () => {
      if (user?.role === 'parent') {
        try {
          const r = await parentApi.dashboard()
          const list = r.data?.children || r.data?.students || []
          setChildren(list)
          if (!studentId && list.length > 0) setStudentId(list[0]._id)
        } catch (err) { console.error(err) }
      } else if (user?.role === 'directeur' || user?.role === 'enseignant' || user?.role === 'super_admin') {
        try {
          const r = await studentsApi.list()
          setStudents(r.data || [])
          if (!studentId && r.data?.length > 0) setStudentId(r.data[0]._id)
        } catch (err) { console.error(err) }
      }
    })()
  }, [user?.role])

  // Fetch bulletin
  useEffect(() => {
    if (!studentId) return
    (async () => {
      setLoading(true); setError(null)
      try {
        const r = await gradesApi.bulletin(studentId, term)
        setData(r.data)
      } catch (e) { setError(e.message || 'Erreur de chargement') }
      setLoading(false)
    })()
  }, [studentId, term])

  // Sync URL
  useEffect(() => { setSearchParams({ term }, { replace: true }) }, [term])

  const handleDownloadPdf = () => {
    if (!data) return
    const element = document.querySelector('.bulletin-doc')
    if (!element) {
      // Fallback: open print dialog if for some reason we can't find the bulletin container
      window.print()
      return
    }

    const filenameParts = []
    if (data?.student?.lastName || data?.student?.firstName) {
      filenameParts.push(`${data.student.lastName || ''}_${data.student.firstName || ''}`.trim())
    } else {
      filenameParts.push('bulletin')
    }
    if (data?.academicYear) filenameParts.push(data.academicYear)
    if (data?.term) filenameParts.push(data.term.replace(/\s+/g, '_'))

    const filename = `${filenameParts.join('_') || 'bulletin'}.pdf`

    const options = {
      margin: [10, 10, 10, 10],
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    }

    html2pdf().set(options).from(element).save()
  }

  const handlePrint = () => window.print()

  const accessibleList = user?.role === 'parent' ? children : students

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Toolbar (hidden on print) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => navigate(-1)} className="btn-ghost text-sm border border-gray-200">
            <ArrowLeft size={14} /> Retour
          </button>
          <h1 className="text-lg font-bold text-gray-900">Bulletin scolaire</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {accessibleList.length > 1 && (
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="input text-sm w-auto">
              {accessibleList.map((s) => (
                <option key={s._id} value={s._id}>{s.lastName || s.fullName?.split(' ')[0]} {s.firstName || s.fullName?.split(' ').slice(1).join(' ')}</option>
              ))}
            </select>
          )}
          <select value={term} onChange={(e) => setTerm(e.target.value)} className="input text-sm w-auto">
            {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button onClick={handleDownloadPdf} disabled={!data} className="btn-primary text-sm">
            <Download size={14} /> Télécharger (PDF)
          </button>
          <button onClick={handlePrint} disabled={!data} className="btn-ghost text-sm border border-gray-200">
            <Printer size={14} /> Imprimer
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>
      ) : error ? (
        <div className="card p-8 text-center text-red-500 flex flex-col items-center gap-2">
          <AlertCircle size={32} />
          <p className="text-sm">{error}</p>
        </div>
      ) : !studentId ? (
        <div className="card p-8 text-center text-gray-400">
          <p className="text-sm">Aucun élève sélectionné</p>
        </div>
      ) : (
        <BulletinView data={data} />
      )}

      <div className="no-print text-center text-xs text-gray-400 pt-2">
        <Calendar size={11} className="inline mr-1" /> Astuce : le bouton « Télécharger (PDF) » ouvre la boîte de dialogue d'impression — choisissez <strong>« Enregistrer au format PDF »</strong> comme destination.
      </div>
    </div>
  )
}
