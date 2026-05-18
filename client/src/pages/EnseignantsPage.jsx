import { useState } from 'react'
import { Search, Plus, Download, UserCheck, Mail, Phone, Edit, Eye, Trash2 } from 'lucide-react'
import { teachers } from '../data/mockData'
import { cn } from '../lib/utils'

const statusConfig = {
  active: { label: 'Actif', cls: 'badge-green' },
  leave: { label: 'En congé', cls: 'badge-orange' },
  inactive: { label: 'Inactif', cls: 'badge-red' },
}

export default function EnseignantsPage() {
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)

  const filtered = teachers.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.subject.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <UserCheck size={22} className="text-teal-600" />
            Gestion des Enseignants
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{teachers.length} enseignants · Cycle Primaire</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost text-sm border border-gray-200">
            <Download size={15} /> Exporter
          </button>
          <button onClick={() => setShowModal(true)} className="btn-primary text-sm">
            <Plus size={15} /> Ajouter un enseignant
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total enseignants', value: teachers.length, color: 'text-teal-600', bg: 'bg-teal-50' },
          { label: 'Présents aujourd\'hui', value: teachers.filter(t => t.status === 'active').length, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'En congé', value: teachers.filter(t => t.status === 'leave').length, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Taux présence moyen', value: `${Math.round(teachers.reduce((a,b) => a + b.attendance, 0) / teachers.length)}%`, color: 'text-blue-600', bg: 'bg-blue-50' },
        ].map((stat) => (
          <div key={stat.label} className={`card p-4 ${stat.bg} border-0`}>
            <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-gray-600 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou matière..."
            className="input pl-9 text-sm"
          />
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((teacher) => (
          <div key={teacher.id} className="card p-5 hover:shadow-card-lg transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {teacher.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900">{teacher.name}</div>
                  <div className="text-xs text-blue-600 font-medium">{teacher.subject}</div>
                </div>
              </div>
              <span className={`badge ${statusConfig[teacher.status].cls} text-xs`}>
                {statusConfig[teacher.status].label}
              </span>
            </div>

            <div className="space-y-1.5 mb-3">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Mail size={12} className="text-gray-400 flex-shrink-0" />
                <span className="truncate">{teacher.email}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Phone size={12} className="text-gray-400 flex-shrink-0" />
                {teacher.phone}
              </div>
            </div>

            <div className="flex flex-wrap gap-1 mb-3">
              {teacher.classes.map((cls) => (
                <span key={cls} className="badge badge-blue text-xs">{cls}</span>
              ))}
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
              <span>Expérience : <strong className="text-gray-700">{teacher.experience}</strong></span>
              <span>Présence : <strong className={teacher.attendance >= 95 ? 'text-green-600' : 'text-orange-500'}>{teacher.attendance}%</strong></span>
            </div>

            {/* Attendance bar */}
            <div className="bg-gray-100 rounded-full h-1.5 mb-4">
              <div
                className={`h-1.5 rounded-full ${teacher.attendance >= 95 ? 'bg-green-500' : 'bg-orange-400'}`}
                style={{ width: `${teacher.attendance}%` }}
              />
            </div>

            <div className="flex items-center gap-2">
              <button className="flex-1 btn-ghost text-xs py-1.5 border border-gray-200 justify-center">
                <Eye size={13} /> Profil
              </button>
              <button className="flex-1 btn-outline text-xs py-1.5 justify-center">
                <Edit size={13} /> Modifier
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Ajouter un enseignant</h3>
            <div className="space-y-3">
              <input placeholder="Nom complet" className="input" />
              <input placeholder="Matière enseignée" className="input" />
              <input placeholder="Email professionnel" type="email" className="input" />
              <input placeholder="Numéro de téléphone" className="input" />
              <input placeholder="Années d'expérience" type="number" className="input" />
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
