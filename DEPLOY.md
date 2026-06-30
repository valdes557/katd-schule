# Déploiement KATD-SCHÜLE sur VPS Hostinger + domaine katdschool.com

Architecture cible : **Nginx** sert le front React (`client/dist`) et fait proxy de `/api` + `/uploads`
vers **Node (PM2, port 5000)**. **MongoDB 8.0** tourne en local sur le VPS. **HTTPS** via Let's Encrypt.

```
Internet → katdschool.com (DNS LWS → IP VPS) → Nginx (80/443)
        ├── "/"            → client/dist (React statique)
        └── "/api","/uploads" → localhost:5000 (Node + PM2) → MongoDB local
```

---

## Phase 0 — Récupérer les infos

- **IP publique du VPS** : Hostinger → VPS → Aperçu (ex. `82.x.x.x`)
- **Mot de passe root** (ou clé SSH) : Hostinger → VPS → Paramètres
- **Variables d'environnement actuelles** : Render → service `katd-schule-api` → Environment
  (récupérez `JWT_SECRET`, `CLOUDINARY_*`, `SMTP_USER`, `SMTP_PASS`, et l'ancienne `MONGO_URI` Atlas)

---

## Phase 1 — DNS chez LWS

Espace client LWS → domaine `katdschool.com` → **Zone DNS** :

| Type | Nom   | Valeur (IP du VPS) | TTL  |
|------|-------|--------------------|------|
| A    | `@`   | `82.x.x.x`         | 3600 |
| A    | `www` | `82.x.x.x`         | 3600 |

Supprimez les anciens enregistrements pointant vers Vercel (A `76.76.21.21` ou CNAME `cname.vercel-dns.com`).
La propagation prend de quelques minutes à quelques heures.

Test (depuis votre PC) : `ping katdschool.com` doit renvoyer l'IP du VPS.

---

## Phase 2 — Connexion SSH au VPS

Depuis ce terminal Claude Code, préfixez par `!` :

```
! ssh root@82.x.x.x
```

(Première fois : tapez `yes` pour accepter l'empreinte, puis le mot de passe root.)

---

## Phase 3 — Préparer le serveur

```bash
apt update && apt upgrade -y

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs git nginx ufw

# PM2 (garde Node en vie + redémarrage auto au reboot)
npm install -g pm2

# Pare-feu : autoriser SSH + web
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

node -v && npm -v && nginx -v
```

---

## Phase 4 — Installer MongoDB 8.0 (Ubuntu 24.04 "noble")

```bash
apt install -y gnupg curl

curl -fsSL https://pgp.mongodb.com/server-8.0.asc | \
  gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor

echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" \
  | tee /etc/apt/sources.list.d/mongodb-org-8.0.list

apt update
apt install -y mongodb-org mongodb-database-tools

systemctl start mongod
systemctl enable mongod
systemctl status mongod      # doit afficher "active (running)"
```

### Créer l'utilisateur admin + activer l'authentification

```bash
mongosh
```
```javascript
use admin
db.createUser({
  user: "katdadmin",
  pwd: "UN_MOT_DE_PASSE_SOLIDE",
  roles: [ { role: "root", db: "admin" } ]
})
exit
```
```bash
nano /etc/mongod.conf
```
Ajoutez à la fin (attention à l'indentation YAML) :
```yaml
security:
  authorization: enabled
```
```bash
systemctl restart mongod
```

URI locale (à utiliser plus bas) :
```
mongodb://katdadmin:UN_MOT_DE_PASSE_SOLIDE@localhost:27017/katd-schule?authSource=admin
```

---

## Phase 5 — Migrer les données Atlas → VPS

```bash
# 1) Atlas → Network Access → autoriser temporairement 0.0.0.0/0

# 2) Export depuis Atlas (ancienne URI récupérée dans Render)
mongodump --uri="mongodb+srv://USER:PASS@cluster.xxxx.mongodb.net/katd-schule" \
  --archive=/tmp/atlas-katd.gz --gzip

# 3) Import dans le MongoDB local
mongorestore --uri="mongodb://katdadmin:UN_MOT_DE_PASSE_SOLIDE@localhost:27017/?authSource=admin" \
  --archive=/tmp/atlas-katd.gz --gzip

# 4) Vérifier
mongosh "mongodb://katdadmin:UN_MOT_DE_PASSE_SOLIDE@localhost:27017/katd-schule?authSource=admin" \
  --eval "db.getCollectionNames(); db.users.countDocuments()"

rm /tmp/atlas-katd.gz
```

---

## Phase 6 — Cloner le code + configurer le backend

```bash
mkdir -p /var/www && cd /var/www
git clone https://github.com/valdes557/katd-schule.git
cd katd-schule/server
npm install --production
mkdir -p logs uploads

nano /var/www/katd-schule/server/.env
```
```env
NODE_ENV=production
PORT=5000
MONGO_URI=mongodb://katdadmin:UN_MOT_DE_PASSE_SOLIDE@localhost:27017/katd-schule?authSource=admin
JWT_SECRET=<identique à Render>
JWT_EXPIRE=30d
CLIENT_URL=https://katdschool.com
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
```

---

## Phase 7 — Build du frontend

```bash
cd /var/www/katd-schule/client
npm install
npm run build      # lit client/.env.production -> VITE_API_URL=/api ; génère dist/
```

---

## Phase 8 — Nginx

```bash
cp /var/www/katd-schule/nginx-katdschool.conf /etc/nginx/sites-available/katdschool
ln -s /etc/nginx/sites-available/katdschool /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

`http://katdschool.com` doit déjà afficher le site (une fois le DNS propagé).

---

## Phase 9 — Lancer l'API (PM2)

```bash
cd /var/www/katd-schule/server
pm2 start ecosystem.config.js
pm2 save
pm2 startup        # exécutez la commande affichée (démarrage auto au reboot)

curl http://localhost:5000/api/health    # -> {"status":"ok"...}
```

---

## Phase 10 — HTTPS (Let's Encrypt)

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d katdschool.com -d www.katdschool.com
```
Choisissez la redirection HTTP→HTTPS. Site servi en `https://katdschool.com`.

---

## Phase 11 — Sauvegardes automatiques MongoDB

```bash
nano /var/www/katd-schule/backup-mongo.sh   # remplacer le mot de passe
chmod +x /var/www/katd-schule/backup-mongo.sh
/var/www/katd-schule/backup-mongo.sh        # test manuel
ls -lh /var/backups/mongo/

crontab -e
# ajouter :
17 3 * * * /var/www/katd-schule/backup-mongo.sh >> /var/log/katd-backup.log 2>&1
```

---

## Phase 12 — Couper l'ancien hébergement

- Vercel : retirer le domaine custom / supprimer le projet
- Render : suspendre le service `katd-schule-api`
- Atlas : retirer `0.0.0.0/0` ; fermer le cluster une fois la migration validée

---

## Déploiements futurs

Sur votre PC : `git push origin main`.
Sur le VPS :
```bash
cd /var/www/katd-schule && ./deploy.sh
```

---

## Dépannage rapide

| Symptôme | Vérifier |
|----------|----------|
| 502 Bad Gateway | `pm2 logs katd-api` — l'API tourne-t-elle ? `curl localhost:5000/api/health` |
| Page blanche | `npm run build` a-t-il généré `client/dist` ? chemin `root` dans Nginx |
| Erreur Mongo | `systemctl status mongod` ; URI + mot de passe dans `server/.env` |
| Uploads échouent (413) | `client_max_body_size 20M;` présent dans Nginx |
| certbot échoue | DNS pas encore propagé — attendre, retester `ping katdschool.com` |
| `bad interpreter` sur .sh | fins de ligne CRLF — `sed -i 's/\r$//' deploy.sh` |
```
