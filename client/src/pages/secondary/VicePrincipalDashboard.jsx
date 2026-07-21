import { Clock, BookOpen, ClipboardList, FileText, MessageSquare, CalendarCheck, UserCheck, FolderOpen } from 'lucide-react'
import SecondaryRoleDashboard from './SecondaryRoleDashboard'

export default function VicePrincipalDashboard() {
  return (
    <SecondaryRoleDashboard
      subtitle="Emplois du temps, attribution des classes, examens et suivi pédagogique"
      quickButtons={[
        { label: 'Emplois du temps', path: '/dashboard/emploi-du-temps', icon: Clock, bg: 'bg-blue-600 hover:bg-blue-700' },
        { label: 'Professeurs (classes & matières)', path: '/dashboard/enseignants', icon: UserCheck, bg: 'bg-purple-600 hover:bg-purple-700' },
        { label: 'Classes & Salles', path: '/dashboard/classes', icon: BookOpen, bg: 'bg-teal-600 hover:bg-teal-700' },
        { label: 'Suivi des devoirs', path: '/dashboard/devoirs', icon: ClipboardList, bg: 'bg-orange-500 hover:bg-orange-600' },
        { label: 'Notes & examens', path: '/dashboard/notes', icon: FileText, bg: 'bg-indigo-600 hover:bg-indigo-700' },
        { label: 'Rapports reçus', path: '/dashboard/rapports-recus', icon: FolderOpen, bg: 'bg-rose-600 hover:bg-rose-700' },
        { label: 'Messenger (rendez-vous parents)', path: '/dashboard/messagerie', icon: MessageSquare, bg: 'bg-green-600 hover:bg-green-700' },
        { label: 'Rendez-vous', path: '/dashboard/rendez-vous-ecole', icon: CalendarCheck, bg: 'bg-cyan-600 hover:bg-cyan-700' },
      ]}
    />
  )
}
