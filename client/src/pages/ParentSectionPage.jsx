import { useEffect, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Loader2, GraduationCap, ArrowRight, AlertCircle } from 'lucide-react'
import { parentApi } from '../lib/api'
import { getInitials } from '../lib/utils'

const SECTION_TITLES = {
  notes: 'Notes & Bulletins',
  attendance: 'Présence de mes enfants',
  classattendance: "Liste de présence de la classe",
  homework: 'Devoirs assignés',
  completion: 'Complétion des devoirs',
  teachers: 'Enseignants',
  timetable: 'Emploi du temps',
  subjects: 'Matières enseignées',
  fees: 'Frais de scolarité & tranches',
}

const SECTION_ICONS = {
  notes: '📝', attendance: '📅', classattendance: '🧑‍🤝‍🧑', homework: '📚',
  completion: '✅', teachers: '👨‍🏫', timetable: '🕒', subjects: '📖', fees: '💳',
}

const SECTION_DESCRIPTIONS = {
  notes: 'Notes séquentielles et trimestrielles enregistrées par les enseignants.',
  attendance: "Suivi quotidien des présences, absences et retards de votre enfant.",
  classattendance: "Liste journalière de présence de la classe entière (publiée par l'enseignant).",
  homework: 'Tous les devoirs et évaluations assignés par les enseignants.',
  completion: "Statut « fait / non fait » des devoirs pour votre enfant et toute la classe.",
  teachers: 'Liste des enseignants enregistrés par le directeur pour la classe.',
  timetable: "Emploi du temps hebdomadaire de la classe de votre enfant.",
  subjects: "Toutes les matières enregistrées pour l'école / classe de votre enfant.",
  fees: 'Évolution du paiement, tranches restantes et délais.',
}

export default function ParentSectionPage({ section = 'notes' }) {
  const [children, setChildren] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    (async () => {
      try {
        const r = await parentApi.dashboard()
        setChildren(r.data?.children || r.data?.students || [])
      } catch (_) {}
      setLoading(false)
    })()
  }, [])

  if (loading) return <div className="flex justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>

  // If single child, auto-redirect to their detail page on the right tab
  if (children.length === 1) {
    return <Navigate to={`/dashboard/parent/enfant/${children[0]._id}?tab=${section}`} replace />
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <span className="text-2xl">{SECTION_ICONS[section] || '📁'}</span> {SECTION_TITLES[section] || 'Section'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{SECTION_DESCRIPTIONS[section]}</p>
      </div>

      {children.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          <AlertCircle size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucun enfant enregistré dans votre compte.</p>
        </div>
      ) : (
        <>
          <p className="text-sm font-medium text-gray-700">Sélectionnez un enfant pour voir cette section :</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {children.map((c) => (
              <button
                key={c._id}
                onClick={() => navigate(`/dashboard/parent/enfant/${c._id}?tab=${section}`)}
                className="card p-4 flex items-center gap-3 hover:shadow-card-lg hover:border-blue-300 border border-gray-100 transition-all text-left group"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden">
                  {c.photo ? <img src={c.photo} alt="" className="w-full h-full object-cover" /> : getInitials(c.fullName || `${c.firstName || ''} ${c.lastName || ''}`)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{c.fullName || `${c.firstName} ${c.lastName}`}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <GraduationCap size={11} /> {c.class?.name || 'Classe non assignée'}{c.cycle ? ` · ${c.cycle}` : ''}
                  </p>
                </div>
                <ArrowRight size={16} className="text-gray-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
