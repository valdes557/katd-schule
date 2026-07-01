# Déploiement automatique — GitHub → VPS Hostinger

À chaque `git push` sur la branche **`main`**, GitHub Actions se connecte en SSH
au VPS et lance `deploy.sh` (pull → build → PM2 reload → nginx). Le site
**https://katdschool.com** reflète alors automatiquement le dernier commit.

```
git push  ──►  GitHub Actions  ──►  SSH  ──►  VPS : deploy.sh
                                              (git reset --hard, build client,
                                               npm install server, pm2 reload,
                                               nginx reload best-effort)
```

Le workflow est défini dans `.github/workflows/deploy.yml`.

---

## Mise en place (à faire UNE SEULE FOIS)

### 1. Générer une paire de clés SSH dédiée au déploiement

**Sur le VPS** (connecté en SSH), crée une clé sans passphrase réservée à GitHub :

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy -N ""
```

Cela crée :
- `~/.ssh/github_deploy`     → clé **privée** (ira dans les secrets GitHub)
- `~/.ssh/github_deploy.pub` → clé **publique** (reste sur le VPS)

### 2. Autoriser la clé publique sur le VPS

```bash
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 3. Récupérer la clé privée à copier dans GitHub

```bash
cat ~/.ssh/github_deploy
```

Copie **tout** l'affichage, de la ligne `-----BEGIN OPENSSH PRIVATE KEY-----`
jusqu'à `-----END OPENSSH PRIVATE KEY-----` incluses.

### 4. Créer les secrets sur GitHub

Sur le dépôt : **Settings ▸ Secrets and variables ▸ Actions ▸ New repository secret**.
Crée ces 4 secrets :

| Nom du secret | Valeur                                                        |
|---------------|---------------------------------------------------------------|
| `VPS_HOST`    | IP publique du VPS (ex. `82.180.123.45`) ou `katdschool.com`  |
| `VPS_USER`    | l'utilisateur SSH (ex. `root`, ou l'utilisateur de déploiement)|
| `VPS_SSH_KEY` | le **contenu complet** de la clé privée copiée à l'étape 3     |
| `VPS_PORT`    | le port SSH — généralement `22`                               |

> ⚠️ La clé privée ne doit **jamais** être commitée dans le dépôt. Elle vit
> uniquement dans les secrets GitHub (chiffrés).

### 5. (Si `VPS_USER` n'est PAS `root`) → sudo sans mot de passe pour Nginx

`deploy.sh` recharge Nginx avec `sudo`. En session SSH automatique, sudo ne peut
pas saisir de mot de passe. Deux cas :

- **`VPS_USER = root`** → rien à faire, root n'a pas besoin de mot de passe.
- **Utilisateur non-root** → autorise juste les 2 commandes Nginx sans mot de passe :

```bash
# En tant que root sur le VPS (remplace <USER> par ton utilisateur de déploiement)
echo '<USER> ALL=(root) NOPASSWD: /usr/sbin/nginx -t, /bin/systemctl reload nginx' \
  | sudo tee /etc/sudoers.d/katd-deploy
sudo chmod 440 /etc/sudoers.d/katd-deploy
sudo visudo -c   # vérifie la syntaxe
```

> Sans cette étape, le déploiement fonctionne quand même : seul le rechargement
> Nginx est sauté (utile uniquement si `nginx-katdschool.conf` a changé). Un
> avertissement s'affiche dans les logs.

---

## Vérifier que ça marche

1. Fais un petit changement, puis :
   ```bash
   git add -A && git commit -m "test auto-deploy" && git push
   ```
2. Sur GitHub : onglet **Actions** → tu vois le workflow **Deploy to Hostinger VPS**
   s'exécuter. Clique dessus pour voir les logs en direct.
3. Vert ✅ = le site est à jour sur https://katdschool.com.

### Lancer un déploiement manuellement (sans push)

Onglet **Actions ▸ Deploy to Hostinger VPS ▸ Run workflow** (bouton à droite).
Utile pour re-déployer sans nouveau commit.

---

## Dépannage

| Symptôme dans les logs GitHub Actions | Cause probable / solution |
|---|---|
| `ssh: handshake failed` / `permission denied (publickey)` | Clé publique absente de `~/.ssh/authorized_keys` sur le VPS, ou mauvais `VPS_USER`. Reprendre étapes 1-3. |
| `dial tcp ... i/o timeout` | `VPS_HOST` ou `VPS_PORT` incorrect, ou pare-feu (ufw) bloque le port SSH. |
| Le déploiement se fige puis timeout à l'étape Nginx | sudo attend un mot de passe → faire l'étape 5 (sudo sans mot de passe). |
| `deploy.sh: bad interpreter` | Fins de ligne CRLF. Déjà géré par `.gitattributes` (`*.sh eol=lf`) — refaire `git pull` sur le VPS. |
| `git reset --hard` échoue | Modifications locales non commitées sur le VPS. Se connecter et faire `git status` ; le reset écrase tout ce qui est suivi par git. |

---

## Sécurité — bonnes pratiques

- La clé `github_deploy` ne sert **qu'**au déploiement : si elle fuite, il suffit
  de retirer sa ligne de `~/.ssh/authorized_keys` sur le VPS pour la révoquer.
- Les variables sensibles (MONGO_URI, JWT_SECRET, OPENAI_API_KEY…) restent dans
  `server/.env` **sur le VPS** — jamais dans le dépôt ni dans les secrets GitHub.
- Le workflow ne déploie que la branche `main`. Les autres branches ne touchent
  pas la production.
