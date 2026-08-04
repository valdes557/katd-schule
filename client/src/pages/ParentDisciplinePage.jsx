import { useEffect, useState } from 'react'
import { Shield, Loader2 } from 'lucide-react'
import { parentApi, studentsApi } from '../lib/api'
import DisciplineView from '../components/DisciplineView'

/** Discipline par enfant (espace parent) : sélecteur d'enfant + dossier complet. */
export default function ParentDisciplinePage() {
  const [children, setChildren] = useState([])
  const [studentId, setStudentId] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Charge la liste des enfants
  useEffect(() => {
    (async () => {
      try {
        const r = await parentApi.dashboard()
        const list = r.data?.children || r.data?.students || []
        setChildren(list)
        if (list.length > 0) setStudentId(list[0]._id)
        else setLoading(false)
      } catch (e) { setError(e.message); setLoading(false) }
    })()
  }, [])

  // Charge la discipline de l'enfant sélectionné
  useEffect(() => {
    if (!studentId) return
    (async () => {
      setLoading(true); setError(null)
      try {
        const r = await studentsApi.discipline(studentId)
        setData(r.data || null)
      } catch (e) { setError(e.message) }
      setLoading(false)
    })()
  }, [studentId])

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Shield size={20} className="text-rose-600" /> Discipline</h1>
          <p className="text-sm text-gray-500">Retards, absences et permissions de votre enfant.</p>
        </div>
        {children.length > 1 && (
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="input text-sm w-auto self-start">
            {children.map((c) => (
              <option key={c._id} value={c._id}>{c.lastName || ''} {c.firstName || c.fullName || ''}</option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>
      ) : error ? (
        <div className="card p-10 text-center text-sm text-red-500">{error}</div>
      ) : children.length === 0 ? (
        <div className="card p-10 text-center text-sm text-gray-500">Aucun enfant lié à votre compte.</div>
      ) : (
        <DisciplineView data={data} />
      )}
    </div>
  )
}
