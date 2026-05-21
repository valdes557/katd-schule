import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, GraduationCap } from 'lucide-react'
import PublicHeader from '../components/layout/PublicHeader'
import Footer from '../components/layout/Footer'

const plans = [
  {
    cycle: 'Maternelle',
    icon: '🌸',
    color: 'from-orange-500 to-amber-400',
    accent: 'orange',
    quarterly: 10000,
    annual: 30000,
    features: ['Gestion des élèves', 'Suivi de présence', 'Messagerie parents', 'Vitrine multimédia', 'Support email'],
  },
  {
    cycle: 'Primaire',
    icon: '📚',
    color: 'from-blue-600 to-blue-400',
    accent: 'blue',
    quarterly: 15000,
    annual: 40000,
    features: ['Tout Maternelle +', 'Notes & Bulletins', 'Emploi du temps', 'Export PDF/Excel', 'Support prioritaire'],
    popular: true,
  },
  {
    cycle: 'Secondaire',
    icon: '🎓',
    color: 'from-emerald-500 to-green-400',
    accent: 'green',
    quarterly: 20000,
    annual: 55000,
    features: ['Tout Primaire +', 'Gestion avancée des matières', 'Statistiques détaillées', 'Multi-classes illimité', 'Support dédié 7j/7'],
  },
]

const ACCENTS = {
  orange: { light: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600', btn: 'bg-orange-500 hover:bg-orange-600' },
  blue: { light: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', btn: 'bg-blue-600 hover:bg-blue-700' },
  green: { light: 'bg-green-50', border: 'border-green-200', text: 'text-green-600', btn: 'bg-green-600 hover:bg-green-700' },
}

export default function TarifsPage() {
  const [billing, setBilling] = useState('annual')

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader />
      <div className="max-w-5xl mx-auto px-4 py-14">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Nos formules d'abonnement</h1>
          <p className="text-base text-gray-600 mb-6">Choisissez la formule adaptée à votre cycle scolaire</p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
            <button onClick={() => setBilling('trimestrial')} className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${billing === 'trimestrial' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              Trimestriel
            </button>
            <button onClick={() => setBilling('annual')} className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${billing === 'annual' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              Annuel <span className="text-green-600 text-xs font-semibold ml-1">-17%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const c = ACCENTS[plan.accent]
            const price = billing === 'annual' ? plan.annual : plan.quarterly
            const period = billing === 'annual' ? '/an' : '/trimestre'
            return (
              <div key={plan.cycle} className={`bg-white rounded-2xl overflow-hidden border ${plan.popular ? 'ring-2 ring-blue-600 border-blue-200' : 'border-gray-100'} hover:shadow-card-lg transition-all relative`}>
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">POPULAIRE</div>
                )}
                <div className={`bg-gradient-to-r ${plan.color} p-6 text-white`}>
                  <div className="text-3xl mb-2">{plan.icon}</div>
                  <div className="text-lg font-bold">{plan.cycle}</div>
                </div>
                <div className="p-6">
                  <div className="mb-5">
                    <span className="text-3xl font-bold text-gray-900">{price.toLocaleString()}</span>
                    <span className="text-sm text-gray-500 ml-1">F CFA {period}</span>
                  </div>
                  <div className="space-y-2.5 mb-6">
                    {plan.features.map((f) => (
                      <div key={f} className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" /> {f}
                      </div>
                    ))}
                  </div>
                  <Link
                    to={`/souscrire?cycle=${plan.cycle}&plan=${billing}&amount=${price}`}
                    className={`w-full flex items-center justify-center gap-2 text-white text-sm font-semibold py-3 rounded-xl ${c.btn} transition-colors`}
                  >
                    <GraduationCap size={16} /> S'inscrire
                  </Link>
                </div>
              </div>
            )
          })}
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          Tous les prix incluent l'accès complet à la plateforme. Paiement sécurisé par Mobile Money.
        </p>
      </div>
      <Footer />
    </div>
  )
}
