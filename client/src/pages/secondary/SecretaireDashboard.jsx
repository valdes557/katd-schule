import { Bell, FolderOpen, FileText, MessageSquare, Info } from 'lucide-react'
import SecondaryRoleDashboard from './SecondaryRoleDashboard'

export default function SecretaireDashboard() {
  return (
    <SecondaryRoleDashboard
      subtitle="Annonces de l'établissement, dossiers des enseignants et rapports au principal"
      quickButtons={[
        { label: 'Annonces', path: '/dashboard/annonces', icon: Bell, bg: 'bg-blue-600 hover:bg-blue-700' },
        { label: 'Dossiers enseignants', path: '/dashboard/documents', icon: FolderOpen, bg: 'bg-purple-600 hover:bg-purple-700' },
        { label: 'Mes rapports', path: '/dashboard/mes-rapports', icon: FileText, bg: 'bg-teal-600 hover:bg-teal-700' },
        { label: 'Messenger', path: '/dashboard/messagerie', icon: MessageSquare, bg: 'bg-green-600 hover:bg-green-700' },
        { label: 'Informations générales', path: '/dashboard/infos', icon: Info, bg: 'bg-orange-500 hover:bg-orange-600' },
      ]}
    />
  )
}
