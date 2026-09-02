# Déploiement automatique — GitHub → hébergement cPanel (gptservers.cloud)

Le site est hébergé sur **gptservers.cloud** (cPanel mutualisé), domaine **https://katdschool.com**.
À chaque `git push` sur la branche **`main`**, GitHub Actions **compile le client**, **installe les
dépendances backend** et **envoie le tout par FTPS** vers l'application Node de l'hébergement, puis
**redémarre l'app** (Passenger). Le site en ligne reflète alors automatiquement le dernier commit.

```
git push  ──►  GitHub Actions  ──►  FTPS  ──►  cPanel
                (build client + npm ci        (synchro incrémentale de server/ + client/dist,
                 dépendances prod)             puis tmp/restart.txt → redémarrage Passenger)
```

Le workflow est défini dans `.github/workflows/deploy.yml`.

> **Pourquoi ce changement ?** L'ancien hébergement (VPS Contabo) utilisait SSH + PM2 + Nginx.
> Un cPanel mutualisé n'a ni root, ni PM2, ni Nginx : l'app Node y est gérée par cPanel
> (« Setup Node.js App » / Passenger) et le déploiement se fait par FTP. L'app Node sert
> désormais **à la fois l'API et le site React** (voir `server/server.js`, `SERVE_CLIENT`).

---

## Mise en place (à faire UNE SEULE FOIS)

### 1. Créer l'application Node.js sur cPanel

Dans cPanel → **Setup Node.js App** → **Create Application** :

- **Node.js version** : 20 (ou la plus récente disponible).
- **Application mode** : `Production`.
- **Application root** : ex. `katd-schule` (dossier qui contiendra `server/`, `client/dist`, …).
- **Application URL** : le domaine `katdschool.com`.
- **Application startup file** : `server/server.js`.
- **Variables d'environnement** : ajouter toutes celles de `server/.env.example`
  (`MONGO_URI`, `JWT_SECRET`, `ENCRYPTION_KEY`, SMTP, Ikeepay, `CLIENT_URL=https://katdschool.com`,
  `SERVER_URL=https://katdschool.com`, `SERVE_CLIENT=true`, …). **Ne mettez jamais ces secrets
  dans le dépôt.** On peut aussi téléverser un fichier `server/.env` (voir étape 4).

> **Base de données** : cPanel mutualisé ne fournit **que MySQL**. L'application utilise **MongoDB**
> → la base doit rester **externe** (MongoDB Atlas, ou l'ancien VPS). Renseignez simplement
> `MONGO_URI` vers cette base externe. Rien à changer dans le code.

### 2. Récupérer les identifiants FTP

cPanel → **FTP Accounts**. Notez l'**hôte** (ex. `ftp.katdschool.com`), l'**utilisateur** et le
**mot de passe**. Repérez le **chemin** du dossier de l'app (Application root), ex.
`/home/UTILISATEUR/katd-schule/`.

### 3. Créer les secrets sur GitHub

Dépôt → **Settings ▸ Secrets and variables ▸ Actions ▸ New repository secret** :

| Nom du secret  | Valeur                                                                 |
|----------------|------------------------------------------------------------------------|
| `FTP_HOST`     | hôte FTP (ex. `ftp.katdschool.com`)                                     |
| `FTP_USERNAME` | identifiant du compte FTP cPanel                                        |
| `FTP_PASSWORD` | mot de passe du compte FTP cPanel                                       |
| `FTP_APP_DIR`  | (optionnel) dossier racine de l'app, ex. `/home/UTILISATEUR/katd-schule/` — défaut `./` |

> ⚠️ Le mot de passe FTP ne doit **jamais** être commité : il vit uniquement dans les secrets
> GitHub (chiffrés).

### 4. Créer le fichier `server/.env` sur l'hébergement (une fois)

Le workflow **n'écrase jamais** `server/.env` (il est exclu de la synchro). Créez-le une fois via le
**File Manager** de cPanel (ou par FTP) dans `…/katd-schule/server/.env`, à partir de
`server/.env.example`, avec les vraies valeurs. (Alternative : tout définir dans les variables
d'environnement de l'app Node à l'étape 1.)

### 5. Premier déploiement

Poussez sur `main` (ou lancez le workflow à la main : onglet **Actions ▸ Deploy to cPanel ▸ Run
workflow**). Le premier envoi est plus long (il téléverse aussi `server/node_modules`) ; les suivants
sont **incrémentaux** (seuls les fichiers modifiés partent).

Après le premier déploiement, ouvrez **Setup Node.js App** et cliquez **Restart** si l'app ne s'est
pas relancée automatiquement. Les redéploiements suivants la redémarrent via `tmp/restart.txt`.

---

## Vérifier que ça marche

1. Onglet **Actions** → le workflow **Deploy to cPanel (gptservers.cloud)** doit finir en vert ✅.
2. Ouvrez **https://katdschool.com** — le site doit refléter le dernier commit.
3. Testez l'API : **https://katdschool.com/api/health** doit répondre `{"status":"ok",…}`.

---

## Alternative : « Git Version Control » de cPanel (sans FTP)

Si vous préférez que cPanel tire lui-même le dépôt : cPanel → **Git Version Control** → cloner le
dépôt, puis déployer. Cette voie exige toutefois de compiler le client et d'installer les
dépendances côté hébergement (souvent via un `.cpanel.yml` et l'accès terminal), ce que tous les
plans mutualisés ne permettent pas. La méthode **FTP ci-dessus reste la plus simple et la plus
portable**, et ne demande aucune action manuelle après la mise en place.

---

## Dépannage

| Symptôme | Cause probable / solution |
|---|---|
| Le workflow échoue à l'étape FTP (`login incorrect` / timeout) | `FTP_HOST` / `FTP_USERNAME` / `FTP_PASSWORD` erronés, ou FTP bloqué. Vérifiez le compte FTP dans cPanel. |
| Le site affiche l'ancienne version | L'app Node n'a pas redémarré : **Setup Node.js App → Restart**. Vérifiez que `tmp/restart.txt` est bien dans l'Application root. |
| `/api/health` OK mais le site est blanc | `client/dist` non déployé ou `SERVE_CLIENT` absent. Vérifiez la variable d'env `SERVE_CLIENT=true` et la présence de `client/dist/index.html` sur l'hôte. |
| Erreurs 500 / l'app ne démarre pas | `server/.env` manquant ou `MONGO_URI` invalide (base MongoDB externe injoignable). Consultez les logs de l'app Node dans cPanel. |
| Les fichiers téléversés ont disparu | `server/uploads/` est préservé (exclu de la synchro). S'ils manquent, ils n'ont pas été migrés depuis l'ancien VPS. |

---

## Sécurité — bonnes pratiques

- Les secrets FTP vivent uniquement dans les secrets GitHub (chiffrés). En cas de fuite, changez le
  mot de passe du compte FTP dans cPanel.
- Les variables sensibles (`MONGO_URI`, `JWT_SECRET`, `ENCRYPTION_KEY`, clés Ikeepay/YouTube…)
  restent dans `server/.env` **sur l'hébergement** — jamais dans le dépôt ni dans les secrets FTP.
- Le workflow ne déploie que la branche `main`. Les autres branches ne touchent pas la production.
