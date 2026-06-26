import { Link } from 'react-router-dom'
import { teacherApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { Wallet, Loader2, CheckCircle2, Clock, Banknote, ArrowUpFromLine } from 'lucide-react'

const fmt = (n) => `${(Number(n) || 0).toLocaleString('fr-FR')} F CFA`
const METHOD_LABELS = {
  cash: 'Espèces', mtn_momo: 'MTN Mobile Money', royalkatd: 'RoyalKATD', futurra: 'Futurra',
  orange_money: 'Orange Money', bank_transfer: 'Virement bancaire',
  mobile_money: 'Mobile Money', bank: 'Virement', online: 'En ligne',
}
const monthLabel = (m) => {
  if (!m) return '—'
  const [y, mo] = m.split('-')
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

export default function TeacherSalaryPage() {
  const salariesQ = useCachedFetch('/teacher/salaries', async () => await teacherApi.salaries(), [])
  const salaries = salariesQ.data?.data || []
  const summary = salariesQ.data?.summary || { total: 0, totalPaid: 0, totalPending: 0, totalDeductions: 0 }
  const loading = salariesQ.loading

  // Fiche du mois le plus récent (les salaires sont triés par mois décroissant côté API)
  const latest = salaries[0]
  const monthlyGross = latest?.grossAmount ?? latest?.amount ?? 0
  const monthlyNet = latest?.netAmount ?? latest?.amount ?? 0

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Wallet size={20} className="text-blue-600" /> Mes salaires</h1>
        <p className="text-sm text-gray-500">État détaillé de vos salaires : brut, déductions et net reçu</p>
      </div>

      <Link to="/dashboard/portefeuille" className="card p-4 flex items-center justify-between hover:shadow-md transition group">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center"><Wallet size={18} className="text-emerald-600" /></div>
          <div>
            <div className="text-sm font-semibold text-gray-900">Mon portefeuille</div>
            <div className="text-xs text-gray-500">Consultez votre solde et demandez un retrait (traité sous 24h)</div>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 group-hover:gap-2 transition-all"><ArrowUpFromLine size={16} /> Retirer</span>
      </Link>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4"><div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-green-100"><Banknote size={18} className="text-green-600" /></div><div className="text-lg sm:text-2xl font-bold text-gray-900">{fmt(summary.totalPaid)}</div><div className="text-xs text-gray-500 mt-0.5">Total accumulé (reçu)</div></div>
        <div className="card p-4"><div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-blue-100"><Wallet size={18} className="text-blue-600" /></div><div className="text-lg sm:text-2xl font-bold text-gray-900">{fmt(monthlyGross)}</div><div className="text-xs text-gray-500 mt-0.5">Salaire mensuel (brut)</div></div>
        <div className="card p-4"><div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-red-100"><Clock size={18} className="text-red-600" /></div><div className="text-lg sm:text-2xl font-bold text-gray-900">{fmt(summary.totalDeductions)}</div><div className="text-xs text-gray-500 mt-0.5">Déductions totales</div></div>
        <div className="card p-4"><div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-purple-100"><CheckCircle2 size={18} className="text-purple-600" /></div><div className="text-lg sm:text-2xl font-bold text-gray-900">{fmt(monthlyNet)}</div><div className="text-xs text-gray-500 mt-0.5">Net du mois</div></div>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <div className="text-center py-12"><Loader2 size={24} className="animate-spin text-blue-600 mx-auto" /></div>
        ) : salaries.length === 0 ? (
          <div className="text-center py-12 text-gray-400">Aucun salaire enregistré pour le moment</div>
        ) : (
          <table className="w-full min-w-[720px]">
            <thead><tr className="border-b border-gray-100 bg-gray-50">
              {['Mois', 'Brut', 'Déductions', 'Net reçu', 'Statut', 'Payé le', 'Méthode'].map((h) => <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {salaries.map((s) => (
                <tr key={s._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900 capitalize">{monthLabel(s.month)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{fmt(s.grossAmount ?? s.amount)}</td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap">
                    {s.deductions > 0
                      ? <span className="text-red-600">− {fmt(s.deductions)}{s.deductionReason ? <span className="block text-[10px] text-gray-400 font-normal">{s.deductionReason}</span> : null}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">{fmt(s.netAmount ?? s.amount)}</td>
                  <td className="px-4 py-3">
                    {s.status === 'paid'
                      ? <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200"><CheckCircle2 size={12} /> Payé</span>
                      : <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200"><Clock size={12} /> En attente</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{s.paidAt ? new Date(s.paidAt).toLocaleDateString('fr-FR') : '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{METHOD_LABELS[s.method] || s.method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}