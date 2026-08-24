# PLAN-BOOST — 🚀 Booster une publication (monétisation espace social)

Fonctionnalité de monétisation de l'espace social utilisateur (`/u`) : un propriétaire peut
**booster** sa publication pour gagner en visibilité, avec paiement, diffusion sponsorisée,
statistiques, historique, dashboard Super Admin, configuration des prix, cron et notifications.

Construit **au-dessus de l'existant** (aucune réécriture) : modèle `SchoolPost`, feed
`GET /api/platform/feed`, composant `SocialTab`, portefeuille `walletService`, passerelle
`ikeepayService` + `PaymentIntent` + webhook `applyOutcome`, RBAC `protect/authorize`,
notifications `pushService`, cron `jobs/scheduler`, journal `AuditLog`.

## Décisions
- **Paiement** : portefeuille interne (instantané, confirmé serveur) **+** Ikeepay Mobile Money
  (confirmé par webhook), derrière une couche d'abstraction `boostPaymentService`.
- **Sécurité** : conventions du projet + durcissement ciblé (pas de nouveau middleware global).
- Prix **résolus exclusivement côté serveur** (`BoostPricing`) ; le front n'envoie qu'une `durationKey`.

## Modèle de données
- **`BoostPricing`** : `durationKey (24h|3d|7d)`, `hours`, `price`, `currency`, `isActive` — défauts
  semés : 24h=500, 3j=1000, 7j=2500 XOF.
- **`BoostConfig`** (singleton) : garde-fous anti-spam + diffusion (limites budget jour/mois,
  campagnes actives/user, boosts/post, délai min, durée max, `requireReview`, `feedInjectionRatio`,
  `maxSponsoredPerPage`, `objectives`).
- **`BoostCampaign`** : `user`, `post`, `objective`, `audience`, `durationKey/Hours`, `budget`,
  `paymentProvider`, `paymentRef/Intent`, `status` (pending_payment → pending_review → active →
  paused/completed/rejected/cancelled/refunded), `stats` (impressions/views/likes/comments/shares/
  clicks/newFollowers), `baselineStats`, `startsAt/endsAt`.

## Flux
1. **Bouton 🚀** dans `PostCard` (`SocialTab.jsx`) — **propriétaire uniquement**, aligné avec
   Like/Commenter/Partager/DL (même style `flex-1`). Devient **« En cours »** si campagne active ;
   masqué si compte suspendu / post plateforme.
2. **`BoostModal`** : Objectif → Audience (auto/personnalisée) → Durée (prix serveur) → Résumé →
   Paiement (Portefeuille avec PIN **ou** Mobile Money avec polling du statut) → Confirmation.
3. **Paiement** : wallet = débit serveur + activation immédiate ; ikeepay = collecte + activation au
   **webhook** (`applyOutcome`, purpose `boost`). Aucune activation sur simple retour front.
4. **Diffusion** (`boostFeedService`) : injection de publications **sponsorisées** dans le feed
   (page 1), sélection par **score** (base + poids budget + pertinence + engagement − répétition),
   espacées ; label **« Sponsorisé »** ; impressions comptées au service.
5. **Cron** (`scheduler.tick` horaire) : `completeExpired()` + `notifyEndingSoon()` (≤6h).
6. **Notifications** (`pushService`) : paiement confirmé / activé / fin proche / terminé.

## API
Utilisateur (`/api/boosts`, protégé) : `GET /pricing`, `POST /preview`, `POST /create`
(rate-limité), `GET /my-campaigns`, `GET /:id`, `GET /:id/stats`, `POST /:id/cancel`.
Admin (`/api/admin/boosts`, super_admin) : `GET /`, `GET /stats`, `PATCH /:id/status`,
`POST /:id/refund`, `GET|PATCH /config`, `GET|POST /pricing`, `PATCH|DELETE /pricing/:id`.

## Sécurité & anti-fraude
Auth obligatoire ; vérif propriétaire ; prix serveur (protection contre manipulation) ; limites
`BoostConfig` (spam) ; idempotence (`PaymentIntent.fulfilled` + garde campagne active unique) ;
rate-limit ciblé sur `create` ; `AuditLog` (create/cancel/admin/refund) ; le front ne fixe jamais
budget/statut/impressions/dates/paiement.

## Fichiers
**Créés** : `server/models/{BoostCampaign,BoostPricing,BoostConfig}.js` ;
`server/services/{boostPricingService,boostPaymentService,boostFeedService,boostLifecycleService}.js` ;
`server/routes/{boosts,adminBoosts}.js` ; `client/src/components/boost/{BoostModal,BoostStatsModal}.jsx` ;
`client/src/pages/user/UserBoostsPage.jsx` ; `client/src/pages/AdminBoostsPage.jsx`.
**Modifiés** : `server/models/{PaymentIntent,WalletTransaction}.js` ; `server/routes/{payments,platform}.js` ;
`server/jobs/scheduler.js` ; `server/server.js` ; `client/src/lib/api.js` ;
`client/src/components/landing/SocialTab.jsx` ; `client/src/pages/user/UserLayout.jsx` ;
`client/src/App.jsx` ; `client/src/data/navSections.js`.

## Variables d'environnement
Aucune nouvelle **requise**. Wallet : rien. Ikeepay : réutilise `IKEEPAY_*` + `SERVER_URL` (webhook).
Optionnel : `BOOST_DEFAULT_CURRENCY` (défaut `XOF`). Prix & limites = configuration en base (défauts
semés au 1er accès à `/api/boosts/pricing`).

## Test rapide
1. Se connecter en `utilisateur`, publier un post → 🚀 « Booster » visible **seulement** sur mes posts.
2. Booster (portefeuille + PIN) → statut `active`, bouton « En cours », « Sponsorisé » dans le feed.
3. « Mes boosts » (`/u/mes-boosts`) → campagne + statistiques.
4. Admin `/dashboard/boosts-admin` → liste, revenus, suspendre/réactiver/rembourser, éditer les prix.
5. Cron : `node -e "require('./server/jobs/scheduler').runBoostLifecycle().then(console.log)"` (DB requise).
