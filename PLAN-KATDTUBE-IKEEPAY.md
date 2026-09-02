# PLAN — Ikeepay (dépôt/retrait) + Code email + Vidéos YouTube + Renommage KATDtube

> Établi le 2026-09-02 après vérification du code. Fichier de suivi (exclu du déploiement, `*.md`).

## 1. Ikeepay — la passerelle est-elle bien branchée pour dépôt/retrait ?

### Ce qui est BON
- Architecture complète : `services/ikeepayService.js` (collecte `createCollection`, payout `createPayout`, statut, webhook), `routes/payments.js` (initiation + webhook + crédit portefeuille **idempotent**), modèles PaymentIntent/WithdrawalRequest/WalletTransaction.
- Sécurité webhook solide : vérif HMAC **ou** réconciliation active (ne crédite jamais sur un webhook non vérifié).
- **Une seule « clé API » est NORMAL** : le site utilise l'API H2H `api.ikeepay.com` qui s'authentifie avec **une clé secrète unique** (par mode test/live). Le `pk_live_...` (public key) ne sert QU'À l'iframe inline `ikeepay.com/checkout/v1/inline`, que le site n'utilise pas. Donc l'absence de champ « public key / secret key » séparés est attendue. (Il faut juste : mode test/live + clé API (secrète) + secret webhook.)

### Écarts CODE vs DOC Ikeepay (fournie le 2026-09-02) → causeraient des erreurs en live
Fichier : `server/services/ikeepayService.js`
1. **En-tête d'auth** : le code envoie `Authorization: Bearer <clé>` (ligne ~94). La doc dit **`x-api-key: SECRET_KEY`**. ❌ → 401/403.
2. **Champs du payload** (`buildMomoBody`, ligne ~121) : le code envoie `phone`, `provider`, `payment_method`. La doc attend **`phoneNumber`**, **`operator`** (ex. ORANGE), sans `payment_method`. ❌ → 400 validation.
3. **Payin** : la doc attend aussi `customer_email` (+ `otp` si requis) et **renvoie `payment_link`** (Wave/Orange) à ouvrir côté client. Non géré. ⚠️
4. **Base URL / chemins** : code `https://api.ikeepay.com/api/v1` + `/payments`, `/payouts`. Doc : base `https://api.ikeepay.com` (chemins payin/payout exacts **à confirmer**). ⚠️
5. **Webhook** : la doc met la réf fournisseur dans `data.provider_reference` ; le code lit `transaction_id/id` (manque `provider_reference`). ⚠️
   Le code lui-même note : « chemins/entête à confirmer avec la doc ».

### Actions
- [ ] Aligner `authHeaders` → `{ 'x-api-key': cfg.apiKey }` (garder Content-Type/Accept).
- [ ] `buildMomoBody` → `phoneNumber`, `operator: mapProvider(...)`, retirer `payment_method` ; ajouter `customer_email`, `otp?` pour payin.
- [ ] Gérer `payment_link` renvoyé (redirection Wave/Orange).
- [ ] `BASE_URL` → `https://api.ikeepay.com` + **confirmer** les chemins payin/payout/statut avec Ikeepay.
- [ ] Webhook : lire aussi `data.provider_reference`.
- [ ] Renseigner dans le dashboard admin : mode = **live**, clé API **live**, secret webhook. Mettre l'URL webhook côté Ikeepay = `https://katdschool.com/api/webhook`.

## 2. Code de vérification par email qui n'arrive pas (valdeslando15@gmail.com)

Cause probable : **SMTP cassé/incomplet sur le serveur migré** (le code email part de `contact@katdschool.com` via `mail.katdschool.com:465`). Après migration gptservers, les identifiants/hôte SMTP dans `katd-api/.env` peuvent être faux/placeholder, ou les mails partent en spam.

### Diagnostic (endpoint intégré)
`GET https://katdschool.com/api/smtp-test?secret=<8 premiers caractères de JWT_SECRET>&to=valdeslando15@gmail.com`
→ renvoie la config SMTP + le résultat d'envoi. Si erreur → corriger `SMTP_HOST/PORT/USER/PASS/FROM` dans `~/katd-api/.env` (ou `~/katd-api/server/.env`) puis restart.

### Note importante (chiffrement)
Les clés (Ikeepay, YouTube) sont **chiffrées avec `ENCRYPTION_KEY`**. Si cette clé diffère sur le serveur migré, les clés stockées ne se déchiffrent plus (→ « non configurée » / pas de vidéos). **Re-saisir les clés dans le dashboard** les re-chiffre avec la clé actuelle.

## 3. Faire apparaître les vidéos côté utilisateur

Les vidéos s'affichent par **recherche + catégories** (pas de chaîne/playlist à configurer). Il faut :
1. Une **clé API YouTube Data v3** (Google Cloud → activer « YouTube Data API v3 »).
2. Dashboard : **Gestion Plateforme → Clés API → « Clé API YouTube (Vidéos) »** → coller la clé, cocher **« Fonctionnalité YouTube activée »**, enregistrer.
3. Si rien ne s'affiche : clé invalide/restreinte, API non activée dans Google Cloud, quota dépassé, ou `ENCRYPTION_KEY` changée (re-saisir la clé).

## 4. Renommage « YouTube » → « KATDtube » (section Vidéos)

### FAIT (display, `client/src/pages/user/UserVideosPage.jsx`)
- Sous-titre (l.37) : « Regardez **KATDtube** et les vidéos KATD… »
- Libellé d'onglet (l.42) : `'YouTube'` → **`'KATDtube'`**

### Optionnel (autres textes visibles — à confirmer si on les renomme)
- `components/youtube/YoutubePlayerModal.jsx` l.72 : `title={video?.title || 'YouTube'}` (fallback iframe).
- `AdminPlatformPage.jsx` (panneau admin) : « Clé API YouTube », « Fonctionnalité YouTube activée » → admin interne ; garder « YouTube » y est plus clair (c'est une clé de l'API YouTube).

### NE PAS TOUCHER (casserait le fonctionnement)
- Icône `Youtube` de **lucide-react** (Footer, UserLayout, UserVideosPage, etc.).
- Noms de composants/fichiers `Youtube*`, `youtubeApi`, routes `/api/youtube/*`, clés de données `post.type==='youtube'`, `youtubeVideoId`.
- URLs réelles `youtube.com/embed`, `youtu.be`, `googleapis.com/youtube/v3` (vrai service YouTube).
- Liens sociaux « YouTube » des écoles (DashboardSchoolProfilePage / SchoolDetailPage) — vrais liens YouTube.

## 5. Paiement INLINE Ikeepay (implémenté 2026-09-02)
« requested function was not found » au paiement = le chemin H2H `/payments` n'existe pas chez Ikeepay. Choix retenu : **paiement inline** (méthode principale de la doc, iframe `https://ikeepay.com/checkout/v1/inline?pk=…`).
- Backend : `resolveConfig` renvoie `publicKey` (publicKeyLive/Test) ; `GET /api/payments/config` (clé publique, non secret) ; `POST /payments/subscription/initiate` **sans** phone/operator → mode inline (crée l'intention, renvoie `reference`+`publicKey`, PAS d'appel H2H). Le webhook confirme.
- Frontend : `components/payments/IkeepayCheckout.jsx` (iframe + écoute `ikeepay-success`/`ikeepay-close`) ; `PaySubscriptionPage.jsx` ouvre l'iframe puis interroge `/status`.
- **Prérequis** : la **clé publique pk_live** doit être saisie dans le dashboard (→ nécessite le code email → SMTP OK).
- **Restant (même patron)** : nouvelle inscription (`SchoolRegistrationPage`), dépôt portefeuille, enrôlement, boost, marchand, actionnaire utilisent encore le H2H → à convertir en inline si voulu.

## Déploiement
Tout changement de code se déploie par `git push` sur `main` (pipeline réparé : `FTP_APP_DIR=./`, dépose dans `katd-api`, restart auto).
