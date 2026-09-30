import { Link } from 'react-router-dom'
import { BookOpen, Facebook, Youtube } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <BookOpen size={16} className="text-white" />
              </div>
              <span className="text-sm font-bold text-gray-900">KATD-SCHÜLE</span>
            </Link>
            <p className="text-sm text-gray-500 leading-relaxed max-w-xs">
              KATD-SCHÜLE est une plateforme collaborative pour les écoles. Apprenons ensemble, partageons nos réussites et inspirons l'avenir.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-3">À propos</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><Link to="/apropos" className="hover:text-blue-600 transition-colors">Qui sommes-nous ?</Link></li>
              <li><Link to="/contacts" className="hover:text-blue-600 transition-colors">Nous contacter</Link></li>
              <li><Link to="/experiences" className="hover:text-blue-600 transition-colors">Témoignages</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-3">Légal & Aide</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><Link to="/cgu" className="hover:text-blue-600 transition-colors">Conditions d'utilisation (CGU)</Link></li>
              <li><Link to="/aide" className="hover:text-blue-600 transition-colors">Aide & Confidentialité</Link></li>
              <li><Link to="/contacts" className="hover:text-blue-600 transition-colors">Support technique</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-3">Ressources</h4>
            <ul className="space-y-2 mb-5 text-sm text-gray-500">
              <li><Link to="/blogs" className="hover:text-blue-600 transition-colors font-medium text-blue-700">Blog éducatif</Link></li>
              <li><Link to="/ecoles" className="hover:text-blue-600 transition-colors">Guide des écoles</Link></li>
              <li><Link to="/tarifs" className="hover:text-blue-600 transition-colors">Tarifs & Souscriptions</Link></li>
            </ul>
            <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-3">Suivez-nous</h4>
            <div className="flex items-center gap-3">
              <a href="https://facebook.com" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-blue-600 transition-colors"><Facebook size={18} /></a>
              <a href="https://youtube.com" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-red-600 transition-colors"><Youtube size={18} /></a>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
              <BookOpen size={11} className="text-white" />
            </div>
            <span className="text-xs text-gray-500">© 2026 KATD-SCHÜLE. Tous droits réservés.</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/cgu" className="text-xs text-gray-500 hover:text-gray-800">Conditions d'utilisation</Link>
            <Link to="/aide" className="text-xs text-gray-500 hover:text-gray-800">Politique de confidentialité</Link>
            <Link to="/contacts" className="text-xs text-gray-500 hover:text-gray-800">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
