#!/usr/bin/env bash
# Monta um payload de webhook Meta assinado (HMAC de dev) e faz POST no webhook local.
# Uso: make test-msg MSG="2kg arroz, leite, 6 ovos" TEL=5511999999999
set -euo pipefail

MSG="${1:?Uso: make test-msg MSG=\"...\" TEL=...}"
TEL="${2:-5511999999999}"

ENV_NAME="${ENV:-dev}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/envs/env.$ENV_NAME"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ Arquivo de env não encontrado: $ENV_FILE" >&2
  exit 1
fi

PORT="$(grep -m1 '^PORT=' "$ENV_FILE" | cut -d '=' -f2-)"
APP_SECRET="$(grep -m1 '^WHATSAPP_APP_SECRET=' "$ENV_FILE" | cut -d '=' -f2-)"

if [[ -z "$APP_SECRET" ]]; then
  echo "❌ WHATSAPP_APP_SECRET vazio em $ENV_FILE — configure um segredo de dev para assinar o payload." >&2
  exit 1
fi

WA_MESSAGE_ID="wamid.test.$(date +%s)"
TIMESTAMP="$(date +%s)"

PAYLOAD_FILE="$(mktemp)"
trap 'rm -f "$PAYLOAD_FILE"' EXIT

cat > "$PAYLOAD_FILE" <<JSON
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "test-entry",
      "changes": [
        {
          "field": "messages",
          "value": {
            "messaging_product": "whatsapp",
            "messages": [
              {
                "from": "$TEL",
                "id": "$WA_MESSAGE_ID",
                "timestamp": "$TIMESTAMP",
                "type": "text",
                "text": { "body": "$MSG" }
              }
            ]
          }
        }
      ]
    }
  ]
}
JSON

SIGNATURE="sha256=$(openssl dgst -sha256 -hmac "$APP_SECRET" "$PAYLOAD_FILE" | sed 's/^.* //')"

echo "📨 Enviando webhook simulado para http://localhost:$PORT/v1/webhook/whatsapp"
echo "    TEL=$TEL MSG=\"$MSG\" waMessageId=$WA_MESSAGE_ID"

curl -sS -X POST "http://localhost:$PORT/v1/webhook/whatsapp" \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: $SIGNATURE" \
  --data-binary "@$PAYLOAD_FILE" \
  -w '\n→ HTTP %{http_code}\n'
