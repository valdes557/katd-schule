import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, BarChart, Bar, Legend,
} from 'recharts'
import {
  Loader2, AlertCircle, RefreshCw, Users, UserCheck, BookOpen, TrendingUp,
  ClipboardList, Star, PieChart as PieIcon,
} from 'lucide-react'
import { dashboardApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4']

export default function DirectorStatisticsPage() {
  const statsQ = useCachedFetch('/dashboard/stats?', async () => {
    const res = await dashboardApi.getStats()
    return res.data || null
  }, [])
  const hwQ = useCachedFetch('/dashboard/homework-overview', async () => {
    const res = await dashboardApi.homeworkOverview()
    return res.data || { classes: [], byTeacher: [], summary: {} }
  }, [])

  const loading = statsQ.loading || hwQ.loading
  const refresh = () => {
    cache.invalidate('/dashboard/stats'); cache.invalidate('/dashboard/homework-overview')
    statsQ.refetch(); hwQ.refetch()
  }

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>
  if (statsQ.error) return <div className="text-center py-16"><AlertCircle size={36} className="mx-auto text-red-400 mb-3" /><p className="text-sm text-gray-600">{statsQ.error.message}</p><button onClick={refresh} className="btn-primary text-sm mt-4">Réessayer</button></div>

  const s = statsQ.data || {}
  const hw = hwQ.data || { byTeacher: [], summary: {} }
  const hwSummary = hw.summary || {}

  const kpis = [
    { title: 'Élèves', value: s.totalStudents || 0, icon: Users, bg: 'bg-blue-100', color: 'text-blue-600' },
    { title: 'Enseignants', value: s.totalTeachers || 0, icon: UserCheck, bg: 'bg-teal-100', color: 'text-teal-600' },
    { title: 'Classes', value: s.totalClasses || 0, icon: BookOpen, bg: 'bg-orange-100', color: 'text-orange-500' },
    { title: 'Taux de présence', value: `${s.attendanceRate || 0}%`, icon: TrendingUp, bg: 'bg-green-100', color: 'text-green-600' },
    { title: 'Moyenne générale', value: `${s.averageGrade || 0}/20`, icon: Star, bg: 'bg-amber-100', color: 'text-amber-600' },
    { title: 'Devoirs donnés', value: hwSummary.totalHomeworks || 0, icon: ClipboardList, bg: 'bg-purple-100', color: 'text-purple-600' },
    { title: 'Devoirs corrigés', value: `${hwSummary.gradedRate || 0}%`, icon: ClipboardList, bg: 'bg-green-100', color: 'text-green-600' },
    { title: 'Contenus multimédias', value: s.totalMedia || 0, icon: PieIcon, bg: 'bg-indigo-100', color: 'text-indigo-600' },
  ]

  const gradeData = (s.gradesBySubject || []).map((g) => ({ name: g._id, moyenne: Math.round((g.average || 0) * 10) / 10 }))
  const pieData = (s.studentsByCycle || []).map((c) => ({ name: c._id || 'Non défini', value: c.count }))
  const attendanceChart = (s.recentAttendance || []).map((d) => ({ date: (d._id || '').slice(5), présents: d.present, absents: d.absent }))
  const teacherHw = (hw.byTeacher || []).map((t) => ({
    name: t.teacherName,
    corrigés: t.correctedHomeworks,
    'à corriger': t.pendingCorrection,
  }))

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><PieIcon size={22} className="text-blue-600" /> Statistiques</h1>
          <p className="text-sm text-gray-500">Vue d'ensemble chiffrée de votre établissement</p>
        </div>
        <button onClick={refresh} className="btn-ghost text-xs border border-gray-200 self-start bg-white"><RefreshCw size={13} /> Actualiser</button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map((k) => (
          <div key={k.title} className="card p-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${k.bg} mb-3`}><k.icon size={18} className={k.color} /></div>
            <div className="text-2xl font-bold text-gray-900">{k.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{k.title}</div>
          </div>
        ))}
      </div>

      {/* Moyennes par matière + élèves par cycle */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Moyennes par matière</h3>
          {gradeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}><BarChart data={gradeData}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" /><XAxis dataKey="name" fontSize={11} /><YAxis domain={[0, 20]} fontSize={11} /><Tooltip /><Bar dataKey="moyenne" fill="#3B82F6" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 py-12 text-center">Aucune note enregistrée</p>}
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Élèves par cycle</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}><PieChart><Pie data={pieData} cx="50%" cy="50%" outerRadius={75} dataKey="value" label={({ name, value }) => `${name} (${value})`} labelLine={false}>{pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 py-12 text-center">Aucune donnée</p>}
        </div>
      </div>

      {/* Présence 7 jours */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Présence des 7 derniers jours</h3>
        {attendanceChart.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}><AreaChart data={attendanceChart}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" /><XAxis dataKey="date" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Area type="monotone" dataKey="présents" stroke="#10B981" fill="#D1FAE5" /><Area type="monotone" dataKey="absents" stroke="#EF4444" fill="#FEE2E2" /></AreaChart></ResponsiveContainer>
        ) : <p className="text-sm text-gray-400 py-12 text-center">Aucun appel enregistré cette semaine</p>}
      </div>

      {/* Suivi des devoirs par enseignant */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Devoirs corrigés vs à corriger (par enseignant)</h3>
        {teacherHw.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(220, teacherHw.length * 42)}>
            <BarChart data={teacherHw} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" fontSize={11} allowDecimals={false} />
              <YAxis type="category" dataKey="name" fontSize={11} width={120} />
              <Tooltip />
              <Legend />
              <Bar dataKey="corrigés" stackId="a" fill="#10B981" radius={[0, 4, 4, 0]} />
              <Bar dataKey="à corriger" stackId="a" fill="#F59E0B" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <p className="text-sm text-gray-400 py-12 text-center">Aucun devoir enregistré</p>}
      </div>
    </div>
  )
}
