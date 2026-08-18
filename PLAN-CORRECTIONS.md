# PLAN-CORRECTIONS — KATD-SCHÜLE

Corrections apportées au système (côté primaire + plateforme), déployées automatiquement
sur le VPS Contabo via `git push` sur `main` (workflow `.github/workflows/deploy.yml`).

## 1. Emploi du temps — réservé au directeur

- **Seul le rôle `directeur`** peut créer, modifier, **attribuer** et **retirer** un emploi
  du temps. Tous les autres rôles (enseignant, vice-principal, parent, élève, super_admin)
  sont en **lecture seule**.
- Serveur `server/routes/timetables.js` : toutes les routes d'écriture passent en
  `authorize('directeur')` + vérification stricte du périmètre école. Nouvelle route
  `POST /:id/unassign-from` pour **retirer** (vider) l'emploi du temps de classes choisies.
- Client `client/src/pages/EmploiDuTempsPage.jsx` : `canEdit`/`canPublish` = directeur
  uniquement ; la modale « Attribuer / Retirer » permet d'appliquer ou de retirer l'emploi
  du temps sur une ou plusieurs classes.

## 2. Passerelle de paiement — SEBPay remplacé par Ikeepay

- **Suppression complète de SEBPay** ; nouvelle intégration **Ikeepay**
  (doc : https://www.ikeepay.com/developer) gérant **collectes** (encaissements) ET
  **payouts** (retraits) + **webhook** signé.
- Nouveau service `server/services/ikeepayService.js` : `createCollection`, `createPayout`,
  `getTransactionStatus`, `listOperators`, `verifyWebhookSignature`. Nouveau modèle
  `server/models/IkeepayConfig.js` (clé API + secret webhook, chiffrés, par environnement).
- **Retraits entièrement automatiques** : à la demande de retrait, le payout Ikeepay part
  immédiatement vers le Mobile Money de l'utilisateur ; le webhook confirme (règle le
  montant bloqué) ou rembourse en cas d'échec. L'admin garde un filet manuel.
- Marché par défaut : **multi-pays, devise XOF, pays par défaut CI** (surchargeable via
  `IKEEPAY_COUNTRY`/`IKEEPAY_CURRENCY`). Opérateurs : Orange, MTN, Wave, Moov, Free, E-Money, Airtel.
- Config admin : onglet « Clés API » (`/dashboard/plateforme?tab=api`) → clé API + secret
  webhook Ikeepay (test/live), déverrouillage par code email.
- Champ de transaction renommé `sebpayTransactionId` → `providerTransactionId` (lecture
  legacy conservée pour les anciens enregistrements).

> ⚠️ La doc API Ikeepay (chemins payout/statut, schéma exact de signature webhook) n'est pas
> publique. Ces éléments sont **surchargeables par variables d'environnement**
> (`IKEEPAY_PAYOUT_PATH`, `IKEEPAY_STATUS_PATH`, `IKEEPAY_SIGNATURE_HEADER`) et un repli de
> réconciliation (vérification active du statut) empêche tout crédit sur un webhook non
> vérifié. **À confirmer avec les vraies clés/doc lors de la mise en production.**

## 3. Bouton YouTube — espace utilisateur

- Nouveau bouton **« Vidéos »** (icône YouTube, dégradé rouge) dans la barre de navigation
  de l'espace utilisateur `/u`, aligné avec les autres boutons
  (`client/src/pages/user/UserLayout.jsx`).
- Nouvelle page `client/src/pages/user/UserVideosPage.jsx` (route `/u/videos`) : liste
  **toutes les vidéos du site** et les lit **en intégré** (iframe YouTube/Vimeo via
  `components/ResourcePreview.jsx`, lecteur `<video>` pour les fichiers) — **aucune
  redirection** vers YouTube.
- Nouvel endpoint serveur `GET /api/platform/videos` (posts publics de type vidéo).

## 4. Configuration à faire en production (VPS)

Dans `server/.env` (voir `server/.env.example` pour la liste complète) :

```
IKEEPAY_MODE=live
IKEEPAY_BASE_URL=...           # base API Ikeepay
IKEEPAY_COUNTRY=CI
IKEEPAY_CURRENCY=XOF
IKEEPAY_API_KEY_LIVE=...       # ou via le dashboard admin (chiffré en base)
IKEEPAY_WEBHOOK_SECRET_LIVE=...
IKEEPAY_PAYOUT_PATH=/payouts   # à confirmer avec Ikeepay
IKEEPAY_STATUS_PATH=/payments  # à confirmer avec Ikeepay
IKEEPAY_SIGNATURE_HEADER=x-ikeepay-signature  # à confirmer avec Ikeepay
SERVER_URL=https://katdschool.com             # callback_url des webhooks
```

Configurer l'URL de webhook côté tableau de bord Ikeepay :
`https://katdschool.com/api/payments/webhook`.
