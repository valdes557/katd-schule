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

# Surcharge locale (HORS Git) : sur le VPS, crée un fichier « backup-mongo.conf »
# à côté de ce script contenant tes vrais secrets, par ex. :
#   MONGO_URI="mongodb://katdadmin:MOT_DE_PASSE_REEL@localhost:27017/?authSource=admin"
# Ce fichier est ignoré par .gitignore : le secret n'est jamais poussé sur GitHub
# et n'est PAS écrasé par `git reset --hard` lors des déploiements automatiques.
CONF_FILE="$(cd "$(dirname "$0")" && pwd)/backup-mongo.conf"
if [ -f "$CONF_FILE" ]; then
  # shellcheck disable=SC1090
  source "$CONF_FILE"
fi
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
