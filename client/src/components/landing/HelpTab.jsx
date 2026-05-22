import { HelpCircle, MessageCircle, ShieldCheck } from 'lucide-react'

export default function HelpTab({ platformData }) {
  const sections = [
    {
      icon: HelpCircle,
      title: 'Support',
      content:
        platformData?.help?.support ||
        'Notre équipe est disponible 7j/7 pour vous assister. Contactez-nous via la rubrique Contacts pour toute question.',
    },
    {
      icon: MessageCircle,
      title: 'FAQ',
      content:
        platformData?.help?.faq ||
        'Consultez notre foire aux questions pour trouver rapidement des réponses à vos interrogations les plus fréquentes.',
    },
    {
      icon: ShieldCheck,
      title: 'Politique de confidentialité',
      content:
        platformData?.help?.privacy ||
        'Nous prenons la protection de vos données très au sérieux. Toutes les informations sont chiffrées et stockées de manière sécurisée.',
    },
    {
      icon: ShieldCheck,
      title: "Conditions d'utilisation",
      content:
        platformData?.help?.terms ||
        "En utilisant KATD-SCHÜLE, vous acceptez nos conditions générales d'utilisation. Veuillez les lire attentivement.",
    },
  ]

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Aide & Support</h2>
      {sections.map((s, i) => (
        <div key={i} className="bg-white border border-gray-100 rounded-xl p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <s.icon size={14} className="text-blue-600" /> {s.title}
          </h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{s.content}</p>
        </div>
      ))}
    </div>
  )
}
