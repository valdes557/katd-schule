import { Gift } from 'lucide-react'

export default function SupportTab({ platformData }) {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Soutenez KATD-SCHÜLE</h2>
      <p className="text-sm text-gray-600">
        {platformData?.donationDescription ||
          'Votre soutien nous aide à améliorer la plateforme et à offrir des outils toujours plus performants aux écoles africaines. Chaque contribution compte, à partir de 100 F CFA.'}
      </p>

      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 text-center">
        <Gift size={40} className="text-blue-600 mx-auto mb-3" />
        <div className="text-3xl font-bold text-gray-900 mb-1">À partir de 100 F CFA</div>
        <p className="text-sm text-gray-500">Montant minimum de soutien</p>
      </div>

      {platformData?.donationAccounts?.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-gray-900">Comptes de donation</h3>
          {platformData.donationAccounts.map((a, i) => (
            <div
              key={i}
              className="bg-white border border-gray-100 rounded-xl p-4 flex items-center justify-between"
            >
              <div>
                <div className="text-sm font-semibold text-gray-900">{a.accountName}</div>
                <div className="text-xs text-gray-500">{a.bankName}</div>
              </div>
              <code className="text-sm font-mono bg-gray-50 px-3 py-1 rounded-lg text-blue-700">
                {a.accountNumber}
              </code>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl p-5 text-center text-sm text-gray-400">
          Les informations de compte seront bientôt disponibles.
        </div>
      )}
    </div>
  )
}
