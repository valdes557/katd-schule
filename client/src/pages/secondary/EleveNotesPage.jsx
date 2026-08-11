import { useState } from 'react'
import { FileText, Loader2 } from 'lucide-react'
import { gradesApi } from '../../lib/api'
import { useCachedFetch } from '../../hooks/useCachedFetch'

const TYPE_LABELS = { devoir: 'Devoir', examen: 'Examen', composition: 'Composition', oral: 'Oral', tp: 'TP', examen_blanc: 'Examen blanc', examen_officiel: 'Examen officiel' }

/** Notes de l'élève connecté (lecture seule — le serveur limite à SES notes). */
export default function EleveNotesPage() {
  const [term, setTerm] = useState('')
  const gradesQ = useCachedFetch(`/grades?eleve&term=${term}`, async () => {
    const r = await gradesApi.list(term ? `term=${term}` : '')
    return r.data || []
  }, [term])

  const grades = gradesQ.data || []
  const avg = grades.length
    ? Math.round((grades.reduce((s, g) => s + (g.value || 0), 0) / grades.length) * 10) / 10
    : null

  if (gradesQ.loading) return <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><FileText size={20} className="text-indigo-600" /> Mes notes</h1>
          <p className="text-sm text-gray-500">{avg !== null ? `Moyenne : ${avg} / 20 (${grades.length} note(s))` : 'Aucune note pour le moment'}</p>
        </div>
        <select value={term} onChange={(e) => setTerm(e.target.value)} className="input text-xs w-auto self-start">
          <option value="">Tous les trimestres</option>
          <option value="Trimestre 1">Trimestre 1</option>
          <option value="Trimestre 2">Trimestre 2</option>
          <option value="Trimestre 3">Trimestre 3</option>
        </select>
      </div>

      {grades.length === 0 ? (
        <div className="card p-10 text-center">
          <FileText size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">Aucune note enregistrée.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="px-4 py-3">Matière</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3">Trimestre</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {grades.map((g) => {
                const value = g.value || 0
                return (
                  <tr key={g._id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{g.subject}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{TYPE_LABELS[g.type] || g.type || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${value >= 10 ? 'text-green-600' : 'text-red-600'}`}>{value}</span>
                      <span className="text-xs text-gray-400"> / 20</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{g.term || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{g.date ? new Date(g.date).toLocaleDateString('fr-FR') : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
