#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Sauvegarde quotidienne de MongoDB Atlas (données KATD-SCHÜLE) sur le VPS.
# Exporte toutes les collections en JSON via server/scripts/atlas-backup.js,
# archive en .tar.gz daté dans /var/backups/katd-atlas, puis fait la rotation
# (ne garde que les N derniers jours).
#
# Installation (cron root) :
#   chmod +x /var/www/katd-schule/backup-atlas.sh
#   crontab -e
#   # ajouter (backup chaque nuit à 03:17) :
#   17 3 * * * /var/www/katd-schule/backup-atlas.sh >> /var/log/katd-backup.log 2>&1
# ---------------------------------------------------------------------------
set -euo pipefail

APP_DIR="/var/www/katd-schule"
BACKUP_DIR="/var/backups/katd-atlas"
RETENTION_DAYS=14
STAMP="$(date +%Y-%m-%d_%H%M)"
TMP_DIR="/tmp/katd-atlas-${STAMP}"

mkdir -p "$BACKUP_DIR"

echo "[$(date '+%F %T')] Démarrage backup Atlas -> ${STAMP}"

# 1) Export JSON de toutes les collections (lecture seule sur Atlas).
#    Le script lit MONGO_URI depuis server/.env.
cd "$APP_DIR/server"
node scripts/atlas-backup.js "$TMP_DIR"

# 2) Archive compressée + empreinte pour vérifier l'intégrité plus tard.
ARCHIVE="$BACKUP_DIR/katd-atlas-${STAMP}.tar.gz"
tar -czf "$ARCHIVE" -C "$TMP_DIR" .
sha256sum "$ARCHIVE" > "${ARCHIVE}.sha256"
rm -rf "$TMP_DIR"

SIZE="$(du -h "$ARCHIVE" | cut -f1)"
echo "[$(date '+%F %T')] Archive créée : $ARCHIVE ($SIZE)"

# 3) Rotation : supprime les archives (et leurs .sha256) de plus de N jours.
find "$BACKUP_DIR" -name 'katd-atlas-*.tar.gz*' -type f -mtime "+${RETENTION_DAYS}" -print -delete

echo "[$(date '+%F %T')] Backup terminé. Rétention : ${RETENTION_DAYS} jours."
