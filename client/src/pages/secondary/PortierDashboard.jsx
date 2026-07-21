import { QrCode, CalendarCheck, Bell, MessageSquare } from 'lucide-react'
import SecondaryRoleDashboard from './SecondaryRoleDashboard'

export default function PortierDashboard() {
  return (
    <SecondaryRoleDashboard
      subtitle="Scan des QR à l'entrée/sortie et gestion des permissions"
      quickButtons={[
        { label: 'Scanner un QR', path: '/dashboard/portier/scan', icon: QrCode, bg: 'bg-blue-600 hover:bg-blue-700' },
        { label: 'Entrées & sorties du jour', path: '/dashboard/portier/journal', icon: CalendarCheck, bg: 'bg-purple-600 hover:bg-purple-700' },
        { label: 'Permissions autorisées', path: '/dashboard/permissions', icon: Bell, bg: 'bg-orange-500 hover:bg-orange-600' },
        { label: 'Messenger', path: '/dashboard/messagerie', icon: MessageSquare, bg: 'bg-green-600 hover:bg-green-700' },
      ]}
    />
  )
}
