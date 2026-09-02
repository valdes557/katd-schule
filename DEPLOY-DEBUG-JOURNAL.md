# Journal de débogage — déploiement katdschool.com (gptservers.cloud / cPanel)

> Fichier de suivi vivant. Objectif : que `git push` sur `main` mette réellement à jour
> https://katdschool.com. Exclu du déploiement FTP (`*.md`), donc sans impact en ligne.

## Contexte
- Site migré Contabo (VPS) → **gptservers.cloud** (cPanel mutualisé, LiteSpeed, CloudLinux, Passenger).
- Même domaine `katdschool.com`. Une app Node sert l'API **et** le site React (`SERVE_CLIENT=true`, `server/server.js`).
- Déploiement : `.github/workflows/deploy.yml` (push `main` → build client + `npm ci` server → **FTPS** vers `FTP_APP_DIR` → `tmp/restart.txt`).

## Diagnostic PROUVÉ (2026-09-02)
1. `main` (GitHub) a le **bon** workflow cPanel ; les runs **réussissent** (dernier : 2 sept 08:42 UTC ✅).
2. L'app Node **tourne** et est servie : `GET /api/health` → 200.
3. **MAIS le site sert un ancien build (30 août)**, pas le code déployé :
   - En ligne : `index-CXHjPEF-.js` (HTTP 200).
   - Build CI/déployé : `index-Be2d1g4Z.js` (HTTP **404** sur le domaine).
   - Cache-buster → toujours l'ancien ⇒ **pas un cache**.
4. Logs FTP : `client/dist/index.html` « File content is the same, doing nothing » ⇒ le build frais **est** bien dans le dossier cible du FTP (`katd-api`)… mais le domaine ne sert pas ce dossier.
5. Symptôme utilisateur : **« route non trouvée »** sur les fonctionnalités récentes (ex. `/api/youtube/...`) ⇒ l'app en ligne exécute l'**ancien code** (routes absentes).

## Cause racine
Le dossier **déployé** (`FTP_APP_DIR` = `katd-api`) ≠ le dossier **exécuté/servi** par le domaine.
**Info clé (utilisateur) : il y a DEUX applications Node sur le plan.** → `katdschool.com` est
très probablement branché sur la 1re app (ancien build), alors que le déploiement alimente `katd-api` (2e app).

## Faits confirmés
- « Application root » d'une des apps = **`katd-api`** (vérifié par l'utilisateur dans Setup Node.js App).
- Le déploiement (FTP) écrit bien du code frais dans `katd-api`.
- Le `.env` (secrets) et `server/uploads/` sont **exclus** du déploiement (jamais écrasés).

## Plan de correction
- **PHASE 1 — Identifier les 2 apps** : quel dossier chaque domaine exécute (`PassengerAppRoot` dans les `.htaccess`), et confirmer que `katd-api` a le code frais. → commandes ci-dessous.
- **PHASE 2 — Bascule** (au choix, selon Phase 1) :
  - (A, sûr) Régler `FTP_APP_DIR` = dossier réellement servi par katdschool.com → redéployer → restart.
  - (B, propre) Rebrancher le domaine `katdschool.com` sur l'app `katd-api` (+ copier `.env`, lier `uploads/`) → restart.
- **PHASE 3 — Vérifier** : nouveau bundle en 200, `/api/youtube/...` répond, site à jour.

## Journal des actions
- 2026-09-02 : diagnostic complet ci-dessus. Branche `feat/cpanel-deploy-youtube-download` poussée ; `main` confirmé à jour (5954751). Déploiement vert mais dossier mal ciblé.
- 2026-09-02 : PHASE 1 faite. Résultats (via `.htaccess` / PassengerAppRoot) :
  - Compte cPanel : `katdscho` (home `/home/katdscho`), serveur `rs7-lon`.
  - App #1 `api.livefx-trading.com` → `/home/katdscho/repos/livefxacademy/backend` (AUTRE projet, ne pas toucher).
  - App #2 **`katdschool.com`** (docroot `public_html`) → **`/home/katdscho/katd-api`** (startup `server/server.js`).
  - ⇒ Le domaine pointe BIEN sur `katd-api`, MAIS **`katd-api` n'a pas le code frais** (`server/routes/youtube.js` ABSENT, `client/dist` vide).
  - CONCLUSION : le FTP ne dépose pas dans `/home/katdscho/katd-api` → `FTP_APP_DIR` cible un autre dossier (ou fichier d'état `.ftp-deploy-sync-state.json` périmé qui fait sauter l'upload).
- 2026-09-02 : (en cours) PHASE 1bis — localiser la cible FTP réelle (`.ftp-deploy-sync-state.json`, `youtube.js`, `index-Be2d1g4Z.js`).

## CAUSE RACINE DÉFINITIVE (2026-09-02) — bug de chemin dupliqué
Le code frais est déployé dans un dossier **imbriqué en double** :
```
/home/katdscho/katd-api/home/katdscho/katd-api/server/routes/youtube.js
/home/katdscho/katd-api/home/katdscho/katd-api/client/dist/assets/index-Be2d1g4Z.js
```
- Le **compte FTP est chrooté sur `/home/katdscho/katd-api`** (c'est déjà sa racine).
- Or le secret **`FTP_APP_DIR` vaut le chemin ABSOLU `/home/katdscho/katd-api/`**.
- ⇒ le FTP repart de sa racine (`…/katd-api`) et y ajoute encore `home/katdscho/katd-api/` → tout tombe dans `katd-api/home/katdscho/katd-api/`.
- Le domaine lit `katd-api/server/server.js` (app root Passenger) → ne voit jamais le code frais → « route non trouvée » + ancien build.
- `katd-api/.env` existe (30 juil., creds DB OK). `katd-api/server/.env` ABSENT.
- `server.js` : `dotenv.config()` (cwd = app root), `clientDist = __dirname/../client/dist` = `katd-api/client/dist`, `SERVE_CLIENT` OK si `NODE_ENV=production`.

## FIX = mettre `FTP_APP_DIR` à `./` (le FTP est déjà dans katd-api)
Étapes :
1. (cPanel terminal, sans risque, app actuelle intacte) préparer katd-api : `cp .env` vers `server/.env`, ajouter `SERVE_CLIENT=true`, recopier `uploads/` vers `server/uploads/`.
2. Régler le secret `FTP_APP_DIR = ./` (le défaut du workflow si le secret est vide).
3. Relancer le déploiement (`workflow_dispatch`) → écrit `katd-api/{server,client/dist}` + `tmp/restart.txt` → Passenger redémarre.
4. Nettoyer le dossier imbriqué : `rm -rf ~/katd-api/home`.
5. Vérifier : `youtube.js` présent, nouveau bundle en 200, site à jour.

## AVANCEMENT (2026-09-02, après-midi)
- ÉTAPE 1 (terminal) FAITE via one-liner : code frais déplacé du dossier imbriqué vers `katd-api/{server,client}`, `.env` recopié dans `server/.env` + `SERVE_CLIENT=true`, uploads préservés, dossier `home/` imbriqué supprimé, `tmp/restart.txt` touché.
  - Résultat en ligne : **backend FRAIS** → `/api/youtube/ad-config` = 401 (route existe, avant 404), `index-Be2d1g4Z.js` = 200 (avant 404), `/api/health` = 200. ✅
- RESTE : la page `/` sert encore l'ancien build statique présent dans **`~/public_html`** (index.html + assets du 30 août) que LiteSpeed sert avant Passenger.
  - FIX : déplacer tout `public_html` sauf `.htaccess`/dotfiles/cgi-bin/php.ini vers `~/_public_html_old` → `/` tombe sur Node (build frais). Réversible.
- ENSUITE (durabilité) : ÉTAPE 2 = régler le secret GitHub `FTP_APP_DIR = ./` (le token n'a pas la permission Secrets → à faire dans l'UI), puis redeploy de validation.

## ✅ RÉSOLU EN LIGNE (2026-09-02) — site frais
- Nettoyage `~/public_html` (build statique déplacé vers `~/_public_html_old`, seul `.htaccess` + `.well-known` conservés).
- Vérif en ligne : accueil sert **`index-Be2d1g4Z.js` + `index-DRYFP2R6.css`** (build frais), `/api/health`=200, `/api/youtube/ad-config`=401 (route OK). **Site à jour.** 🎉
- (Cosmétique) ancien bundle `CXHjPEF` encore 200 = cache LiteSpeed, sans conséquence.

## RESTE À FAIRE (durabilité des futurs `git push`)
- **ÉTAPE 2 — secret GitHub `FTP_APP_DIR = ./`** (UI, le token n'a pas la permission Secrets). Sans ça, le prochain push redéposera dans le dossier imbriqué et les futures modifs n'apparaîtront pas.
- ÉTAPE 3 — redeploy de validation (via API) une fois le secret corrigé.
- Nettoyage optionnel : supprimer `~/_public_html_old` et les vieux fichiers plats de `katd-api` (server.js 7308o, routes/, models/… à la racine) une fois tout validé.
- Révoquer le token GitHub.

## Sécurité
- Un token GitHub (fine-grained) a été utilisé dans la session pour pousser → **à révoquer** après le fix
  (GitHub → Settings → Developer settings → Fine-grained tokens → Revoke).
