import { useEffect, useState } from 'react'
import {
  Users, Loader2, Search, TrendingUp, CalendarCheck, BookOpen,
  ChevronDown, ChevronUp, ArrowUpDown, Phone, Mail, UserCheck,
} from 'lucide-react'
import { teacherApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'

export default function TeacherStudentsPage() {
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState('lastName')
  const [sortDir, setSortDir] = useState('asc')
  const [filterClass, setFilterClass] = useState('')
  const [activeView, setActiveView] = useState('students') // 'students' | 'parents'
  const [parents, setParents] = useState({})
  const [parentsLoading, setParentsLoading] = useState(false)
  const [parentsClass, setParentsClass] = useState('')

  const studentsQ = useCachedFetch('/teacher/students?', async () => (await teacherApi.students()).data || [], [])
  const dashboardQ = useCachedFetch('/teacher/dashboard?', async () => {
    const r = await teacherApi.dashboard()
    return r.data?.teacher?.classes || []
  }, [])

  const students = studentsQ.data || []
  const classes = dashboardQ.data || []
  const loading = studentsQ.loading || dashboardQ.loading

  // Set the initial parentsClass once classes load (mirrors the original initializer)
  useEffect(() => {
    if (classes.length > 0 && !parentsClass) setParentsClass(classes[0]._id)
  }, [classes, parentsClass])

  const loadParents = async (classId) => {
    if (!classId) return
    setParentsLoading(true)
    try {
      const r = await teacherApi.classParents(classId)
      setParents((p) => ({ ...p, [classId]: r.data || [] }))
    } catch (_) {}
    setParentsLoading(false)
  }

  useEffect(() => {
    if (activeView === 'parents' && parentsClass && !parents[parentsClass]) loadParents(parentsClass)
  }, [activeView, parentsClass])

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const filtered = students
    .filter((s) => {
      if (filterClass && (s.class?._id || s.class) !== filterClass) return false
      if (search) {
        const q = search.toLowerCase()
        return s.fullName?.toLowerCase().includes(q) || s.matricule?.toLowerCase().includes(q)
      }
      return true
    })
    .sort((a, b) => {
      const m = sortDir === 'asc' ? 1 : -1
      if (sortField === 'averageGrade') return ((a.averageGrade ?? -1) - (b.averageGrade ?? -1)) * m
      if (sortField === 'attendanceRate') return ((a.attendanceRate ?? -1) - (b.attendanceRate ?? -1)) * m
      return (a[sortField] || '').localeCompare(b[sortField] || '') * m
    })

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Users size={22} className="text-blue-600" /> Mes élèves</h1>
          <p className="text-sm text-gray-500">{students.length} élève(s) dans vos classes</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button onClick={() => setActiveView('students')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeView === 'students' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Élèves</button>
          <button onClick={() => setActiveView('parents')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeView === 'parents' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Parents</button>
        </div>
      </div>

      {activeView === 'parents' ? (
        <div className="space-y-4">
          <div className="flex gap-3">
            <select value={parentsClass} onChange={(e) => { setParentsClass(e.target.value); if (!parents[e.target.value]) loadParents(e.target.value) }} className="input text-sm w-auto">
              {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          {parentsLoading ? (
            <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-blue-600" /></div>
          ) : !parents[parentsClass] || parents[parentsClass].length === 0 ? (
            <div className="text-center py-12 text-gray-400"><UserCheck size={36} className="mx-auto mb-3 opacity-30" /><p className="text-sm">Aucun parent enregistré pour cette classe</p></div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Élève</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Parent</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Contact</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">Compte</th>
                  </tr>
                </thead>
                <tbody>
                  {parents[parentsClass]?.map((p) => (
                    <tr key={p.studentId} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-bold text-gray-900">{p.studentName}</p>
                        <p className="text-[10px] text-gray-400">{p.matricule}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{p.parent.name || '—'}</p>
                        <p className="text-[10px] text-gray-400">{p.parent.relation === 'pere' ? 'Père' : p.parent.relation === 'mere' ? 'Mère' : 'Tuteur'}</p>
                      </td>
                      <td className="px-4 py-3">
                        {p.parent.phone && <p className="flex items-center gap-1 text-gray-600"><Phone size={10} />{p.parent.phone}</p>}
                        {p.parent.email && <p className="flex items-center gap-1 text-gray-400"><Mail size={10} />{p.parent.email}</p>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${p.parent.hasAccount ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {p.parent.hasAccount ? '✅ Compte actif' : 'Pas de compte'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un élève..." className="input text-sm pl-9" />
        </div>
        <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} className="input text-xs w-auto">
          <option value="">Toutes les classes</option>
          {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-3 text-center">
          <p className="text-xl font-bold text-blue-600">{filtered.length}</p>
          <p className="text-[10px] text-gray-500">Total élèves</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xl font-bold text-green-600">
            {filtered.filter((s) => s.averageGrade != null && s.averageGrade >= 10).length}
          </p>
          <p className="text-[10px] text-gray-500">Moyenne ≥ 10</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xl font-bold text-red-600">
            {filtered.filter((s) => s.averageGrade != null && s.averageGrade < 10).length}
          </p>
          <p className="text-[10px] text-gray-500">Moyenne &lt; 10</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xl font-bold text-amber-600">
            {filtered.filter((s) => s.attendanceRate != null && s.attendanceRate < 80).length}
          </p>
          <p className="text-[10px] text-gray-500">Présence &lt; 80%</p>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400"><Users size={36} className="mx-auto mb-3 opacity-30" /><p>Aucun élève trouvé</p></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Élève</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Classe</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:text-gray-900" onClick={() => toggleSort('averageGrade')}>
                    <span className="flex items-center gap-1 justify-center">Moyenne <ArrowUpDown size={10} /></span>
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:text-gray-900" onClick={() => toggleSort('attendanceRate')}>
                    <span className="flex items-center gap-1 justify-center">Présence <ArrowUpDown size={10} /></span>
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-center">Notes saisies</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-center">Statut</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const avgColor = s.averageGrade == null ? 'text-gray-400' : s.averageGrade >= 14 ? 'text-green-600' : s.averageGrade >= 10 ? 'text-blue-600' : s.averageGrade >= 8 ? 'text-amber-600' : 'text-red-600'
                  const attColor = s.attendanceRate == null ? 'text-gray-400' : s.attendanceRate >= 90 ? 'text-green-600' : s.attendanceRate >= 75 ? 'text-amber-600' : 'text-red-600'
                  const status = s.averageGrade != null && s.averageGrade < 8 ? 'danger' : s.averageGrade != null && s.averageGrade < 10 ? 'warning' : 'ok'
                  return (
                    <tr key={s._id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                            {s.photo ? <img src={s.photo} alt="" className="w-full h-full rounded-full object-cover" /> : s.firstName?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{s.fullName}</p>
                            <p className="text-[10px] text-gray-400">{s.matricule}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{s.class?.name || '—'}</td>
                      <td className={`px-4 py-3 text-center font-bold ${avgColor}`}>{s.averageGrade != null ? `${s.averageGrade}/20` : '—'}</td>
                      <td className={`px-4 py-3 text-center font-bold ${attColor}`}>{s.attendanceRate != null ? `${s.attendanceRate}%` : '—'}</td>
                      <td className="px-4 py-3 text-center text-gray-500">{s.gradeCount}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          status === 'danger' ? 'bg-red-100 text-red-700' :
                          status === 'warning' ? 'bg-amber-100 text-amber-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {status === 'danger' ? 'En difficulté' : status === 'warning' ? 'À surveiller' : 'OK'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  )
}
