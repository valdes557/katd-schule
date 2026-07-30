# Suivi de progression du déploiement

> Migration réalisée en juillet 2026 : ancien VPS **Hostinger** → nouveau VPS **Contabo**.
> La base est restée sur **MongoDB Atlas** (pas de Mongo local). Détail des phases dans **DEPLOY.md**.

## État (migration Contabo — 2026-07-30)

- [x] **Backup Atlas** — export JSON de sécurité de toutes les collections (1707 docs)
- [x] **Stack VPS** — Node 20 + Nginx + PM2 + pare-feu ufw installés sur Contabo
- [x] **Code + .env** — repo cloné dans `/var/www/katd-schule`, `server/.env` recopié (MONGO_URI Atlas, NODE_ENV=production, CLIENT_URL=https://katdschool.com)
- [x] **API (PM2)** — `katd-api` online, connexion Atlas OK, `/api/health` répond
- [x] **Frontend** — `client/dist` buildé, Nginx configuré et rechargé
- [x] **DNS LWS** — A `@` et `www` → IP Contabo `169.58.96.69`, propagé
- [x] **HTTPS** — certbot OK sur katdschool.com + www.katdschool.com
- [ ] **Secrets GitHub Actions** — VPS_HOST/USER/PORT/SSH_KEY repointés vers Contabo + déploiement test validé
- [ ] **Sauvegardes** — cron de backup programmé sur le VPS
- [ ] **Ancien hébergement** — Hostinger résilié / non renouvelé

## Notes / blocages rencontrés

- La base n'a jamais été sur le VPS Hostinger : elle est chez MongoDB Atlas, donc la coupure de Hostinger n'a détruit aucune donnée.
- Penser à garder l'IP du VPS autorisée dans **Atlas ▸ Network Access**.
