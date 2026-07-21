import { FileText, Clock, ClipboardList, QrCode, MessageSquare, Bell, Globe } from 'lucide-react'
import SecondaryRoleDashboard from './SecondaryRoleDashboard'

export default function EleveDashboardPage() {
  return (
    <SecondaryRoleDashboard
      subtitle="Mon espace élève"
      quickButtons={[
        { label: 'Mes notes', path: '/dashboard/eleve/notes', icon: FileText, bg: 'bg-blue-600 hover:bg-blue-700' },
        { label: 'Mon emploi du temps', path: '/dashboard/eleve/emploi-du-temps', icon: Clock, bg: 'bg-purple-600 hover:bg-purple-700' },
        { label: 'Mes devoirs', path: '/dashboard/eleve/devoirs', icon: ClipboardList, bg: 'bg-teal-600 hover:bg-teal-700' },
        { label: 'Mon QR de présence', path: '/dashboard/eleve/mon-qr', icon: QrCode, bg: 'bg-orange-500 hover:bg-orange-600' },
        { label: 'Messenger', path: '/dashboard/messagerie', icon: MessageSquare, bg: 'bg-green-600 hover:bg-green-700' },
        { label: 'Annonces', path: '/dashboard/annonces', icon: Bell, bg: 'bg-indigo-600 hover:bg-indigo-700' },
        { label: 'Social', path: '/dashboard/social', icon: Globe, bg: 'bg-rose-600 hover:bg-rose-700' },
      ]}
    />
  )
}
