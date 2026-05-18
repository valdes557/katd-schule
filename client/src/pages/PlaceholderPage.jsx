import { Construction } from 'lucide-react'

export default function PlaceholderPage({ title = 'Page en construction' }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
      <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-5">
        <Construction size={28} className="text-blue-400" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">{title}</h2>
      <p className="text-sm text-gray-500 max-w-sm">
        Cette section est en cours de développement et sera disponible prochainement.
      </p>
    </div>
  )
}
