import { useState } from 'react'
import { Search, Plus, Filter, Download, ChevronDown, Eye, Edit, Trash2, GraduationCap } from 'lucide-react'
import { students } from '../data/mockData'
import { cn } from '../lib/utils'

const statusLabels = { active: 'Actif', warning: 'À surveiller' }
const statusColors = { active: 'badge-green', warning: 'badge-orange' }

export default function ElevesPage() {
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('Toutes')
  const [showModal, setShowModal] = useState(false)

  const classes = ['Toutes', ...new Set(students.map((s) => s.class))]

  const filtered = students.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.matricule.includes(search)
    const matchClass = classFilter === 'Toutes' || s.class === classFilter
    return matchSearch && matchClass
  })

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <GraduationCap size={22} className="text-blue-600" />
            Gestion des Élèves
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{students.length} élèves inscrits · Cycle Primaire</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost text-sm border border-gray-200">
            <Download size={15} />
            Exporter
          </button>
          <button onClick={() => setShowModal(true)} className="btn-primary text-sm">
            <Plus size={15} />
            Ajouter un élève
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total élèves', value: students.length, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Présents aujourd\'hui', value: Math.round(students.length * 0.92), color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Absents', value: Math.round(students.length * 0.06), color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Moyenne générale', value: '13.8/20', color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map((stat) => (
          <div key={stat.label} className={`card p-4 ${stat.bg} border-0`}>
            <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-gray-600 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filters bar */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un élève ou matricule..."
            className="input pl-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">Classe :</span>
          {classes.map((c) => (
            <button
              key={c}
              onClick={() => setClassFilter(c)}
              className={cn(
                'text-xs px-3 py-1.5 rounded-lg border transition-colors',
                classFilter === c
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-200 text-gray-600 hover:border-blue-300'
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Élève', 'Matricule', 'Classe', 'Âge', 'Moyenne', 'Présence', 'Parent/Responsable', 'Statut', 'Actions'].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${student.gender === 'F' ? 'bg-pink-500' : 'bg-blue-500'}`}>
                        {student.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-800">{student.name}</div>
                        <div className="text-xs text-gray-400">{student.gender === 'F' ? 'Fille' : 'Garçon'} · {student.city}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 font-mono">{student.matricule}</td>
                  <td className="px-4 py-3">
                    <span className="badge badge-blue text-xs">{student.class}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{student.age} ans</td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-semibold ${student.average >= 14 ? 'text-green-600' : student.average >= 10 ? 'text-orange-500' : 'text-red-500'}`}>
                      {student.average}/20
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-[60px]">
                        <div
                          className={`h-1.5 rounded-full ${student.attendance >= 90 ? 'bg-green-500' : 'bg-orange-400'}`}
                          style={{ width: `${student.attendance}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600">{student.attendance}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{student.parentName}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${statusColors[student.status]} text-xs`}>
                      {statusLabels[student.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"><Eye size={14} /></button>
                      <button className="p-1.5 rounded hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors"><Edit size={14} /></button>
                      <button className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <GraduationCap size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucun élève trouvé</p>
          </div>
        )}
        <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between">
          <span className="text-xs text-gray-500">{filtered.length} élève(s) affiché(s)</span>
          <div className="flex items-center gap-2">
            <button className="text-xs border border-gray-200 px-3 py-1 rounded hover:bg-gray-50">Précédent</button>
            <span className="text-xs bg-blue-600 text-white px-3 py-1 rounded">1</span>
            <button className="text-xs border border-gray-200 px-3 py-1 rounded hover:bg-gray-50">Suivant</button>
          </div>
        </div>
      </div>

      {/* Add student modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Ajouter un élève</h3>
            <div className="space-y-3">
              <input placeholder="Nom complet" className="input" />
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Âge" type="number" className="input" />
                <select className="input"><option>Garçon</option><option>Fille</option></select>
              </div>
              <select className="input">
                <option value="">Sélectionner une classe</option>
                {['CP A','CP B','CE1 A','CE2 A','CM1 A','CM2 A'].map(c=><option key={c}>{c}</option>)}
              </select>
              <input placeholder="Nom du parent/responsable" className="input" />
              <input placeholder="Contact du parent" className="input" />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="btn-ghost flex-1 justify-center border border-gray-200">Annuler</button>
              <button onClick={() => setShowModal(false)} className="btn-primary flex-1 justify-center">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
