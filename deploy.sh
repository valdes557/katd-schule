#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Script de déploiement KATD-SCHÜLE sur le VPS Hostinger
# Usage (sur le VPS, dans /var/www/katd-schule) :  ./deploy.sh
# ---------------------------------------------------------------------------
set -e  # stoppe au premier échec

APP_DIR="/var/www/katd-schule"
cd "$APP_DIR"

echo "==> 1/5  Récupération du code"
# Synchronisation stricte sur origin/main (évite tout conflit de merge lors
# d'un déploiement automatique). Le workflow GitHub Actions fait déjà ce reset,
# on le refait ici pour que le script reste correct s'il est lancé à la main.
git fetch --all --prune
git reset --hard origin/main

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
# Best-effort : le rechargement n'est vraiment utile que si la conf Nginx a
# changé. On utilise `sudo -n` (non-interactif) pour ne JAMAIS bloquer un
# déploiement automatique en attendant un mot de passe. Si sudo exige un mot
# de passe (voir AUTO-DEPLOY.md, section « sudo sans mot de passe »), on affiche
# un avertissement sans faire échouer le déploiement.
if sudo -n nginx -t 2>/dev/null; then
  sudo -n systemctl reload nginx && echo "   Nginx rechargé."
else
  echo "   ⚠️  Nginx non rechargé (sudo indisponible en non-interactif)."
  echo "      Ce n'est nécessaire que si nginx-katdschool.conf a changé."
  echo "      Voir AUTO-DEPLOY.md pour activer sudo sans mot de passe."
fi

echo ""
echo "✅ Déploiement terminé — https://katdschool.com"
