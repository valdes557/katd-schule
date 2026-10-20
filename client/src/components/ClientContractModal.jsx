// client/src/components/ClientContractModal.jsx — Affichage, impression et téléchargement du contrat de collecte signé
import { Printer, Download, X, ShieldCheck, CheckCircle2 } from 'lucide-react'

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('fr-FR', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
}) : '—')

export default function ClientContractModal({ client, agent, onClose }) {
  if (!client) return null

  const handlePrint = () => {
    window.print()
  }

  const defaultTerms = `CONDITIONS GÉNÉRALES D'ADHÉSION ET D'ENGAGEMENT DE COLLECTE JOURNALIÈRE

1. OBJET DU SERVICE
Le présent contrat formalise l'ouverture d'un compte de collecte journalière et d'épargne sécurisée géré par l'Agent de collecte pour le compte du Client titulaire sur la plateforme KATD-SCHULE.

2. SANCTUARISATION ET PROPRIÉTÉ STRICTE DES FONDS
Conformément aux règles de sécurité absolues de la plateforme :
- Les fonds versés sur le compte de collecte appartiennent exclusivement et en toute circonstance au Client titulaire.
- Ni l'agent de collecte ni l'administration n'ont le droit de prélever ou retirer les fonds d'un client.
- Seul le client titulaire peut ordonner le retrait de son épargne vers ses coordonnées Mobile Money enregistrées.
- L'administration peut décaisser les fonds à la demande expresse et vérifiée du client.

3. COORDONNÉES MOBILE MONEY ET PAIEMENT
Les numéros MTN MoMo et Orange Money mentionnés au présent contrat constituent les numéros de référence certifiés pour tout versement et retrait.

4. FRAIS DE GESTION FORFAITAIRES
Une somme forfaitaire de 1 100 FCFA est automatiquement déduite chaque mois sur le compte du client pour les frais de gestion, de sécurisation et d'assurance de la collecte.

5. SIGNATURES NUMÉRIQUES ET FORCE PROBANTE
Les signatures numériques apposées ci-dessous au doigt par l'Agent et le Client ont valeur d'engagement juridique ferme et irrévocable.`

  const termsText = client.termsContent || defaultTerms
  const contractNum = client.contractNumber || `CTR-${client.accountNumber}`
  const signedDate = client.termsSignedAt || client.createdAt

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-contract, #printable-contract * {
            visibility: visible;
          }
          #printable-contract {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 20mm !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl border border-gray-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Barre d'action supérieure (masquée à l'impression) */}
        <div className="no-print p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-emerald-400" />
            <div>
              <h3 className="font-bold text-sm">Contrat & Termes Signés Numériquement</h3>
              <p className="text-[11px] text-slate-400">Réf : {contractNum}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
              title="Imprimer ou enregistrer en PDF"
            >
              <Printer size={14} />
              <span>Imprimer / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Corps du contrat imprimable */}
        <div id="printable-contract" className="p-6 sm:p-8 space-y-6 overflow-y-auto text-gray-900 bg-white">
          {/* En-tête officiel */}
          <div className="border-b-2 border-gray-900 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="text-xl font-black tracking-tight text-gray-900 uppercase">KATD-SCHULE</div>
              <div className="text-xs text-gray-600 font-medium">Plateforme d'Éducation & de Collecte d'Épargne Journalière</div>
              <div className="text-[11px] text-gray-400">Rép. du Cameroun • Système Certifié</div>
            </div>
            <div className="text-left sm:text-right bg-slate-50 sm:bg-transparent p-2.5 sm:p-0 rounded-xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">N° de Contrat Officiel</span>
              <span className="font-mono font-black text-base text-emerald-700">{contractNum}</span>
              <div className="text-[11px] text-gray-500">Signé le {fmtDateTime(signedDate)}</div>
            </div>
          </div>

          <div className="text-center py-1">
            <h1 className="text-base sm:text-lg font-black uppercase tracking-wide text-gray-900">
              Contrat d'Adhésion & Termes et Conditions de Collecte Journalière
            </h1>
            <p className="text-xs text-gray-500">Sanctuarisation de l'épargne client et engagement mutuel</p>
          </div>

          {/* Section 1 : Parties */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* L'Agent */}
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-1.5 text-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block mb-1">
                L'Agence & L'Agent Agréé
              </span>
              <div><b>Agence :</b> {agent?.agencyName || 'Agence de collecte KATD'}</div>
              <div><b>Responsable :</b> {agent?.user?.name || agent?.name || 'Agent Agréé'}</div>
              <div><b>Téléphone :</b> {agent?.phone || '—'}</div>
              <div><b>Zone / Quartier :</b> {agent?.neighborhood || client.neighborhood}</div>
            </div>

            {/* Le Client */}
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-1.5 text-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-800 block mb-1">
                Le Client Titulaire
              </span>
              <div><b>Nom complet :</b> {client.fullName}</div>
              <div><b>N° Compte Collecte :</b> <span className="font-mono font-bold">{client.accountNumber}</span></div>
              <div><b>MTN MoMo certifié :</b> <span className="font-mono font-bold text-yellow-800">{client.momoMtn || 'Non renseigné'}</span></div>
              <div><b>Orange Money certifié :</b> <span className="font-mono font-bold text-orange-800">{client.momoOrange || 'Non renseigné'}</span></div>
              <div><b>Quartier :</b> {client.neighborhood} {client.city ? `(${client.city})` : ''}</div>
              <div><b>Collecte journalière :</b> <b>{fmt(client.dailyTarget)} FCFA / jour</b></div>
              {client.email && <div><b>Email :</b> {client.email}</div>}
              {client.cni && <div><b>CNI :</b> {client.cni}</div>}
            </div>
          </div>

          {/* Section 2 : Termes et Conditions rédigés par le Super Admin */}
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-700">
              Conditions Générales & Termes Réglementaires
            </h4>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] text-gray-700 leading-relaxed whitespace-pre-line max-h-56 overflow-y-auto">
              {termsText}
            </div>
          </div>

          {/* Section 3 : Signatures Numériques au doigt */}
          <div className="pt-2 border-t border-gray-200 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-gray-700">
              <span>Signatures Numériques Tactiles Certifiées</span>
              <span className="text-[10px] text-emerald-600 flex items-center gap-1 font-semibold">
                <CheckCircle2 size={12} /> Authentification électronique KATD
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Signature Agent */}
              <div className="p-3 bg-white border border-gray-300 rounded-2xl text-center space-y-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase block">
                  Signature de l'Agent de Collecte
                </span>
                <div className="h-20 flex items-center justify-center bg-gray-50/60 rounded-xl overflow-hidden p-1 border border-gray-100">
                  {client.agentSignature ? (
                    <img
                      src={client.agentSignature}
                      alt="Signature Agent"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-[11px] text-gray-400 italic">Signé électroniquement</span>
                  )}
                </div>
                <div className="text-[10px] text-gray-500 font-medium">
                  {agent?.user?.name || agent?.name || 'Agent Agréé'}
                </div>
              </div>

              {/* Signature Client */}
              <div className="p-3 bg-white border border-gray-300 rounded-2xl text-center space-y-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase block">
                  Signature du Client Titulaire
                </span>
                <div className="h-20 flex items-center justify-center bg-gray-50/60 rounded-xl overflow-hidden p-1 border border-gray-100">
                  {client.clientSignature ? (
                    <img
                      src={client.clientSignature}
                      alt="Signature Client"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-[11px] text-gray-400 italic">Signé électroniquement</span>
                  )}
                </div>
                <div className="text-[10px] text-gray-500 font-medium">
                  {client.fullName}
                </div>
              </div>
            </div>

            <div className="text-center text-[10px] text-gray-400 pt-2 border-t border-gray-100">
              Document officiel généré par KATD-SCHULE • Archivé électroniquement avec valeur probante.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
