import { useEffect, useState } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import {
  ArrowLeft, BookOpen, CalendarCheck, FileText, Clock, CheckCircle2,
  XCircle, AlertTriangle, Loader2, RefreshCw, User, Download, Wifi,
  Users, GraduationCap, Phone, Mail, Banknote, ListChecks, ChevronDown, ChevronRight,
  ClipboardList,
} from 'lucide-react'
import { parentApi } from '../lib/api'
import { cn } from '../lib/utils'

const PIE_COLORS = ['#10B981', '#EF4444', '#F59E0B', '#6366F1']
const TABS = [
  { id: 'overview', label: 'Vue d\'ensemble', icon: User },
  { id: 'notes', label: 'Notes', icon: BookOpen },
  { id: 'attendance', label: 'Présence', icon: CalendarCheck },
  { id: 'classattendance', label: 'Classe', icon: Users },
  { id: 'teachers', label: 'Enseignants', icon: GraduationCap },
  { id: 'homework', label: 'Devoirs', icon: FileText },
  { id: 'completion', label: 'Complétion', icon: ListChecks },
  { id: 'subjects', label: 'Matières', icon: ClipboardList },
  { id: 'fees', label: 'Frais', icon: Banknote },
  { id: 'timetable', label: 'Emploi du temps', icon: Clock },
]

const TERMS = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3']
const SEQUENCES = ['Séquence 1', 'Séquence 2', 'Séquence 3', 'Séquence 4', 'Séquence 5', 'Séquence 6']

export default function ParentChildDetailPage() {
  const { studentId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') || 'overview'
  const [data, setData] = useState(null)
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, _setTab] = useState(initialTab)
  const setTab = (t) => { _setTab(t); setSearchParams({ tab: t }, { replace: true }) }
  const [classAtt, setClassAtt] = useState(null)
  const [classAttLoading, setClassAttLoading] = useState(false)
  const [teachers, setTeachers] = useState(null)
  const [teachersLoading, setTeachersLoading] = useState(false)
  const [selectedTerm, setSelectedTerm] = useState('')
  const [selectedSeq, setSelectedSeq] = useState('')
  const [completionData, setCompletionData] = useState({})
  const [completionLoading, setCompletionLoading] = useState(null)
  const [expandedHw, setExpandedHw] = useState(null)
  const [subjects, setSubjects] = useState(null)
  const [subjectsLoading, setSubjectsLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [detail, rep] = await Promise.all([
        parentApi.childDetail(studentId),
        parentApi.weeklyReport(studentId),
      ])
      setData(detail.data)
      setReport(rep.data)
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  const loadClassAttendance = async () => {
    if (classAtt) return
    setClassAttLoading(true)
    try { const r = await parentApi.classAttendance(studentId); setClassAtt(r.data) } catch (err) { console.error(err) }
    setClassAttLoading(false)
  }

  const loadTeachers = async () => {
    if (teachers) return
    setTeachersLoading(true)
    try { const r = await parentApi.classTeachers(studentId); setTeachers(r.data || []) } catch (err) { console.error(err) }
    setTeachersLoading(false)
  }

  const loadCompletion = async (hwId) => {
    if (completionData[hwId]) return
    setCompletionLoading(hwId)
    try { const r = await parentApi.homeworkClassCompletion(hwId); setCompletionData((p) => ({ ...p, [hwId]: r.data })) } catch (err) { console.error(err) }
    setCompletionLoading(null)
  }

  const loadSubjects = async () => {
    if (subjects) return
    setSubjectsLoading(true)
    try { const r = await parentApi.childSubjects(studentId); setSubjects(r.data || []) } catch (err) { console.error(err) }
    setSubjectsLoading(false)
  }

  useEffect(() => { load() }, [studentId])
  useEffect(() => { if (tab === 'classattendance') loadClassAttendance() }, [tab])
  useEffect(() => { if (tab === 'teachers') loadTeachers() }, [tab])
  useEffect(() => { if (tab === 'subjects') loadSubjects() }, [tab])

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>
  if (!data) return <div className="text-center py-16 text-sm text-gray-500">Enfant non trouvé</div>

  const { student, gradesBySubject, grades, attendance, homeworks, timetable, todayAttendance, fees } = data

  // Compute per-subject averages for chart
  const subjectAvg = Object.entries(gradesBySubject).map(([subj, gs]) => ({
    name: subj,
    moyenne: Math.round((gs.reduce((s, g) => s + g.value, 0) / gs.length) * 10) / 10,
  }))

  // Attendance pie
  const attStats = { present: 0, absent: 0, late: 0, excused: 0 }
  attendance.forEach((a) => { if (attStats[a.status] !== undefined) attStats[a.status]++ })
  const attPie = Object.entries(attStats).filter(([, v]) => v > 0).map(([k, v]) => ({
    name: k === 'present' ? 'Présent' : k === 'absent' ? 'Absent' : k === 'late' ? 'Retard' : 'Excusé',
    value: v,
  }))

  // Homework stats
  const hwSubmitted = homeworks.filter((h) => h.status === 'submitted').length
  const hwLate = homeworks.filter((h) => h.status === 'late').length
  const hwOverdue = homeworks.filter((h) => h.status === 'overdue').length
  const hwPending = homeworks.filter((h) => h.status === 'pending').length

  // Timetable days
  const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
  const ttByDay = {}
  days.forEach((d) => { ttByDay[d] = (timetable || []).filter((s) => s.day === d).sort((a, b) => a.startTime.localeCompare(b.startTime)) })

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/dashboard" className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft size={18} /></Link>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-14 h-14 rounded-full overflow-hidden bg-blue-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
            {student.photo ? <img src={student.photo} alt="" className="w-full h-full object-cover" /> : student.firstName?.charAt(0)}
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">{student.fullName}</h1>
            <p className="text-xs text-gray-500">{student.class?.name} · {student.cycle} · {student.matricule}</p>
          </div>
        </div>
        <button onClick={load} className="btn-ghost text-xs border border-gray-200"><RefreshCw size={13} /></button>
      </div>

      {/* Weekly Report Banner */}
      {report && (
        <div className="card p-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white">
          <p className="text-xs font-bold mb-1">Rapport hebdomadaire</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <span>Moyenne: <strong>{report.averageGrade ?? '—'}/20</strong></span>
            <span>Présence: <strong>{report.attendance?.present}/{report.attendance?.total} jours</strong></span>
            <span>Devoirs: <strong>{report.homeworkDone}/{report.homeworkTotal} faits</strong></span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${tab === t.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {/* Today's attendance banner */}
          {(() => {
            const STATUS = { present: { label: 'Présent aujourd\'hui', bg: 'bg-green-50 border-green-200', color: 'text-green-700', dot: 'bg-green-500', icon: CheckCircle2 }, absent: { label: 'Absent aujourd\'hui', bg: 'bg-red-50 border-red-200', color: 'text-red-700', dot: 'bg-red-500', icon: XCircle }, late: { label: 'En retard aujourd\'hui', bg: 'bg-amber-50 border-amber-200', color: 'text-amber-700', dot: 'bg-amber-500', icon: AlertTriangle }, excused: { label: 'Excusé aujourd\'hui', bg: 'bg-indigo-50 border-indigo-200', color: 'text-indigo-700', dot: 'bg-indigo-400', icon: CheckCircle2 }, unknown: { label: 'Présence pas encore enregistrée', bg: 'bg-gray-50 border-gray-200', color: 'text-gray-500', dot: 'bg-gray-300', icon: Clock } }
            const ts = STATUS[todayAttendance || 'unknown']
            const Icon = ts.icon
            return (
              <div className={cn('border rounded-xl p-4 flex items-center gap-3', ts.bg)}>
                <span className={cn('w-3 h-3 rounded-full flex-shrink-0', ts.dot)} />
                <Icon size={16} className={cn('flex-shrink-0', ts.color)} />
                <p className={cn('text-sm font-bold', ts.color)}>{ts.label}</p>
              </div>
            )
          })()}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{subjectAvg.length > 0 ? (subjectAvg.reduce((s, a) => s + a.moyenne, 0) / subjectAvg.length).toFixed(1) : '—'}</p>
              <p className="text-xs text-gray-500">Moyenne générale /20</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{attendance.length > 0 ? Math.round((attStats.present / attendance.length) * 100) : 0}%</p>
              <p className="text-xs text-gray-500">Présence</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-purple-600">{hwSubmitted + hwLate}/{homeworks.length}</p>
              <p className="text-xs text-gray-500">Devoirs rendus</p>
            </div>
            <div className="card p-4 text-center">
              <p className={`text-2xl font-bold ${hwOverdue > 0 ? 'text-red-600' : 'text-gray-400'}`}>{hwOverdue}</p>
              <p className="text-xs text-gray-500">En retard</p>
            </div>
          </div>

          {/* Connexion & Activité */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2"><Wifi size={14} className="text-green-600" /> Activité & Connexion</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${data.lastActivity && (new Date() - new Date(data.lastActivity)) < 15 * 60 * 1000 ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                <span className="text-xs text-gray-700">
                  {data.lastActivity && (new Date() - new Date(data.lastActivity)) < 15 * 60 * 1000
                    ? 'En ligne maintenant'
                    : data.lastActivity ? `Dernière connexion: ${new Date(data.lastActivity).toLocaleString('fr-FR')}` : 'Aucune activité'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={13} className="text-blue-500" />
                <span className="text-xs text-gray-700">Temps connecté cette semaine: <strong>{data.weeklyScreenTime ? `${Math.floor(data.weeklyScreenTime / 60)}h${String(data.weeklyScreenTime % 60).padStart(2, '0')}` : '—'}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <CalendarCheck size={13} className="text-purple-500" />
                <span className="text-xs text-gray-700">Jours actifs: <strong>{data.activeDays ?? '—'}/7</strong></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'notes' && (
        <div className="space-y-5">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select value={selectedTerm} onChange={(e) => { setSelectedTerm(e.target.value); setSelectedSeq('') }} className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
              <option value="">Tous les trimestres</option>
              {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={selectedSeq} onChange={(e) => { setSelectedSeq(e.target.value); setSelectedTerm('') }} className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
              <option value="">Toutes les séquences</option>
              {SEQUENCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {(selectedTerm || selectedSeq) && <button onClick={() => { setSelectedTerm(''); setSelectedSeq('') }} className="text-xs text-blue-600 hover:underline">Réinitialiser</button>}
            <button onClick={() => window.print()} className="ml-auto btn-ghost text-xs border border-gray-200 flex items-center gap-1.5"><Download size={13} /> PDF</button>
          </div>
          {subjectAvg.length > 0 ? (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Moyennes par matière{selectedTerm ? ` — ${selectedTerm}` : selectedSeq ? ` — ${selectedSeq}` : ''}</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={subjectAvg}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis domain={[0, 20]} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="moyenne" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-sm text-gray-400 text-center py-8">Aucune note enregistrée</p>}

          {Object.entries(gradesBySubject).map(([subj, gs]) => {
            const filtered = gs.filter((g) => {
              if (selectedSeq) return g.sequence === selectedSeq
              if (selectedTerm) return g.term === selectedTerm
              return true
            })
            if (filtered.length === 0) return null
            const avg = (filtered.reduce((s, g) => s + g.value, 0) / filtered.length).toFixed(1)
            return (
              <div key={subj} className="card p-4">
                <h4 className="text-sm font-bold text-gray-800 mb-2">{subj} <span className="text-xs text-gray-400 font-normal">— Moy: {avg}/20</span></h4>
                <div className="space-y-1">
                  {filtered.map((g, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0 text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${g.value >= 10 ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-gray-600 capitalize">{g.type}</span>
                        {g.sequence && <span className="bg-purple-100 text-purple-700 px-1.5 rounded text-[10px]">{g.sequence}</span>}
                        {!g.sequence && g.term && <span className="bg-blue-100 text-blue-700 px-1.5 rounded text-[10px]">{g.term}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {g.comment && <span className="text-gray-400 truncate max-w-[120px]">{g.comment}</span>}
                        <span className={`font-bold ${g.value >= 10 ? 'text-green-600' : 'text-red-600'}`}>{g.value}/20</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'attendance' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Répartition</h3>
              {attPie.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={attPie} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name} (${value})`} labelLine={false}>
                      {attPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-gray-400 text-center py-8">Aucune donnée</p>}
            </div>
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Statistiques</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm"><span className="text-gray-500">Total jours</span><span className="font-bold">{attendance.length}</span></div>
                <div className="flex justify-between text-sm"><span className="text-green-600">Présent</span><span className="font-bold text-green-600">{attStats.present}</span></div>
                <div className="flex justify-between text-sm"><span className="text-red-600">Absent</span><span className="font-bold text-red-600">{attStats.absent}</span></div>
                <div className="flex justify-between text-sm"><span className="text-amber-600">Retard</span><span className="font-bold text-amber-600">{attStats.late}</span></div>
                <div className="flex justify-between text-sm"><span className="text-indigo-600">Excusé</span><span className="font-bold text-indigo-600">{attStats.excused}</span></div>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Historique récent</h3>
            <div className="space-y-1">
              {attendance.slice(0, 20).map((a, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0 text-xs">
                  <span className="text-gray-600">{new Date(a.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                  <span className={`px-2 py-0.5 rounded-full font-medium ${a.status === 'present' ? 'bg-green-100 text-green-700' : a.status === 'absent' ? 'bg-red-100 text-red-700' : a.status === 'late' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                    {a.status === 'present' ? 'Présent' : a.status === 'absent' ? 'Absent' : a.status === 'late' ? 'Retard' : 'Excusé'}
                  </span>
                </div>
              ))}
              {attendance.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Aucun enregistrement</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── PRÉSENCE DE LA CLASSE ── */}
      {tab === 'classattendance' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-blue-600" />
            <h3 className="text-sm font-bold text-gray-900">Présence de la classe — {classAtt?.class?.name}</h3>
          </div>
          {classAttLoading ? (
            <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-blue-600" /></div>
          ) : !classAtt ? (
            <p className="text-center text-sm text-gray-400 py-8">Aucune donnée de présence</p>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Élève</th>
                    <th className="text-center text-xs font-semibold text-gray-500 px-3 py-3">✅</th>
                    <th className="text-center text-xs font-semibold text-gray-500 px-3 py-3">❌</th>
                    <th className="text-center text-xs font-semibold text-gray-500 px-3 py-3">⏰</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(classAtt.students || []).map((s) => (
                    <tr key={s._id} className={`${s.isMyChild ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">
                        {s.name}{s.isMyChild && <span className="ml-1 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Mon enfant</span>}
                      </td>
                      <td className="px-3 py-2 text-center text-xs text-green-600 font-bold">{s.presentCount}</td>
                      <td className="px-3 py-2 text-center text-xs text-red-500 font-bold">{s.absentCount}</td>
                      <td className="px-3 py-2 text-center text-xs text-amber-500 font-bold">{s.lateCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── ENSEIGNANTS DE LA CLASSE ── */}
      {tab === 'teachers' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <GraduationCap size={16} className="text-blue-600" />
            <h3 className="text-sm font-bold text-gray-900">Enseignants de la classe</h3>
          </div>
          {teachersLoading ? (
            <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-blue-600" /></div>
          ) : !teachers || teachers.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">Aucun enseignant enregistré pour cette classe</p>
          ) : (
            teachers.map((t) => (
              <div key={t._id} className="card p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                  {t.firstName?.[0]}{t.lastName?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">{t.lastName} {t.firstName}</p>
                  <p className="text-xs text-blue-600">{(t.subjects || []).join(', ') || t.speciality}</p>
                </div>
                <div className="text-right space-y-0.5">
                  {t.phone && <p className="text-xs text-gray-500 flex items-center gap-1 justify-end"><Phone size={11} />{t.phone}</p>}
                  {t.email && <p className="text-xs text-gray-400 flex items-center gap-1 justify-end"><Mail size={11} />{t.email}</p>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'homework' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="card p-3 text-center"><p className="text-lg font-bold text-gray-900">{homeworks.length}</p><p className="text-[10px] text-gray-500">Total devoirs</p></div>
            <div className="card p-3 text-center"><p className="text-lg font-bold text-green-600">{hwSubmitted}</p><p className="text-[10px] text-gray-500">Rendus</p></div>
            <div className="card p-3 text-center"><p className="text-lg font-bold text-amber-600">{hwLate}</p><p className="text-[10px] text-gray-500">En retard</p></div>
            <div className="card p-3 text-center"><p className="text-lg font-bold text-red-600">{hwOverdue}</p><p className="text-[10px] text-gray-500">Non rendus</p></div>
          </div>

          {homeworks.map((h) => (
            <div key={h._id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">{h.title}</p>
                  <p className="text-xs text-gray-500">{h.subject} · {h.type}</p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                    <span>Assigné: {new Date(h.assignedDate).toLocaleDateString('fr-FR')}</span>
                    <span>Échéance: {new Date(h.dueDate).toLocaleDateString('fr-FR')}</span>
                  </div>
                  {/* Teacher completion status */}
                  <div className="flex items-center gap-2 mt-2">
                    {h.teacherMarkedDone
                      ? <span className="inline-flex items-center gap-1 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold"><CheckCircle2 size={10} /> Fait (confirmé par l'enseignant)</span>
                      : <span className="inline-flex items-center gap-1 text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full"><XCircle size={10} /> Pas encore marqué fait</span>
                    }
                  </div>
                </div>
                <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap flex-shrink-0',
                  h.status === 'submitted' ? 'bg-green-100 text-green-700' :
                  h.status === 'late' ? 'bg-amber-100 text-amber-700' :
                  h.status === 'overdue' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-500'
                )}>
                  {h.status === 'submitted' ? 'Rendu' : h.status === 'late' ? 'Rendu en retard' : h.status === 'overdue' ? 'Non rendu' : 'En attente'}
                </span>
              </div>
              {h.grade != null && <p className="text-xs text-blue-600 mt-1 font-medium">Note: {h.grade}/20</p>}
              {h.description && <p className="text-xs text-gray-400 mt-1 italic">{h.description}</p>}
            </div>
          ))}
          {homeworks.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Aucun devoir enregistré</p>}
        </div>
      )}

      {/* ── COMPLÉTION DE LA CLASSE PAR DEVOIR ── */}
      {tab === 'completion' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <ListChecks size={16} className="text-blue-600" />
            <h3 className="text-sm font-bold text-gray-900">Qui a fait ses devoirs dans la classe ?</h3>
          </div>
          <p className="text-xs text-gray-500 -mt-2">Cliquez sur un devoir pour voir la liste complète de la classe.</p>
          {homeworks.length === 0 && <p className="text-center text-sm text-gray-400 py-8">Aucun devoir</p>}
          {homeworks.map((h) => {
            const isExpanded = expandedHw === h._id
            const cd = completionData[h._id]
            return (
              <div key={h._id} className="card overflow-hidden">
                <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors" onClick={() => { setExpandedHw(isExpanded ? null : h._id); if (!isExpanded) loadCompletion(h._id) }}>
                  <div className="flex items-center gap-3">
                    {h.teacherMarkedDone
                      ? <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
                      : <XCircle size={16} className="text-gray-300 flex-shrink-0" />}
                    <div className="text-left">
                      <p className="text-sm font-bold text-gray-900">{h.title}</p>
                      <p className="text-xs text-gray-500">{h.subject} · Échéance: {new Date(h.dueDate).toLocaleDateString('fr-FR')}</p>
                    </div>
                  </div>
                  {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                </button>
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                    {completionLoading === h._id ? (
                      <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-blue-500" /></div>
                    ) : cd ? (
                      <div>
                        <div className="flex items-center gap-4 mb-3 text-xs">
                          <span className="text-green-600 font-bold">✅ {cd.stats?.done} fait(s)</span>
                          <span className="text-red-500 font-bold">❌ {cd.stats?.notDone} pas fait(s)</span>
                          <span className="text-gray-400">/ {cd.stats?.total} élèves</span>
                        </div>
                        <div className="space-y-1">
                          {(cd.completion || []).map((s) => (
                            <div key={s._id} className={cn('flex items-center justify-between py-1.5 px-2 rounded-lg text-xs', s.isMyChild ? 'bg-blue-50' : '')}>
                              <span className="text-gray-800">{s.name}{s.isMyChild && <span className="ml-1 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Mon enfant</span>}</span>
                              {s.done
                                ? <span className="flex items-center gap-1 text-green-600 font-semibold"><CheckCircle2 size={12} /> Fait</span>
                                : <span className="flex items-center gap-1 text-red-400"><XCircle size={12} /> Pas fait</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : <p className="text-xs text-gray-400 text-center py-2">Impossible de charger les données</p>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── MATIÈRES DE L'ÉCOLE ── */}
      {tab === 'subjects' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ClipboardList size={16} className="text-purple-600" />
            <h3 className="text-sm font-bold text-gray-900">Matières enseignées à {student.class?.name || 'la classe'}</h3>
          </div>
          {subjectsLoading ? (
            <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-purple-600" /></div>
          ) : !subjects || subjects.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">Aucune matière enregistrée pour cette école</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {subjects.map((s) => (
                <div key={s._id} className={cn('card p-4 border', s.isInChildClass ? 'border-purple-200 bg-purple-50/30' : 'border-gray-100')}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900">{s.name}</p>
                      {s.code && <p className="text-[10px] text-gray-400">Code: {s.code}</p>}
                    </div>
                    {s.isInChildClass && <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">Dans sa classe</span>}
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] mb-2">
                    {s.coefficient != null && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Coef. {s.coefficient}</span>}
                    {s.hoursPerWeek != null && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">{s.hoursPerWeek}h/semaine</span>}
                    {s.cycle && <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{s.cycle}</span>}
                  </div>
                  {s.teacher && (
                    <div className="text-xs text-gray-600 border-t border-gray-100 pt-2 mt-2">
                      <p className="flex items-center gap-1"><GraduationCap size={11} className="text-blue-500" /> <span className="font-semibold">{s.teacher.lastName} {s.teacher.firstName}</span></p>
                      {s.teacher.phone && <p className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5"><Phone size={10} />{s.teacher.phone}</p>}
                    </div>
                  )}
                  {s.description && <p className="text-[10px] text-gray-500 mt-2 italic line-clamp-2">{s.description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── FRAIS & TRANCHES ── */}
      {tab === 'fees' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Banknote size={16} className="text-blue-600" />
            <h3 className="text-sm font-bold text-gray-900">Frais de scolarité</h3>
          </div>
          {(!fees || fees.length === 0) && <p className="text-center text-sm text-gray-400 py-8">Aucun frais enregistré</p>}
          {(fees || []).map((f) => (
            <div key={f._id} className="card p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-gray-900">{f.label}</p>
                  <p className="text-xs text-gray-500">{f.paymentMode === 'tranches' ? `Paiement par tranches` : 'Paiement complet'}</p>
                </div>
                <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold', f.status === 'paid' ? 'bg-green-100 text-green-700' : f.status === 'partial' ? 'bg-amber-100 text-amber-700' : f.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500')}>
                  {f.status === 'paid' ? 'Payé' : f.status === 'partial' ? 'Partiel' : f.status === 'overdue' ? 'En retard' : 'En attente'}
                </span>
              </div>
              {/* Progress bar */}
              <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Payé: <strong className="text-green-600">{f.paid.toLocaleString()} F CFA</strong></span>
                  <span>Total: <strong>{f.amount.toLocaleString()} F CFA</strong></span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${Math.min(100, Math.round((f.paid / f.amount) * 100))}%` }} />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Restant: <strong className={f.remaining > 0 ? 'text-red-600' : 'text-green-600'}>{f.remaining.toLocaleString()} F CFA</strong></p>
              </div>
              {/* Installments */}
              {f.paymentMode === 'tranches' && f.installments.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1"><Clock size={12} /> Tranches ({f.pendingInstallments} restante{f.pendingInstallments > 1 ? 's' : ''})</p>
                  <div className="space-y-1">
                    {f.installments.map((inst, i) => (
                      <div key={i} className={cn('flex items-center justify-between py-1.5 px-3 rounded-lg text-xs', inst.paid ? 'bg-green-50' : new Date(inst.dueDate) < new Date() ? 'bg-red-50' : 'bg-gray-50')}>
                        <div>
                          <p className="font-medium text-gray-800">{inst.label}</p>
                          <p className="text-[10px] text-gray-400">Échéance: {new Date(inst.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">{inst.amount.toLocaleString()} F</p>
                          {inst.paid
                            ? <span className="text-green-600 flex items-center gap-0.5 justify-end"><CheckCircle2 size={10} /> Payé</span>
                            : <span className={cn('font-semibold', new Date(inst.dueDate) < new Date() ? 'text-red-600' : 'text-amber-600')}>En attente</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'timetable' && (
        <div className="space-y-4">
          {days.map((day) => {
            const slots = ttByDay[day]
            if (!slots || slots.length === 0) return null
            return (
              <div key={day} className="card p-4">
                <h4 className="text-sm font-bold text-gray-800 mb-2">{day}</h4>
                <div className="space-y-1">
                  {slots.map((s, i) => (
                    <div key={i} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                      <span className="text-xs text-gray-500 w-[80px]">{s.startTime} - {s.endTime}</span>
                      <div className="w-1 h-6 rounded-full" style={{ backgroundColor: s.color || '#3B82F6' }} />
                      <div>
                        <p className="text-xs font-medium text-gray-800">{s.subject}</p>
                        {s.teacher && <p className="text-[10px] text-gray-400">{s.teacher} {s.room ? `· ${s.room}` : ''}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          {timetable.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Emploi du temps non disponible</p>}
        </div>
      )}
    </div>
  )
}
