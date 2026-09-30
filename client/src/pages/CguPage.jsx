import { useState, useEffect } from 'react'
import { FileText, Shield, Scale, Clock, CheckCircle } from 'lucide-react'
import PublicHeader from '../components/layout/PublicHeader'
import Footer from '../components/layout/Footer'
import { platformApi } from '../lib/api'

export default function CguPage() {
  const [platformData, setPlatformData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    platformApi.get()
      .then((r) => setPlatformData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const termsContent = platformData?.help?.terms
  const isHtml = typeof termsContent === 'string' && /<\/?[a-z][\s\S]*>/i.test(termsContent)

  const defaultTerms = `
## 1. Préambule et Objet
Les présentes Conditions Générales d'Utilisation (ci-après « CGU ») régissent l'accès et l'utilisation de la plateforme KATD-SCHÜLE accessible à l'adresse https://katdschool.com ainsi que ses applications associées.
En accédant au service, tout utilisateur (directeur, enseignant, parent, élève ou visiteur) accepte sans réserve les présentes conditions.

## 2. Description des Services
KATD-SCHÜLE est une solution numérique intégrée proposant :
- La gestion administrative et pédagogique des établissements scolaires (Maternelle, Primaire, Secondaire).
- La gestion des présences, des notes, des emplois du temps et la génération automatique des bulletins.
- Une messagerie sécurisée entre l'établissement, les enseignants et les parents d'élèves.
- Des espaces de publication pédagogique, des blogs éducatifs et le partage de ressources.
- Un système de portefeuille électronique sécurisé pour le paiement des pensions et services.

## 3. Accès aux Services et Inscription
L'accès aux fonctionnalités de gestion requiert la création préalable d'un compte validé par un administrateur d'établissement ou la plateforme. L'utilisateur s'engage à fournir des informations exactes et à préserver la stricte confidentialité de ses identifiants et de son code secret (PIN).

## 4. Règles de Conduite et Sécurité
Il est formellement interdit :
- De diffuser des contenus illicites, diffamatoires, violents ou préjudiciables aux mineurs.
- De tenter d'accéder frauduleusement aux données d'un autre établissement, utilisateur ou compte portefeuille.
- D'utiliser des robots ou des processus automatisés pour aspirer le contenu ou saturer la bande passante.

## 5. Propriété Intellectuelle
Tous les contenus, logos, interfaces, logiciels et codes sources de KATD-SCHÜLE demeurent la propriété exclusive de la société éditrice. Toute reproduction totale ou partielle sans autorisation expresse est strictement prohibée.

## 6. Protection des Données Personnelles et Cookies
KATD-SCHÜLE collecte et traite les données personnelles conformément à sa Politique de Confidentialité. Des cookies et technologies similaires (y compris via les services partenaires tels que Google AdSense) peuvent être utilisés à des fins de navigation, d'analyse d'audience et de personnalisation des annonces publicitaires.

## 7. Modifications des Conditions
L'administration de KATD-SCHÜLE se réserve le droit de modifier les présentes conditions générales à tout moment afin de refléter l'évolution des fonctionnalités ou du cadre réglementaire. Les modifications sont opposables dès leur publication en ligne.
  `.trim()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <PublicHeader />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 sm:p-10 space-y-6">
          <div className="border-b border-gray-100 pb-6 flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-3">
                <Scale size={14} /> Cadre Juridique & Conditions
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                Conditions Générales d'Utilisation (CGU)
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Plateforme KATD-SCHÜLE · Dernière mise à jour : {platformData?.updatedAt ? new Date(platformData.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Septembre 2026'}
              </p>
            </div>
            <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 items-center justify-center shrink-0">
              <FileText size={24} />
            </div>
          </div>

          {/* Corps des CGU */}
          {isHtml ? (
            <div
              className="cgu-content text-gray-700 text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: termsContent }}
            />
          ) : (
            <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap font-sans space-y-4">
              {termsContent || defaultTerms}
            </div>
          )}

          <div className="pt-6 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
            <span className="flex items-center gap-1"><Shield size={13} className="text-green-600" /> Document officiel KATD-SCHÜLE</span>
            <span>Contact légal : royalkatdcameroun@gmail.com</span>
          </div>
        </div>
      </main>

      <Footer />

      <style>{`
        .cgu-content h1, .cgu-content h2, .cgu-content h3 { font-weight: 700; color: #111827; margin: 1.25rem 0 .5rem; }
        .cgu-content h2 { font-size: 1.25rem; border-bottom: 1px solid #f3f4f6; padding-bottom: 0.25rem; }
        .cgu-content h3 { font-size: 1.1rem; }
        .cgu-content p { margin: 0.6rem 0; line-height: 1.7; }
        .cgu-content ul { list-style: disc; padding-left: 1.5rem; margin: 0.6rem 0; }
        .cgu-content ol { list-style: decimal; padding-left: 1.5rem; margin: 0.6rem 0; }
        .cgu-content a { color: #2563eb; text-decoration: underline; }
      `}</style>
    </div>
  )
}
