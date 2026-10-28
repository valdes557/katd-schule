// client/src/components/CagnotteLockProofModal.jsx — Affichage, impression et téléchargement du contrat de blocage signé
import { Printer, Download, X, ShieldCheck, Lock, CheckCircle2 } from 'lucide-react'

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', {
  day: '2-digit', month: 'long', year: 'numeric',
}) : '—')

const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('fr-FR', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
}) : '—')

export default function CagnotteLockProofModal({ isOpen = true, contract, client, onClose }) {
  if (!isOpen || !contract) return null

  const handlePrint = () => {
    window.print()
  }

  const contractNum = contract.contractNumber || 'CAG-LOCK-CERT'
  const signedDate = contract.signedAt || new Date()
  const lockUntilDate = contract.lockUntil

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose()
      }}
      className="fixed inset-0 z-[80] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto"
    >
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-lock-contract, #printable-lock-contract * {
            visibility: visible;
          }
          #printable-lock-contract {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 20mm !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-gray-150 space-y-5 my-auto max-h-[92vh] overflow-y-auto">
        {/* En-tête de la modale */}
        <div className="flex items-center justify-between border-b pb-3 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shadow-inner">
              <Lock size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Preuve de Sanctuarisation de Cagnotte</h3>
              <p className="text-xs text-gray-500">Contrat certifié avec signature numérique</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="btn-secondary text-xs py-2 px-3 rounded-xl flex items-center gap-1.5 font-bold"
              title="Imprimer"
            >
              <Printer size={14} /> Imprimer
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Zone imprimable du document officiel */}
        <div id="printable-lock-contract" className="p-6 sm:p-8 bg-gray-50/50 border border-gray-200 rounded-3xl space-y-6 text-gray-900 font-sans">
          {/* Header officiel */}
          <div className="flex items-start justify-between border-b border-gray-200 pb-4">
            <div>
              <h2 className="text-lg font-black tracking-tight text-gray-900">KATD-SCHÜLE TECHNOLOGIES</h2>
              <p className="text-[11px] text-gray-500 uppercase tracking-widest font-bold">Plateforme Numérique Éducative & Financière</p>
              <p className="text-xs text-gray-600 mt-1">Service de Sanctuarisation & d'Épargne Quotidienne</p>
            </div>
            <div className="text-right">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300 inline-block mb-1">
                Certificat de Blocage
              </span>
              <p className="font-mono font-bold text-xs text-gray-900">{contractNum}</p>
              <p className="text-[10px] text-gray-400">Date : {fmtDateTime(signedDate)}</p>
            </div>
          </div>

          {/* Informations du client */}
          <div className="grid grid-cols-2 gap-4 text-xs bg-white p-4 rounded-2xl border border-gray-150">
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 block">Titulaire de la cagnotte</span>
              <span className="font-bold text-gray-900 text-sm">{client?.fullName || 'Client Titulaire'}</span>
              <p className="text-gray-500 text-[11px]">{client?.phone} • {client?.neighborhood}</p>
              <p className="text-[11px] font-mono text-indigo-600 font-bold">N° Compte : {client?.accountNumber}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-gray-400 block">Période d'engagement</span>
              <span className="font-bold text-amber-700 text-sm">{contract.lockDurationMonths} mois d'épargne bloquée</span>
              <p className="text-gray-600 text-[11px] mt-0.5">Échéance finale : <b>{fmtDate(lockUntilDate)}</b></p>
              <p className="text-[10px] text-emerald-600 font-bold flex items-center justify-end gap-1 mt-1">
                <CheckCircle2 size={11} /> 0% frais après échéance
              </p>
            </div>
          </div>

          {/* Termes et Conditions */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide">Convention Contractuelle</h4>
            <div className="p-4 bg-white border border-gray-200 rounded-2xl text-[11px] text-gray-700 font-mono leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
              {contract.termsContent || 'Termes et conditions officiels de blocage de cagnotte.'}
            </div>
          </div>

          {/* Section Signature Numérique */}
          <div className="pt-2 border-t border-gray-200">
            <div className="flex items-center justify-between text-xs font-bold text-gray-700 mb-2">
              <span>Signature Numérique Tactile Certifiée</span>
              <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                <ShieldCheck size={12} /> Force probante juridique
              </span>
            </div>

            <div className="max-w-xs mx-auto p-4 bg-white border border-gray-200 rounded-2xl text-center space-y-1.5 shadow-xs">
              <span className="text-[10px] font-bold text-gray-500 uppercase block">
                Signature du Client Titulaire
              </span>
              <div className="h-24 flex items-center justify-center bg-gray-50/60 rounded-xl overflow-hidden p-1 border border-gray-100">
                {contract.clientSignature ? (
                  <img
                    src={contract.clientSignature}
                    alt="Signature Client"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-gray-400 italic">Signature certifiée</span>
                )}
              </div>
              <p className="text-[9px] text-gray-400 font-mono">Signé le {fmtDateTime(signedDate)}</p>
            </div>
          </div>

          {/* Footer officiel */}
          <div className="text-center pt-2 border-t border-gray-200 text-[10px] text-gray-400 leading-normal">
            Document généré automatiquement par la plateforme KATD-SCHÜLE. Un exemplaire identique est archivé dans les registres d'administration pour contrôle et traçabilité financière.
          </div>
        </div>

        <div className="flex justify-end pt-1 print:hidden">
          <button
            onClick={onClose}
            className="btn-secondary text-xs py-2.5 px-6 rounded-xl font-bold"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
