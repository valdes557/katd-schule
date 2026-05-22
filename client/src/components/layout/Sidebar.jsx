import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, School, Info, BookOpen, Clock, Users, GraduationCap,
  UserCheck, UserCog, ClipboardList, FileText, CalendarCheck, Activity,
  Library, MessageSquare, Bell, FolderOpen, CreditCard, History, Receipt,
  BarChart2, LineChart, PieChart, HelpCircle, ChevronRight, LogOut, UserPlus, MapPin, Globe, LayoutGrid,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { cn } from '../../lib/utils'

const sidebarSections = [
  {
    label: 'GESTION DE L\'ÉCOLE',
    items: [
      { label: "Profil de l'école", icon: School, path: '/dashboard/profil' },
      { label: 'Informations générales', icon: Info, path: '/dashboard/infos' },
      { label: 'Classes & Salles', icon: BookOpen, path: '/dashboard/classes' },
      { label: 'Matières & Programmes', icon: ClipboardList, path: '/dashboard/matieres' },
      { label: 'Emploi du temps', icon: Clock, path: '/dashboard/emploi-du-temps' },
      { label: 'Page de l\'école', icon: Globe, path: '/dashboard/page-ecole' },
    ],
  },
  {
    label: 'GESTION DES PERSONNES',
    items: [
      { label: 'Enseignants', icon: UserCheck, path: '/dashboard/enseignants' },
      { label: 'Élèves', icon: GraduationCap, path: '/dashboard/eleves' },
      { label: 'Inscriptions en ligne', icon: UserPlus, path: '/dashboard/inscriptions' },
      { label: 'Parents / Responsables', icon: Users, path: '/dashboard/parents' },
      { label: 'Personnel', icon: UserCog, path: '/dashboard/personnel' },
    ],
  },
  {
    label: 'GESTION PÉDAGOGIQUE',
    items: [
      { label: 'Devoirs & Évaluations', icon: ClipboardList, path: '/dashboard/devoirs' },
      { label: 'Notes & Bulletins', icon: FileText, path: '/dashboard/notes' },
      { label: 'Présence', icon: CalendarCheck, path: '/dashboard/presence' },
      { label: 'Activités scolaires', icon: Activity, path: '/dashboard/activites' },
      { label: 'Ressources pédagogiques', icon: Library, path: '/dashboard/ressources' },
    ],
  },
  {
    label: 'COMMUNICATION',
    items: [
      { label: 'Messagerie', icon: MessageSquare, path: '/dashboard/messagerie' },
      { label: 'Annonces', icon: Bell, path: '/dashboard/annonces' },
      { label: 'Documents partagés', icon: FolderOpen, path: '/dashboard/documents' },
    ],
  },
  {
    label: 'FINANCES & ABONNEMENTS',
    items: [
      { label: 'Souscriptions', icon: CreditCard, path: '/dashboard/souscriptions' },
      { label: 'Historique des paiements', icon: History, path: '/dashboard/paiements' },
      { label: 'Factures', icon: Receipt, path: '/dashboard/factures' },
    ],
  },
  {
    label: 'RAPPORTS & STATISTIQUES',
    items: [
      { label: 'Tableaux de bord', icon: BarChart2, path: '/dashboard/rapports' },
      { label: 'Rapports', icon: LineChart, path: '/dashboard/rapports/detail' },
      { label: 'Statistiques', icon: PieChart, path: '/dashboard/statistiques' },
    ],
  },
  {
    label: 'ADMINISTRATION',
    adminOnly: true,
    items: [
      { label: 'Localités (Pays/Villes)', icon: MapPin, path: '/dashboard/localites' },
      { label: 'Demandes d\'écoles', icon: School, path: '/dashboard/demandes-ecoles' },
      { label: 'Gestion Plateforme', icon: LayoutGrid, path: '/dashboard/plateforme' },
    ],
  },
]

export default function Sidebar({ mobileOpen, onClose }) {
  const { logout, user } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full w-[260px] bg-white border-r border-gray-100 flex flex-col z-40 transition-transform duration-300',
        'lg:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-gray-100 flex-shrink-0">
        <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <BookOpen size={18} className="text-white" />
        </div>
        <div>
          <div className="text-[15px] font-bold text-gray-900 leading-tight">KATD-SCHÜLE</div>
          <div className="text-[10px] text-gray-400 leading-tight">Apprendre, Partager, Grandir</div>
        </div>
      </div>

      {/* Active item: Tableau de bord */}
      <div className="px-3 pt-3 flex-shrink-0">
        <NavLink
          to="/dashboard"
          end
          className={({ isActive }) =>
            cn('sidebar-item', isActive && 'active')
          }
        >
          <LayoutDashboard size={16} />
          <span>Tableau de bord</span>
        </NavLink>
      </div>

      {/* Scrollable nav sections */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 pb-3">
        {sidebarSections.filter((s) => !s.adminOnly || user?.role === 'super_admin').map((section) => (
          <div key={section.label}>
            <div className="section-label">{section.label}</div>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      cn('sidebar-item', isActive && 'active')
                    }
                    onClick={onClose}
                  >
                    <item.icon size={15} className="flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom: Help + Assistance */}
      <div className="px-3 pb-4 border-t border-gray-100 pt-3 flex-shrink-0">
        <div className="bg-blue-50 rounded-xl p-3 mb-3">
          <div className="flex items-center gap-2 mb-1">
            <HelpCircle size={14} className="text-blue-600" />
            <span className="text-xs font-semibold text-gray-700">Besoin d'aide ?</span>
          </div>
          <p className="text-xs text-gray-500">Contactez notre support.</p>
        </div>
        <button className="btn-primary w-full justify-center text-sm py-2 mb-2">
          Assistance
        </button>
        <button
          onClick={handleLogout}
          className="sidebar-item text-red-500 hover:bg-red-50 hover:text-red-600 w-full"
        >
          <LogOut size={15} />
          <span>Se déconnecter</span>
        </button>
      </div>
    </aside>
  )
}
