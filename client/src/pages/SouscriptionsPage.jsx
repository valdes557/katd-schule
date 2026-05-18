import { useState } from 'react'
import { CreditCard, CheckCircle2, Clock, AlertCircle, Download, History } from 'lucide-react'
import { subscriptionPlans } from '../data/mockData'

const paymentHistory = [
  { id: 1, date: '10 Mai 2024', amount: '40 000 F CFA', method: 'Mobile Money', cycle: 'Primaire', type: 'Annuel', status: 'success' },
  { id: 2, date: '10 Fév. 2024', amount: '15 000 F CFA', method: 'Orange Money', cycle: 'Primaire', type: 'Trimestriel', status: 'success' },
  { id: 3, date: '10 Nov. 2023', amount: '15 000 F CFA', method: 'MTN Money', cycle: 'Primaire', type: 'Trimestriel', status: 'success' },
  { id: 4, date: '05 Sept. 2023', amount: '15 000 F CFA', method: 'Mobile Money', cycle: 'Primaire', type: 'Trimestriel', status: 'success' },
]

const planColors = {
  orange: { gradient: 'from-orange-500 to-amber-400', light: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600', btn: 'bg-orange-500 hover:bg-orange-600' },
  blue: { gradient: 'from-blue-600 to-blue-400', light: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', btn: 'bg-blue-600 hover:bg-blue-700' },
  green: { gradient: 'from-green-600 to-emerald-400', light: 'bg-green-50', border: 'border-green-200', text: 'text-green-600', btn: 'bg-green-600 hover:bg-green-700' },
}

export default function SouscriptionsPage() {
  const [selected, setSelected] = useState({ cycleIndex: 1, type: 'annual' })
  const [showPayment, setShowPayment] = useState(false)

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <CreditCard size={22} className="text-blue-600" />
          Souscriptions & Paiements
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Gérez vos abonnements par cycle scolaire</p>
      </div>

      {/* Current subscription status */}
      <div className="card p-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={18} />
              <span className="font-semibold text-lg">Abonnement Actif</span>
              <span className="bg-white/20 text-xs px-2 py-0.5 rounded-full">Annuel</span>
            </div>
            <div className="text-blue-100 text-sm mb-1">Cycle Primaire · École Les Petits Génies</div>
            <div className="text-blue-100 text-sm">Valable jusqu'au <strong className="text-white">31 Août 2024</strong></div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">40 000</div>
            <div className="text-blue-200 text-sm">F CFA / an</div>
          </div>
        </div>
        <div className="mt-4 bg-white/10 rounded-full h-2">
          <div className="bg-white h-2 rounded-full" style={{ width: '72%' }} />
        </div>
        <div className="flex justify-between text-xs text-blue-200 mt-1">
          <span>Sept. 2023</span>
          <span>72% de l'abonnement utilisé</span>
          <span>Août 2024</span>
        </div>
      </div>

      {/* Plans */}
      <div>
        <h2 className="text-base font-bold text-gray-900 mb-4">Nos formules d'abonnement</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {subscriptionPlans.map((plan, idx) => {
            const c = planColors[plan.color]
            const isActive = idx === 1
            return (
              <div key={plan.cycle} className={`card overflow-hidden ${isActive ? 'ring-2 ring-blue-600' : ''}`}>
                <div className={`bg-gradient-to-r ${c.gradient} p-5 text-white`}>
                  <div className="text-2xl mb-1">{plan.icon}</div>
                  <div className="text-base font-bold">{plan.cycle}</div>
                  {isActive && <span className="inline-block bg-white/20 text-xs px-2 py-0.5 rounded-full mt-1">Votre plan actuel</span>}
                </div>
                <div className="p-5">
                  <div className="space-y-2 mb-4">
                    <div className={`p-3 rounded-xl ${c.light} ${c.border} border`}>
                      <div className="text-xs text-gray-500">Trimestriel</div>
                      <div className={`text-base font-bold ${c.text}`}>{plan.quarterly.label}</div>
                    </div>
                    <div className={`p-3 rounded-xl ${c.light} ${c.border} border`}>
                      <div className="text-xs text-gray-500">Annuel</div>
                      <div className={`text-base font-bold ${c.text}`}>{plan.annual.label}</div>
                    </div>
                  </div>
                  <div className="space-y-2 mb-4">
                    {['Accès à toutes les fonctionnalités', 'Support prioritaire', 'Mises à jour incluses', 'Export PDF/Excel'].map((f) => (
                      <div key={f} className="flex items-center gap-2 text-xs text-gray-600">
                        <CheckCircle2 size={12} className="text-green-500 flex-shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => { setSelected({ cycleIndex: idx, type: 'annual' }); setShowPayment(true) }}
                    className={`w-full text-white text-sm font-semibold py-2.5 rounded-lg ${c.btn} transition-colors`}
                  >
                    {isActive ? 'Renouveler' : 'Souscrire'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Payment methods */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Méthodes de paiement acceptées</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { name: 'Stripe', desc: 'Carte bancaire', color: 'bg-indigo-50 border-indigo-100', icon: '💳' },
            { name: 'PayPal', desc: 'Compte PayPal', color: 'bg-blue-50 border-blue-100', icon: '🅿️' },
            { name: 'Mobile Money', desc: 'MTN, Orange', color: 'bg-orange-50 border-orange-100', icon: '📱' },
            { name: 'Wave', desc: 'Paiement Wave', color: 'bg-cyan-50 border-cyan-100', icon: '🌊' },
          ].map((pm) => (
            <div key={pm.name} className={`border ${pm.color} rounded-xl p-3 flex items-center gap-3`}>
              <span className="text-xl">{pm.icon}</span>
              <div>
                <div className="text-sm font-medium text-gray-800">{pm.name}</div>
                <div className="text-xs text-gray-500">{pm.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment history */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <History size={15} className="text-gray-400" />
            Historique des paiements
          </h3>
          <button className="btn-ghost text-xs border border-gray-200">
            <Download size={13} /> Exporter
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Date', 'Cycle', 'Type', 'Méthode', 'Montant', 'Statut'].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 pb-3 pr-6">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paymentHistory.map((p) => (
                <tr key={p.id}>
                  <td className="py-3 pr-6 text-sm text-gray-700">{p.date}</td>
                  <td className="py-3 pr-6"><span className="badge badge-blue text-xs">{p.cycle}</span></td>
                  <td className="py-3 pr-6 text-sm text-gray-600">{p.type}</td>
                  <td className="py-3 pr-6 text-sm text-gray-600">{p.method}</td>
                  <td className="py-3 pr-6 text-sm font-semibold text-gray-800">{p.amount}</td>
                  <td className="py-3">
                    <span className="badge badge-green text-xs">
                      <CheckCircle2 size={10} className="mr-1" /> Payé
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment modal */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Finaliser le paiement</h3>
            <p className="text-sm text-gray-500 mb-5">{subscriptionPlans[selected.cycleIndex]?.cycle} · Abonnement {selected.type === 'annual' ? 'annuel — 40 000 F CFA' : 'trimestriel — 15 000 F CFA'}</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Méthode de paiement</label>
                <select className="input text-sm">
                  <option>Mobile Money (MTN / Orange)</option>
                  <option>Carte bancaire (Stripe)</option>
                  <option>PayPal</option>
                  <option>Wave</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Numéro de téléphone</label>
                <input placeholder="+225 07 XX XX XX" className="input text-sm" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowPayment(false)} className="btn-ghost flex-1 justify-center border border-gray-200">Annuler</button>
              <button onClick={() => setShowPayment(false)} className="btn-primary flex-1 justify-center">
                <CreditCard size={14} /> Payer maintenant
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
