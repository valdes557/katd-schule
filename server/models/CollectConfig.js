// models/CollectConfig.js — Configuration globale de la fonctionnalité Collecte Journalière.
// Contient les termes et conditions d'adhésion pour les agents rédigés par l'administrateur,
// ainsi que le montant des frais de tenue mensuelle (1 100 FCFA).
const mongoose = require('mongoose')

const DEFAULT_CAGNOTTE_LOCK_TERMS = `CONDITIONS GÉNÉRALES DE BLOCAGE ET DE SANCTUARISATION DE LA CAGNOTTE CLIENT

1. ENGAGEMENT VOLONTAIRE D\'ÉPARGNE BLOQUÉE
Le client titulaire choisit volontairement de bloquer le solde de sa cagnotte cumulée pour une durée déterminée afin de sanctuariser son capital et de maximiser la régularité de son épargne.

2. DURÉE DE BLOCAGE ET ÉCHÉANCE
Pendant toute la durée de blocage choisie, les fonds de la cagnotte demeurent strictement sécurisés sur la plateforme KATD-SCHULE et réservés au client titulaire. À l\'échéance de la période, les retraits sont totalement ouverts sans aucun frais.

3. RETRAIT ANTICIPÉ EXCEPTIONNEL ET FRAIS (3%)
En cas de force majeure, si le client décide d\'interrompre le blocage ou d\'effectuer un retrait avant l\'échéance convenue, des frais de rupture de 3% sont automatiquement prélevés sur le montant retiré au titre des frais administratifs et de gestion de plateforme.

4. TRANSFERT AUTOMATIQUE VERS LE PORTEFEUILLE EN CAS DE NON-RETRAIT
À la fin de la période de blocage convenue, une notification est expédiée au client pour l\'inviter à effectuer son retrait. Si aucun retrait n\'est initié, le solde disponible est transféré automatiquement dans son portefeuille utilisateur pour sa sécurité.

5. SIGNATURE NUMÉRIQUE ET PREUVE JURIDIQUE
La présente convention signée numériquement au doigt ou au stylet par le client fait foi entre les parties et engage la plateforme dans la préservation rigoureuse de ses avoirs.`

const DEFAULT_TERMS = `CONDITIONS GÉNÉRALES D'ADHÉSION ET D'ENGAGEMENT DES AGENTS DE COLLECTE JOURNALIÈRE

1. OBJET ET STATUT DE L'AGENT
Le présent contrat définit les droits, obligations et devoirs de tout utilisateur choisissant d'activer son compte en qualité d'Agent de Collecte Journalière sur la plateforme KATD-SCHÜLE.

2. COLLECTE DES FONDS ET SANCTUARISATION
- L'agent de collecte s'engage à enregistrer fidèlement chaque client, son quartier, ainsi que les montants des collectes journalières effectuées.
- PROTECTION ABSOLUE DES FONDS : Conformément aux règles de sécurité strictes de la plateforme, les fonds versés sur le compte de collecte d'un client lui appartiennent exclusivement. Ni l'agent de collecte ni l'administrateur de la plateforme n'ont le droit de retirer arbitrairement l'argent de collecte d'un client.

3. APPROVISIONNEMENT DES COMPTES
L'agent est habilité à approvisionner les comptes collecte de ses clients enregistrés par Mobile Money ou directement depuis son propre portefeuille (wallet) sécurisé.

4. FRAIS MENSUELS DE GESTION (1 100 FCFA / CLIENT)
Une somme forfaitaire de 1 100 FCFA est automatiquement déduite chaque mois sur le compte de chaque client enregistré par l'agent au titre des frais de gestion et de sécurisation de la collecte journalière. Ces frais sont centralisés et versés à l'administrateur au nom de l'agence de collecte.

5. RAPPORTS JOURNALIERS ET OBLIGATION DE TRANSPARENCE
L'agent s'engage à transmettre quotidiennement son rapport d'activité (statistiques des clients payés, en retard et montants collectés) à la direction via son tableau de bord.

6. SUSPENSION ET RÉVOCATION
L'administrateur se réserve le droit souverain de retirer, suspendre ou révoquer un agent de ses fonctions en cas de manquement aux présentes conditions, de tentative de fraude ou de négligence grave.`

const collectConfigSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'main', unique: true },
    termsAndConditions: { type: String, default: DEFAULT_TERMS },
    cagnotteLockTerms: { type: String, default: DEFAULT_CAGNOTTE_LOCK_TERMS },
    monthlyFee: { type: Number, default: 1100, min: 0 },
    defaultDailyTarget: { type: Number, default: 1000 },
    agentSubscriptionFee: { type: Number, default: 4995, min: 0 },
    clientSubscriptionFee: { type: Number, default: 4995, min: 0 },
    clientSubscriptionInterval: { type: String, enum: ['annual', 'monthly'], default: 'annual' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
)

collectConfigSchema.statics.getOrCreate = async function () {
  let cfg = await this.findOne({ key: 'main' })
  if (!cfg) {
    cfg = await this.create({ key: 'main', agentSubscriptionFee: 4995, clientSubscriptionFee: 4995 })
  } else {
    // Si l'ancien tarif de 4800 FCFA était enregistré, migrer automatiquement vers 4995 FCFA
    if (cfg.agentSubscriptionFee === 4800 || !cfg.agentSubscriptionFee) {
      cfg.agentSubscriptionFee = 4995
      await cfg.save()
    }
  }
  return cfg
}

module.exports = mongoose.model('CollectConfig', collectConfigSchema)
