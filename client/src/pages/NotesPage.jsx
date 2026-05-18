import { useState } from 'react'
import { FileText, Plus, Download, Search, TrendingUp, Award, ChevronDown } from 'lucide-react'
import { students } from '../data/mockData'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

const subjects = [
  { name: 'Mathématiques', avg: 13.2, min: 7, max: 19, color: '#3B82F6' },
  { name: 'Français', avg: 14.5, min: 8, max: 20, color: '#8B5CF6' },
  { name: 'Sciences', avg: 12.8, min: 6, max: 18, color: '#10B981' },
  { name: 'Histoire-Géo', avg: 13.9, min: 9, max: 19, color: '#F59E0B' },
  { name: 'EPS', avg: 15.3, min: 10, max: 20, color: '#EF4444' },
  { name: 'Anglais', avg: 11.7, min: 5, max: 18, color: '#06B6D4' },
]

const classAverages = [
  { class: 'CP A', avg: 13.4 },
  { class: 'CP B', avg: 12.9 },
  { class: 'CE1 A', avg: 14.1 },
  { class: 'CE2 A', avg: 13.5 },
  { class: 'CM1 A', avg: 13.8 },
  { class: 'CM2 A', avg: 14.2 },
]

export default function NotesPage() {
  const [selectedClass, setSelectedClass] = useState('CM2 A')
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('notes')

  const classStudents = students.filter((s) => s.class === selectedClass || selectedClass === 'Toutes')
  const filtered = classStudents.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText size={22} className="text-purple-600" />
            Notes & Bulletins
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Saisie des notes · Trimestre 3 · 2023-2024</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost text-sm border border-gray-200">
            <Download size={15} /> Exporter bulletins
          </button>
          <button className="btn-primary text-sm">
            <Plus size={15} /> Saisir des notes
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        {['notes', 'bulletins', 'statistiques'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-all ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'notes' && (
        <>
          {/* Filters */}
          <div className="card p-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un élève..." className="input pl-9 text-sm" />
            </div>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="input text-sm w-auto"
            >
              <option>Toutes</option>
              {['CP A', 'CP B', 'CE1 A', 'CE2 A', 'CM1 A', 'CM2 A'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Notes table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Élève</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Classe</th>
                    {subjects.map((s) => (
                      <th key={s.name} className="text-center text-xs font-semibold text-gray-500 px-3 py-3 whitespace-nowrap">{s.name}</th>
                    ))}
                    <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3">Moyenne</th>
                    <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3">Rang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((student, idx) => {
                    const subjectGrades = subjects.map(() => +(Math.random() * 8 + 10).toFixed(1))
                    const avg = (subjectGrades.reduce((a, b) => a + b, 0) / subjectGrades.length).toFixed(1)
                    return (
                      <tr key={student.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${student.gender === 'F' ? 'bg-pink-400' : 'bg-blue-400'}`}>
                              {student.name[0]}
                            </div>
                            <span className="text-sm font-medium text-gray-800">{student.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3"><span className="badge badge-blue text-xs">{student.class}</span></td>
                        {subjectGrades.map((g, i) => (
                          <td key={i} className="px-3 py-3 text-center">
                            <span className={`text-sm font-medium ${g >= 14 ? 'text-green-600' : g >= 10 ? 'text-gray-700' : 'text-red-500'}`}>
                              {g}
                            </span>
                          </td>
                        ))}
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm font-bold text-blue-600">{avg}/20</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {idx === 0 && <Award size={14} className="text-yellow-500 inline" />}
                          <span className="text-sm font-medium text-gray-700 ml-1">{idx + 1}e</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'statistiques' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Averages by subject */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Moyennes par matière</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={subjects} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 20]} tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(val) => [`${val}/20`, 'Moyenne']} />
                <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                  {subjects.map((s, i) => (
                    <Cell key={i} fill={s.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Averages by class */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Moyennes par classe</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={classAverages} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="class" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 20]} tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(val) => [`${val}/20`, 'Moyenne']} />
                <Bar dataKey="avg" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Subject stats table */}
          <div className="card p-5 lg:col-span-2">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Détail par matière</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Matière', 'Moyenne', 'Min', 'Max', 'Progression'].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 pb-3 pr-6">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {subjects.map((s) => (
                    <tr key={s.name}>
                      <td className="py-3 pr-6">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                          <span className="text-sm font-medium text-gray-800">{s.name}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-6">
                        <span className={`text-sm font-bold ${s.avg >= 14 ? 'text-green-600' : 'text-gray-700'}`}>{s.avg}/20</span>
                      </td>
                      <td className="py-3 pr-6 text-sm text-red-500">{s.min}/20</td>
                      <td className="py-3 pr-6 text-sm text-green-600">{s.max}/20</td>
                      <td className="py-3">
                        <div className="bg-gray-100 rounded-full h-1.5 w-32">
                          <div className="h-1.5 rounded-full" style={{ width: `${(s.avg / 20) * 100}%`, backgroundColor: s.color }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'bulletins' && (
        <div className="card p-8 text-center">
          <FileText size={48} className="text-gray-200 mx-auto mb-4" />
          <h3 className="text-base font-semibold text-gray-700 mb-2">Génération des bulletins</h3>
          <p className="text-sm text-gray-500 mb-5">Sélectionnez une classe et une période pour générer les bulletins.</p>
          <div className="flex justify-center gap-3">
            <select className="input w-48"><option>CM2 A</option><option>CM1 A</option></select>
            <select className="input w-48"><option>Trimestre 3</option><option>Trimestre 2</option></select>
            <button className="btn-primary text-sm"><Download size={15} /> Générer les bulletins</button>
          </div>
        </div>
      )}
    </div>
  )
}
