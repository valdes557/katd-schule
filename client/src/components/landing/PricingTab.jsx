const PLANS = [
  { cycle: 'Maternelle', icon: '🧒', annual: 50000, monthly: 15000, featured: false },
  { cycle: 'Primaire', icon: '📚', annual: 75000, monthly: 22000, featured: true },
  { cycle: 'Secondaire', icon: '🎓', annual: 100000, monthly: 30000, featured: false },
]

const FEATURES = [
  'Toutes les fonctionnalités',
  'Élèves & enseignants illimités',
  'Support prioritaire',
  'Mises à jour gratuites',
]

export default function PricingTab() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h2 className="text-xl font-bold text-gray-900 text-center">Nos tarifs par cycle</h2>
      <p className="text-sm text-gray-600 text-center">
        Souscription par cycle, paiement annuel ou trimestriel
      </p>

      <div className="flex items-center justify-center gap-2 bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-3 text-sm font-medium max-w-2xl mx-auto">
        <Gift size={18} className="flex-shrink-0" />
        <span>
          <strong>1 mois d'essai gratuit</strong> — inscrivez votre établissement sans payer.
          Après 1 mois, l'accès est suspendu jusqu'au paiement de votre souscription.
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {PLANS.map((p) => (
          <div
            key={p.cycle}
            className={`relative bg-white rounded-2xl border-2 p-6 ${
              p.featured ? 'border-blue-500 shadow-card-lg lg:scale-105' : 'border-gray-100'
            }`}
          >
            {p.featured && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                Le plus populaire
              </div>
            )}
            <div className="text-3xl mb-2">{p.icon}</div>
            <div className="text-lg font-bold text-gray-900 mb-1">Cycle {p.cycle}</div>
            <div className="mt-5 mb-1">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-gray-900">
                  {p.annual.toLocaleString()}
                </span>
                <span className="text-sm text-gray-500">F CFA / an</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                ou {p.monthly.toLocaleString()} F CFA / trimestre
              </div>
            </div>
            <div className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 rounded-full px-2.5 py-1 mb-4">
              <Gift size={12} /> 1er mois gratuit
            </div>
            <ul className="space-y-2.5 mb-6">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                  <CheckCircle2 size={15} className="text-green-500 flex-shrink-0 mt-0.5" /> {f}
                </li>
              ))}
            </ul>
            <Link
              to={`/souscrire?cycle=${p.cycle}&plan=trial&amount=${p.annual}&trial=1`}
              className={`block w-full text-center py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                p.featured
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Démarrer l'essai gratuit
            </Link>
            <Link
              to={`/souscrire?cycle=${p.cycle}&plan=annual&amount=${p.annual}`}
              className="block w-full text-center py-2 mt-2 text-xs text-gray-500 hover:text-gray-700"
            >
              ou payer maintenant
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
