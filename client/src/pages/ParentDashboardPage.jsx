import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users, BookOpen, CalendarCheck, CreditCard, MessageSquare, AlertCircle,
  TrendingUp, Clock, FileText, Loader2, RefreshCw, ArrowRight, Bell, Shield,
  GraduationCap, CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { parentApi } from '../lib/api'

export default function ParentDashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const r = await parentApi.dashboard()
      setData(r.data)
    } catch (_) {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>

  const children = data?.children || []
  const s = data?.stats || {}

  if (children.length === 0) {
    return (
      <div className="text-center py-20 animate-fade-in">
        <Users size={48} className="mx-auto text-gray-300 mb-4" />
        <h2 className="text-lg font-bold text-gray-700 mb-2">Aucun enfant associé</h2>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          Votre compte parent n'est pas encore lié à un élève. Contactez l'administration de l'école pour associer votre enfant à votre compte.
        </p>
      </div>
    )
  }

  const quickAnswers = [
    {
      question: 'Mon enfant travaille-t-il ?',
      answer: s.homeworkSubmitted > 0
        ? `${s.homeworkSubmitted}/${s.homeworkTotal} devoirs rendus`
        : 'Aucun devoir enregistré',
      icon: BookOpen,
      color: s.homeworkOverdue > 0 ? 'text-amber-600' : 'text-green-600',
      bg: s.homeworkOverdue > 0 ? 'bg-amber-50' : 'bg-green-50',
    },
    {
      question: 'A-t-il des problèmes ?',
      answer: s.totalAbsences > 0
        ? `${s.totalAbsences} absence(s), ${s.totalLate} retard(s)`
        : 'Aucun problème signalé',
      icon: s.totalAbsences > 2 ? AlertTriangle : CheckCircle2,
      color: s.totalAbsences > 2 ? 'text-red-600' : 'text-green-600',
      bg: s.totalAbsences > 2 ? 'bg-red-50' : 'bg-green-50',
    },
    {
      question: 'Combien je dois payer ?',
      answer: s.feesPending > 0
        ? `${(s.feesTotalDue - s.feesTotalPaid).toLocaleString()} F CFA restant`
        : 'Tout est réglé',
      icon: CreditCard,
      color: s.feesPending > 0 ? 'text-orange-600' : 'text-green-600',
      bg: s.feesPending > 0 ? 'bg-orange-50' : 'bg-green-50',
    },
    {
      question: "Qu'attendez-vous de moi ?",
      answer: s.unreadMessages > 0
        ? `${s.unreadMessages} message(s) non lu(s)`
        : 'Rien pour le moment',
      icon: MessageSquare,
      color: s.unreadMessages > 0 ? 'text-blue-600' : 'text-gray-500',
      bg: s.unreadMessages > 0 ? 'bg-blue-50' : 'bg-gray-50',
    },
  ]

  const statsCards = [
    { title: 'Moyenne générale', value: s.averageGrade ? `${s.averageGrade}/20` : '—', icon: TrendingUp, bg: 'bg-blue-100', color: 'text-blue-600' },
    { title: 'Taux de présence', value: `${s.attendanceRate}%`, icon: CalendarCheck, bg: 'bg-green-100', color: 'text-green-600' },
    { title: 'Devoirs rendus', value: `${s.homeworkSubmitted}/${s.homeworkTotal}`, icon: FileText, bg: 'bg-purple-100', color: 'text-purple-600' },
    { title: 'Devoirs en retard', value: s.homeworkOverdue || 0, icon: Clock, bg: s.homeworkOverdue > 0 ? 'bg-red-100' : 'bg-gray-100', color: s.homeworkOverdue > 0 ? 'text-red-600' : 'text-gray-500' },
    { title: 'Absences', value: s.totalAbsences || 0, icon: XCircle, bg: s.totalAbsences > 0 ? 'bg-amber-100' : 'bg-gray-100', color: s.totalAbsences > 0 ? 'text-amber-600' : 'text-gray-500' },
    { title: 'Messages non lus', value: s.unreadMessages || 0, icon: MessageSquare, bg: 'bg-indigo-100', color: 'text-indigo-600' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Bonjour, {user?.name || 'Parent'} 👋</h1>
          <p className="text-sm text-gray-500">Suivi de {children.length > 1 ? `vos ${children.length} enfants` : `votre enfant`}</p>
        </div>
        <button onClick={load} className="btn-ghost text-xs border border-gray-200 self-start"><RefreshCw size={13} /> Actualiser</button>
      </div>

      {/* 4 Quick Answers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {quickAnswers.map((q) => (
          <div key={q.question} className={`card p-4 ${q.bg} border-0`}>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-white shadow-sm flex-shrink-0`}>
                <q.icon size={18} className={q.color} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-800">{q.question}</p>
                <p className={`text-sm font-semibold mt-0.5 ${q.color}`}>{q.answer}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Children Cards */}
      <div>
        <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2"><GraduationCap size={16} /> Mes enfants</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {children.map((child) => (
            <Link key={child._id} to={`/dashboard/parent/enfant/${child._id}`} className="card p-4 hover:shadow-card-lg transition-shadow group">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-blue-600 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                  {child.photo ? <img src={child.photo} alt="" className="w-full h-full object-cover" /> : child.firstName?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{child.fullName}</p>
                  <p className="text-xs text-gray-500">{child.class?.name || 'Classe non assignée'} · {child.cycle}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{child.matricule}</p>
                </div>
                <ArrowRight size={14} className="text-gray-300 group-hover:text-blue-500" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {statsCards.map((card) => (
          <div key={card.title} className="card p-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.bg} mb-3`}>
              <card.icon size={18} className={card.color} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{card.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{card.title}</div>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Messagerie', path: '/dashboard/messagerie', icon: MessageSquare, color: 'text-blue-600' },
          { label: 'Paiements', path: '/dashboard/parent/finances', icon: CreditCard, color: 'text-green-600' },
          { label: 'Rendez-vous', path: '/dashboard/parent/rendez-vous', icon: CalendarCheck, color: 'text-purple-600' },
          { label: 'Contrôle parental', path: '/dashboard/parent/controles', icon: Shield, color: 'text-orange-600' },
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
