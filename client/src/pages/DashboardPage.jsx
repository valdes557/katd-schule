import { Link } from 'react-router-dom'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Area, AreaChart,
} from 'recharts'
import {
  Users, UserCheck, BookOpen, TrendingUp, RefreshCw,
  ArrowRight, Calendar, UserPlus, Clock, FileText,
  CreditCard, AlertCircle, CheckCircle2, HelpCircle, ExternalLink,
  Info, Phone,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  gradesChartData, attendanceData, recentActivities,
  upcomingEvents, subscriptionPlans,
} from '../data/mockData'

const statsCards = [
  {
    title: 'Total Élèves',
    value: '350',
    trend: '+25 ce mois',
    icon: Users,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    trendColor: 'text-blue-600',
  },
  {
    title: 'Enseignants',
    value: '20',
    trend: '+2 ce mois',
    icon: UserCheck,
    iconBg: 'bg-teal-100',
    iconColor: 'text-teal-600',
    trendColor: 'text-teal-600',
  },
  {
    title: 'Classes',
    value: '15',
    trend: '+1 ce mois',
    icon: BookOpen,
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-500',
    trendColor: 'text-orange-500',
  },
  {
    title: 'Taux de présence',
    value: '92%',
    trend: 'Ce mois',
    icon: TrendingUp,
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    trendColor: 'text-purple-600',
  },
]

const activityIcons = {
  homework: { bg: 'bg-blue-100', color: 'text-blue-600', icon: BookOpen },
  grade: { bg: 'bg-green-100', color: 'text-green-600', icon: CheckCircle2 },
  absence: { bg: 'bg-orange-100', color: 'text-orange-500', icon: AlertCircle },
  document: { bg: 'bg-red-100', color: 'text-red-500', icon: FileText },
  payment: { bg: 'bg-purple-100', color: 'text-purple-600', icon: CreditCard },
}

const eventColors = {
  blue: { bg: 'bg-blue-600', text: 'text-white', light: 'bg-blue-50', border: 'border-blue-200' },
  green: { bg: 'bg-green-600', text: 'text-white', light: 'bg-green-50', border: 'border-green-200' },
  orange: { bg: 'bg-orange-500', text: 'text-white', light: 'bg-orange-50', border: 'border-orange-200' },
  purple: { bg: 'bg-purple-600', text: 'text-white', light: 'bg-purple-50', border: 'border-purple-200' },
}

const planColors = {
  orange: { title: 'text-orange-600', btn: 'border-orange-400 text-orange-600 hover:bg-orange-50' },
  blue: { title: 'text-blue-600', btn: 'border-blue-600 text-blue-600 hover:bg-blue-50 bg-blue-600 text-white' },
  green: { title: 'text-green-600', btn: 'border-green-500 text-green-600 hover:bg-green-50' },
}

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-card-lg text-sm">
        <div className="font-semibold text-gray-800">{payload[0].value}/20</div>
        <div className="text-gray-500 text-xs">Moyenne générale</div>
      </div>
    )
  }
  return null
}

export default function DashboardPage() {
  const { school, cycle } = useAuth()

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            Bonjour, {school?.name || "École Les Petits Génies"} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Tableau de bord — Cycle {cycle}</p>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Calendar size={15} />
          Année scolaire 2024 - 2025
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((card) => (
          <div key={card.title} className="card p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              </div>
              <div className={`w-10 h-10 ${card.iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <card.icon size={18} className={card.iconColor} />
              </div>
            </div>
            <div className={`flex items-center gap-1 text-xs font-medium ${card.trendColor}`}>
              <RefreshCw size={11} />
              {card.trend}
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Attendance donut */}
        <div className="lg:col-span-4 card p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Présence des élèves <span className="text-gray-400 font-normal">(Ce mois)</span></h3>
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <ResponsiveContainer width={120} height={120}>
                <PieChart>
                  <Pie
                    data={attendanceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={38}
                    outerRadius={55}
                    dataKey="value"
                    strokeWidth={2}
                    stroke="#fff"
                  >
                    {attendanceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold text-gray-900">92%</span>
                <span className="text-[10px] text-gray-400">Présents</span>
              </div>
            </div>
            <div className="space-y-2 flex-1">
              {attendanceData.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-gray-600">{item.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-800">
                    {item.percentage}% ({item.value})
                  </span>
                </div>
              ))}
            </div>
          </div>
          <Link to="/dashboard/presence" className="flex items-center gap-1 text-xs text-blue-600 hover:underline mt-4 font-medium">
            Voir le détail <ArrowRight size={11} />
          </Link>
        </div>

        {/* Grades line chart */}
        <div className="lg:col-span-5 card p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-1">Évolution des notes moyennes</h3>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-sm bg-blue-500" />
            <span className="text-xs text-gray-500">Moyenne générale</span>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={gradesChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 20]} tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="avg" stroke="#3B82F6" strokeWidth={2} fill="url(#gradeGradient)" dot={{ fill: '#3B82F6', r: 3 }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
          <Link to="/dashboard/notes" className="flex items-center gap-1 text-xs text-blue-600 hover:underline mt-3 font-medium">
            Voir le détail <ArrowRight size={11} />
          </Link>
        </div>

        {/* Important notices */}
        <div className="lg:col-span-3 card p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Informations importantes</h3>
          <div className="space-y-3">
            {[
              { color: 'bg-blue-500', text: 'Réunion parents – enseignants', date: '25 Mai 2024 à 09:00' },
              { color: 'bg-green-500', text: "Fête de fin d'année", date: '15 Juin 2024 à 15:00' },
              { color: 'bg-orange-400', text: 'Vacances de Pâques', date: 'Du 20 Avril au 05 Mai 2024' },
            ].map((notice, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className={`w-2.5 h-2.5 ${notice.color} rounded-full mt-0.5 flex-shrink-0`} />
                <div>
                  <div className="text-xs font-semibold text-gray-800 leading-tight">{notice.text}</div>
                  <div className="text-xs text-gray-400">{notice.date}</div>
                </div>
              </div>
            ))}
          </div>
          <Link to="/dashboard/annonces" className="flex items-center gap-1 text-xs text-blue-600 hover:underline mt-4 font-medium">
            Voir toutes les annonces <ArrowRight size={11} />
          </Link>
        </div>
      </div>

      {/* Activities + Events + Quick access */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Recent activities */}
        <div className="lg:col-span-5 card p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Activités récentes</h3>
          <div className="space-y-3">
            {recentActivities.map((activity) => {
              const config = activityIcons[activity.type]
              return (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className={`w-8 h-8 ${config.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <config.icon size={14} className={config.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 line-clamp-1">{activity.title}</div>
                    <div className="text-xs text-gray-400">{activity.subtitle}</div>
                  </div>
                  <div className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">{activity.time}</div>
                </div>
              )
            })}
          </div>
          <Link to="/dashboard/annonces" className="flex items-center gap-1 text-xs text-blue-600 hover:underline mt-4 font-medium">
            Voir toutes les activités <ArrowRight size={11} />
          </Link>
        </div>

        {/* Upcoming events */}
        <div className="lg:col-span-4 card p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Prochains événements</h3>
          <div className="space-y-2">
            {upcomingEvents.map((event) => {
              const c = eventColors[event.color]
              return (
                <div key={event.id} className="flex items-center gap-3">
                  <div className={`${c.bg} rounded-xl px-2.5 py-1.5 text-center min-w-[42px]`}>
                    <div className={`text-base font-bold ${c.text} leading-tight`}>{event.day}</div>
                    <div className={`text-[9px] font-semibold ${c.text} opacity-80`}>{event.month}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 line-clamp-1">{event.title}</div>
                    <div className="text-xs text-gray-400">{event.time}</div>
                  </div>
                </div>
              )
            })}
          </div>
          <Link to="/dashboard/emploi-du-temps" className="flex items-center gap-1 text-xs text-blue-600 hover:underline mt-4 font-medium">
            Voir le calendrier complet <ArrowRight size={11} />
          </Link>
        </div>

        {/* Quick access */}
        <div className="lg:col-span-3 space-y-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Accès rapides</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Ajouter un élève', icon: UserPlus, path: '/dashboard/eleves' },
                { label: 'Ajouter un enseignant', icon: UserCheck, path: '/dashboard/enseignants' },
                { label: "Emploi du temps", icon: Clock, path: '/dashboard/emploi-du-temps' },
                { label: 'Notes & Bulletins', icon: FileText, path: '/dashboard/notes' },
                { label: 'Devoirs', icon: BookOpen, path: '/dashboard/devoirs' },
                { label: 'Messagerie', icon: Users, path: '/dashboard/messagerie' },
              ].map((action) => (
                <Link
                  key={action.label}
                  to={action.path}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-blue-50 transition-colors group"
                >
                  <div className="w-9 h-9 border-2 border-gray-200 group-hover:border-blue-300 rounded-xl flex items-center justify-center transition-colors">
                    <action.icon size={16} className="text-gray-500 group-hover:text-blue-600 transition-colors" />
                  </div>
                  <span className="text-[10px] text-gray-500 text-center leading-tight line-clamp-2">{action.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Subscription status */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-800">Statut de souscription</h3>
              <span className="badge badge-green text-xs">Abonnement annuel</span>
            </div>
            <div className="text-lg font-bold text-green-600 flex items-center gap-1 mb-1">
              Actif <CheckCircle2 size={16} />
            </div>
            <div className="text-xs text-gray-500 mb-1">Valable jusqu'au : <span className="font-semibold text-gray-700">31 Août 2024</span></div>
            <div className="text-xs text-gray-500 mb-3">Montant payé : <span className="font-semibold text-gray-700">40 000 F CFA</span></div>
            <Link to="/dashboard/souscriptions" className="btn-outline w-full justify-center text-xs py-2">
              Voir les détails de l'abonnement
            </Link>
          </div>
        </div>
      </div>

      {/* Help section */}
      <div className="card p-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-1">Besoin d'aide ?</h3>
            <p className="text-xs text-gray-500 mb-4">Consultez notre centre d'aide ou contactez notre équipe support.</p>
            <div className="flex flex-wrap gap-3">
              {[
                { icon: HelpCircle, label: "Centre d'aide", path: '#' },
                { icon: BookOpen, label: "Guide d'utilisation", path: '#' },
                { icon: Phone, label: 'Nous contacter', path: '#' },
              ].map((link) => (
                <a key={link.label} href={link.path} className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-medium">
                  <link.icon size={13} />
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Subscription plans */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Nos formules d'abonnement <span className="text-gray-400 font-normal">(Par cycle)</span></h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {subscriptionPlans.map((plan) => {
            const colors = planColors[plan.color]
            return (
              <div key={plan.cycle} className="border border-gray-200 rounded-xl p-5">
                <div className="text-2xl mb-1">{plan.icon}</div>
                <div className={`text-sm font-bold ${colors.title} mb-2`}>{plan.cycle}</div>
                <div className="text-xs text-gray-600 mb-1">{plan.quarterly.label}</div>
                <div className="text-xs text-gray-600 mb-4">{plan.annual.label}</div>
                <div className="space-y-1.5 mb-4">
                  {['Accès à toutes les fonctionnalités', 'Support prioritaire', 'Mises à jour incluses'].map((feature) => (
                    <div key={feature} className="flex items-center gap-1.5 text-xs text-gray-600">
                      <CheckCircle2 size={12} className="text-green-500 flex-shrink-0" />
                      {feature}
                    </div>
                  ))}
                </div>
                <Link
                  to="/dashboard/souscriptions"
                  className={`block w-full text-center text-xs font-semibold py-2 rounded-lg border transition-colors ${
                    plan.color === 'blue'
                      ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
                      : plan.color === 'orange'
                      ? 'border-orange-400 text-orange-600 hover:bg-orange-50'
                      : 'border-green-500 text-green-600 hover:bg-green-50'
                  }`}
                >
                  Choisir cette formule
                </Link>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer note */}
      <div className="text-center pt-2 pb-4">
        <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
          <BookOpen size={12} className="text-blue-500" />
          <span>KATD-SCHÜLE © 2024. Tous droits réservés.</span>
          <span>·</span>
          <a href="#" className="hover:text-gray-600">Conditions d'utilisation</a>
          <span>·</span>
          <a href="#" className="hover:text-gray-600">Politique de confidentialité</a>
        </div>
      </div>
    </div>
  )
}
