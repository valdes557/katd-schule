import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import {
  ArrowLeft, BookOpen, CalendarCheck, FileText, Clock, CheckCircle2,
  XCircle, AlertTriangle, Loader2, RefreshCw, User,
} from 'lucide-react'
import { parentApi } from '../lib/api'

const PIE_COLORS = ['#10B981', '#EF4444', '#F59E0B', '#6366F1']
const TABS = [
  { id: 'overview', label: 'Vue d\'ensemble', icon: User },
  { id: 'notes', label: 'Notes', icon: BookOpen },
  { id: 'attendance', label: 'Présence', icon: CalendarCheck },
  { id: 'homework', label: 'Devoirs', icon: FileText },
  { id: 'timetable', label: 'Emploi du temps', icon: Clock },
]

export default function ParentChildDetailPage() {
  const { studentId } = useParams()
  const [data, setData] = useState(null)
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')

  const load = async () => {
    setLoading(true)
    try {
      const [detail, rep] = await Promise.all([
        parentApi.childDetail(studentId),
        parentApi.weeklyReport(studentId),
      ])
      setData(detail.data)
      setReport(rep.data)
    } catch (_) {}
    setLoading(false)
  }
  useEffect(() => { load() }, [studentId])

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>
  if (!data) return <div className="text-center py-16 text-sm text-gray-500">Enfant non trouvé</div>

  const { student, gradesBySubject, grades, attendance, homeworks, timetable } = data

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
      )}

      {tab === 'notes' && (
        <div className="space-y-5">
          {subjectAvg.length > 0 ? (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Moyennes par matière</h3>
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

          {Object.entries(gradesBySubject).map(([subj, gs]) => (
            <div key={subj} className="card p-4">
              <h4 className="text-sm font-bold text-gray-800 mb-2">{subj} <span className="text-xs text-gray-400 font-normal">— Moy: {(gs.reduce((s, g) => s + g.value, 0) / gs.length).toFixed(1)}/20</span></h4>
              <div className="space-y-1">
                {gs.map((g, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0 text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${g.value >= 10 ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-gray-600 capitalize">{g.type}</span>
                      <span className="text-gray-400">{g.term}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {g.comment && <span className="text-gray-400 truncate max-w-[120px]">{g.comment}</span>}
                      <span className={`font-bold ${g.value >= 10 ? 'text-green-600' : 'text-red-600'}`}>{g.value}/20</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
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
                <div>
                  <p className="text-sm font-bold text-gray-900">{h.title}</p>
                  <p className="text-xs text-gray-500">{h.subject} · {h.type}</p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                    <span>Assigné: {new Date(h.assignedDate).toLocaleDateString('fr-FR')}</span>
                    <span>Échéance: {new Date(h.dueDate).toLocaleDateString('fr-FR')}</span>
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                  h.status === 'submitted' ? 'bg-green-100 text-green-700' :
                  h.status === 'late' ? 'bg-amber-100 text-amber-700' :
                  h.status === 'overdue' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {h.status === 'submitted' ? 'Rendu' : h.status === 'late' ? 'Rendu en retard' : h.status === 'overdue' ? 'Non rendu' : 'En attente'}
                </span>
              </div>
              {h.grade != null && <p className="text-xs text-blue-600 mt-1 font-medium">Note: {h.grade}/20</p>}
            </div>
          ))}
          {homeworks.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Aucun devoir enregistré</p>}
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
