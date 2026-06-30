#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Script de déploiement KATD-SCHÜLE sur le VPS Hostinger
# Usage (sur le VPS, dans /var/www/katd-schule) :  ./deploy.sh
# ---------------------------------------------------------------------------
set -e  # stoppe au premier échec

APP_DIR="/var/www/katd-schule"
cd "$APP_DIR"

echo "==> 1/5  Récupération du code (git pull)"
git pull origin main

echo "==> 2/5  Backend : dépendances"
cd "$APP_DIR/server"
npm install --production --no-audit --no-fund

echo "==> 3/5  Frontend : build React"
cd "$APP_DIR/client"
npm install --no-audit --no-fund
npm run build

echo "==> 4/5  Redémarrage de l'API (PM2)"
cd "$APP_DIR/server"
mkdir -p logs
# (re)démarre via ecosystem ; relance si déjà lancé, sinon démarre
pm2 startOrReload ecosystem.config.js
pm2 save

echo "==> 5/5  Rechargement de Nginx"
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "✅ Déploiement terminé — https://katdschool.com"
