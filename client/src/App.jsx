import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { useAuth } from './context/AuthContext'

// Eager: public landing + login + layout (small, needed immediately)
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import DashboardLayout from './components/layout/DashboardLayout'
import DashboardPage from './pages/DashboardPage'
import PlaceholderPage from './pages/PlaceholderPage'

// Lazy: every secondary page is loaded on demand to shrink the initial bundle
const ExplorerPage = lazy(() => import('./pages/ExplorerPage'))
const EcolesPage = lazy(() => import('./pages/EcolesPage'))
const ElevesPage = lazy(() => import('./pages/ElevesPage'))
const EnseignantsPage = lazy(() => import('./pages/EnseignantsPage'))
const NotesPage = lazy(() => import('./pages/NotesPage'))
const PresencePage = lazy(() => import('./pages/PresencePage'))
const MessagingPage = lazy(() => import('./pages/MessagingPage'))
const SouscriptionsPage = lazy(() => import('./pages/SouscriptionsPage'))
const EnrollmentPage = lazy(() => import('./pages/EnrollmentPage'))
const InscriptionsPage = lazy(() => import('./pages/InscriptionsPage'))
const TarifsPage = lazy(() => import('./pages/TarifsPage'))
const SchoolRegistrationPage = lazy(() => import('./pages/SchoolRegistrationPage'))
const AdminLocationsPage = lazy(() => import('./pages/AdminLocationsPage'))
const AdminSchoolRegistrationsPage = lazy(() => import('./pages/AdminSchoolRegistrationsPage'))
const SchoolDetailPage = lazy(() => import('./pages/SchoolDetailPage'))
const ManageSchoolPage = lazy(() => import('./pages/ManageSchoolPage'))
const AdminPlatformPage = lazy(() => import('./pages/AdminPlatformPage'))
const SocialPage = lazy(() => import('./pages/SocialPage'))
const AboutPage = lazy(() => import('./pages/AboutPage'))
const ContactsPage = lazy(() => import('./pages/ContactsPage'))
const AidePage = lazy(() => import('./pages/AidePage'))
const ResourcesPage = lazy(() => import('./pages/ResourcesPage'))
const ExperiencesPage = lazy(() => import('./pages/ExperiencesPage'))
const SupportPage = lazy(() => import('./pages/SupportPage'))
const DashboardSchoolProfilePage = lazy(() => import('./pages/DashboardSchoolProfilePage'))
const ClassesPage = lazy(() => import('./pages/ClassesPage'))
const MatieresPage = lazy(() => import('./pages/MatieresPage'))
const EmploiDuTempsPage = lazy(() => import('./pages/EmploiDuTempsPage'))
const AdminEcolesPage = lazy(() => import('./pages/AdminEcolesPage'))
const ParentChildDetailPage = lazy(() => import('./pages/ParentChildDetailPage'))
const ParentFinancesPage = lazy(() => import('./pages/ParentFinancesPage'))
const ParentControlsPage = lazy(() => import('./pages/ParentControlsPage'))
const ParentAppointmentsPage = lazy(() => import('./pages/ParentAppointmentsPage'))
const ParentDocumentsPage = lazy(() => import('./pages/ParentDocumentsPage'))
const TeacherHomeworkPage = lazy(() => import('./pages/TeacherHomeworkPage'))
const TeacherAnalyticsPage = lazy(() => import('./pages/TeacherAnalyticsPage'))
const TeacherStudentsPage = lazy(() => import('./pages/TeacherStudentsPage'))
const TeacherActivitiesPage = lazy(() => import('./pages/TeacherActivitiesPage'))
const TeacherResourcesPage = lazy(() => import('./pages/TeacherResourcesPage'))
const TeacherReportsPage = lazy(() => import('./pages/TeacherReportsPage'))
const DirectorReportsPage = lazy(() => import('./pages/DirectorReportsPage'))
const ParentsPage = lazy(() => import('./pages/ParentsPage'))
const DirectorFeesPage = lazy(() => import('./pages/DirectorFeesPage'))
const AdminSchoolSubjectsPage = lazy(() => import('./pages/AdminSchoolSubjectsPage'))
const ParentSectionPage = lazy(() => import('./pages/ParentSectionPage'))
const BulletinPage = lazy(() => import('./pages/BulletinPage'))
const ParentActivitiesPage = lazy(() => import('./pages/ParentActivitiesPage'))

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
  return (
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
        <Route path="inscriptions" element={<InscriptionsPage />} />

        <Route path="profil" element={<DashboardSchoolProfilePage />} />
        <Route path="infos" element={<PlaceholderPage title="Informations générales" />} />
        <Route path="classes" element={<ClassesPage />} />
        <Route path="matieres" element={<MatieresPage />} />
        <Route path="emploi-du-temps" element={<EmploiDuTempsPage />} />
        <Route path="parents" element={<ParentsPage />} />
        <Route path="personnel" element={<PlaceholderPage title="Personnel" />} />
        <Route path="devoirs" element={<TeacherHomeworkPage />} />
        <Route path="activites" element={<TeacherActivitiesPage />} />
        <Route path="ressources" element={<TeacherResourcesPage />} />
        <Route path="annonces" element={<PlaceholderPage title="Annonces" />} />
        <Route path="documents" element={<PlaceholderPage title="Documents partagés" />} />
        <Route path="paiements" element={<PlaceholderPage title="Historique des paiements" />} />
        <Route path="factures" element={<PlaceholderPage title="Factures" />} />
        <Route path="rapports" element={<DirectorReportsPage />} />
        <Route path="rapports/detail" element={<PlaceholderPage title="Rapports détaillés" />} />
        <Route path="statistiques" element={<PlaceholderPage title="Statistiques" />} />
        <Route path="localites" element={<AdminLocationsPage />} />
        <Route path="demandes-ecoles" element={<AdminSchoolRegistrationsPage />} />
        <Route path="ecoles-admin" element={<AdminEcolesPage />} />
        <Route path="page-ecole" element={<ManageSchoolPage />} />
        <Route path="plateforme" element={<AdminPlatformPage />} />
        <Route path="matieres-ecoles" element={<AdminSchoolSubjectsPage />} />

        {/* Director routes */}
        <Route path="director/pensions" element={<DirectorFeesPage />} />

        {/* Teacher routes */}
        <Route path="teacher/eleves" element={<TeacherStudentsPage />} />
        <Route path="teacher/analytics" element={<TeacherAnalyticsPage />} />
        <Route path="teacher/rapports" element={<TeacherReportsPage />} />

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
      </Route>

      {/* 404 fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  )
}
