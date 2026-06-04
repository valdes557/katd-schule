import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts'
import {
  BarChart2, Loader2, RefreshCw, TrendingUp, Users, BookOpen, CheckCircle2,
} from 'lucide-react'
import { teacherApi } from '../lib/api'

const COLORS = ['#EF4444', '#F97316', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#6366F1']

export default function TeacherAnalyticsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const r = await teacherApi.analytics()
      setData(r.data)
    } catch (err) { console.error(err) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>
  if (!data) return <div className="text-center py-16 text-sm text-gray-500">Aucune donnée analytique disponible</div>

  const { gradeDistribution, classAverages, subjectAverages, hwCompletion, attendanceTrend } = data

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><BarChart2 size={22} className="text-amber-600" /> Statistiques & Analytics</h1>
          <p className="text-sm text-gray-500">Vue détaillée de la performance de vos classes</p>
        </div>
        <button onClick={load} className="btn-ghost text-xs border border-gray-200"><RefreshCw size={13} /> Actualiser</button>
      </div>

      {/* Top row: class averages + subject averages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Class averages */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-4"><BookOpen size={15} /> Moyenne par classe</h3>
          {classAverages.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={classAverages}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="class" fontSize={11} />
                <YAxis domain={[0, 20]} fontSize={11} />
                <Tooltip formatter={(v) => `${v}/20`} />
                <Bar dataKey="average" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 text-center py-8">Aucune donnée</p>}
        </div>

        {/* Subject averages */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-4"><TrendingUp size={15} /> Moyenne par matière</h3>
          {subjectAverages.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={subjectAverages}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="subject" fontSize={11} />
                <YAxis domain={[0, 20]} fontSize={11} />
                <Tooltip formatter={(v) => `${v}/20`} />
                <Bar dataKey="average" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 text-center py-8">Aucune donnée</p>}
        </div>
      </div>

      {/* Grade Distribution + Homework Completion */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Grade distribution */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Répartition des notes</h3>
          {gradeDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={gradeDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="range" fontSize={10} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="count" fill="#10B981" radius={[4, 4, 0, 0]} name="Nombre de notes" />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 text-center py-8">Aucune note enregistrée</p>}
        </div>

        {/* Homework Completion by class */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-4"><CheckCircle2 size={15} /> Taux de complétion des devoirs</h3>
          {hwCompletion.length > 0 ? (
            <div className="space-y-3">
              {hwCompletion.map((c) => (
                <div key={c.class}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700">{c.class}</span>
                    <span className="text-gray-500">{c.completionRate}% · {c.homeworkCount} devoir(s)</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${c.completionRate >= 75 ? 'bg-green-500' : c.completionRate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${c.completionRate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-gray-400 text-center py-8">Aucun devoir</p>}
        </div>
      </div>

      {/* Attendance Trend */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-4"><Users size={15} /> Tendance de présence (4 dernières semaines)</h3>
        {attendanceTrend.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={attendanceTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="week" fontSize={11} tickFormatter={(v) => `S${v}`} />
              <YAxis domain={[0, 100]} fontSize={11} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v) => `${Math.round(v)}%`} />
              <Line type="monotone" dataKey="rate" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981' }} name="Présence" />
            </LineChart>
          </ResponsiveContainer>
        ) : <p className="text-sm text-gray-400 text-center py-8">Pas assez de données</p>}
      </div>

      {/* Summary cards at bottom */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">
            {classAverages.length > 0 ? (classAverages.reduce((s, c) => s + c.average, 0) / classAverages.length).toFixed(1) : '—'}
          </p>
          <p className="text-[10px] text-gray-500">Moyenne globale /20</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-green-600">
            {hwCompletion.length > 0 ? Math.round(hwCompletion.reduce((s, c) => s + c.completionRate, 0) / hwCompletion.length) : 0}%
          </p>
          <p className="text-[10px] text-gray-500">Complétion devoirs</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">
            {gradeDistribution.reduce((s, b) => s + b.count, 0)}
          </p>
          <p className="text-[10px] text-gray-500">Notes saisies</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">
            {attendanceTrend.length > 0 ? `${Math.round(attendanceTrend[attendanceTrend.length - 1]?.rate || 0)}%` : '—'}
          </p>
          <p className="text-[10px] text-gray-500">Présence (dernière sem.)</p>
        </div>
      </div>
    </div>
  )
}
