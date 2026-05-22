import { Link } from 'react-router-dom'
import { BookOpen, Globe2, HelpCircle, Phone } from 'lucide-react'

export default function ResourcesTab({ platformData }) {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Ressources</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          to="/ecoles"
          className="bg-white border border-gray-100 rounded-xl p-5 hover:border-blue-300 hover:shadow-card transition-all"
        >
          <BookOpen size={24} className="text-blue-600 mb-3" />
          <h3 className="text-sm font-bold text-gray-900 mb-1">Guide d'écoles</h3>
          <p className="text-xs text-gray-500">
            Découvrez notre annuaire complet des établissements partenaires.
          </p>
        </Link>

        <div className="bg-white border border-gray-100 rounded-xl p-5 hover:border-blue-300 hover:shadow-card transition-all">
          <Globe2 size={24} className="text-purple-600 mb-3" />
          <h3 className="text-sm font-bold text-gray-900 mb-1">Blog</h3>
          <p className="text-xs text-gray-500">
            Articles, actualités et conseils pour la gestion scolaire.
          </p>
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-5 hover:border-blue-300 hover:shadow-card transition-all">
          <HelpCircle size={24} className="text-green-600 mb-3" />
          <h3 className="text-sm font-bold text-gray-900 mb-1">Support</h3>
          <p className="text-xs text-gray-500">
            Assistance technique et pédagogique pour votre établissement.
          </p>
        </div>

        <Link
          to="/ecoles"
          className="bg-white border border-gray-100 rounded-xl p-5 hover:border-blue-300 hover:shadow-card transition-all"
        >
          <Phone size={24} className="text-orange-600 mb-3" />
          <h3 className="text-sm font-bold text-gray-900 mb-1">Contacter une école</h3>
          <p className="text-xs text-gray-500">
            Trouvez et contactez directement les établissements de votre choix.
          </p>
        </Link>
      </div>

      {platformData?.resources?.blog && (
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Blog KATD-SCHÜLE</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{platformData.resources.blog}</p>
        </div>
      )}
    </div>
  )
}
