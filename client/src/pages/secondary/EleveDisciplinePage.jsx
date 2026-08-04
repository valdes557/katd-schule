import { Shield, Loader2 } from 'lucide-react'
import { studentsApi } from '../../lib/api'
import { useCachedFetch } from '../../hooks/useCachedFetch'
import DisciplineView from '../../components/DisciplineView'

/** Dossier discipline de l'élève connecté : retards à l'entrée, absences/retards en classe, permissions. */
export default function EleveDisciplinePage() {
  const q = useCachedFetch('/students/me/discipline', async () => (await studentsApi.myDiscipline()).data || null, [])

  if (q.loading) return <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>
  if (!q.data) return <div className="card p-10 text-center text-sm text-gray-500">Impossible de charger votre dossier.</div>

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Shield size={20} className="text-rose-600" /> Ma discipline</h1>
        <p className="text-sm text-gray-500">Retards, absences et permissions vous concernant.</p>
      </div>
      <DisciplineView data={q.data} />
    </div>
  )
}
