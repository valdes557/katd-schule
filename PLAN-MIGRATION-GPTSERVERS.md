# PLAN — Migration gptservers.cloud + Téléchargement YouTube + corrections

Site déjà migré sur **gptservers.cloud** (hébergement cPanel mutualisé), **même domaine
`katdschool.com`**. Ce plan couvre 5 tâches demandées, réalisées en une passe puis commit.

---

## 1. Déploiement automatique local → en ligne (cPanel)

L'ancien pipeline (GitHub Actions → SSH → PM2 → Nginx sur VPS Contabo) ne s'applique plus :
cPanel mutualisé = pas de root, souvent pas de SSH, Node géré par **Passenger** (« Setup Node.js
App »), Apache + `.htaccess` au lieu de Nginx.

**Approche retenue — application Node auto-portée + déploiement FTP :**

- **`server/server.js`** sert désormais aussi le build client (`client/dist`) en production, avec
  repli SPA (toute route non `/api` ni `/uploads` → `index.html`). Une seule app Node cPanel sert
  donc l'API **et** le site → plus besoin de Nginx/reverse-proxy.
- **`.github/workflows/deploy.yml`** réécrit : build du client sur le runner GitHub, puis envoi
  **FTPS** de `client/dist` + `server/` vers l'hébergement, puis `touch tmp/restart.txt` (convention
  Passenger) pour redémarrer l'app Node. Déclenché à chaque `push` sur `main` → mise à jour quasi
  instantanée.
- Secrets GitHub à créer : `FTP_HOST`, `FTP_USERNAME`, `FTP_PASSWORD` (compte FTP cPanel),
  `FTP_APP_DIR` (dossier racine de l'app Node, ex. `/home/USER/katd-schule`).
- **`.cpanel.yml`** ajouté (alternative « Git Version Control » de cPanel si le FTP n'est pas voulu).
- **`client/public/.htaccess`** : repli SPA côté Apache si le client est servi séparément.
- **`AUTO-DEPLOY.md`** mis à jour (mise en place cPanel).

> DB : inchangée (MongoDB externe via `MONGO_URI` déjà défini sur l'hébergement). cPanel ne fournit
> que MySQL ; Mongo doit rester externe (Atlas / VPS). Rien à migrer côté code.

## 2. Téléchargement des vidéos YouTube + pub AdSense (monétisation)

- **Backend** : `GET /api/youtube/download/:videoId` (auth) — flux progressif MP4 (audio+vidéo,
  ≤720p, sans ffmpeg) via `@distube/ytdl-core` (require paresseux + rate-limit). `GET
  /api/youtube/ad-config` renvoie la config pub **non secrète** (client AdSense, slot, secondes,
  activé). `YoutubeConfig` étendu : `adsenseClient`, `adSlot`, `adCountdown`, `downloadEnabled`.
- **Admin** : panneau YouTube (Gestion Plateforme → Clés API) étendu pour saisir l'ID éditeur
  AdSense (`ca-pub-…`), l'ID de bloc, le compte à rebours et activer/désactiver le téléchargement.
- **Frontend** : `DownloadAdGate` (modal pub + compte à rebours, puis téléchargement via fetch
  authentifié → blob → enregistrement). Bouton **Télécharger** sur `YoutubeCard` et
  `YoutubePlayerModal`. Si aucun ID AdSense n'est encore configuré → encart « Publicité » neutre
  (la fonctionnalité marche déjà, la pub s'activera dès l'ID saisi).

## 3. Lien webhook Ikeepay

Le handler existe déjà (`/api/payments/webhook`). Ajout d'un **alias court** `POST /api/webhook`
(même logique) pour coller au format demandé.

**Lien à mettre dans la passerelle Ikeepay :** `https://katdschool.com/api/webhook`
(l'ancien `https://katdschool.com/api/payments/webhook` reste valide.)

## 4. Réactivation d'un plan de souscription expiré (admin)

`PUT /api/schools/:id/subscription-status` ne remettait que le `status` : un plan **expiré**
(endDate dépassée) restait sans accès car `hasActiveAccess()` exige `endDate > now`. Correctif :
à la réactivation, si `endDate` absente/dépassée, on la **prolonge** (durée du plan, ou `months`
transmis). Le dashboard `AdminEcolesPage` distingue l'état **Expiré** et permet de
**réactiver / renouveler** (durée en mois).

## 5. Correctif — bulletin maternelle (notes enregistrées absentes)

Cause : la saisie (`NotesPage`) enregistre en **brouillon par défaut**, or le bulletin exclut les
brouillons (`status ≠ brouillon`) — pensé pour le Secondaire. En Maternelle/Primaire il n'y a pas
de notion de publication → les notes n'apparaissaient jamais.

Correctif (double sécurité) :
- `NotesPage` : statut **« Publier »** par défaut (le brouillon reste un choix explicite).
- `GET /api/grades/bulletin/:studentId` : pour les cycles **Maternelle/Primaire**, inclure toutes
  les notes (brouillons compris) dans le bulletin, les `availableTerms` et le classement. Le
  Secondaire conserve le workflow publié-uniquement.

---

### Vérification
Build client OK ; `/api/webhook` répond ; réactivation d'une école expirée → accès rétabli avec
nouvelle échéance ; note maternelle saisie → visible immédiatement sur le bulletin ; bouton
Télécharger → pub/compte à rebours → fichier MP4 enregistré ; aucune clé secrète exposée au client.
