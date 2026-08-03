import { CreditCard, Loader2, Receipt } from 'lucide-react'
import { studentsApi } from '../../lib/api'
import { useCachedFetch } from '../../hooks/useCachedFetch'

const fmt = (n) => (Number(n) || 0).toLocaleString('fr-FR')
const STATUS = {
  pending: { label: 'À payer', cls: 'text-amber-700 bg-amber-50 border-amber-200' },
  partial: { label: 'Partiel', cls: 'text-blue-700 bg-blue-50 border-blue-200' },
  paid: { label: 'Payé', cls: 'text-green-700 bg-green-50 border-green-200' },
  overdue: { label: 'En retard', cls: 'text-red-700 bg-red-50 border-red-200' },
}

/** Frais de scolarité de l'élève connecté (lecture seule) : total, payé, solde restant, détail. */
export default function ElevePaiementsPage() {
  const q = useCachedFetch('/students/me/fees', async () => (await studentsApi.myFees()).data || null, [])
  const d = q.data

  if (q.loading) return <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>
  if (!d) return <div className="card p-10 text-center text-sm text-gray-500">Impossible de charger vos frais.</div>

  const { fees = [], totalDue = 0, totalPaid = 0, remaining = 0 } = d

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><CreditCard size={20} className="text-emerald-600" /> Mes paiements</h1>
        <p className="text-sm text-gray-500">Frais de scolarité, montants réglés et solde restant.</p>
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4 text-center">
          <div className="text-lg sm:text-2xl font-bold text-gray-900">{fmt(totalDue)} F</div>
          <div className="text-xs text-gray-500">Total des frais</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-lg sm:text-2xl font-bold text-green-600">{fmt(totalPaid)} F</div>
          <div className="text-xs text-gray-500">Déjà payé</div>
        </div>
        <div className="card p-4 text-center">
          <div className={`text-lg sm:text-2xl font-bold ${remaining > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(remaining)} F</div>
          <div className="text-xs text-gray-500">Solde restant</div>
        </div>
      </div>

      {fees.length === 0 ? (
        <div className="card p-10 text-center">
          <Receipt size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">Aucun frais enregistré pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {fees.map((f) => {
            const st = STATUS[f.status] || STATUS.pending
            const rest = (f.amount || 0) - (f.paid || 0)
            return (
              <div key={f._id} className="card p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-gray-900 truncate">{f.label}</h3>
                    <p className="text-xs text-gray-500">
                      {f.term || ''}{f.academicYear ? ` · ${f.academicYear}` : ''}
                      {f.dueDate ? ` · échéance ${new Date(f.dueDate).toLocaleDateString('fr-FR')}` : ''}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold border rounded-full px-2 py-0.5 shrink-0 ${st.cls}`}>{st.label}</span>
                </div>
                <div className="flex items-center justify-between mt-2 text-sm">
                  <span className="text-gray-600">Payé : <b className="text-green-600">{fmt(f.paid)} F</b> / {fmt(f.amount)} F</span>
                  {rest > 0 && <span className="text-red-600 text-xs font-semibold">Reste {fmt(rest)} F</span>}
                </div>
                {/* Barre de progression */}
                <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${f.amount ? Math.min(100, Math.round(((f.paid || 0) / f.amount) * 100)) : 0}%` }} />
                </div>
                {/* Tranches */}
                {(f.installments || []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {f.installments.map((inst, i) => (
                      <span key={i} className={`text-[11px] border rounded-full px-2 py-0.5 ${inst.paid ? 'text-green-700 bg-green-50 border-green-200' : 'text-gray-500 bg-gray-50 border-gray-200'}`}>
                        {inst.label || `Tranche ${i + 1}`} : {fmt(inst.amount)} F {inst.paid ? '✓' : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="text-xs text-gray-400">Les paiements sont effectués par vos parents ou à la caisse de l'école.</p>
    </div>
  )
}
