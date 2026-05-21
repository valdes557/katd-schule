import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, BarChart, Bar,
} from 'recharts'
import {
  Users, UserCheck, BookOpen, TrendingUp, RefreshCw,
  ArrowRight, Calendar, CreditCard, AlertCircle, CheckCircle2, Loader2,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { dashboardApi } from '../lib/api'

const PIE_COLORS = ['#3B82F6', '#F59E0B', '#10B981']

export default function DashboardPage() {
  const { user, school } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchStats = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await dashboardApi.getStats()
      setStats(res.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStats() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin text-blue-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <AlertCircle size={36} className="mx-auto text-red-400 mb-3" />
        <p className="text-sm text-gray-600">{error}</p>
        <button onClick={fetchStats} className="btn-primary text-sm mt-4">Réessayer</button>
      </div>
    )
  }

  const s = stats || {}

  const statsCards = [
    { title: 'Total Élèves', value: s.totalStudents || 0, icon: Users, iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
    { title: 'Enseignants', value: s.totalTeachers || 0, icon: UserCheck, iconBg: 'bg-teal-100', iconColor: 'text-teal-600' },
    { title: 'Classes', value: s.totalClasses || 0, icon: BookOpen, iconBg: 'bg-orange-100', iconColor: 'text-orange-500' },
    { title: 'Taux présence', value: `${s.attendanceRate || 0}%`, icon: TrendingUp, iconBg: 'bg-green-100', iconColor: 'text-green-600' },
  ]

  const pieData = (s.studentsByCycle || []).map((c) => ({ name: c._id || 'Non défini', value: c.count }))
  const gradeData = (s.gradesBySubject || []).map((g) => ({ name: g._id, moyenne: Math.round(g.average * 10) / 10 }))
  const attendanceChart = (s.recentAttendance || []).map((d) => ({
    date: d._id.slice(5),
    présents: d.present,
    absents: d.absent,
  }))

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Bonjour, {user?.name || 'Directeur'} 👋
          </h1>
          <p className="text-sm text-gray-500">{school?.name || 'Mon école'}</p>
        </div>
        <button onClick={fetchStats} className="btn-ghost text-xs border border-gray-200 self-start">
          <RefreshCw size={13} /> Actualiser
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((card) => (
          <div key={card.title} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.iconBg}`}>
                <card.icon size={18} className={card.iconColor} />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{card.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{card.title}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Grades by subject */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Moyennes par matière</h3>
          {gradeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={gradeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis domain={[0, 20]} fontSize={11} />
                <Tooltip />
                <Bar dataKey="moyenne" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 py-12 text-center">Aucune note enregistrée</p>
          )}
        </div>

        {/* Pie chart students by cycle */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Élèves par cycle</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} fill="#8884d8" dataKey="value" label={({ name, value }) => `${name} (${value})`} labelLine={false}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 py-12 text-center">Aucune donnée</p>
          )}
        </div>
      </div>

      {/* Attendance chart */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Présence des 7 derniers jours</h3>
        {attendanceChart.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={attendanceChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Area type="monotone" dataKey="présents" stroke="#10B981" fill="#D1FAE5" />
              <Area type="monotone" dataKey="absents" stroke="#EF4444" fill="#FEE2E2" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-gray-400 py-12 text-center">Aucun appel enregistré cette semaine</p>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Gérer les élèves', path: '/dashboard/eleves', icon: Users, color: 'text-blue-600' },
          { label: 'Saisir des notes', path: '/dashboard/notes', icon: BookOpen, color: 'text-purple-600' },
          { label: 'Faire l\'appel', path: '/dashboard/presence', icon: Calendar, color: 'text-green-600' },
          { label: 'Souscriptions', path: '/dashboard/souscriptions', icon: CreditCard, color: 'text-orange-600' },
        ].map((q) => (
          <Link key={q.path} to={q.path} className="card p-4 flex items-center gap-3 hover:shadow-card-lg transition-shadow group">
            <q.icon size={18} className={q.color} />
            <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{q.label}</span>
            <ArrowRight size={14} className="ml-auto text-gray-300 group-hover:text-gray-500" />
          </Link>
        ))}
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Résumé académique</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Moyenne générale</span>
              <span className="font-bold text-gray-900">{s.averageGrade || '—'} / 20</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Contenus multimédias</span>
              <span className="font-bold text-gray-900">{s.totalMedia || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Messages non lus</span>
              <span className="font-bold text-blue-600">{s.unreadMessages || 0}</span>
            </div>
          </div>
        </div>
        <div className="card p-5 bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={16} />
            <span className="text-sm font-semibold">Abonnement Actif</span>
          </div>
          <p className="text-blue-100 text-xs mb-3">Votre abonnement est en cours de validité.</p>
          <Link to="/dashboard/souscriptions" className="text-xs font-medium text-white underline underline-offset-2">
            Voir les détails →
          </Link>
        </div>
      </div>
    </div>
  )
}
