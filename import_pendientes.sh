#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAYLOAD_FILE="$DIR/pendientes_enfoco.json"
ENDPOINT="http://137.131.245.249:3000/api/integrations/tasks"

API_KEY="${1:-$ENFOCO_API_KEY}"

if [ -z "$API_KEY" ]; then
  echo "❌ Error: Falta la API Key de Enfoco."
  echo "Uso: ./import_pendientes.sh TU_CLAVE_DE_ENFOCO"
  echo "O define la variable: export ENFOCO_API_KEY='enf_live_...'"
  exit 1
fi

echo "🚀 Enviando pendientes a Enfoco en $ENDPOINT ..."

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$ENDPOINT" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @"$PAYLOAD_FILE")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
  echo "✅ ¡Éxito! Tareas importadas correctamente."
  echo "$BODY"
else
  echo "❌ Error ($HTTP_CODE):"
  echo "$BODY"
  exit 1
fi
