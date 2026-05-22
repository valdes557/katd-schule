import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Play, BookOpen, Globe2, GraduationCap,
  CheckCircle2, Sparkles, Info, Phone, HelpCircle,
  CreditCard, Star, Gift, Loader2,
} from 'lucide-react'
import PublicHeader from '../components/layout/PublicHeader'
import Footer from '../components/layout/Footer'
import { schoolsApi, platformApi } from '../lib/api'
import { useAuth } from '../context/AuthContext'

import SocialTab from '../components/landing/SocialTab'
import AboutTab from '../components/landing/AboutTab'
import ContactsTab from '../components/landing/ContactsTab'
import HelpTab from '../components/landing/HelpTab'
import ResourcesTab from '../components/landing/ResourcesTab'
import SchoolsTab from '../components/landing/SchoolsTab'
import PricingTab from '../components/landing/PricingTab'
import ExperiencesTab from '../components/landing/ExperiencesTab'
import SupportTab from '../components/landing/SupportTab'

const NAV_TABS = [
  { id: 'social', label: 'Social', icon: Globe2 },
  { id: 'about', label: 'À propos', icon: Info },
  { id: 'contacts', label: 'Contacts', icon: Phone },
  { id: 'help', label: 'Aide', icon: HelpCircle },
  { id: 'resources', label: 'Ressources', icon: BookOpen },
  { id: 'schools', label: 'Nos écoles', icon: GraduationCap },
  { id: 'pricing', label: 'Tarifs', icon: CreditCard },
  { id: 'experiences', label: 'Expériences', icon: Star },
  { id: 'support', label: 'Support Social', icon: Gift },
]

export default function LandingPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('social')
  const [schoolsList, setSchoolsList] = useState([])
  const [feed, setFeed] = useState([])
  const [platformData, setPlatformData] = useState(null)
  const [experiences, setExperiences] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      schoolsApi.list('limit=50').then((r) => setSchoolsList(r.data || [])).catch(() => {}),
      platformApi.getFeed(1).then((r) => setFeed(r.data || [])).catch(() => {}),
      platformApi.get().then((r) => setPlatformData(r.data || {})).catch(() => {}),
      platformApi.getExperiences().then((r) => setExperiences(r.data || [])).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 size={32} className="animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50/40 via-white to-white">
        <div className="absolute inset-0 -z-10 opacity-30">
          <div className="absolute top-20 -left-20 w-72 h-72 bg-blue-400 rounded-full filter blur-3xl opacity-20" />
          <div className="absolute top-40 -right-20 w-72 h-72 bg-indigo-400 rounded-full filter blur-3xl opacity-20" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-10 sm:pb-16">
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
                KATD-SCHÜLE offre à chaque établissement un système de gestion complet — tout en
                bâtissant un réseau mondial où les écoles partagent leurs réussites.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start">
                <Link
                  to="/login"
                  className="btn-primary text-sm w-full sm:w-auto justify-center px-6 py-3"
                >
                  Commencer gratuitement <ArrowRight size={15} />
                </Link>
                <Link
                  to="/explorer"
                  className="btn-ghost border border-gray-200 text-sm w-full sm:w-auto justify-center px-6 py-3"
                >
                  <Play size={14} /> Découvrir la plateforme
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-8 text-xs text-gray-500 justify-center lg:justify-start">
                {['Sans engagement', 'Support 7j/7', 'Données sécurisées'].map((t) => (
                  <span key={t} className="flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-green-500" />
                    {t}
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
                      <div className="text-sm font-bold text-gray-900">Tableau de bord</div>
                      <div className="text-[10px] text-gray-400">Vue d'ensemble</div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { label: 'Élèves', value: '1,245', color: 'bg-blue-50 text-blue-600' },
                    { label: 'Enseignants', value: '48', color: 'bg-purple-50 text-purple-600' },
                    { label: 'Classes', value: '32', color: 'bg-green-50 text-green-600' },
                    { label: 'Présence', value: '94%', color: 'bg-orange-50 text-orange-600' },
                  ].map((s) => (
                    <div key={s.label} className={`${s.color} rounded-xl p-3`}>
                      <div className="text-lg font-bold">{s.value}</div>
                      <div className="text-[10px] font-medium">{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="h-24 bg-gray-50 rounded-xl flex items-end gap-1 px-2 pb-1">
                  {[40, 65, 45, 80, 55, 70, 90, 60, 75, 50, 85, 95].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-blue-500 rounded-t-sm opacity-80"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* QUICK ACCESS NAVIGATION BAR */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex gap-0.5 overflow-x-auto scrollbar-hide py-1">
            {NAV_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                  tab === t.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <t.icon size={14} />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TAB CONTENT */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {tab === 'social' && <SocialTab feed={feed} setFeed={setFeed} user={user} />}
        {tab === 'about' && <AboutTab platformData={platformData} />}
        {tab === 'contacts' && <ContactsTab platformData={platformData} />}
        {tab === 'help' && <HelpTab platformData={platformData} />}
        {tab === 'resources' && <ResourcesTab platformData={platformData} />}
        {tab === 'schools' && <SchoolsTab schoolsList={schoolsList} />}
        {tab === 'pricing' && <PricingTab />}
        {tab === 'experiences' && (
          <ExperiencesTab experiences={experiences} setExperiences={setExperiences} />
        )}
        {tab === 'support' && <SupportTab platformData={platformData} />}
      </div>

      <Footer />
    </div>
  )
}
