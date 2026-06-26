import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense, useEffect, Component } from 'react'
import { useAuth } from './context/AuthContext'

// Eager: public landing + login + layout (small, needed immediately)
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import DashboardLayout from './components/layout/DashboardLayout'
import DashboardPage from './pages/DashboardPage'

// Variante de lazy() qui enregistre aussi le « factory » d'import, afin de pouvoir
// précharger tous les chunks de page en arrière-plan (navigation instantanée).
const pagePrefetchers = []
// Recharge la page UNE seule fois si un chunk JS est introuvable.
// Cas typique : apres un nouveau deploiement, les anciens chunks (ancien hash)
// n'existent plus -> l'import() dynamique echoue et l'ecran reste blanc tant
// que l'utilisateur ne rafraichit pas manuellement.
const CHUNK_RELOAD_KEY = 'katd_chunk_reloaded'
function isChunkLoadError(err) {
  const msg = (err && (err.message || err.toString())) || ''
  return /Loading chunk|dynamically imported module|Importing a module script failed|Failed to fetch|error loading dynamically/i.test(msg)
}
function importWithRetry(factory) {
  return factory().catch((err) => {
    if (isChunkLoadError(err) && !sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
      window.location.reload()
      return new Promise(() => {})
    }
    throw err
  })
}

function lazyPage(factory) {
  pagePrefetchers.push(factory)
  return lazy(() => importWithRetry(factory))
}

// Empeche tout ecran totalement blanc en cas d'erreur de chargement de route.
class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(error) {
    if (isChunkLoadError(error) && !sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
      window.location.reload()
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-6">
          <p className="text-gray-700 font-medium">Impossible de charger cette page.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Recharger la page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
// Déclenche le téléchargement de tous les chunks de page pendant un temps mort,
// sans bloquer le rendu courant. Best-effort : les échecs sont ignorés.
function prefetchAllPages() {
  let i = 0
  const run = () => {
    // Petits lots pour ne pas saturer le réseau d'un coup
    for (let n = 0; n < 4 && i < pagePrefetchers.length; n++, i++) {
      try { pagePrefetchers[i]() } catch (_) {}
    }
    if (i < pagePrefetchers.length) schedule()
  }
  const schedule = () => {
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 2000 })
    else setTimeout(run, 200)
  }
  schedule()
}

// Lazy: every secondary page is loaded on demand to shrink the initial bundle
const ExplorerPage = lazyPage(() => import('./pages/ExplorerPage'))
const EcolesPage = lazyPage(() => import('./pages/EcolesPage'))
const ElevesPage = lazyPage(() => import('./pages/ElevesPage'))
const EnseignantsPage = lazyPage(() => import('./pages/EnseignantsPage'))
const NotesPage = lazyPage(() => import('./pages/NotesPage'))
const PresencePage = lazyPage(() => import('./pages/PresencePage'))
const MessagingPage = lazyPage(() => import('./pages/MessagingPage'))
const SouscriptionsPage = lazyPage(() => import('./pages/SouscriptionsPage'))
const PortefeuillePage = lazyPage(() => import('./pages/PortefeuillePage'))
const EnrollmentPage = lazyPage(() => import('./pages/EnrollmentPage'))
const InscriptionsPage = lazyPage(() => import('./pages/InscriptionsPage'))
const TarifsPage = lazyPage(() => import('./pages/TarifsPage'))
const SchoolRegistrationPage = lazyPage(() => import('./pages/SchoolRegistrationPage'))
const AdminLocationsPage = lazyPage(() => import('./pages/AdminLocationsPage'))
const AdminSchoolRegistrationsPage = lazyPage(() => import('./pages/AdminSchoolRegistrationsPage'))
const SchoolDetailPage = lazyPage(() => import('./pages/SchoolDetailPage'))
const ManageSchoolPage = lazyPage(() => import('./pages/ManageSchoolPage'))
const AdminPlatformPage = lazyPage(() => import('./pages/AdminPlatformPage'))
const SocialPage = lazyPage(() => import('./pages/SocialPage'))
const AboutPage = lazyPage(() => import('./pages/AboutPage'))
const ContactsPage = lazyPage(() => import('./pages/ContactsPage'))
const AidePage = lazyPage(() => import('./pages/AidePage'))
const ResourcesPage = lazyPage(() => import('./pages/ResourcesPage'))
const ExperiencesPage = lazyPage(() => import('./pages/ExperiencesPage'))
const SupportPage = lazyPage(() => import('./pages/SupportPage'))
const DashboardSchoolProfilePage = lazyPage(() => import('./pages/DashboardSchoolProfilePage'))
const ClassesPage = lazyPage(() => import('./pages/ClassesPage'))
const MatieresPage = lazyPage(() => import('./pages/MatieresPage'))
const EmploiDuTempsPage = lazyPage(() => import('./pages/EmploiDuTempsPage'))
const AdminEcolesPage = lazyPage(() => import('./pages/AdminEcolesPage'))
const ParentChildDetailPage = lazyPage(() => import('./pages/ParentChildDetailPage'))
const ParentFinancesPage = lazyPage(() => import('./pages/ParentFinancesPage'))
const ParentControlsPage = lazyPage(() => import('./pages/ParentControlsPage'))
const ParentAppointmentsPage = lazyPage(() => import('./pages/ParentAppointmentsPage'))
const ParentDocumentsPage = lazyPage(() => import('./pages/ParentDocumentsPage'))
const TeacherHomeworkPage = lazyPage(() => import('./pages/TeacherHomeworkPage'))
const TeacherAnalyticsPage = lazyPage(() => import('./pages/TeacherAnalyticsPage'))
const TeacherStudentsPage = lazyPage(() => import('./pages/TeacherStudentsPage'))
const TeacherActivitiesPage = lazyPage(() => import('./pages/TeacherActivitiesPage'))
const TeacherResourcesPage = lazyPage(() => import('./pages/TeacherResourcesPage'))
const TeacherReportsPage = lazyPage(() => import('./pages/TeacherReportsPage'))
const DirectorReportsPage = lazyPage(() => import('./pages/DirectorReportsPage'))
const DirectorStatisticsPage = lazyPage(() => import('./pages/DirectorStatisticsPage'))
const DirectorDetailedReportPage = lazyPage(() => import('./pages/DirectorDetailedReportPage'))
const ParentsPage = lazyPage(() => import('./pages/ParentsPage'))
const DirectorFeesPage = lazyPage(() => import('./pages/DirectorFeesPage'))
const AdminSchoolSubjectsPage = lazyPage(() => import('./pages/AdminSchoolSubjectsPage'))
const ParentSectionPage = lazyPage(() => import('./pages/ParentSectionPage'))
const BulletinPage = lazyPage(() => import('./pages/BulletinPage'))
const ParentActivitiesPage = lazyPage(() => import('./pages/ParentActivitiesPage'))
const DashboardSocialPage = lazyPage(() => import('./pages/DashboardSocialPage'))
const AnnoncesPage = lazyPage(() => import('./pages/AnnoncesPage'))
const PaymentHistoryPage = lazyPage(() => import('./pages/PaymentHistoryPage'))
const FacturesPage = lazyPage(() => import('./pages/FacturesPage'))
const SalariesPage = lazyPage(() => import('./pages/SalariesPage'))
const TeacherSalaryPage = lazyPage(() => import('./pages/TeacherSalaryPage'))
const DocumentsPage = lazyPage(() => import('./pages/DocumentsPage'))
const InfosPage = lazyPage(() => import('./pages/InfosPage'))
const TeacherAttendanceAdminPage = lazyPage(() => import('./pages/TeacherAttendanceAdminPage'))
const TeacherAttendanceDashboardPage = lazyPage(() => import('./pages/TeacherAttendanceDashboardPage'))
const TeacherAttendanceScanPage = lazyPage(() => import('./pages/TeacherAttendanceScanPage'))
const PersonnelPage = lazyPage(() => import('./pages/PersonnelPage'))
const UserPresencePage = lazyPage(() => import('./pages/UserPresencePage'))
const AiChatPage = lazyPage(() => import('./pages/AiChatPage'))
const DirectorAiPage = lazyPage(() => import('./pages/DirectorAiPage'))
const AdminAiPage = lazyPage(() => import('./pages/AdminAiPage'))
const AdminBannersPage = lazyPage(() => import('./pages/AdminBannersPage'))
// Espace utilisateur grand public
const UserLayout = lazyPage(() => import('./pages/user/UserLayout'))
const UserSocialPage = lazyPage(() => import('./pages/user/UserSocialPage'))
const UserPublishPage = lazyPage(() => import('./pages/user/UserPublishPage'))
const UserMessengerPage = lazyPage(() => import('./pages/user/UserMessengerPage'))
const UserProfilePage = lazyPage(() => import('./pages/user/UserProfilePage'))

function PageFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <svg className="animate-spin h-7 w-7 text-blue-600" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-xs text-gray-400">Chargement…</span>
      </div>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm text-gray-500">Chargement...</span>
        </div>
      </div>
    )
  }
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  // Précharge en arrière-plan tous les chunks de page une fois l'app montée :
  // le clic sur une fonctionnalité affiche alors la page sans temps de chargement.
  useEffect(() => { sessionStorage.removeItem(CHUNK_RELOAD_KEY); prefetchAllPages() }, [])

  return (
    <RouteErrorBoundary>
    <Suspense fallback={<PageFallback />}>
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/explorer" element={<ExplorerPage />} />
      <Route path="/ecoles" element={<EcolesPage />} />
      <Route path="/inscription/:schoolId" element={<EnrollmentPage />} />
      <Route path="/social" element={<SocialPage />} />
      <Route path="/apropos" element={<AboutPage />} />
      <Route path="/contacts" element={<ContactsPage />} />
      <Route path="/aide" element={<AidePage />} />
      <Route path="/ressources" element={<ResourcesPage />} />
      <Route path="/experiences" element={<ExperiencesPage />} />
      <Route path="/support-social" element={<SupportPage />} />
      <Route path="/tarifs" element={<TarifsPage />} />
      <Route path="/souscrire" element={<SchoolRegistrationPage />} />
      <Route path="/ecole/:schoolId" element={<SchoolDetailPage />} />

      {/* Protected dashboard routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="eleves" element={<ElevesPage />} />
        <Route path="enseignants" element={<EnseignantsPage />} />
        <Route path="notes" element={<NotesPage />} />
        <Route path="presence" element={<PresencePage />} />
        <Route path="messagerie" element={<MessagingPage />} />
        <Route path="souscriptions" element={<SouscriptionsPage />} />
        <Route path="portefeuille" element={<PortefeuillePage />} />
        <Route path="inscriptions" element={<InscriptionsPage />} />

        <Route path="profil" element={<DashboardSchoolProfilePage />} />
        <Route path="infos" element={<InfosPage />} />
        <Route path="classes" element={<ClassesPage />} />
        <Route path="matieres" element={<MatieresPage />} />
        <Route path="emploi-du-temps" element={<EmploiDuTempsPage />} />
        <Route path="parents" element={<ParentsPage />} />
        <Route path="personnel" element={<PersonnelPage />} />
        <Route path="suivi-connexions" element={<UserPresencePage />} />
        <Route path="ia-chat" element={<AiChatPage />} />
        <Route path="ia" element={<DirectorAiPage />} />
        <Route path="ia-admin" element={<AdminAiPage />} />
        <Route path="bannieres" element={<AdminBannersPage />} />
        <Route path="devoirs" element={<TeacherHomeworkPage />} />
        <Route path="activites" element={<TeacherActivitiesPage />} />
        <Route path="ressources" element={<TeacherResourcesPage />} />
        <Route path="annonces" element={<AnnoncesPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="paiements" element={<PaymentHistoryPage />} />
        <Route path="factures" element={<FacturesPage />} />
        <Route path="salaires" element={<SalariesPage />} />
        <Route path="rapports" element={<DirectorReportsPage />} />
        <Route path="rapports/detail" element={<DirectorDetailedReportPage />} />
        <Route path="statistiques" element={<DirectorStatisticsPage />} />
        <Route path="localites" element={<AdminLocationsPage />} />
        <Route path="demandes-ecoles" element={<AdminSchoolRegistrationsPage />} />
        <Route path="ecoles-admin" element={<AdminEcolesPage />} />
        <Route path="page-ecole" element={<ManageSchoolPage />} />
        <Route path="plateforme" element={<AdminPlatformPage />} />
        <Route path="matieres-ecoles" element={<AdminSchoolSubjectsPage />} />

        {/* Director routes */}
        <Route path="director/pensions" element={<DirectorFeesPage />} />
        <Route path="pointage" element={<TeacherAttendanceAdminPage />} />
        <Route path="pointage/rapports" element={<TeacherAttendanceDashboardPage />} />

        {/* Teacher routes */}
        <Route path="teacher/eleves" element={<TeacherStudentsPage />} />
        <Route path="teacher/pointage" element={<TeacherAttendanceScanPage />} />
        <Route path="teacher/analytics" element={<TeacherAnalyticsPage />} />
        <Route path="teacher/rapports" element={<TeacherReportsPage />} />
        <Route path="teacher/salaires" element={<TeacherSalaryPage />} />

        {/* Parent routes */}
        <Route path="parent/enfant/:studentId" element={<ParentChildDetailPage />} />
        <Route path="parent/notes" element={<ParentSectionPage section="notes" />} />
        <Route path="parent/presence" element={<ParentSectionPage section="attendance" />} />
        <Route path="parent/presence-classe" element={<ParentSectionPage section="classattendance" />} />
        <Route path="parent/devoirs" element={<ParentSectionPage section="homework" />} />
        <Route path="parent/completion" element={<ParentSectionPage section="completion" />} />
        <Route path="parent/enseignants" element={<ParentSectionPage section="teachers" />} />
        <Route path="parent/emploi-du-temps" element={<ParentSectionPage section="timetable" />} />
        <Route path="parent/matieres" element={<ParentSectionPage section="subjects" />} />
        <Route path="parent/frais" element={<ParentSectionPage section="fees" />} />
        <Route path="bulletin" element={<BulletinPage />} />
        <Route path="bulletin/:studentId" element={<BulletinPage />} />
        <Route path="parent/finances" element={<ParentFinancesPage />} />
        <Route path="parent/controles" element={<ParentControlsPage />} />
        <Route path="parent/rendez-vous" element={<ParentAppointmentsPage />} />
        <Route path="parent/documents" element={<ParentDocumentsPage />} />
        <Route path="parent/activites" element={<ParentActivitiesPage section="activities" />} />
        <Route path="parent/ressources" element={<ParentActivitiesPage section="resources" />} />
        <Route path="social" element={<DashboardSocialPage />} />
      </Route>

      {/* Espace utilisateur (grand public) — atterrissage direct sur le social */}
      <Route
        path="/u"
        element={
          <ProtectedRoute>
            <UserLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<UserSocialPage />} />
        <Route path="publier" element={<UserPublishPage />} />
        <Route path="messages" element={<UserMessengerPage />} />
        <Route path="profil" element={<UserProfilePage />} />
      </Route>

      {/* 404 fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
    </RouteErrorBoundary>
  )
}