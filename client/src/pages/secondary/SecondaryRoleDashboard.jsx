import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import AppLauncher from '../../components/layout/AppLauncher'
import { roleLabel } from '../../lib/roleLabels'

/**
 * Socle commun des dashboards du cycle Secondaire (VP, SG, caissière, secrétaire, portier, élève).
 * En-tête sticky (nom + fonction + école) + AppLauncher + grille de boutons colorés.
 */
export default function SecondaryRoleDashboard({ subtitle, quickButtons = [], children }) {
  const { user, school } = useAuth()
  return (
    <div className="space-y-6 animate-fade-in">
      {/* En-tête fixe : identité du membre */}
      <div className="sticky top-24 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-gray-50/95 backdrop-blur-sm border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">Bonjour, {user?.name} 👋</h1>
        <p className="text-sm text-gray-500">
          <span className="font-semibold text-indigo-600">{roleLabel(user?.role, school)}</span>
          {school?.name ? ` — ${school.name}` : ''}
        </p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>

      {/* Accès rapide à toutes les fonctionnalités (grille de boutons ronds) */}
      <AppLauncher />

      {/* Boutons d'accès rapides colorés (pattern du dashboard directeur) */}
      {quickButtons.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickButtons.map((q) => (
            <Link
              key={q.path}
              to={q.path}
              className={`flex flex-col items-center justify-center text-center gap-2 rounded-xl px-3 py-4 text-white font-semibold shadow-sm hover:shadow-md transition-all ${q.bg}`}
            >
              <q.icon size={22} />
              <span className="text-xs leading-tight">{q.label}</span>
            </Link>
          ))}
        </div>
      )}

      {children}
    </div>
  )
}
