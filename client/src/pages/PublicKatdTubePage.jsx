import { Link } from 'react-router-dom'
import PublicHeader from '../components/layout/PublicHeader'
import PublicNavBar from '../components/layout/PublicNavBar'
import Footer from '../components/layout/Footer'
import WhatsAppFab from '../components/WhatsAppFab'
import UserVideosPage from './user/UserVideosPage'
import AdBanner from '../components/ads/AdBanner'
import { Youtube, Sparkles, ArrowLeft } from 'lucide-react'

export default function PublicKatdTubePage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <PublicHeader />
      <PublicNavBar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-6 pt-16">
        {/* Bouton Retour */}
        <div className="mb-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-bold text-gray-700 hover:text-red-600 bg-white hover:bg-red-50 border border-gray-200 hover:border-red-200 rounded-xl transition-all shadow-2xs group"
          >
            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1 text-gray-500 group-hover:text-red-600" />
            <span>Retour à l'accueil</span>
          </Link>
        </div>

        {/* En-tête promotionnel KATDTUBE */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white rounded-2xl p-5 sm:p-6 mb-6 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 bg-white/20 rounded-lg">
                <Youtube size={22} className="text-white" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
                KATDTUBE
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-white text-red-600 shadow-xs">
                  Streaming & Éducation
                </span>
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-white/90 max-w-2xl">
              Plateforme publique de vidéos éducatives, cours, documentaires et divertissement de l'écosystème KATD.
              Recherchez, regardez et téléchargez vos vidéos préférées librement.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/20 text-xs font-semibold text-white/95">
              <Sparkles size={14} className="text-amber-300" /> Accès libre et gratuit
            </span>
          </div>
        </div>

        {/* Bloc publicitaire AdMob / AdSense sous l'en-tête */}
        <AdBanner className="mb-6" />

        {/* Contenu complet de KATDTUBE */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 shadow-xs">
          <UserVideosPage />
        </div>

        {/* Bloc publicitaire bas de page */}
        <AdBanner className="mt-6" />
      </main>

      <Footer />
      <WhatsAppFab />
    </div>
  )
}
