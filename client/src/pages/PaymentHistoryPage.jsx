import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { feesApi, parentApi, classesApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { History, Loader2, ChevronDown, ChevronRight, Wallet, CheckCircle2, AlertCircle, Download } from 'lucide-react'

const fmt = (n) => `${(Number(n) || 0).toLocaleString('fr-FR')} F CFA`
const METHOD_LABELS = { cash: 'Espèces', mobile_money: 'Mobile Money', bank: 'Virement', online: 'En ligne' }

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="card p-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color.bg}`}><Icon size={18} className={color.text} /></div>
      <div className="text-lg sm:text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}

/* ─── Vue Directeur : paiements de chaque élève / parent ─── */
function DirectorView() {
  const [classId, setClassId] = useState('')
  const [expanded, setExpanded] = useState({})

  const classesQ = useCachedFetch('/classes?', async () => (await classesApi.list()).data || [], [])
  const classes = classesQ.data || []

  const historyQ = useCachedFetch(
    `/fees/payment-history?${classId}`,
    async () => await feesApi.paymentHistory(classId),
    [classId],
  )
  const rows = historyQ.data?.data || []
  const summary = historyQ.data?.summary || { totalDue: 0, totalPaid: 0, remaining: 0, studentCount: 0 }
  const loading = historyQ.loading

  const toggle = (id) => setExpanded((e) => ({ ...e, [id]: !e[id] }))

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><History size={20} className="text-blue-600" /> Historique des paiements</h1>
        <p className="text-sm text-gray-500">Ce que chaque parent a déjà payé et ce qu'il reste à payer</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total dû" value={fmt(summary.totalDue)} icon={Wallet} color={{ bg: 'bg-blue-100', text: 'text-blue-600' }} />
        <StatCard label="Total payé" value={fmt(summary.totalPaid)} icon={CheckCircle2} color={{ bg: 'bg-green-100', text: 'text-green-600' }} />
        <StatCard label="Reste à payer" value={fmt(summary.remaining)} icon={AlertCircle} color={{ bg: 'bg-amber-100', text: 'text-amber-600' }} />
        <StatCard label="Élèves" value={summary.studentCount} icon={History} color={{ bg: 'bg-purple-100', text: 'text-purple-600' }} />
      </div>

      <div className="card p-4 flex items-center gap-3">
        <label className="text-xs text-gray-600 font-medium">Classe</label>
        <select value={classId} onChange={(e) => setClassId(e.target.value)} className="input text-sm w-60">
          <option value="">Toutes les classes</option>
          {classes.map((c) => <option key={c._id} value={c._id}>{c.name}{c.level ? ` (${c.level})` : ''}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="text-center py-12"><Loader2 size={24} className="animate-spin text-blue-600 mx-auto" /></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-gray-400">Aucun paiement enregistré</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {rows.map((r) => {
              const isOpen = !!expanded[r.studentId]
              const pct = r.totalDue > 0 ? Math.round((r.totalPaid / r.totalDue) * 100) : 0
              return (
                <div key={r.studentId}>
                  <button onClick={() => toggle(r.studentId)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left">
                    {isOpen ? <ChevronDown size={16} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">{r.studentName} <span className="text-xs font-normal text-gray-400">· {r.className}</span></div>
                      <div className="text-xs text-gray-500 truncate">Parent : {r.parentName}{r.parentPhone ? ` · ${r.parentPhone}` : ''}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs text-gray-500">Payé <span className="font-semibold text-green-600">{fmt(r.totalPaid)}</span></div>
                      <div className="text-xs text-gray-500">Reste <span className={`font-semibold ${r.remaining > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{fmt(r.remaining)}</span></div>
                    </div>
                    <div className="hidden sm:block w-24 flex-shrink-0">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full ${pct >= 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
                      <div className="text-[10px] text-gray-400 text-center mt-0.5">{pct}%</div>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-3 bg-gray-50/60">
                      {r.payments.length === 0 ? (
                        <p className="text-xs text-gray-400 py-2 pl-7">Aucun versement encore enregistré</p>
                      ) : (
                        <table className="w-full text-xs mt-1">
                          <thead><tr className="text-gray-400"><th className="text-left font-medium py-1 pl-7">Date</th><th className="text-left font-medium">Libellé</th><th className="text-left font-medium">Méthode</th><th className="text-right font-medium">Montant</th></tr></thead>
                          <tbody>
                            {r.payments.map((p, i) => (
                              <tr key={i} className="border-t border-gray-100">
                                <td className="py-1.5 pl-7 text-gray-600">{p.date ? new Date(p.date).toLocaleDateString('fr-FR') : '—'}</td>
                                <td className="text-gray-700">{p.label}</td>
                                <td className="text-gray-500">{METHOD_LABELS[p.method] || p.method}</td>
                                <td className="text-right font-semibold text-green-600">{fmt(p.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Vue Parent : mes paiements et ce qu'il reste ─── */
function ParentView() {
  const [downloading, setDownloading] = useState(null) // `${feeId}:${index}`
  const feesQ = useCachedFetch('/parent/fees', async () => await parentApi.fees(), [])
  const fees = feesQ.data?.data || []
  const summary = feesQ.data?.summary || { totalDue: 0, totalPaid: 0, remaining: 0 }
  const loading = feesQ.loading

  // Aplatir tous les versements (en conservant l'identifiant du frais et l'index
  // du paiement pour permettre le téléchargement du reçu correspondant)
  const payments = []
  fees.forEach((f) => (f.payments || []).forEach((p, i) => payments.push({ ...p, label: f.label, student: f.student, feeId: f._id, paymentIndex: i })))
  payments.sort((a, b) => new Date(b.date) - new Date(a.date))

  const downloadReceipt = async (feeId, paymentIndex) => {
    const key = `${feeId}:${paymentIndex}`
    setDownloading(key)
    try {
      const { blob, filename } = await feesApi.downloadReceipt(feeId, paymentIndex)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (e) { alert(e.message) }
    setDownloading(null)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><History size={20} className="text-blue-600" /> Historique des paiements</h1>
        <p className="text-sm text-gray-500">Tout ce que vous avez déjà payé et ce qu'il reste</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total dû" value={fmt(summary.totalDue)} icon={Wallet} color={{ bg: 'bg-blue-100', text: 'text-blue-600' }} />
        <StatCard label="Déjà payé" value={fmt(summary.totalPaid)} icon={CheckCircle2} color={{ bg: 'bg-green-100', text: 'text-green-600' }} />
        <StatCard label="Reste à payer" value={fmt(summary.remaining)} icon={AlertCircle} color={{ bg: 'bg-amber-100', text: 'text-amber-600' }} />
      </div>

      {/* Détail par frais */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Détail par frais</h3>
        {loading ? (
          <div className="text-center py-8"><Loader2 size={22} className="animate-spin text-blue-600 mx-auto" /></div>
        ) : fees.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">Aucun frais enregistré</p>
        ) : (
          <div className="space-y-2">
            {fees.map((f) => {
              const remaining = Math.max(0, (f.amount || 0) - (f.paid || 0))
              return (
                <div key={f._id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{f.label}</p>
                    <p className="text-xs text-gray-400">{f.student?.lastName} {f.student?.firstName}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-xs text-gray-500">Payé <span className="font-semibold text-green-600">{fmt(f.paid)}</span> / {fmt(f.amount)}</p>
                    <p className="text-xs text-gray-500">Reste <span className={`font-semibold ${remaining > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{fmt(remaining)}</span></p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Historique des versements */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Mes versements</h3>
        {payments.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">Aucun versement effectué pour le moment</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead><tr className="text-gray-400 text-xs border-b border-gray-100"><th className="text-left font-medium py-2">Date</th><th className="text-left font-medium">Libellé</th><th className="text-left font-medium">Méthode</th><th className="text-right font-medium">Montant</th><th className="text-right font-medium">Reçu</th></tr></thead>
              <tbody>
                {payments.map((p, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 text-gray-600 text-xs">{p.date ? new Date(p.date).toLocaleDateString('fr-FR') : '—'}</td>
                    <td className="text-gray-800">{p.label}</td>
                    <td className="text-gray-500 text-xs">{METHOD_LABELS[p.method] || p.method}</td>
                    <td className="text-right font-semibold text-green-600">{fmt(p.amount)}</td>
                    <td className="text-right">
                      <button
                        title="Télécharger le reçu"
                        onClick={() => downloadReceipt(p.feeId, p.paymentIndex)}
                        disabled={downloading === `${p.feeId}:${p.paymentIndex}`}
                        className="inline-flex items-center justify-center p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                      >
                        {downloading === `${p.feeId}:${p.paymentIndex}`
                          ? <Loader2 size={15} className="animate-spin" />
                          : <Download size={15} />}
                      </button>
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

export default function PaymentHistoryPage() {
  const { user } = useAuth()
  return user?.role === 'parent' ? <ParentView /> : <DirectorView />
}
