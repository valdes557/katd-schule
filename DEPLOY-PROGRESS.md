# Suivi de progression du déploiement

> Cochez `[x]` au fur et à mesure. En cas de coupure, reprenez à la première case non cochée.
> Le détail de chaque phase est dans **DEPLOY.md**.

## État

- [ ] **Phase 0** — Infos rassemblées (IP VPS, mot de passe root, variables Render/Atlas)
- [ ] **Phase 1** — DNS LWS : enregistrements A `@` et `www` vers l'IP du VPS, anciens Vercel supprimés
- [ ] **Phase 2** — Connexion SSH au VPS réussie (`ssh root@IP`)
- [ ] **Phase 3** — Node + Nginx + PM2 + pare-feu (ufw) installés
- [ ] **Phase 4** — MongoDB 8.0 installé, utilisateur `katdadmin` créé, auth activée
- [ ] **Phase 5** — Données Atlas migrées vers le MongoDB local + vérifiées (countDocuments)
- [ ] **Phase 6** — Code cloné dans `/var/www/katd-schule`, `server/.env` créé
- [ ] **Phase 7** — Frontend buildé (`client/dist` généré)
- [ ] **Phase 8** — Nginx configuré et rechargé (site visible en http)
- [ ] **Phase 9** — API lancée avec PM2 (`/api/health` répond ok)
- [ ] **Phase 10** — HTTPS activé via certbot (https://katdschool.com)
- [ ] **Phase 11** — Sauvegardes MongoDB programmées (cron + test manuel ok)
- [ ] **Phase 12** — Vercel/Render/Atlas coupés

## Notes / blocages rencontrés

> (Écrivez ici tout souci pour en reparler à la reprise)

-
