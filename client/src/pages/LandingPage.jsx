import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, BookOpen, GraduationCap, CheckCircle2,
  ChevronRight, Star, Loader2, Zap, Shield, BarChart2,
  Globe, Users, School, ChevronLeft,
} from 'lucide-react'
import PublicHeader from '../components/layout/PublicHeader'
import Footer from '../components/layout/Footer'
import { schoolsApi, platformApi, bannersApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'

// Carrousel des bannières promotionnelles gérées par l'administrateur.
function BannerCarousel() {
  const q = useCachedFetch('/banners', async () => (await bannersApi.list()).data || [], [])
  const banners = q.data || []
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (banners.length <= 1) return
    const id = setInterval(() => setIdx((i) => (i + 1) % banners.length), 5000)
    return () => clearInterval(id)
  }, [banners.length])

  if (!banners.length) return null
  const go = (i) => setIdx((i + banners.length) % banners.length)
  const b = banners[idx]

  const Inner = (
    <div className="relative aspect-[16/5] sm:aspect-[16/4] bg-gray-900">
      <img src={b.image} alt={b.title || ''} className="w-full h-full object-cover" />
      {(b.title || b.subtitle) && (
        <div className="absolute inset-0 flex flex-col justify-center px-6 sm:px-12 bg-gradient-to-r from-black/50 to-transparent text-white">
          {b.title && <h2 className="text-xl sm:text-3xl font-extrabold drop-shadow">{b.title}</h2>}
          {b.subtitle && <p className="text-sm sm:text-lg text-white/90 mt-1 max-w-xl">{b.subtitle}</p>}
        </div>
      )}
    </div>
  )

  return (
    <section className="relative max-w-7xl mx-auto">
      {b.link ? <a href={b.link} target="_blank" rel="noreferrer">{Inner}</a> : Inner}
      {banners.length > 1 && (
        <>
          <button onClick={() => go(idx - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5"><ChevronLeft size={18} /></button>
          <button onClick={() => go(idx + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5"><ChevronRight size={18} /></button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {banners.map((_, i) => (
              <button key={i} onClick={() => go(i)} className={`w-2 h-2 rounded-full ${i === idx ? 'bg-white' : 'bg-white/40'}`} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

const FEATURES = [
  { icon: GraduationCap, title: 'Gestion complète', desc: 'Élèves, enseignants, classes, notes — tout centralisé', color: 'text-blue-600', bg: 'bg-blue-50' },
  { icon: Users, title: 'Communication', desc: 'Messagerie intégrée entre parents, enseignants et direction', color: 'text-purple-600', bg: 'bg-purple-50' },
  { icon: BarChart2, title: 'Statistiques', desc: 'Tableaux de bord et rapports en temps réel', color: 'text-green-600', bg: 'bg-green-50' },
  { icon: Shield, title: 'Sécurisé', desc: 'Données hébergées en toute sécurité avec chiffrement SSL', color: 'text-orange-600', bg: 'bg-orange-50' },
  { icon: Globe, title: 'Multi-pays', desc: "Disponible au Cameroun, Côte d'Ivoire, Gabon, Sénégal…", color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { icon: Zap, title: 'Rapide & Simple', desc: 'Interface intuitive, prise en main en moins de 5 minutes', color: 'text-yellow-600', bg: 'bg-yellow-50' },
]

const PLANS = [
  {
    cycle: 'Maternelle', icon: '🌸',
    gradient: 'from-orange-500 to-amber-400',
    btnClass: 'bg-orange-500 hover:bg-orange-600 text-white',
    ringClass: 'ring-orange-300',
    quarterly: 10000, annual: 30000,
    features: ['Gestion des élèves', 'Suivi de présence', 'Messagerie parents', 'Vitrine multimédia', 'Support email'],
  },
  {
    cycle: 'Primaire', icon: '📚',
    gradient: 'from-blue-600 to-blue-400',
    btnClass: 'bg-blue-600 hover:bg-blue-700 text-white',
    ringClass: 'ring-blue-500',
    quarterly: 15000, annual: 40000, popular: true,
    features: ['Tout Maternelle +', 'Notes & Bulletins', 'Emploi du temps', 'Export PDF/Excel', 'Support prioritaire'],
  },
  {
    cycle: 'Secondaire', icon: '🎓',
    gradient: 'from-emerald-500 to-green-400',
    btnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    ringClass: 'ring-emerald-400',
    quarterly: 20000, annual: 55000,
    features: ['Tout Primaire +', 'Gestion avancée des matières', 'Statistiques détaillées', 'Multi-classes illimité', 'Support dédié 7j/7'],
  },
]

export default function LandingPage() {
  const [selectedPlans, setSelectedPlans] = useState({ Maternelle: 'annual', Primaire: 'annual', Secondaire: 'annual' })

  // Bundle schools + experiences into one cache entry
  const landingQ = useCachedFetch('/landing/home', async () => {
    const [sRes, eRes] = await Promise.all([
      schoolsApi.list('limit=8'),
      platformApi.getExperiences(),
    ])
    return {
      schools: sRes.data?.data || sRes.data || [],
      experiences: eRes.data?.slice(0, 3) || [],
    }
  }, [])

  const schools = landingQ.data?.schools || []
  const experiences = landingQ.data?.experiences || []
  const loadingSchools = landingQ.loading

  const togglePlan = (cycle, value) =>
    setSelectedPlans((prev) => ({ ...prev, [cycle]: value }))

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />

      {/* Bannières promotionnelles (carrousel) */}
      <BannerCarousel />

      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 text-white">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-10 left-[8%] w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-10 right-[8%] w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-blue-700/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.75s' }} />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-32 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 text-sm mb-8 animate-pulse">
            <span className="w-2 h-2 bg-green-400 rounded-full" />
            Déjà +500 écoles en Afrique nous font confiance
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold mb-6 leading-tight tracking-tight">
            La plateforme scolaire<br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-yellow-300 via-orange-300 to-pink-300">
              #1 en Afrique
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-blue-100 max-w-2xl mx-auto mb-10 leading-relaxed">
            Gérez votre école, connectez parents et enseignants, publiez vos actualités.
            Digitalisation complète — simple, rapide et sécurisée.
          </p>

          <div className="flex flex-wrap gap-4 justify-center mb-14">
            <Link
              to="/souscrire"
              className="inline-flex items-center gap-2 bg-white text-blue-800 font-bold px-7 py-4 rounded-xl hover:bg-yellow-50 transition-all text-base shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transform"
            >
              Inscrire mon école <ArrowRight size={18} />
            </Link>
            <Link
              to="/ecoles"
              className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/30 text-white font-semibold px-7 py-4 rounded-xl hover:bg-white/20 transition-all text-base"
            >
              <School size={16} /> Voir les écoles
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-sm mx-auto">
            {[['500+', 'Écoles'], ['50 000+', 'Élèves'], ['5', 'Pays']].map(([num, label]) => (
              <div key={label}>
                <div className="text-3xl sm:text-4xl font-extrabold">{num}</div>
                <div className="text-sm text-blue-200 mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 60L1440 60L1440 0C1200 45 960 60 720 50C480 40 240 15 0 30L0 60Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* ═══ DASHBOARD PREVIEW STRIP ═══ */}
      <section className="py-12 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6 text-white shadow-xl">
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-xl sm:text-2xl font-bold mb-2">Tableau de bord intelligent</h2>
              <p className="text-blue-100 text-sm leading-relaxed">
                Visualisez les performances de votre école en temps réel. Élèves, présences,
                notes, messagerie — tout en un coup d'œil.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 grid grid-cols-2 gap-3 min-w-[200px]">
              {[
                { label: 'Élèves', value: '1 245', color: 'text-yellow-300' },
                { label: 'Enseignants', value: '48', color: 'text-green-300' },
                { label: 'Classes', value: '32', color: 'text-pink-300' },
                { label: 'Présence', value: '94%', color: 'text-orange-300' },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <div className={`text-xl font-extrabold ${s.color}`}>{s.value}</div>
                  <div className="text-[10px] text-blue-200">{s.label}</div>
                </div>
              ))}
            </div>
            <Link
              to="/souscrire"
              className="inline-flex items-center gap-2 bg-white text-blue-700 font-bold px-5 py-3 rounded-xl text-sm whitespace-nowrap hover:bg-yellow-50 transition-all"
            >
              Essayer gratuitement <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Tout ce dont votre école a besoin</h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Une suite complète d'outils pour digitaliser chaque aspect de la vie scolaire
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc, color, bg }) => (
              <div
                key={title}
                className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-lg transition-all hover:-translate-y-1 transform"
              >
                <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center mb-4`}>
                  <Icon size={20} className={color} />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-1.5">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SCHOOLS ═══ */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Nos écoles partenaires</h2>
              <p className="text-gray-500">Des établissements d'excellence dans toute l'Afrique francophone</p>
            </div>
            <Link
              to="/ecoles"
              className="hidden sm:inline-flex items-center gap-1.5 text-blue-600 font-semibold text-sm hover:gap-2.5 transition-all"
            >
              Voir toutes <ChevronRight size={16} />
            </Link>
          </div>

          {loadingSchools ? (
            <div className="flex justify-center py-12">
              <Loader2 size={28} className="animate-spin text-blue-600" />
            </div>
          ) : schools.length === 0 ? (
            <p className="text-center text-gray-400 py-12">Aucune école publiée pour le moment.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {schools.map((school) => {
                const initials = school.name?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
                const colors = ['from-blue-600 to-indigo-700', 'from-emerald-500 to-teal-600', 'from-purple-600 to-pink-600', 'from-orange-500 to-red-500']
                const colorIdx = school.name?.charCodeAt(0) % colors.length
                return (
                  <div
                    key={school._id}
                    className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1 transform"
                  >
                    <div className={`h-24 bg-gradient-to-br ${colors[colorIdx]} flex items-center justify-center`}>
                      {school.logo ? (
                        <img src={school.logo} alt="" className="w-14 h-14 rounded-xl object-cover" />
                      ) : (
                        <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center text-white text-xl font-bold">
                          {initials}
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="text-sm font-bold text-gray-900 mb-0.5 line-clamp-1">{school.name}</h3>
                      <p className="text-xs text-gray-400 mb-2">
                        {school.address?.city}{school.address?.city && school.address?.country ? ', ' : ''}{school.address?.country}
                      </p>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {school.cycles?.map((c) => (
                          <span key={c} className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{c}</span>
                        ))}
                      </div>
                      <Link
                        to={`/ecole/${school._id}`}
                        className="w-full block text-center text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 py-2 rounded-lg transition-colors"
                      >
                        Voir les détails →
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="text-center mt-7 sm:hidden">
            <Link to="/ecoles" className="inline-flex items-center gap-1.5 text-blue-600 font-semibold text-sm">
              Voir toutes les écoles <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ PRICING — per-cycle toggle ═══ */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Nos formules d'abonnement</h2>
            <p className="text-gray-500">Choisissez la période de facturation adaptée à chaque cycle scolaire</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map((plan) => {
              const billing = selectedPlans[plan.cycle]
              const price = billing === 'annual' ? plan.annual : plan.quarterly
              const period = billing === 'annual' ? '/an' : '/trimestre'
              return (
                <div
                  key={plan.cycle}
                  className={`bg-white rounded-2xl border overflow-hidden transition-all hover:shadow-xl ${
                    plan.popular
                      ? `ring-2 ${plan.ringClass} border-transparent shadow-lg`
                      : 'border-gray-100 hover:-translate-y-1 transform'
                  }`}
                >
                  {plan.popular && (
                    <div className="text-center bg-blue-600 text-white text-xs font-bold py-1.5 tracking-wide">
                      ⭐ PLUS POPULAIRE
                    </div>
                  )}
                  <div className={`bg-gradient-to-br ${plan.gradient} p-5 text-white`}>
                    <span className="text-3xl">{plan.icon}</span>
                    <h3 className="text-lg font-bold mt-1 flex items-center gap-2">
                      {plan.cycle}
                      {plan.cycle === 'Secondaire' && (
                        <span className="text-[10px] font-semibold bg-white/25 px-2 py-0.5 rounded-full">Bientôt</span>
                      )}
                    </h3>
                  </div>
                  <div className="p-5">
                    {/* Per-card plan toggle */}
                    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-4">
                      <button
                        onClick={() => togglePlan(plan.cycle, 'trimestrial')}
                        className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all ${
                          billing === 'trimestrial' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Trimestriel
                      </button>
                      <button
                        onClick={() => togglePlan(plan.cycle, 'annual')}
                        className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all ${
                          billing === 'annual' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Annuel <span className="text-green-500 font-bold ml-0.5">-17%</span>
                      </button>
                    </div>

                    <div className="mb-4">
                      <span className="text-4xl font-extrabold text-gray-900">{price.toLocaleString()}</span>
                      <span className="text-sm text-gray-400 ml-2">F CFA {period}</span>
                    </div>

                    <div className="space-y-2 mb-5">
                      {plan.features.map((f) => (
                        <div key={f} className="flex items-center gap-2 text-sm text-gray-600">
                          <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" /> {f}
                        </div>
                      ))}
                    </div>

                    {plan.cycle === 'Secondaire' ? (
                      <button
                        type="button"
                        disabled
                        title="Ce cycle n'est pas encore disponible"
                        className="w-full flex items-center justify-center gap-2 font-semibold py-3 rounded-xl text-sm bg-gray-100 text-gray-400 cursor-not-allowed"
                      >
                        🚧 Disponible très bientôt
                      </button>
                    ) : (
                      <Link
                        to={`/souscrire?cycle=${plan.cycle}&plan=${billing}&amount=${price}`}
                        className={`w-full flex items-center justify-center gap-2 font-semibold py-3 rounded-xl text-sm transition-colors ${plan.btnClass}`}
                      >
                        <GraduationCap size={15} /> S'inscrire
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            ✅ Accès complet · 🔒 Paiement sécurisé · 📞 Support inclus · 🎁 Essai 30 jours
          </p>
        </div>
      </section>

      {/* ═══ TESTIMONIALS ═══ */}
      {experiences.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">Ce que disent nos directeurs</h2>
              <p className="text-gray-500">Plus de 500 établissements nous font confiance</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {experiences.map((exp) => (
                <div key={exp._id} className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:shadow-md transition-all">
                  <div className="flex gap-0.5 mb-3">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} size={13} className={s <= exp.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'} />
                    ))}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed italic mb-4">"{exp.content}"</p>
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xs font-bold">
                      {exp.authorName?.[0]?.toUpperCase()}
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{exp.authorName}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center mt-7">
              <Link
                to="/experiences"
                className="inline-flex items-center gap-1.5 text-blue-600 font-semibold text-sm hover:gap-2.5 transition-all"
              >
                Voir tous les témoignages <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ═══ CTA ═══ */}
      <section className="py-20 bg-gradient-to-br from-blue-900 to-indigo-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="text-4xl mb-4">🚀</div>
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">Prêt à digitaliser votre école ?</h2>
          <p className="text-blue-200 text-lg mb-8 max-w-xl mx-auto">
            Rejoignez +500 établissements qui font déjà confiance à KATD-SCHÜLE.
            Essai gratuit 30 jours, sans carte bancaire.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              to="/souscrire"
              className="inline-flex items-center gap-2 bg-white text-blue-800 font-bold px-8 py-4 rounded-xl hover:bg-yellow-50 transition-all text-base shadow-xl hover:-translate-y-0.5 transform"
            >
              Commencer gratuitement <ArrowRight size={18} />
            </Link>
            <Link
              to="/contacts"
              className="inline-flex items-center gap-2 border border-white/30 text-white font-semibold px-8 py-4 rounded-xl hover:bg-white/10 transition-all text-base"
            >
              Nous contacter
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
