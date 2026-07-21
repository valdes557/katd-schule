import { CalendarCheck, Users, MessageSquare, ClipboardList, Bell, Phone } from 'lucide-react'
import SecondaryRoleDashboard from './SecondaryRoleDashboard'

export default function SurveillantDashboard() {
  return (
    <SecondaryRoleDashboard
      subtitle="Discipline : arrivées, retards, absences et permissions"
      quickButtons={[
        { label: 'Présences du jour', path: '/dashboard/surveillance', icon: CalendarCheck, bg: 'bg-blue-600 hover:bg-blue-700' },
        { label: 'Appels des professeurs', path: '/dashboard/presence', icon: ClipboardList, bg: 'bg-purple-600 hover:bg-purple-700' },
        { label: 'Permissions', path: '/dashboard/permissions', icon: Bell, bg: 'bg-orange-500 hover:bg-orange-600' },
        { label: 'Contacts parents', path: '/dashboard/contacts-parents', icon: Phone, bg: 'bg-teal-600 hover:bg-teal-700' },
        { label: 'Messenger', path: '/dashboard/messagerie', icon: MessageSquare, bg: 'bg-green-600 hover:bg-green-700' },
        { label: 'Élèves', path: '/dashboard/eleves', icon: Users, bg: 'bg-indigo-600 hover:bg-indigo-700' },
      ]}
    />
  )
}
