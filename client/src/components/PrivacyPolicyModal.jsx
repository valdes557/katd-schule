import { useState, useEffect } from 'react'
import { ShieldCheck, X, Loader2, CheckCircle2, LogOut } from 'lucide-react'
import { platformApi, authApi } from '../lib/api'

const DEFAULT_PRIVACY_TEXT = `POLITIQUE DE CONFIDENTIALITÉ DE LA PLATEFORME KATD-SCHÜLE

1. Collecte et Utilisation des Données
La plateforme KATD-SCHÜLE collecte et traite les informations nécessaires à la gestion scolaire, à la communication institutionnelle, à la sécurisation des accès et à la fourniture de nos services numériques (gestion des notes, présences, inscriptions, portefeuilles électroniques et publications).

2. Protection et Sécurité des Données
Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles renforcées (chiffrement, accès restreint par rôles, traçabilité des opérations sensibles) pour protéger vos données personnelles contre tout accès non autorisé, altération, divulgation ou destruction.

3. Gestion Financière et Transactions
Les opérations de dépôt, de retrait et de transfert via Mobile Money sont opérées de manière sécurisée en collaboration avec nos partenaires de paiement agréés. Aucune information sensible telle que votre code secret Mobile Money n'est conservée sur nos serveurs.

4. Confidentialité des Établissements et des Élèves
Les données relatives aux élèves, aux parents et au corps enseignant appartiennent exclusivement à leurs établissements respectifs et ne font l'objet d'aucune exploitation commerciale ou cession à des tiers sans consentement préalable.

5. Droits des Utilisateurs
Conformément à la réglementation en vigueur sur la protection des données à caractère personnel, vous disposez d'un droit d'accès, de rectification et de suppression des données vous concernant en contactant l'administration de la plateforme.`

export default function PrivacyPolicyModal({
  isOpen = true,
  onClose,
  isMandatory = false,
  onAccepted,
  onLogout,
}) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [agreed, setAgreed] = useState(!isMandatory)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    platformApi.getPrivacyPolicy()
      .then((res) => {
        if (!active) return
        setContent(res?.content || '')
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  if (!isOpen) return null

  const handleAccept = async () => {
    if (isMandatory) {
      if (!agreed) {
        setError('Vous devez cocher la case pour attester avoir lu et accepté la politique.')
        return
      }
      setSubmitting(true)
      setError('')
      try {
        await authApi.acceptPrivacyPolicy()
        if (onAccepted) onAccepted()
      } catch (err) {
        setError(err.message || "Erreur lors de l'enregistrement de votre acceptation")
      } finally {
        setSubmitting(false)
      }
    } else {
      if (onAccepted) onAccepted()
      if (onClose) onClose()
    }
  }

  const displayedText = (content && content.trim()) ? content : DEFAULT_PRIVACY_TEXT

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base sm:text-lg">Politique de Confidentialité</h3>
              <p className="text-xs text-gray-500">Protection et gestion de vos données sur KATD-SCHÜLE</p>
            </div>
          </div>
          {!isMandatory && onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Content body */}
        <div className="p-6 overflow-y-auto flex-1 text-sm text-gray-700 leading-relaxed space-y-4">
          {loading ? (
            <div className="py-16 text-center text-gray-400 flex flex-col items-center gap-2">
              <Loader2 size={24} className="animate-spin text-blue-600" />
              <span>Chargement de la politique de confidentialité...</span>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-5 font-sans whitespace-pre-wrap leading-relaxed text-gray-800 text-xs sm:text-sm">
              {displayedText}
            </div>
          )}

          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </div>
          )}

          {isMandatory && (
            <label className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => {
                  setError('')
                  setAgreed(e.target.checked)
                }}
                className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <span className="text-xs sm:text-sm text-blue-950 font-medium">
                J'atteste avoir pris connaissance de la Politique de Confidentialité et j'en accepte l'intégralité des termes et conditions.
              </span>
            </label>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between flex-wrap gap-3">
          {isMandatory ? (
            <>
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="btn-ghost text-xs text-gray-600 hover:text-red-600 inline-flex items-center gap-1.5"
                >
                  <LogOut size={14} /> Se déconnecter
                </button>
              )}
              <button
                type="button"
                onClick={handleAccept}
                disabled={!agreed || submitting}
                className="btn-primary ml-auto text-sm px-5 py-2.5 inline-flex items-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <><Loader2 size={16} className="animate-spin" /> Enregistrement...</>
                ) : (
                  <><CheckCircle2 size={16} /> Accepter et continuer</>
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="btn-primary ml-auto text-sm px-5 py-2"
            >
              Fermer
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
