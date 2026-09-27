import { Link } from 'react-router-dom'
import {
  Newspaper, Users, Store, Landmark, Rocket, Wallet,
  Plus, User, Globe2, Briefcase, ChevronRight, Sparkles,
  ShoppingBag
} from 'lucide-react'

export default function UserStorePage() {
  const storeItems = [
    {
      title: 'Blogs & Articles',
      desc: 'Articles pédagogiques, conseils éducatifs et actualités rédigés par l\'administration et les enseignants.',
      path: '/u/blogs',
      icon: Newspaper,
      gradient: 'from-blue-600 to-indigo-600',
      badge: 'Nouveau',
      badgeColor: 'bg-yellow-400 text-slate-900',
    },
    {
      title: 'Fil Social KATD',
      desc: 'Publications, partages et réussites partagés par la communauté des écoles et utilisateurs.',
      path: '/u/social',
      icon: Globe2,
      gradient: 'from-indigo-500 to-blue-600',
    },
    {
      title: 'Amis & Messagerie',
      desc: 'Discussions privées, messagerie instantanée et contacts avec d\'autres membres.',
      path: '/u/messages',
      icon: Users,
      gradient: 'from-teal-500 to-emerald-600',
    },
    {
      title: 'News & Recrutements',
      desc: 'Avis de recrutement d\'enseignants, postes vacants et annonces officielles des écoles.',
      path: '/u/news',
      icon: Briefcase,
      gradient: 'from-amber-500 to-orange-600',
    },
    {
      title: 'Espace Marchand',
      desc: 'Boutiques partenaires, vente de fournitures scolaires, livres et services éducatifs.',
      path: '/u/marchand',
      icon: Store,
      gradient: 'from-orange-500 to-amber-600',
    },
    {
      title: 'Actionnaires & Parts',
      desc: 'Devenez actionnaire de KATD-SCHÜLE, suivez l\'évolution de vos parts et percevez vos dividendes.',
      path: '/u/actionnaires',
      icon: Landmark,
      gradient: 'from-indigo-600 to-violet-600',
    },
    {
      title: 'Mes Boosts',
      desc: 'Donnez une visibilité maximale à vos publications pour toucher des milliers d\'utilisateurs.',
      path: '/u/mes-boosts',
      icon: Rocket,
      gradient: 'from-purple-500 to-fuchsia-600',
    },
    {
      title: 'Mon Portefeuille',
      desc: 'Solde, recharges, retraits Mobile Money (Orange, MTN, Wave, Moov) et transferts instantanés.',
      path: '/u/portefeuille',
      icon: Wallet,
      gradient: 'from-emerald-500 to-green-600',
    },
    {
      title: 'Créer une Publication',
      desc: 'Partagez un message, une photo ou une vidéo sur le réseau social de la plateforme.',
      path: '/u/publier',
      icon: Plus,
      gradient: 'from-pink-500 to-rose-600',
    },
    {
      title: 'Mon Profil & Paramètres',
      desc: 'Gérez vos informations de compte, votre photo de profil, votre sécurité et vos coordonnées.',
      path: '/u/profil',
      icon: User,
      gradient: 'from-slate-600 to-gray-800',
    },
  ]

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-in fade-in duration-200">
      {/* En-tête du Store */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 bottom-0 translate-x-8 translate-y-8 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-blue-200 text-xs font-semibold mb-3 backdrop-blur-sm">
            <ShoppingBag size={14} className="text-yellow-400" />
            KATD Store & Services
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
            Toutes vos fonctionnalités réunies
          </h1>
          <p className="text-blue-200 text-xs sm:text-sm leading-relaxed">
            Accédez facilement à l'ensemble des modules, des blogs officiels et des services sans encombrer votre écran principal.
          </p>
        </div>
      </div>

      {/* Grille de cartes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {storeItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className="group bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-200 flex items-start gap-4 hover:-translate-y-0.5"
          >
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${item.gradient} text-white flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform`}>
              <item.icon size={22} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-bold text-gray-900 text-sm sm:text-base group-hover:text-blue-600 transition-colors">
                  {item.title}
                </h2>
                {item.badge && (
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${item.badgeColor || 'bg-blue-100 text-blue-700'}`}>
                    {item.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                {item.desc}
              </p>
            </div>

            <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all shrink-0 self-center" />
          </Link>
        ))}
      </div>
    </div>
  )
}
