import { CreditCard, History, Wallet, Receipt, BarChart2, MessageSquare } from 'lucide-react'
import SecondaryRoleDashboard from './SecondaryRoleDashboard'

export default function CaissiereDashboard() {
  return (
    <SecondaryRoleDashboard
      subtitle="Encaissement des pensions, rapports financiers et préparation des salaires"
      quickButtons={[
        { label: 'Pensions & frais', path: '/dashboard/director/pensions', icon: CreditCard, bg: 'bg-blue-600 hover:bg-blue-700' },
        { label: 'Historique paiements', path: '/dashboard/paiements', icon: History, bg: 'bg-purple-600 hover:bg-purple-700' },
        { label: 'Rapports financiers', path: '/dashboard/rapports-financiers', icon: BarChart2, bg: 'bg-teal-600 hover:bg-teal-700' },
        { label: 'Salaires (préparation)', path: '/dashboard/salaires', icon: Wallet, bg: 'bg-orange-500 hover:bg-orange-600' },
        { label: 'Factures', path: '/dashboard/factures', icon: Receipt, bg: 'bg-indigo-600 hover:bg-indigo-700' },
        { label: 'Mon portefeuille', path: '/dashboard/portefeuille', icon: Wallet, bg: 'bg-emerald-600 hover:bg-emerald-700' },
        { label: 'Messenger', path: '/dashboard/messagerie', icon: MessageSquare, bg: 'bg-green-600 hover:bg-green-700' },
      ]}
    />
  )
}
