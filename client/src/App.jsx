import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import ExplorerPage from './pages/ExplorerPage'
import EcolesPage from './pages/EcolesPage'
import DashboardLayout from './components/layout/DashboardLayout'
import DashboardPage from './pages/DashboardPage'
import ElevesPage from './pages/ElevesPage'
import EnseignantsPage from './pages/EnseignantsPage'
import NotesPage from './pages/NotesPage'
import PresencePage from './pages/PresencePage'
import MessagingPage from './pages/MessagingPage'
import SouscriptionsPage from './pages/SouscriptionsPage'
import PlaceholderPage from './pages/PlaceholderPage'
import EnrollmentPage from './pages/EnrollmentPage'
import InscriptionsPage from './pages/InscriptionsPage'
import TarifsPage from './pages/TarifsPage'
import SchoolRegistrationPage from './pages/SchoolRegistrationPage'
import AdminLocationsPage from './pages/AdminLocationsPage'
import AdminSchoolRegistrationsPage from './pages/AdminSchoolRegistrationsPage'
import SchoolDetailPage from './pages/SchoolDetailPage'
import ManageSchoolPage from './pages/ManageSchoolPage'
import AdminPlatformPage from './pages/AdminPlatformPage'
import SocialPage from './pages/SocialPage'
import AboutPage from './pages/AboutPage'
import ContactsPage from './pages/ContactsPage'
import AidePage from './pages/AidePage'
import ResourcesPage from './pages/ResourcesPage'
import ExperiencesPage from './pages/ExperiencesPage'
import SupportPage from './pages/SupportPage'
import DashboardSchoolProfilePage from './pages/DashboardSchoolProfilePage'
import ClassesPage from './pages/ClassesPage'
import MatieresPage from './pages/MatieresPage'
import EmploiDuTempsPage from './pages/EmploiDuTempsPage'
import AdminEcolesPage from './pages/AdminEcolesPage'
import ParentChildDetailPage from './pages/ParentChildDetailPage'
import ParentFinancesPage from './pages/ParentFinancesPage'
import ParentControlsPage from './pages/ParentControlsPage'
import ParentAppointmentsPage from './pages/ParentAppointmentsPage'
import ParentDocumentsPage from './pages/ParentDocumentsPage'
import TeacherHomeworkPage from './pages/TeacherHomeworkPage'
import TeacherAnalyticsPage from './pages/TeacherAnalyticsPage'
import TeacherStudentsPage from './pages/TeacherStudentsPage'

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
        <Route path="parents" element={<PlaceholderPage title="Parents / Responsables" />} />
        <Route path="personnel" element={<PlaceholderPage title="Personnel" />} />
        <Route path="devoirs" element={<TeacherHomeworkPage />} />
        <Route path="activites" element={<PlaceholderPage title="Activités scolaires" />} />
        <Route path="ressources" element={<PlaceholderPage title="Ressources pédagogiques" />} />
        <Route path="annonces" element={<PlaceholderPage title="Annonces" />} />
        <Route path="documents" element={<PlaceholderPage title="Documents partagés" />} />
        <Route path="paiements" element={<PlaceholderPage title="Historique des paiements" />} />
        <Route path="factures" element={<PlaceholderPage title="Factures" />} />
        <Route path="rapports" element={<PlaceholderPage title="Tableaux de bord" />} />
        <Route path="rapports/detail" element={<PlaceholderPage title="Rapports détaillés" />} />
        <Route path="statistiques" element={<PlaceholderPage title="Statistiques" />} />
        <Route path="localites" element={<AdminLocationsPage />} />
        <Route path="demandes-ecoles" element={<AdminSchoolRegistrationsPage />} />
        <Route path="ecoles-admin" element={<AdminEcolesPage />} />
        <Route path="page-ecole" element={<ManageSchoolPage />} />
        <Route path="plateforme" element={<AdminPlatformPage />} />

        {/* Teacher routes */}
        <Route path="teacher/eleves" element={<TeacherStudentsPage />} />
        <Route path="teacher/analytics" element={<TeacherAnalyticsPage />} />

        {/* Parent routes */}
        <Route path="parent/enfant/:studentId" element={<ParentChildDetailPage />} />
        <Route path="parent/finances" element={<ParentFinancesPage />} />
        <Route path="parent/controles" element={<ParentControlsPage />} />
        <Route path="parent/rendez-vous" element={<ParentAppointmentsPage />} />
        <Route path="parent/documents" element={<ParentDocumentsPage />} />
      </Route>

      {/* 404 fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
