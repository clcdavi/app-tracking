#!/usr/bin/env bash
set -euo pipefail

# Directorio raíz del proyecto
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${PROJECT_DIR}/backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/enfoco_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

# Cargar variables de .env si existe
if [[ -f "${PROJECT_DIR}/.env" ]]; then
  # Exportar variables sin comentarios
  export $(grep -v '^#' "${PROJECT_DIR}/.env" | xargs)
fi

DB_USER="${DB_USER:-enfoco}"
DB_NAME="${DB_NAME:-enfoco_db}"
CONTAINER_NAME="enfoco_db"

echo "=== Iniciando Backup de Base de Datos PostgreSQL ==="
echo "Contenedor: ${CONTAINER_NAME}"
echo "Base de datos: ${DB_NAME}"
echo "Destino: ${BACKUP_FILE}"

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "Error: El contenedor ${CONTAINER_NAME} no se encuentra en ejecución." >&2
  exit 1
fi

docker exec -t "${CONTAINER_NAME}" pg_dump -U "${DB_USER}" "${DB_NAME}" | gzip > "${BACKUP_FILE}"

FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "✅ Backup completado exitosamente: ${BACKUP_FILE} (${FILE_SIZE})"

# Política de retención: Eliminar backups con más de 14 días
find "${BACKUP_DIR}" -type f -name "enfoco_*.sql.gz" -mtime +14 -exec rm {} \;
echo "🧹 Política de retención aplicada (se conservan los últimos 14 días)."
