#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -f "${PROJECT_DIR}/.env" ]]; then
  export $(grep -v '^#' "${PROJECT_DIR}/.env" | xargs)
fi

DB_USER="${DB_USER:-enfoco}"
DB_NAME="${DB_NAME:-enfoco_db}"
CONTAINER_NAME="enfoco_db"

if [[ $# -ne 1 ]]; then
  echo "Uso: $0 <ruta_al_archivo_backup.sql.gz>"
  exit 1
fi

BACKUP_FILE="$1"

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "Error: El archivo ${BACKUP_FILE} no existe." >&2
  exit 1
fi

echo "⚠️  ATENCIÓN: Esto sobrescribirá los datos en '${DB_NAME}'."
read -p "¿Estás seguro de que deseas continuar? (s/N): " -r CONFIRM
if [[ ! "$CONFIRM" =~ ^[sS]$ ]]; then
  echo "Restauración cancelada."
  exit 0
fi

echo "Iniciando restauración desde ${BACKUP_FILE}..."
gunzip -c "${BACKUP_FILE}" | docker exec -i "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}"
echo "✅ Restauración completada con éxito."
