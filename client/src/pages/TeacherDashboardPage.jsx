import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users, BookOpen, CalendarCheck, FileText, Clock, Loader2, RefreshCw,
  ArrowRight, AlertTriangle, AlertCircle, XCircle, TrendingUp, BarChart2,
  ClipboardList, CheckCircle2, GraduationCap, Bell,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { teacherApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'

export default function TeacherDashboardPage() {
  const { user } = useAuth()

  const dashboardQ = useCachedFetch('/teacher/dashboard?', async () => (await teacherApi.dashboard()).data || null, [])

  const data = dashboardQ.data
  const loading = dashboardQ.loading

  const handleRefresh = () => { cache.invalidate('/teacher/dashboard'); dashboardQ.refetch() }

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>
  if (!data) return <div className="text-center py-16 text-sm text-gray-500">Profil enseignant non trouvé. Contactez l'administration.</div>

  const { teacher, stats, alerts, recentGrades, upcomingHomework, announcements = [] } = data

  const statCards = [
    { title: 'Mes élèves', value: stats.totalStudents, icon: Users, bg: 'bg-blue-100', color: 'text-blue-600' },
    { title: 'Mes classes', value: stats.totalClasses, icon: BookOpen, bg: 'bg-purple-100', color: 'text-purple-600' },
    { title: 'Taux de présence', value: `${stats.attendanceRate}%`, icon: CalendarCheck, bg: 'bg-green-100', color: 'text-green-600' },
    { title: 'Moyenne générale', value: stats.averageGrade ? `${stats.averageGrade}/20` : '—', icon: TrendingUp, bg: 'bg-indigo-100', color: 'text-indigo-600' },
    { title: 'Devoirs créés', value: stats.homeworkTotal, icon: ClipboardList, bg: 'bg-amber-100', color: 'text-amber-600' },
    { title: 'Absences', value: stats.totalAbsences, icon: XCircle, bg: stats.totalAbsences > 0 ? 'bg-red-100' : 'bg-gray-100', color: stats.totalAbsences > 0 ? 'text-red-600' : 'text-gray-500' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Bonjour, {teacher.firstName} {teacher.lastName} 👋</h1>
          <p className="text-sm text-gray-500">
            {teacher.subjects?.join(', ') || teacher.speciality || 'Enseignant'} · {stats.totalClasses} classe(s)
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {teacher.cycle && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                <GraduationCap size={11} /> Cycle : {teacher.cycle}
              </span>
            )}
            {(teacher.classes || []).slice(0, 3).map((c) => (
              <span key={c._id} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                <BookOpen size={11} /> {c.name}{c.room ? ` · Salle ${c.room}` : ''}
              </span>
            ))}
            {(teacher.classes || []).length > 3 && (
              <span className="text-[11px] text-gray-400 self-center">+{teacher.classes.length - 3} autres</span>
            )}
          </div>
        </div>
        <button onClick={handleRefresh} className="btn-ghost text-xs border border-gray-200 self-start"><RefreshCw size={13} /> Actualiser</button>
      </div>

      {/* Smart Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className={`flex items-start gap-3 p-3 rounded-xl text-sm ${a.type === 'danger' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
              {a.type === 'danger' ? <AlertCircle size={16} className="mt-0.5 flex-shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />}
              <span>{a.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <div key={card.title} className="card p-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.bg} mb-3`}>
              <card.icon size={18} className={card.color} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{card.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{card.title}</div>
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* My Classes */}
        <div className="card p-5">
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-3"><BookOpen size={15} /> Mes classes</h2>
          {(teacher.classes || []).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Aucune classe assignée</p>
          ) : (
            <div className="space-y-2">
              {teacher.classes.map((c) => (
                <Link key={c._id} to="/dashboard/classes" className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors group">
                  <div>
                    <p className="text-sm font-bold text-gray-800">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.level} · {c.cycle}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{c.stats?.totalStudents || 0} élèves</span>
                    <ArrowRight size={13} className="text-gray-300 group-hover:text-blue-500" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Homework */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2"><ClipboardList size={15} /> Devoirs à venir</h2>
            <Link to="/dashboard/devoirs" className="text-xs text-blue-600 hover:underline">Tout voir</Link>
          </div>
          {upcomingHomework.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Aucun devoir planifié</p>
          ) : (
            <div className="space-y-2">
              {upcomingHomework.map((h) => {
                const daysLeft = Math.ceil((new Date(h.dueDate) - new Date()) / (1000 * 60 * 60 * 24))
                return (
                  <div key={h._id} className="p-3 rounded-xl bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-800">{h.title}</p>
                        <p className="text-xs text-gray-500">{h.subject} · {h.class?.name}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${daysLeft <= 1 ? 'bg-red-100 text-red-700' : daysLeft <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                        {daysLeft <= 0 ? "Aujourd'hui" : `${daysLeft}j restant${daysLeft > 1 ? 's' : ''}`}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">{h.submissionCount} soumission(s)</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Grades + Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {recentGrades.length > 0 && (
          <div className="card p-5">
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-3"><GraduationCap size={15} /> Notes récentes</h2>
            <div className="space-y-1">
              {recentGrades.map((g) => (
                <div key={g._id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${g.value >= 10 ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="font-medium text-gray-700">{g.student?.firstName} {g.student?.lastName}</span>
                    <span className="text-gray-400">· {g.subject}</span>
                  </div>
                  <span className={`font-bold ${g.value >= 10 ? 'text-green-600' : 'text-red-600'}`}>{g.value}/20</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {announcements.length > 0 && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2"><Bell size={15} /> Annonces de l'école</h2>
              <Link to="/dashboard/annonces" className="text-[11px] text-blue-600 hover:underline">Voir tout</Link>
            </div>
            <div className="space-y-2">
              {announcements.map((a) => (
                <div key={a._id} className="text-xs border-b border-gray-50 last:border-0 pb-2">
                  <div className="font-semibold text-gray-800 truncate">{a.title || 'Annonce'}</div>
                  <div className="text-gray-500 line-clamp-2 text-[11px]">{a.content}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{new Date(a.createdAt).toLocaleDateString('fr-FR')}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Devoirs & Évaluations', path: '/dashboard/devoirs', icon: ClipboardList, color: 'text-purple-600' },
          { label: 'Notes & Bulletins', path: '/dashboard/notes', icon: FileText, color: 'text-blue-600' },
          { label: 'Présence', path: '/dashboard/presence', icon: CalendarCheck, color: 'text-green-600' },
          { label: 'Statistiques', path: '/dashboard/teacher/analytics', icon: BarChart2, color: 'text-amber-600' },
        ].map((q) => (
          <Link key={q.path} to={q.path} className="card p-4 flex items-center gap-3 hover:shadow-card-lg transition-shadow group">
            <q.icon size={18} className={q.color} />
            <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{q.label}</span>
            <ArrowRight size={14} className="ml-auto text-gray-300 group-hover:text-gray-500" />
          </Link>
        ))}
      </div>
    </div>
  )
}
