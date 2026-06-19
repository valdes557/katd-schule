import { Loader2, AlertCircle, RefreshCw, Printer, FileText } from 'lucide-react'
import { dashboardApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'
import { useAuth } from '../context/AuthContext'

const TYPE_LABEL = { devoir: 'Devoir', exercice: 'Exercice', projet: 'Projet', expose: 'Exposé' }

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function DirectorDetailedReportPage() {
  const { user, school } = useAuth()

  const statsQ = useCachedFetch('/dashboard/stats?', async () => (await dashboardApi.getStats()).data || null, [])
  const hwQ = useCachedFetch('/dashboard/homework-overview', async () => (await dashboardApi.homeworkOverview()).data || { classes: [], byTeacher: [], summary: {} }, [])
  const reportsQ = useCachedFetch('/dashboard/reports?limit=50', async () => (await dashboardApi.getReports('limit=50')).data || [], [])

  const loading = statsQ.loading || hwQ.loading || reportsQ.loading
  const refresh = () => {
    cache.invalidate('/dashboard/stats'); cache.invalidate('/dashboard/homework-overview'); cache.invalidate('/dashboard/reports?limit=50')
    statsQ.refetch(); hwQ.refetch(); reportsQ.refetch()
  }

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>
  if (statsQ.error) return <div className="text-center py-16"><AlertCircle size={36} className="mx-auto text-red-400 mb-3" /><p className="text-sm text-gray-600">{statsQ.error.message}</p><button onClick={refresh} className="btn-primary text-sm mt-4">Réessayer</button></div>

  const s = statsQ.data || {}
  const hw = hwQ.data || { classes: [], byTeacher: [], summary: {} }
  const hwSummary = hw.summary || {}
  const reports = reportsQ.data || []

  const summaryRows = [
    ['Nombre d\'élèves', s.totalStudents || 0],
    ['Nombre d\'enseignants', s.totalTeachers || 0],
    ['Nombre de classes', s.totalClasses || 0],
    ['Taux de présence global', `${s.attendanceRate || 0} %`],
    ['Moyenne générale', `${s.averageGrade || 0} / 20`],
    ['Devoirs donnés', hwSummary.totalHomeworks || 0],
    ['Devoirs entièrement corrigés', hwSummary.fullyGradedHomeworks || 0],
    ['Taux de correction', `${hwSummary.gradedRate || 0} %`],
    ['Copies en attente de correction', hwSummary.pendingCorrection || 0],
    ['Classes sans devoir', hwSummary.classesWithoutHomework || 0],
    ['Contenus multimédias', s.totalMedia || 0],
  ]

  return (
    <div className="space-y-6 animate-fade-in print:space-y-4">
      {/* Barre d'actions — masquée à l'impression */}
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><FileText size={22} className="text-indigo-600" /> Rapport détaillé</h1>
          <p className="text-sm text-gray-500">Synthèse complète de l'établissement — imprimable ou exportable en PDF</p>
        </div>
        <div className="flex gap-2 self-start">
          <button onClick={refresh} className="btn-ghost text-xs border border-gray-200 bg-white"><RefreshCw size={13} /> Actualiser</button>
          <button onClick={() => window.print()} className="btn-primary text-xs"><Printer size={13} /> Imprimer / PDF</button>
        </div>
      </div>

      {/* En-tête du rapport */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{school?.name || 'Établissement'}</h2>
            <p className="text-xs text-gray-500">Rapport établi par {user?.name || 'la direction'} — le {fmtDate(new Date())}</p>
          </div>
        </div>
      </div>

      {/* Synthèse chiffrée */}
      <div className="card p-5">
        <h3 className="text-sm font-bold text-gray-800 mb-3">1. Synthèse chiffrée</h3>
        <table className="w-full text-sm">
          <tbody>
            {summaryRows.map(([label, value]) => (
              <tr key={label} className="border-b border-gray-50 last:border-0">
                <td className="py-2 text-gray-600">{label}</td>
                <td className="py-2 text-right font-semibold text-gray-900">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Devoirs par enseignant */}
      <div className="card p-5">
        <h3 className="text-sm font-bold text-gray-800 mb-3">2. Devoirs &amp; évaluations par enseignant</h3>
        {(hw.byTeacher || []).length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Aucun devoir enregistré.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="py-2 font-medium">Enseignant</th>
                  <th className="py-2 font-medium">Classe(s)</th>
                  <th className="py-2 font-medium">Donnés</th>
                  <th className="py-2 font-medium">Corrigés</th>
                  <th className="py-2 font-medium">À corriger</th>
                  <th className="py-2 font-medium">Types</th>
                </tr>
              </thead>
              <tbody>
                {hw.byTeacher.map((t) => (
                  <tr key={t.teacherId || t.teacherName} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 font-semibold text-gray-800">{t.teacherName}</td>
                    <td className="py-2 text-gray-500">{t.classes.length ? t.classes.join(', ') : '—'}</td>
                    <td className="py-2 text-gray-700">{t.totalHomeworks}</td>
                    <td className="py-2 text-green-600 font-medium">{t.correctedHomeworks}</td>
                    <td className={t.pendingCorrection > 0 ? 'py-2 text-amber-600 font-medium' : 'py-2 text-gray-400'}>{t.pendingCorrection}</td>
                    <td className="py-2 text-gray-500">{Object.entries(t.byType || {}).map(([k, n]) => `${TYPE_LABEL[k] || k}: ${n}`).join(' · ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Devoirs par classe */}
      <div className="card p-5">
        <h3 className="text-sm font-bold text-gray-800 mb-3">3. Suivi des devoirs par classe</h3>
        {(hw.classes || []).length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Aucune classe enregistrée.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="py-2 font-medium">Classe</th>
                  <th className="py-2 font-medium">Devoirs</th>
                  <th className="py-2 font-medium">Copies à corriger</th>
                  <th className="py-2 font-medium">En retard</th>
                </tr>
              </thead>
              <tbody>
                {hw.classes.map((c) => (
                  <tr key={c.classId} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 font-semibold text-gray-800">{c.className} <span className="text-xs font-normal text-gray-400">· {c.level || c.cycle}</span></td>
                    <td className="py-2 text-gray-700">{c.totalHomeworks}</td>
                    <td className={c.ungradedSubmissions > 0 ? 'py-2 text-amber-600 font-medium' : 'py-2 text-gray-400'}>{c.ungradedSubmissions}</td>
                    <td className={c.overdueWithMissing > 0 ? 'py-2 text-red-500 font-medium' : 'py-2 text-gray-400'}>{c.overdueWithMissing}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rapports quotidiens récents */}
      <div className="card p-5">
        <h3 className="text-sm font-bold text-gray-800 mb-3">4. Rapports quotidiens récents des enseignants</h3>
        {reports.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Aucun rapport quotidien soumis.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="py-2 font-medium">Date</th>
                  <th className="py-2 font-medium">Enseignant</th>
                  <th className="py-2 font-medium">Classe(s)</th>
                  <th className="py-2 font-medium">Titre</th>
                  <th className="py-2 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r._id} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 text-gray-500 whitespace-nowrap">{fmtDate(r.date)}</td>
                    <td className="py-2 font-medium text-gray-800">{r.teacher ? `${r.teacher.firstName || ''} ${r.teacher.lastName || ''}`.trim() : '—'}</td>
                    <td className="py-2 text-gray-500">{(r.classes || []).map((c) => c.name).join(', ') || '—'}</td>
                    <td className="py-2 text-gray-700">{r.title || '—'}</td>
                    <td className="py-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${r.status === 'reviewed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {r.status === 'reviewed' ? 'Revu' : 'Soumis'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
