// models/CollectConfig.js — Configuration globale de la fonctionnalité Collecte Journalière.
// Contient les termes et conditions d'adhésion pour les agents rédigés par l'administrateur,
// ainsi que le montant des frais de tenue mensuelle (1 100 FCFA).
const mongoose = require('mongoose')

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
    monthlyFee: { type: Number, default: 1100, min: 0 },
    defaultDailyTarget: { type: Number, default: 1000 },
    agentSubscriptionFee: { type: Number, default: 4800, min: 0 },
    clientSubscriptionFee: { type: Number, default: 4995, min: 0 },
    clientSubscriptionInterval: { type: String, enum: ['annual', 'monthly'], default: 'annual' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
)

collectConfigSchema.statics.getOrCreate = async function () {
  let cfg = await this.findOne({ key: 'main' })
  if (!cfg) {
    cfg = await this.create({ key: 'main' })
  }
  return cfg
}

module.exports = mongoose.model('CollectConfig', collectConfigSchema)
