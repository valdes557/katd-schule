import { useState, useRef } from 'react'
import { BarChart2, Loader2, TrendingUp, TrendingDown, Wallet, Receipt } from 'lucide-react'
import { feesApi, expensesApi, salariesApi } from '../../lib/api'
import { useCachedFetch } from '../../hooks/useCachedFetch'
import DownloadPdfButton from '../../components/DownloadPdfButton'

const fmtF = (n) => `${Number(n || 0).toLocaleString('fr-FR')} F`

/**
 * Rapports financiers (caissière + principal) : encaissements de pensions,
 * dépenses et salaires — agrégats prêts à transmettre au principal (export PDF).
 */
export default function CaissiereReportsPage() {
  const [month, setMonth] = useState('')
  const pdfRef = useRef(null)

  const feesQ = useCachedFetch('/fees?report', async () => (await feesApi.list('limit=2000')).data || [], [])
  const expensesQ = useCachedFetch('/expenses?report', async () => (await expensesApi.list()).data || [], [])
  const salariesQ = useCachedFetch(`/salaries?report&month=${month}`, async () => {
    const r = await salariesApi.list(month ? `month=${month}` : '')
    return r || {}
  }, [month])

  const loading = feesQ.loading || expensesQ.loading || salariesQ.loading
  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>

  const fees = feesQ.data || []
  const expenses = expensesQ.data || []
  const salariesSummary = salariesQ.data?.summary || {}

  // Agrégats pensions par classe (chaque fee : amount = dû, paid = encaissé)
  const byClass = new Map()
  let totalExpected = 0, totalPaid = 0
  const seenStudents = new Map() // classe → Set d'élèves
  for (const f of fees) {
    const key = f.student?.class?.name || 'Sans classe'
    if (!byClass.has(key)) { byClass.set(key, { expected: 0, paid: 0, students: 0 }); seenStudents.set(key, new Set()) }
    const c = byClass.get(key)
    const net = Math.max(0, (f.amount || 0) - (f.discount?.amount || 0))
    c.expected += net
    c.paid += f.paid || 0
    const sid = f.student?._id || f.student
    if (sid && !seenStudents.get(key).has(String(sid))) { seenStudents.get(key).add(String(sid)); c.students += 1 }
    totalExpected += net
    totalPaid += f.paid || 0
  }
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0)

  const kpis = [
    { label: 'Pensions attendues', value: fmtF(totalExpected), icon: Receipt, cls: 'bg-blue-100 text-blue-600' },
    { label: 'Pensions encaissées', value: fmtF(totalPaid), icon: TrendingUp, cls: 'bg-green-100 text-green-600' },
    { label: 'Reste à encaisser', value: fmtF(Math.max(0, totalExpected - totalPaid)), icon: TrendingDown, cls: 'bg-orange-100 text-orange-600' },
    { label: 'Dépenses totales', value: fmtF(totalExpenses), icon: Wallet, cls: 'bg-red-100 text-red-600' },
  ]

  return (
    <div className="space-y-5 animate-fade-in" ref={pdfRef}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><BarChart2 size={20} className="text-indigo-600" /> Rapports financiers</h1>
          <p className="text-sm text-gray-500">Synthèse des encaissements, dépenses et salaires — à transmettre au principal</p>
        </div>
        <DownloadPdfButton containerRef={pdfRef} filename="rapport-financier.pdf" title="Rapport financier" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="card p-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${k.cls} mb-3`}><k.icon size={18} /></div>
            <div className="text-lg font-bold text-gray-900">{k.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Pensions par classe */}
      <div className="card overflow-x-auto">
        <div className="px-4 py-2.5 border-b bg-gray-50">
          <h3 className="text-sm font-bold text-gray-800">Encaissements par classe</h3>
        </div>
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b">
              <th className="px-4 py-2">Classe</th>
              <th className="px-4 py-2">Élèves</th>
              <th className="px-4 py-2">Attendu</th>
              <th className="px-4 py-2">Encaissé</th>
              <th className="px-4 py-2">Reste</th>
              <th className="px-4 py-2">Taux</th>
            </tr>
          </thead>
          <tbody>
            {[...byClass.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([className, c]) => {
              const rate = c.expected > 0 ? Math.round((c.paid / c.expected) * 100) : 0
              return (
                <tr key={className} className="border-b last:border-0">
                  <td className="px-4 py-2 font-medium text-gray-900">{className}</td>
                  <td className="px-4 py-2 text-gray-600">{c.students}</td>
                  <td className="px-4 py-2 text-gray-600">{fmtF(c.expected)}</td>
                  <td className="px-4 py-2 text-green-600 font-semibold">{fmtF(c.paid)}</td>
                  <td className="px-4 py-2 text-orange-600">{fmtF(Math.max(0, c.expected - c.paid))}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${rate >= 80 ? 'bg-green-50 text-green-600' : rate >= 50 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>{rate}%</span>
                  </td>
                </tr>
              )
            })}
            {byClass.size === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-400">Aucune donnée de pension</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Salaires */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-800">Salaires {month ? `— ${month}` : '(tous les mois)'}</h3>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="input text-xs w-auto no-pdf" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div><div className="text-lg font-bold text-gray-900">{fmtF(salariesSummary.totalGross)}</div><div className="text-[11px] text-gray-500">Brut total</div></div>
          <div><div className="text-lg font-bold text-red-600">{fmtF(salariesSummary.totalDeductions)}</div><div className="text-[11px] text-gray-500">Déductions</div></div>
          <div><div className="text-lg font-bold text-gray-900">{fmtF(salariesSummary.totalNet)}</div><div className="text-[11px] text-gray-500">Net total</div></div>
          <div><div className="text-lg font-bold text-green-600">{fmtF(salariesSummary.totalPaid)}</div><div className="text-[11px] text-gray-500">Déjà payé</div></div>
        </div>
      </div>
    </div>
  )
}
