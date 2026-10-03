import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users, Loader2, Search, TrendingUp, CalendarCheck, BookOpen,
  ArrowUpDown, Phone, Mail, UserCheck, Eye, Plus, FileText,
  CheckCircle2, AlertCircle, X, Award, Calendar, Settings, Clock
} from 'lucide-react'
import { teacherApi, gradesApi, classesApi, timetablesApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'
import { cn } from '../lib/utils'

export default function TeacherStudentsPage() {
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState('lastName')
  const [sortDir, setSortDir] = useState('asc')
  const [filterClass, setFilterClass] = useState('')
  const [activeView, setActiveView] = useState('students') // 'students' | 'evaluations' | 'parents'
  const [parents, setParents] = useState({})
  const [parentsLoading, setParentsLoading] = useState(false)
  const [parentsClass, setParentsClass] = useState('')

  // Modals
  const [selectedProfileStudent, setSelectedProfileStudent] = useState(null)
  const [gradeModalStudent, setGradeModalStudent] = useState(null)

  const studentsQ = useCachedFetch('/teacher/students?', async () => (await teacherApi.students()).data || [], [])
  const dashboardQ = useCachedFetch('/teacher/dashboard?', async () => {
    const r = await teacherApi.dashboard()
    return r.data?.teacher?.classes || []
  }, [])

  const students = studentsQ.data || []
  const classes = dashboardQ.data || []
  const loading = studentsQ.loading || dashboardQ.loading

  const refreshStudents = () => {
    cache.invalidate('/teacher/students')
    studentsQ.refetch()
  }

  // Set the initial parentsClass once classes load
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
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Users size={22} className="text-blue-600" /> Mes élèves & Suivi pédagogique
          </h1>
          <p className="text-sm text-gray-500">{students.length} élève(s) dans vos classes · Saisie des notes, profil et évaluations</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveView('students')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${activeView === 'students' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Élèves ({students.length})
          </button>
          <button
            onClick={() => setActiveView('evaluations')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${activeView === 'evaluations' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Évaluations programmées
          </button>
          <button
            onClick={() => setActiveView('parents')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${activeView === 'parents' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Parents
          </button>
        </div>
      </div>

      {activeView === 'evaluations' ? (
        <TeacherEvaluationsView classes={classes} />
      ) : activeView === 'parents' ? (
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
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un élève (nom, matricule)..." className="input text-sm pl-9" />
            </div>
            <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} className="input text-xs w-auto">
              <option value="">Toutes vos classes</option>
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
                      <th className="px-4 py-3 font-semibold text-gray-600 text-center">Actions pédagogiques</th>
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
                              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                                {s.photo ? <img src={s.photo} alt="" className="w-full h-full rounded-full object-cover" /> : s.firstName?.charAt(0)}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <p className="font-bold text-gray-900">{s.fullName}</p>
                                  {s.studentType && (
                                    <span className={cn(
                                      'text-[9px] font-bold px-1.5 py-0.2 rounded uppercase',
                                      s.studentType === 'ancien' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                                    )}>
                                      {s.studentType === 'ancien' ? 'Ancien' : 'Nouveau'}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-gray-400">{s.matricule || 'Sans matricule'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600 font-medium">{s.class?.name || '—'}</td>
                          <td className={`px-4 py-3 text-center font-bold ${avgColor}`}>{s.averageGrade != null ? `${s.averageGrade}/20` : '—'}</td>
                          <td className={`px-4 py-3 text-center font-bold ${attColor}`}>{s.attendanceRate != null ? `${s.attendanceRate}%` : '—'}</td>
                          <td className="px-4 py-3 text-center text-gray-500 font-semibold">{s.gradeCount}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              status === 'danger' ? 'bg-red-100 text-red-700' :
                              status === 'warning' ? 'bg-amber-100 text-amber-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {status === 'danger' ? 'En difficulté' : status === 'warning' ? 'À surveiller' : 'OK'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => setSelectedProfileStudent(s)}
                                className="btn-ghost p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg text-[11px] font-semibold flex items-center gap-1"
                                title="Consulter le profil et le suivi pédagogique"
                              >
                                <Eye size={13} /> Profil & Suivi
                              </button>
                              <button
                                type="button"
                                onClick={() => setGradeModalStudent(s)}
                                className="btn-ghost p-1.5 text-green-600 hover:bg-green-50 rounded-lg text-[11px] font-semibold flex items-center gap-1"
                                title="Saisir une note et une appréciation"
                              >
                                <Plus size={13} /> Noter
                              </button>
                              <Link
                                to={`/dashboard/bulletin/${s._id}`}
                                className="btn-ghost p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg text-[11px] font-semibold flex items-center gap-1"
                                title="Générer / consulter le bulletin scolaire"
                              >
                                <FileText size={13} /> Bulletin
                              </Link>
                            </div>
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

      {/* Modal 1 : Profil pédagogique et suivi */}
      {selectedProfileStudent && (
        <PedagogicalProfileModal
          student={selectedProfileStudent}
          onClose={() => setSelectedProfileStudent(null)}
          onAddGrade={(st) => {
            setSelectedProfileStudent(null)
            setGradeModalStudent(st)
          }}
        />
      )}

      {/* Modal 2 : Saisie de note et appréciation */}
      {gradeModalStudent && (
        <AddGradeModal
          student={gradeModalStudent}
          onClose={() => setGradeModalStudent(null)}
          onSuccess={refreshStudents}
        />
      )}
    </div>
  )
}

function PedagogicalProfileModal({ student, onClose, onAddGrade }) {
  const [grades, setGrades] = useState([])
  const [loadingGrades, setLoadingGrades] = useState(true)

  useEffect(() => {
    if (!student?._id) return
    setLoadingGrades(true)
    gradesApi.list(`student=${student._id}`)
      .then((res) => setGrades(res.data || []))
      .catch(console.error)
      .finally(() => setLoadingGrades(false))
  }, [student?._id])

  if (!student) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-600 text-white font-bold text-lg flex items-center justify-center shrink-0">
              {student.photo ? (
                <img src={student.photo} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                student.firstName?.charAt(0) || 'E'
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">{student.fullName}</h2>
                <span className={cn(
                  'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase',
                  student.studentType === 'ancien' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                )}>
                  {student.studentType === 'ancien' ? 'Ancien élève' : 'Nouvel élève'}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Matricule : <span className="font-semibold text-gray-700">{student.matricule || 'N/A'}</span> · Classe : <span className="font-semibold text-gray-700">{student.class?.name || '—'}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        {/* Synthèse indicateurs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-3 bg-blue-50/50 border border-blue-100 text-center">
            <span className="text-[10px] font-semibold text-blue-700 uppercase">Moyenne générale</span>
            <div className="text-xl font-black text-blue-900 mt-0.5">
              {student.averageGrade != null ? `${student.averageGrade}/20` : '—'}
            </div>
          </div>
          <div className="card p-3 bg-green-50/50 border border-green-100 text-center">
            <span className="text-[10px] font-semibold text-green-700 uppercase">Taux de présence</span>
            <div className="text-xl font-black text-green-900 mt-0.5">
              {student.attendanceRate != null ? `${student.attendanceRate}%` : '—'}
            </div>
          </div>
          <div className="card p-3 bg-indigo-50/50 border border-indigo-100 text-center">
            <span className="text-[10px] font-semibold text-indigo-700 uppercase">Évaluations</span>
            <div className="text-xl font-black text-indigo-900 mt-0.5">
              {student.gradeCount || grades.length} note(s)
            </div>
          </div>
        </div>

        {/* Coordonnées des parents */}
        <div className="rounded-xl border border-gray-200 p-4 bg-gray-50/60 space-y-2">
          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
            <Users size={14} className="text-blue-600" /> Coordonnées du responsable / parent
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-gray-400">Nom du parent :</span>{' '}
              <span className="font-semibold text-gray-800">{student.parent?.name || 'Non renseigné'}</span>{' '}
              {student.parent?.relation && <span className="text-gray-500 text-[10px]">({student.parent.relation})</span>}
            </div>
            <div>
              <span className="text-gray-400">Téléphone :</span>{' '}
              {student.parent?.phone ? (
                <a href={`tel:${student.parent.phone}`} className="font-semibold text-blue-600 hover:underline">
                  {student.parent.phone}
                </a>
              ) : (
                <span className="text-gray-400">N/A</span>
              )}
            </div>
            <div>
              <span className="text-gray-400">Email :</span>{' '}
              {student.parent?.email ? (
                <a href={`mailto:${student.parent.email}`} className="font-semibold text-blue-600 hover:underline">
                  {student.parent.email}
                </a>
              ) : (
                <span className="text-gray-400">N/A</span>
              )}
            </div>
            <div>
              <span className="text-gray-400">Genre élève :</span>{' '}
              <span className="font-semibold text-gray-800">{student.gender === 'F' ? 'Féminin' : 'Masculin'}</span>
            </div>
          </div>
        </div>

        {/* Historique des notes et appréciations */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
              <Award size={14} className="text-amber-600" /> Suivi pédagogique : Notes & Appréciations
            </h4>
            <span className="text-xs text-gray-400">{grades.length} note(s) au total</span>
          </div>

          {loadingGrades ? (
            <div className="py-6 text-center"><Loader2 size={20} className="animate-spin mx-auto text-blue-600" /></div>
          ) : grades.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-gray-200 text-center text-xs text-gray-400">
              Aucune note ni appréciation enregistrée pour cet élève.
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
              {grades.map((g) => (
                <div key={g._id} className="p-3 rounded-xl border border-gray-100 bg-white shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-gray-900">{g.subject}</span>
                    <span className={cn(
                      'font-black text-sm',
                      g.value >= 10 ? 'text-green-600' : 'text-red-600'
                    )}>
                      {g.value}/20 <span className="text-[10px] text-gray-400 font-normal">(coef {g.coefficient || 1})</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-gray-400">
                    <span className="capitalize">{g.type}</span>
                    <span>·</span>
                    <span>{g.term}</span>
                    {g.sequence && <><span>·</span><span>{g.sequence}</span></>}
                    <span>·</span>
                    <span>{new Date(g.date || g.createdAt).toLocaleDateString('fr-FR')}</span>
                    {g.status === 'brouillon' && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">Brouillon</span>
                    )}
                  </div>
                  {g.comment && (
                    <div className="text-xs text-gray-600 bg-amber-50/60 p-2 rounded-lg border border-amber-100 italic">
                      💬 <span className="font-semibold text-gray-700">Appréciation :</span> {g.comment}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t">
          <Link
            to={`/dashboard/bulletin/${student._id}`}
            className="btn-ghost border border-gray-200 text-xs flex items-center gap-1.5 w-full sm:w-auto justify-center"
          >
            <FileText size={14} className="text-blue-600" /> Consulter le bulletin scolaire
          </Link>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => {
                onClose()
                onAddGrade(student)
              }}
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              <Plus size={14} /> Saisir note / appréciation
            </button>
            <button type="button" onClick={onClose} className="btn-ghost text-xs">
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AddGradeModal({ student, onClose, onSuccess }) {
  const [form, setForm] = useState({
    subject: '',
    value: '',
    coefficient: 1,
    type: 'devoir',
    term: 'Trimestre 1',
    sequence: 'Séquence 1',
    comment: '',
    status: 'publie',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!student?._id) return
    if (form.value === '' || isNaN(form.value) || Number(form.value) < 0 || Number(form.value) > 20) {
      alert('Veuillez saisir une note valide entre 0 et 20.')
      return
    }
    if (!form.subject.trim()) {
      alert('Veuillez indiquer la matière.')
      return
    }

    setSaving(true)
    try {
      await gradesApi.create({
        student: student._id,
        class: student.class?._id || student.class,
        subject: form.subject.trim(),
        value: Number(form.value),
        coefficient: Number(form.coefficient) || 1,
        type: form.type,
        term: form.term,
        sequence: form.sequence,
        comment: form.comment.trim(),
        status: form.status,
      })
      alert('Note et appréciation enregistrées avec succès !')
      onSuccess?.()
      onClose()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="text-base font-bold text-gray-900">Saisir une note & appréciation</h3>
            <p className="text-xs text-gray-500">
              Pour : <span className="font-semibold text-gray-800">{student?.fullName}</span> ({student?.class?.name || '—'})
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-gray-700 mb-1">Matière *</label>
            <input
              type="text"
              required
              placeholder="Ex: Mathématiques, Français, SVT..."
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="input w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Note /20 *</label>
              <input
                type="number"
                min="0"
                max="20"
                step="0.25"
                required
                placeholder="Ex: 14.5"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                className="input w-full font-bold text-sm"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Coefficient</label>
              <input
                type="number"
                min="1"
                max="10"
                value={form.coefficient}
                onChange={(e) => setForm({ ...form, coefficient: e.target.value })}
                className="input w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Type d'évaluation</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="input w-full"
              >
                <option value="devoir">Devoir à domicile / régulier</option>
                <option value="composition">Composition</option>
                <option value="examen">Examen</option>
                <option value="oral">Interrogation orale</option>
                <option value="tp">Travaux Pratiques (TP)</option>
                <option value="examen_blanc">Examen blanc</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Période (Trimestre)</label>
              <select
                value={form.term}
                onChange={(e) => setForm({ ...form, term: e.target.value })}
                className="input w-full"
              >
                <option value="Trimestre 1">Trimestre 1</option>
                <option value="Trimestre 2">Trimestre 2</option>
                <option value="Trimestre 3">Trimestre 3</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">Séquence (optionnel)</label>
            <select
              value={form.sequence}
              onChange={(e) => setForm({ ...form, sequence: e.target.value })}
              className="input w-full"
            >
              <option value="">Aucune séquence spécifique</option>
              <option value="Séquence 1">Séquence 1</option>
              <option value="Séquence 2">Séquence 2</option>
              <option value="Séquence 3">Séquence 3</option>
              <option value="Séquence 4">Séquence 4</option>
              <option value="Séquence 5">Séquence 5</option>
              <option value="Séquence 6">Séquence 6</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">Appréciation / Observation pédagogique</label>
            <textarea
              rows={2}
              placeholder="Ex: Excellent travail, rigoureux et attentif. Poursuivre ainsi..."
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
              className="input w-full"
            />
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">Statut de la note</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="input w-full"
            >
              <option value="publie">Publiée (immédiatement visible par l'élève et les parents)</option>
              <option value="brouillon">Brouillon (visible uniquement par vous)</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <button type="button" onClick={onClose} className="btn-ghost">
              Annuler
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {saving ? 'Enregistrement...' : 'Enregistrer la note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TeacherEvaluationsView({ classes }) {
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?._id || '')
  const [classDetail, setClassDetail] = useState(null)
  const [timetable, setTimetable] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selectedClassId && classes.length > 0) {
      setSelectedClassId(classes[0]._id)
    }
  }, [classes, selectedClassId])

  useEffect(() => {
    if (!selectedClassId) return
    setLoading(true)
    Promise.all([
      classesApi.get(selectedClassId).then((r) => r.data || r).catch(() => null),
      timetablesApi.getByClass(selectedClassId).then((r) => r.data || r).catch(() => null),
    ]).then(([cls, tt]) => {
      setClassDetail(cls)
      setTimetable(tt)
    }).finally(() => setLoading(false))
  }, [selectedClassId])

  const config = classDetail?.evaluationConfig
  const slots = (timetable?.slots || []).filter(
    (s) => s.type === 'evaluation' || s.isScheduledEvaluation
  )

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-wrap items-center justify-between gap-3 bg-white">
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase">Classe</label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="input text-sm w-auto font-medium"
          >
            {classes.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </div>

        <Link
          to="/dashboard/emploi-du-temps"
          className="btn-ghost border border-gray-200 text-xs flex items-center gap-1.5"
        >
          <Calendar size={14} className="text-blue-600" /> Accéder à l'agenda de la classe
        </Link>
      </div>

      {loading ? (
        <div className="py-16 text-center"><Loader2 size={28} className="animate-spin mx-auto text-blue-600" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Configuration des évaluations */}
          <div className="card p-5 space-y-3 bg-white">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Settings size={16} className="text-blue-600" /> Configuration des évaluations ({classDetail?.name || '—'})
            </h3>

            {config?.evaluationTypes?.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">Types d'évaluations prévues pour cette classe :</p>
                <div className="divide-y divide-gray-100">
                  {config.evaluationTypes.map((et, idx) => (
                    <div key={idx} className="py-2 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-gray-800">{et.name}</p>
                        <p className="text-[10px] text-gray-400">Périodicité : {et.periodicity || 'hebdomadaire'} · Coef : {et.weight || 1}</p>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                        {et.code || 'ÉVAL'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-gray-200 text-center text-xs text-gray-400">
                Aucun type d'évaluation spécifique configuré. Les évaluations standard (devoirs, compositions) s'appliquent.
              </div>
            )}

            <div className="pt-2 border-t text-xs text-gray-600 space-y-1">
              <div><span className="font-semibold text-gray-700">Méthode de calcul annuel :</span> {config?.annualCalculationMethod === 'moyenne_arithmetique' ? 'Moyenne arithmétique' : 'Moyenne coefficientée par trimestre'}</div>
              <div><span className="font-semibold text-gray-700">Barème d'appréciation :</span> {config?.appreciationRules?.length || 4} paliers configurés (Excellent, Très bien, Bien...)</div>
            </div>
          </div>

          {/* Évaluations programmées dans l'agenda */}
          <div className="card p-5 space-y-3 bg-white">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <CalendarCheck size={16} className="text-amber-600" /> Évaluations programmées dans l'agenda ({slots.length})
            </h3>

            {slots.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-gray-200 text-center text-xs text-gray-400">
                Aucune évaluation n'est programmée dans l'emploi du temps de cette classe pour le moment.
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {slots.map((s) => (
                  <div key={s._id} className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-gray-900">{s.title || s.subject}</span>
                        <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-200 text-amber-900">ÉVALUATION</span>
                      </div>
                      <p className="text-[11px] text-gray-600 mt-0.5">
                        {s.day} · {s.startTime} - {s.endTime} {s.room ? `· Salle ${s.room}` : ''}
                      </p>
                    </div>
                    {s.evaluationType && (
                      <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                        {s.evaluationType}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
