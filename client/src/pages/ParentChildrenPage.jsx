import { Link } from 'react-router-dom'
import { GraduationCap, ArrowRight, Users, Loader2, BookOpen, Receipt, Clock } from 'lucide-react'
import { parentApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'

// Page « Mes enfants » : liste des élèves rattachés au compte parent.
// (Route dédiée : le bouton nav pointait avant sur /dashboard, ce qui ne faisait
//  rien quand on était déjà sur le tableau de bord.)
export default function ParentChildrenPage() {
  // Même clé/forme que les autres pages parent (objet complet) — dérivation défensive.
  const dashQ = useCachedFetch(
    '/parent/dashboard',
    async () => (await parentApi.dashboard()).data || null,
    [],
  )
  const d = dashQ.data
  const children = Array.isArray(d) ? d : (d?.children || d?.students || [])
  const loading = dashQ.loading

  if (loading) return <div className="flex justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><GraduationCap size={22} className="text-blue-600" /> Mes enfants</h1>
        <p className="text-sm text-gray-500">Les élèves rattachés à votre compte. Cliquez pour voir le détail (notes, présence, emploi du temps).</p>
      </div>

      {children.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          <Users size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucun enfant associé à votre compte.</p>
          <p className="text-xs mt-1">Contactez l'administration de l'école pour lier votre enfant à votre compte.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {children.map((child) => (
            <div key={child._id} className="card p-4 hover:shadow-card-lg transition-shadow">
              <Link to={`/dashboard/parent/enfant/${child._id}`} className="flex items-center gap-3 group">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-blue-600 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                  {child.photo ? <img src={child.photo} alt="" className="w-full h-full object-cover" /> : (child.firstName || child.fullName || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{child.fullName || `${child.firstName || ''} ${child.lastName || ''}`.trim()}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {child.matricule ? <span className="font-mono">{child.matricule}</span> : null}
                    {child.matricule && (child.class?.name || child.cycle) ? ' · ' : ''}
                    {child.class?.name || 'Classe non assignée'}{child.cycle ? ` · ${child.cycle}` : ''}
                  </p>
                </div>
                <ArrowRight size={16} className="text-gray-300 group-hover:text-blue-500 flex-shrink-0" />
              </Link>
              <div className="grid grid-cols-3 gap-1.5 mt-3 pt-3 border-t border-gray-100">
                <Link to={`/dashboard/parent/enfant/${child._id}?tab=notes`} className="flex flex-col items-center gap-0.5 py-2 rounded-lg hover:bg-blue-50 text-gray-600 hover:text-blue-600 transition-colors">
                  <BookOpen size={14} /><span className="text-[10px] font-medium">Notes</span>
                </Link>
                <Link to={`/dashboard/bulletin/${child._id}`} className="flex flex-col items-center gap-0.5 py-2 rounded-lg hover:bg-purple-50 text-gray-600 hover:text-purple-600 transition-colors">
                  <Receipt size={14} /><span className="text-[10px] font-medium">Bulletin</span>
                </Link>
                <Link to={`/dashboard/parent/enfant/${child._id}?tab=timetable`} className="flex flex-col items-center gap-0.5 py-2 rounded-lg hover:bg-emerald-50 text-gray-600 hover:text-emerald-600 transition-colors">
                  <Clock size={14} /><span className="text-[10px] font-medium">Emploi</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
