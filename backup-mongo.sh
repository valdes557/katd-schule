#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Sauvegarde automatique de la base MongoDB KATD-SCHÜLE
# Garde les 14 dernières sauvegardes, compressées (.gz), puis supprime les vieilles.
#
# Installation du cron (1 sauvegarde / jour à 03h17) :
#   chmod +x backup-mongo.sh
#   crontab -e
#   puis ajouter la ligne :
#   17 3 * * * /var/www/katd-schule/backup-mongo.sh >> /var/log/katd-backup.log 2>&1
# ---------------------------------------------------------------------------
set -euo pipefail

# --- Configuration ---------------------------------------------------------
DB_NAME="katd-schule"
MONGO_URI="mongodb://katdadmin:UN_MOT_DE_PASSE_SOLIDE@localhost:27017/?authSource=admin"
BACKUP_DIR="/var/backups/mongo"
RETENTION_DAYS=14
# ---------------------------------------------------------------------------

STAMP="$(date +%Y-%m-%d_%H-%M-%S)"
OUT="$BACKUP_DIR/katd-$STAMP.archive.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date '+%F %T')] Démarrage sauvegarde -> $OUT"

# Dump compressé en une seule archive
mongodump --uri="$MONGO_URI" --db="$DB_NAME" --archive="$OUT" --gzip

echo "[$(date '+%F %T')] Sauvegarde OK ($(du -h "$OUT" | cut -f1))"

# Nettoyage : supprime les sauvegardes plus vieilles que RETENTION_DAYS
find "$BACKUP_DIR" -name 'katd-*.archive.gz' -type f -mtime +"$RETENTION_DAYS" -delete

echo "[$(date '+%F %T')] Nettoyage terminé (rétention ${RETENTION_DAYS} jours)"

# --- Pour RESTAURER une sauvegarde -----------------------------------------
#   mongorestore --uri="$MONGO_URI" --gzip --archive=/var/backups/mongo/katd-XXXX.archive.gz --drop
# ---------------------------------------------------------------------------
