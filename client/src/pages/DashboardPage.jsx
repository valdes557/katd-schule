import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, BarChart, Bar,
} from 'recharts'
import {
  Users, UserCheck, BookOpen, TrendingUp, RefreshCw, School,
  ArrowRight, Calendar, CreditCard, AlertCircle, CheckCircle2, Loader2, DollarSign, UserPlus,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { dashboardApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'
import ParentDashboardPage from './ParentDashboardPage'
import TeacherDashboardPage from './TeacherDashboardPage'
import AppLauncher from '../components/layout/AppLauncher'

const PIE_COLORS = ['#3B82F6', '#F59E0B', '#10B981']

/* ─── Admin Dashboard ─── */
function AdminDashboard({ user }) {
  const statsQ = useCachedFetch('/dashboard/admin-stats?', async () => {
    const r = await dashboardApi.getAdminStats()
    return r.data || null
  }, [])

  const loading = statsQ.loading
  const stats = statsQ.data

  const refreshStats = () => { cache.invalidate('/dashboard/admin-stats'); statsQ.refetch() }

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>
  const s = stats || {}

  const cards = [
    { title: 'Écoles', value: s.totalSchools || 0, icon: School, bg: 'bg-blue-100', color: 'text-blue-600' },
    { title: 'Directeurs', value: s.totalDirectors || 0, icon: UserCheck, bg: 'bg-teal-100', color: 'text-teal-600' },
    { title: 'Enseignants', value: s.totalTeachers || 0, icon: Users, bg: 'bg-purple-100', color: 'text-purple-600' },
    { title: 'Élèves', value: s.totalStudents || 0, icon: BookOpen, bg: 'bg-orange-100', color: 'text-orange-500' },
    { title: 'Demandes en attente', value: s.pendingRegistrations || 0, icon: UserPlus, bg: 'bg-amber-100', color: 'text-amber-600' },
    { title: 'Revenus totaux', value: `${(s.totalRevenue || 0).toLocaleString()} F`, icon: DollarSign, bg: 'bg-green-100', color: 'text-green-600' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Administration KATD-SCHÜLE 🛡️</h1>
          <p className="text-sm text-gray-500">Vue d'ensemble de la plateforme</p>
        </div>
        <button onClick={refreshStats} className="btn-ghost text-xs border border-gray-200 self-start"><RefreshCw size={13} /> Actualiser</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.title} className="card p-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.bg} mb-3`}><c.icon size={18} className={c.color} /></div>
            <div className="text-2xl font-bold text-gray-900">{c.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{c.title}</div>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Gérer les écoles', path: '/dashboard/ecoles-admin', icon: School, color: 'text-blue-600' },
          { label: 'Demandes d\'écoles', path: '/dashboard/demandes-ecoles', icon: UserPlus, color: 'text-amber-600' },
          { label: 'Souscriptions', path: '/dashboard/souscriptions', icon: CreditCard, color: 'text-green-600' },
          { label: 'Paiements', path: '/dashboard/paiements', icon: DollarSign, color: 'text-purple-600' },
        ].map((q) => (
          <Link key={q.path} to={q.path} className="card p-4 flex items-center gap-3 hover:shadow-card-lg transition-shadow group">
            <q.icon size={18} className={q.color} />
            <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{q.label}</span>
            <ArrowRight size={14} className="ml-auto text-gray-300 group-hover:text-gray-500" />
          </Link>
        ))}
      </div>

      {/* Recent schools */}
      {(s.recentSchools || []).length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Dernières écoles créées</h3>
          <div className="space-y-2">
            {s.recentSchools.map((sc) => (
              <div key={sc._id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">{sc.name}</p>
                  <p className="text-xs text-gray-400">{sc.cycles?.join(', ')} · {sc.address?.city || ''}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${sc.subscription?.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {sc.subscription?.status === 'active' ? 'Actif' : 'Inactif'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent registrations */}
      {(s.recentRegistrations || []).length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Dernières demandes</h3>
            <Link to="/dashboard/demandes-ecoles" className="text-xs text-blue-600 hover:underline">Voir tout →</Link>
          </div>
          <div className="space-y-2">
            {s.recentRegistrations.map((r) => (
              <div key={r._id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">{r.schoolName}</p>
                  <p className="text-xs text-gray-400">{r.directorName} · {r.cycle} · {r.amount?.toLocaleString()} F</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${r.status === 'pending' ? 'bg-amber-100 text-amber-700' : r.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {r.status === 'pending' ? 'En attente' : r.status === 'approved' ? 'Approuvé' : 'Rejeté'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Director Dashboard ─── */
function DirectorDashboard({ user, school }) {
  const statsQ = useCachedFetch('/dashboard/stats?', async () => {
    const res = await dashboardApi.getStats()
    return res.data || null
  }, [])

  const loading = statsQ.loading
  const error = statsQ.error
  const stats = statsQ.data

  const refreshStats = () => { cache.invalidate('/dashboard/stats'); statsQ.refetch() }

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>
  if (error) return <div className="text-center py-16"><AlertCircle size={36} className="mx-auto text-red-400 mb-3" /><p className="text-sm text-gray-600">{error.message}</p><button onClick={refreshStats} className="btn-primary text-sm mt-4">Réessayer</button></div>

  const s = stats || {}
  const statsCards = [
    { title: 'Total Élèves', value: s.totalStudents || 0, icon: Users, iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
    { title: 'Enseignants', value: s.totalTeachers || 0, icon: UserCheck, iconBg: 'bg-teal-100', iconColor: 'text-teal-600' },
    { title: 'Classes', value: s.totalClasses || 0, icon: BookOpen, iconBg: 'bg-orange-100', iconColor: 'text-orange-500' },
    { title: 'Taux présence', value: `${s.attendanceRate || 0}%`, icon: TrendingUp, iconBg: 'bg-green-100', iconColor: 'text-green-600' },
  ]
  const pieData = (s.studentsByCycle || []).map((c) => ({ name: c._id || 'Non défini', value: c.count }))
  const gradeData = (s.gradesBySubject || []).map((g) => ({ name: g._id, moyenne: Math.round(g.average * 10) / 10 }))
  const attendanceChart = (s.recentAttendance || []).map((d) => ({ date: d._id.slice(5), présents: d.present, absents: d.absent }))
  const schoolCycles = school?.cycles || []

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Bonjour, {user?.name || 'Directeur'} 👋</h1>
          <p className="text-sm text-gray-500">{school?.name || 'Mon école'}</p>
          {schoolCycles.length > 0 && (
            <div className="flex gap-1 mt-1">{schoolCycles.map((c) => <span key={c} className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full font-medium">{c}</span>)}</div>
          )}
        </div>
        <button onClick={refreshStats} className="btn-ghost text-xs border border-gray-200 self-start"><RefreshCw size={13} /> Actualiser</button>
      </div>

      {!school && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Aucune école associée</p>
            <p className="text-xs text-amber-600 mt-0.5">Créez votre école depuis la page <Link to="/dashboard/profil" className="underline font-medium">Profil de l'école</Link>.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((card) => (
          <div key={card.title} className="card p-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.iconBg} mb-3`}><card.icon size={18} className={card.iconColor} /></div>
            <div className="text-2xl font-bold text-gray-900">{card.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{card.title}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Moyennes par matière</h3>
          {gradeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}><BarChart data={gradeData}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" /><XAxis dataKey="name" fontSize={11} /><YAxis domain={[0, 20]} fontSize={11} /><Tooltip /><Bar dataKey="moyenne" fill="#3B82F6" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 py-12 text-center">Aucune note enregistrée</p>}
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Élèves par cycle</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name} (${value})`} labelLine={false}>{pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 py-12 text-center">Aucune donnée</p>}
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Présence des 7 derniers jours</h3>
        {attendanceChart.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}><AreaChart data={attendanceChart}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" /><XAxis dataKey="date" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Area type="monotone" dataKey="présents" stroke="#10B981" fill="#D1FAE5" /><Area type="monotone" dataKey="absents" stroke="#EF4444" fill="#FEE2E2" /></AreaChart></ResponsiveContainer>
        ) : <p className="text-sm text-gray-400 py-12 text-center">Aucun appel enregistré cette semaine</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Gérer les élèves', path: '/dashboard/eleves', icon: Users, color: 'text-blue-600' },
          { label: 'Saisir des notes', path: '/dashboard/notes', icon: BookOpen, color: 'text-purple-600' },
          { label: 'Faire l\'appel', path: '/dashboard/presence', icon: Calendar, color: 'text-green-600' },
          { label: 'Souscriptions', path: '/dashboard/souscriptions', icon: CreditCard, color: 'text-orange-600' },
        ].map((q) => (
          <Link key={q.path} to={q.path} className="card p-4 flex items-center gap-3 hover:shadow-card-lg transition-shadow group">
            <q.icon size={18} className={q.color} /><span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{q.label}</span><ArrowRight size={14} className="ml-auto text-gray-300 group-hover:text-gray-500" />
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Résumé académique</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm"><span className="text-gray-500">Moyenne générale</span><span className="font-bold text-gray-900">{s.averageGrade || '—'} / 20</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Contenus multimédias</span><span className="font-bold text-gray-900">{s.totalMedia || 0}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Messages non lus</span><span className="font-bold text-blue-600">{s.unreadMessages || 0}</span></div>
          </div>
        </div>
        <div className="card p-5 bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
          <div className="flex items-center gap-2 mb-2"><CheckCircle2 size={16} /><span className="text-sm font-semibold">Abonnement Actif</span></div>
          <p className="text-blue-100 text-xs mb-3">Votre abonnement est en cours de validité.</p>
          <Link to="/dashboard/souscriptions" className="text-xs font-medium text-white underline underline-offset-2">Voir les détails →</Link>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { user, school } = useAuth()
  let content
  if (user?.role === 'super_admin') content = <AdminDashboard user={user} />
  else if (user?.role === 'parent') content = <ParentDashboardPage />
  else if (user?.role === 'enseignant') content = <TeacherDashboardPage />
  else content = <DirectorDashboard user={user} school={school} />

  return (
    <div className="space-y-8">
      {/* Grille de boutons ronds (remplace la sidebar) : accès rapide à toutes les fonctionnalités */}
      <AppLauncher />
      {content}
    </div>
  )
}
