import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Play, Users, GraduationCap, BookOpen, Award,
  Globe2, ShieldCheck, Zap, Heart, MessageCircle, Share2,
  CheckCircle2, Sparkles, TrendingUp, MapPin,
} from 'lucide-react'
import PublicHeader from '../components/layout/PublicHeader'
import Footer from '../components/layout/Footer'
import { mediaApi, schoolsApi } from '../lib/api'

const features = [
  { icon: Users, title: 'Gestion complète', desc: 'Élèves, enseignants, classes, parents — tout dans une interface intuitive.', color: 'bg-blue-50 text-blue-600' },
  { icon: GraduationCap, title: 'Outils pédagogiques', desc: 'Notes, bulletins, devoirs, présence et emploi du temps automatisés.', color: 'bg-purple-50 text-purple-600' },
  { icon: Globe2, title: 'Réseau mondial', desc: 'Connectez votre école à un réseau international d\'établissements.', color: 'bg-green-50 text-green-600' },
  { icon: ShieldCheck, title: 'Sécurité avancée', desc: 'Authentification multi-facteurs et données chiffrées de bout en bout.', color: 'bg-orange-50 text-orange-600' },
  { icon: Zap, title: 'Rapide & moderne', desc: 'Interface fluide, mises à jour automatiques, support 7j/7.', color: 'bg-rose-50 text-rose-600' },
  { icon: Sparkles, title: 'Vitrine multimédia', desc: 'Partagez vidéos, photos et podcasts pour valoriser votre établissement.', color: 'bg-cyan-50 text-cyan-600' },
]

const stats = [
  { value: '120+', label: 'Écoles connectées' },
  { value: '15K+', label: 'Élèves suivis' },
  { value: '8', label: 'Pays représentés' },
  { value: '99,9%', label: 'Disponibilité' },
]

const testimonials = [
  {
    name: 'Mme Diallo Aminata',
    role: 'Directrice, École Lumière (Dakar)',
    text: "KATD-SCHÜLE a révolutionné la gestion de notre école. Tout est centralisé et nos parents adorent recevoir les bulletins en ligne.",
    initials: 'DA',
    color: '#3B82F6',
  },
  {
    name: 'M. Kouamé Jean',
    role: 'Directeur, Collège Ivoire (Abidjan)',
    text: "L'espace vitrine nous permet de partager nos activités avec d'autres écoles africaines. Une vraie communauté éducative !",
    initials: 'KJ',
    color: '#10B981',
  },
  {
    name: 'Mme Bantou Esther',
    role: 'Enseignante (Yaoundé)',
    text: "La saisie des notes et la communication avec les parents sont devenues un jeu d'enfant. Je gagne plusieurs heures chaque semaine.",
    initials: 'BE',
    color: '#F59E0B',
  },
]

const pricing = [
  { cycle: 'Maternelle', icon: '🎨', monthly: 12000, annual: 35000, color: 'from-orange-400 to-amber-500', accent: 'orange' },
  { cycle: 'Primaire', icon: '📘', monthly: 15000, annual: 40000, color: 'from-blue-500 to-indigo-600', accent: 'blue', featured: true },
  { cycle: 'Secondaire', icon: '🎓', monthly: 20000, annual: 55000, color: 'from-emerald-500 to-green-600', accent: 'green' },
]

function Stat({ value, label }) {
  return (
    <div className="text-center">
      <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">{value}</div>
      <div className="text-xs sm:text-sm text-gray-500 mt-1">{label}</div>
    </div>
  )
}

const GRADIENTS = ['from-blue-400 to-indigo-500', 'from-purple-400 to-pink-500', 'from-green-400 to-teal-500', 'from-orange-400 to-red-500']

function MediaPreviewCard({ item, index }) {
  const thumb = item.thumbnail || item.files?.[0]?.url || null
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-card-lg transition-all hover:-translate-y-0.5">
      <div className={`relative h-40 sm:h-44 ${thumb ? 'bg-gray-100' : `bg-gradient-to-br ${GRADIENTS[index % GRADIENTS.length]}`}`}>
        {thumb ? (
          <img src={thumb} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.2) 1px, transparent 0)', backgroundSize: '20px 20px' }} />
        )}
        {item.type === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 bg-white/25 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30">
              <Play size={18} className="text-white fill-white ml-0.5" />
            </div>
          </div>
        )}
        <div className="absolute top-3 left-3">
          <span className="bg-black/40 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-full capitalize font-medium">
            {item.category || item.type}
          </span>
        </div>
      </div>
      <div className="p-4">
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug mb-2">{item.title}</h3>
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span className="truncate">{item.school?.name || 'École'}</span>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="flex items-center gap-1"><Heart size={11} />{item.stats?.likes || 0}</span>
            <span className="flex items-center gap-1"><MessageCircle size={11} />{item.stats?.comments || 0}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const [mediaItems, setMediaItems] = useState([])
  const [schoolsList, setSchoolsList] = useState([])

  useEffect(() => {
    mediaApi.list('sort=popular&limit=4').then((res) => setMediaItems(res.data || [])).catch(() => {})
    schoolsApi.list('limit=8').then((res) => setSchoolsList(res.data || [])).catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50/40 via-white to-white">
        <div className="absolute inset-0 -z-10 opacity-30">
          <div className="absolute top-20 -left-20 w-72 h-72 bg-blue-400 rounded-full filter blur-3xl opacity-20" />
          <div className="absolute top-40 -right-20 w-72 h-72 bg-indigo-400 rounded-full filter blur-3xl opacity-20" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-16 sm:pb-24">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium mb-5">
                <Sparkles size={13} /> Plateforme #1 en Afrique francophone
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight mb-5">
                Gérez votre école.{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                  Connectez-vous au monde.
                </span>
              </h1>
              <p className="text-base sm:text-lg text-gray-600 leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0">
                KATD-SCHÜLE offre à chaque établissement, peu importe sa taille, un système de gestion complet — tout en bâtissant un réseau mondial où les écoles partagent leurs réussites.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start">
                <Link to="/login" className="btn-primary text-sm w-full sm:w-auto justify-center px-6 py-3">
                  Commencer gratuitement <ArrowRight size={15} />
                </Link>
                <Link to="/explorer" className="btn-ghost border border-gray-200 text-sm w-full sm:w-auto justify-center px-6 py-3">
                  <Play size={14} /> Découvrir la plateforme
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-8 text-xs text-gray-500 justify-center lg:justify-start">
                {['Sans engagement', 'Support 7j/7', 'Données sécurisées'].map((t) => (
                  <span key={t} className="flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-green-500" />{t}
                  </span>
                ))}
              </div>
            </div>

            {/* Hero illustration card */}
            <div className="relative">
              <div className="relative bg-white rounded-2xl shadow-card-lg border border-gray-100 p-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
                      <BookOpen size={16} className="text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900">École Les Petits Génies</div>
                      <div className="text-[11px] text-gray-400 flex items-center gap-1"><MapPin size={9} /> Abidjan</div>
                    </div>
                  </div>
                  <span className="badge badge-green text-[10px]">Actif</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { v: '248', l: 'Élèves', c: 'bg-blue-50 text-blue-700' },
                    { v: '18', l: 'Profs', c: 'bg-purple-50 text-purple-700' },
                    { v: '12', l: 'Classes', c: 'bg-green-50 text-green-700' },
                  ].map((s) => (
                    <div key={s.l} className={`${s.c} rounded-xl p-3 text-center`}>
                      <div className="text-lg font-bold leading-none">{s.v}</div>
                      <div className="text-[10px] mt-1 opacity-80">{s.l}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-2.5">
                  {[
                    { l: 'Présence du jour', v: '92%', c: 'bg-green-500' },
                    { l: 'Moyenne générale', v: '13.8', c: 'bg-blue-500' },
                    { l: 'Devoirs rendus', v: '87%', c: 'bg-orange-400' },
                  ].map((row) => (
                    <div key={row.l}>
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>{row.l}</span><span className="font-semibold">{row.v}</span>
                      </div>
                      <div className="bg-gray-100 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${row.c}`} style={{ width: row.v.includes('%') ? row.v : `${(parseFloat(row.v) / 20) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Floating badges */}
              <div className="hidden sm:flex absolute -top-4 -right-4 bg-white rounded-xl shadow-card border border-gray-100 px-3 py-2 items-center gap-2">
                <TrendingUp size={14} className="text-green-500" />
                <div className="text-xs">
                  <div className="font-bold text-gray-900">+12%</div>
                  <div className="text-gray-400 text-[10px]">ce mois</div>
                </div>
              </div>
              <div className="hidden sm:flex absolute -bottom-4 -left-4 bg-white rounded-xl shadow-card border border-gray-100 px-3 py-2 items-center gap-2">
                <Award size={14} className="text-amber-500" />
                <div className="text-xs">
                  <div className="font-bold text-gray-900">Top 5</div>
                  <div className="text-gray-400 text-[10px]">Abidjan</div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8 mt-16 sm:mt-20 pt-10 border-t border-gray-100">
            {stats.map((s) => <Stat key={s.label} {...s} />)}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-16 sm:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-gray-200 text-xs font-medium text-gray-700 mb-4">
              Fonctionnalités
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3">
              Tout ce dont votre école a besoin
            </h2>
            <p className="text-base text-gray-600 max-w-2xl mx-auto">
              Une suite d'outils pensée pour les directeurs, enseignants, parents et élèves.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-blue-200 hover:shadow-card-lg transition-all">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${f.color}`}>
                  <f.icon size={20} />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MEDIA SHOWCASE */}
      <section className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-medium mb-3">
                Vitrine inter-écoles
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                Découvrez les réussites des écoles
              </h2>
              <p className="text-base text-gray-600">Vidéos, photos et podcasts partagés par la communauté</p>
            </div>
            <Link to="/explorer" className="btn-ghost text-sm border border-gray-200 self-start sm:self-end">
              Voir tout <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {mediaItems.length > 0 ? mediaItems.map((item, i) => (
              <MediaPreviewCard key={item._id} item={item} index={i} />
            )) : (
              <p className="col-span-full text-center text-sm text-gray-400 py-8">Aucun contenu multimédia pour le moment</p>
            )}
          </div>
        </div>
      </section>

      {/* SCHOOLS */}
      <section className="py-16 sm:py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Écoles partenaires</h2>
            <p className="text-sm text-gray-600">Plus de 120 établissements nous font confiance</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {schoolsList.length > 0 ? schoolsList.map((school) => {
              const initials = (school.name || '').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
              const colors = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4']
              const color = colors[Math.abs(school.name?.charCodeAt(0) || 0) % colors.length]
              return (
                <div
                  key={school._id}
                  className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-blue-300 hover:shadow-card transition-all group"
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-base font-bold mb-3"
                    style={{ backgroundColor: color }}
                  >
                    {initials}
                  </div>
                  <div className="text-sm font-semibold text-gray-900 truncate group-hover:text-blue-600">{school.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><MapPin size={10} />{school.address?.city || 'Cameroun'}</div>
                  <Link to={`/inscription/${school._id}`} className="mt-3 w-full flex items-center justify-center gap-1.5 bg-blue-600 text-white text-[11px] font-semibold py-1.5 rounded-lg hover:bg-blue-700 transition-colors">
                    S'inscrire
                  </Link>
                </div>
              )
            }) : (
              <p className="col-span-full text-center text-sm text-gray-400 py-8">Aucune école inscrite pour le moment</p>
            )}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Ils nous font confiance</h2>
            <p className="text-base text-gray-600">L'avis de directeurs et enseignants</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-card transition-shadow">
                <div className="flex gap-1 mb-4 text-amber-400">
                  {[...Array(5)].map((_, i) => <span key={i}>★</span>)}
                </div>
                <p className="text-sm text-gray-700 leading-relaxed mb-5 italic">"{t.text}"</p>
                <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: t.color }}
                  >
                    {t.initials}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{t.name}</div>
                    <div className="text-xs text-gray-500 truncate">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="py-16 sm:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium mb-3">Tarifs</div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Une formule par cycle scolaire</h2>
            <p className="text-base text-gray-600">Souscription par cycle, paiement annuel ou trimestriel</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {pricing.map((p) => (
              <div
                key={p.cycle}
                className={`relative bg-white rounded-2xl border-2 p-6 ${
                  p.featured ? 'border-blue-500 shadow-card-lg lg:scale-105' : 'border-gray-100'
                }`}
              >
                {p.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Le plus populaire
                  </div>
                )}
                <div className="text-3xl mb-2">{p.icon}</div>
                <div className="text-lg font-bold text-gray-900 mb-1">Cycle {p.cycle}</div>
                <div className="mt-5 mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-gray-900">{p.annual.toLocaleString()}</span>
                    <span className="text-sm text-gray-500">F CFA / an</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">ou {p.monthly.toLocaleString()} F CFA / trimestre</div>
                </div>
                <ul className="space-y-2.5 mb-6">
                  {[
                    'Toutes les fonctionnalités',
                    'Élèves & enseignants illimités',
                    'Support prioritaire',
                    'Mises à jour gratuites',
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle2 size={15} className="text-green-500 flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/login"
                  className={`block w-full text-center py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    p.featured
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Souscrire
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 p-8 sm:p-12 text-center text-white">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.3) 1px, transparent 0)', backgroundSize: '24px 24px' }} />
            <div className="relative">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4">
                Prêt à transformer votre école ?
              </h2>
              <p className="text-base sm:text-lg text-blue-100 mb-8 max-w-xl mx-auto">
                Rejoignez plus de 120 écoles et offrez à vos élèves une expérience moderne et connectée.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
                <Link to="/login" className="bg-white text-blue-700 hover:bg-blue-50 px-6 py-3 rounded-lg text-sm font-semibold w-full sm:w-auto">
                  Créer mon école
                </Link>
                <Link to="/contact" className="bg-white/10 hover:bg-white/20 backdrop-blur border border-white/30 text-white px-6 py-3 rounded-lg text-sm font-semibold w-full sm:w-auto">
                  Nous contacter
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
