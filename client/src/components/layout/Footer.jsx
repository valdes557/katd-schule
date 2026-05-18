import { Link } from 'react-router-dom'
import { BookOpen, Facebook, Youtube } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <BookOpen size={16} className="text-white" />
              </div>
              <span className="text-sm font-bold text-gray-900">KATD-SCHÜLE</span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed max-w-xs">
              KATD-SCHÜLE est une plateforme collaborative pour les écoles. Apprenons ensemble, partageons nos réussites et inspirons l'avenir.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-3">À propos</h4>
            <ul className="space-y-2">
              {['Qui sommes-nous ?', 'Nos valeurs', 'Contact'].map((item) => (
                <li key={item}>
                  <Link to="#" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">{item}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-3">Aide</h4>
            <ul className="space-y-2">
              {['FAQ', "Conditions d'utilisation", 'Politique de confidentialité', 'Support'].map((item) => (
                <li key={item}>
                  <Link to="#" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">{item}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-3">Ressources</h4>
            <ul className="space-y-2 mb-5">
              {['Blog', 'Guide des écoles', 'Support'].map((item) => (
                <li key={item}>
                  <Link to="#" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">{item}</Link>
                </li>
              ))}
            </ul>
            <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-3">Suivez-nous</h4>
            <div className="flex items-center gap-3">
              <a href="#" className="text-gray-400 hover:text-blue-600 transition-colors"><Facebook size={18} /></a>
              <a href="#" className="text-gray-400 hover:text-red-600 transition-colors"><Youtube size={18} /></a>
              <a href="#" className="text-gray-400 hover:text-gray-900 transition-colors">
                <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.53V6.77a4.85 4.85 0 01-1.02-.08z"/></svg>
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
              <BookOpen size={11} className="text-white" />
            </div>
            <span className="text-xs text-gray-500">© 2024 KATD-SCHÜLE. Tous droits réservés.</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="#" className="text-xs text-gray-400 hover:text-gray-600">Conditions d'utilisation</Link>
            <Link to="#" className="text-xs text-gray-400 hover:text-gray-600">Politique de confidentialité</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
