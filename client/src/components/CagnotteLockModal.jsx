// client/src/components/CagnotteLockModal.jsx — Modal de blocage de cagnotte avec lecture des termes et signature numérique
import { useState, useEffect } from 'react'
import { Lock, FileText, CheckCircle2, AlertCircle, Loader2, X, Shield, Calendar, ShieldCheck } from 'lucide-react'
import { collectApi } from '../lib/api'
import SignaturePad from './SignaturePad'

const DEFAULT_TERMS = `CONDITIONS GÉNÉRALES DE BLOCAGE ET DE SANCTUARISATION DE LA CAGNOTTE CLIENT

1. ENGAGEMENT VOLONTAIRE D'ÉPARGNE BLOQUÉE
Le client titulaire choisit volontairement de bloquer le solde de sa cagnotte cumulée pour une durée déterminée afin de sanctuariser son capital et de maximiser la régularité de son épargne.

2. DURÉE DE BLOCAGE ET ÉCHÉANCE
Pendant toute la durée de blocage choisie, les fonds de la cagnotte demeurent strictement sécurisés sur la plateforme KATD-SCHULE et réservés au client titulaire. À l'échéance de la période, les retraits sont totalement ouverts sans aucun frais.

3. RETRAIT ANTICIPÉ EXCEPTIONNEL ET FRAIS (3%)
En cas de force majeure, si le client décide d'interrompre le blocage ou d'effectuer un retrait avant l'échéance convenue, des frais de rupture de 3% sont automatiquement prélevés sur le montant retiré au titre des frais administratifs et de gestion de plateforme.

4. TRANSFERT AUTOMATIQUE VERS LE PORTEFEUILLE EN CAS DE NON-RETRAIT
À la fin de la période de blocage convenue, une notification est expédiée au client pour l'inviter à effectuer son retrait. Si aucun retrait n'est initié, le solde disponible est transféré automatiquement dans son portefeuille utilisateur pour sa sécurité.

5. SIGNATURE NUMÉRIQUE ET PREUVE JURIDIQUE
La présente convention signée numériquement au doigt ou au stylet par le client fait foi entre les parties et engage la plateforme dans la préservation rigoureuse de ses avoirs.`

export default function CagnotteLockModal({ client, currentBalance = 0, isOpen, onClose, onSuccess }) {
  const [durationMonths, setDurationMonths] = useState(1)
  const [termsText, setTermsText] = useState(DEFAULT_TERMS)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [signature, setSignature] = useState('')
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    const fetchConfig = async () => {
      try {
        setLoadingConfig(true)
        const cfg = await collectApi.getConfig()
        if (cfg?.cagnotteLockTerms) {
          setTermsText(cfg.cagnotteLockTerms)
        }
      } catch (_) {
        // utilise les termes par défaut
      } finally {
        setLoadingConfig(false)
      }
    }
    fetchConfig()
  }, [isOpen])

  if (!isOpen) return null

  const calculateTargetDate = (months) => {
    const d = new Date()
    d.setMonth(d.getMonth() + Number(months))
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!acceptedTerms) {
      setError('Veuillez cocher la case d\'acceptation des termes et conditions.')
      return
    }
    if (!signature) {
      setError('Veuillez apposer votre signature numérique dans le cadre prévu.')
      return
    }

    try {
      setSubmitting(true)
      setError('')
      const res = await collectApi.lockCagnotte({
        durationMonths: Number(durationMonths),
        termsContent: termsText,
        clientSignature: signature,
      })
      if (onSuccess) onSuccess(res)
      onClose()
    } catch (err) {
      setError(err.message || 'Erreur lors du blocage de la cagnotte.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-gray-150 space-y-4 my-auto max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 shadow-inner">
              <Lock size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Bloquer ma Cagnotte d'Épargne</h3>
              <p className="text-xs text-gray-500">Sanctuaire d'épargne avec engagement contractuel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Sélection de la durée */}
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1.5 flex items-center gap-1.5">
              <Calendar size={14} className="text-amber-600" />
              <span>Durée de blocage souhaitée</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 3, 6, 12].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDurationMonths(m)}
                  className={`py-2 px-2 rounded-xl text-xs font-extrabold border text-center transition-all ${
                    durationMonths === m
                      ? 'border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-400/30 shadow-2xs'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {m} mois
                </button>
              ))}
            </div>
            <div className="mt-2.5">
              <label className="text-[11px] font-semibold text-gray-600 block mb-1">
                Ou insérez vous-même votre durée sur-mesure (en mois) :
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={durationMonths}
                  onChange={(e) => {
                    const val = Math.max(1, Math.min(60, parseInt(e.target.value, 10) || 1))
                    setDurationMonths(val)
                  }}
                  className="input text-xs w-full pr-14 font-extrabold text-amber-900"
                  placeholder="Ex : 2, 5, 8, 24 mois"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                  mois
                </span>
              </div>
            </div>
            <p className="text-[11px] text-gray-500 mt-2">
              Échéance prévue de déblocage sans frais : <b>{calculateTargetDate(durationMonths)}</b>.
            </p>
          </div>

          {/* Termes et Conditions rédigés par le Super Admin */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <FileText size={14} className="text-indigo-600" />
              <span>Termes & Conditions de blocage (rédigés par la Direction)</span>
            </label>
            <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-[11px] text-gray-700 font-mono max-h-36 overflow-y-auto whitespace-pre-wrap leading-relaxed shadow-inner">
              {loadingConfig ? 'Chargement des termes...' : termsText}
            </div>
          </div>

          {/* Case à cocher d'acceptation */}
          <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-50/60 border border-amber-200 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="rounded text-amber-600 focus:ring-amber-500 mt-0.5 shrink-0"
              required
            />
            <span className="text-[11px] text-amber-950 font-medium leading-relaxed">
              J'atteste avoir lu l'intégralité des termes et conditions de blocage ci-dessus et accepte sans réserve la sanctuarisation de ma cagnotte pour la période choisie.
            </span>
          </label>

          {/* Signature numérique au doigt */}
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-600" />
              <span>Signature Numérique du Client *</span>
            </label>
            <SignaturePad
              title="Signature du Client Titulaire"
              subtitle="Signez au doigt dans le cadre blanc pour certifier votre accord"
              onSave={(dataUrl) => setSignature(dataUrl)}
              required
            />
            {signature && (
              <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
                <CheckCircle2 size={12} /> Signature certifiée prête pour le contrat officiel
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-xs flex-1 py-3 rounded-xl font-bold"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting || !acceptedTerms || !signature}
              className="btn-primary text-xs flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
              <span>Signer & Bloquer ma cagnotte</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
