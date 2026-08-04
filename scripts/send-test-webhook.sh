#!/usr/bin/env bash
# Monta um payload de webhook Meta assinado (HMAC de dev) e faz POST no webhook local.
# Uso: make test-msg MSG="2kg arroz, leite, 6 ovos" TEL=5511999999999
#
# Áudio: make test-audio MSG="quero ver os produtos" — sintetiza a fala com `say`, publica o binário
# no wiremock e manda um webhook do tipo `audio`. Serve para exercitar o caminho real (download da
# mídia + transcrição + decisão do fluxo), que é diferente do de texto em tudo menos no fim.
set -euo pipefail

MSG="${1:?Uso: make test-msg MSG=\"...\" TEL=...}"
TEL="${2:-5511999999999}"
KIND="${3:-text}"

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
WIREMOCK_PORT="$(grep -m1 '^WIREMOCK_PORT=' "$ENV_FILE" | cut -d '=' -f2-)"
WIREMOCK_PORT="${WIREMOCK_PORT:-9563}"

if [[ "$KIND" == "audio" ]]; then
  command -v say >/dev/null || { echo "❌ \`say\` indisponível: áudio sintetizado só no macOS." >&2; exit 1; }

  MEDIA_ID="audio-say-$TIMESTAMP"
  AUDIO_DIR="$(mktemp -d)"

  # m4a e não ogg: `afconvert` é nativo do macOS e a Groq aceita audio/mp4 direto, então o teste não
  # depende de ter ffmpeg instalado.
  say -v Luciana -o "$AUDIO_DIR/fala.aiff" "$MSG"
  afconvert -f m4af -d aac "$AUDIO_DIR/fala.aiff" "$AUDIO_DIR/fala.m4a" >/dev/null

  BASE64_AUDIO="$(base64 < "$AUDIO_DIR/fala.m4a" | tr -d '\n')"

  # Stub efêmero: um por envio, com id único, para o teste não depender de fixture fixa nem sujar as
  # mappings do repositório.
  curl -sS -X POST "http://localhost:$WIREMOCK_PORT/__admin/mappings" \
    -H 'Content-Type: application/json' \
    -d "{\"request\":{\"method\":\"GET\",\"urlPathPattern\":\"/v[0-9]+\\\\.[0-9]+/$MEDIA_ID\"},\"response\":{\"status\":200,\"headers\":{\"Content-Type\":\"application/json\"},\"jsonBody\":{\"url\":\"http://localhost:$WIREMOCK_PORT/media-binary/$MEDIA_ID\",\"mime_type\":\"audio/mp4\",\"file_size\":1,\"id\":\"$MEDIA_ID\"}}}" >/dev/null

  curl -sS -X POST "http://localhost:$WIREMOCK_PORT/__admin/mappings" \
    -H 'Content-Type: application/json' \
    -d "{\"request\":{\"method\":\"GET\",\"urlPathPattern\":\"/media-binary/$MEDIA_ID\"},\"response\":{\"status\":200,\"headers\":{\"Content-Type\":\"audio/mp4\"},\"base64Body\":\"$BASE64_AUDIO\"}}" >/dev/null

  MESSAGE_JSON="{\"from\":\"$TEL\",\"id\":\"$WA_MESSAGE_ID\",\"timestamp\":\"$TIMESTAMP\",\"type\":\"audio\",\"audio\":{\"id\":\"$MEDIA_ID\",\"mime_type\":\"audio/mp4\",\"voice\":true}}"
elif [[ "$KIND" == "button" ]]; then
  # Botão e item de lista são payloads distintos, e os handlers checam o TIPO antes do id: revisão de
  # carrinho só aceita `button_reply`, desambiguação só aceita `list_reply`. Simular um pelo outro
  # testaria a recusa, não o caminho.
  MESSAGE_JSON="{\"from\":\"$TEL\",\"id\":\"$WA_MESSAGE_ID\",\"timestamp\":\"$TIMESTAMP\",\"type\":\"interactive\",\"interactive\":{\"type\":\"button_reply\",\"button_reply\":{\"id\":\"$MSG\",\"title\":\"(simulado)\"}}}"
elif [[ "$KIND" == "list" ]]; then
  # Toque em item de lista. O id É a mensagem aqui: o handler roteia por ele, e o título só existe
  # para o cliente ler — mandar título no lugar do id testaria um caminho que a Meta nunca produz.
  MESSAGE_JSON="{\"from\":\"$TEL\",\"id\":\"$WA_MESSAGE_ID\",\"timestamp\":\"$TIMESTAMP\",\"type\":\"interactive\",\"interactive\":{\"type\":\"list_reply\",\"list_reply\":{\"id\":\"$MSG\",\"title\":\"(simulado)\"}}}"
else
  MESSAGE_JSON="{\"from\":\"$TEL\",\"id\":\"$WA_MESSAGE_ID\",\"timestamp\":\"$TIMESTAMP\",\"type\":\"text\",\"text\":{\"body\":\"$MSG\"}}"
fi

PAYLOAD_FILE="$(mktemp)"
# Um único trap: dois `trap ... EXIT` não se somam — o segundo substitui o primeiro, e o áudio
# temporário ficaria no disco a cada envio.
trap 'rm -f "$PAYLOAD_FILE"; [[ -n "${AUDIO_DIR:-}" ]] && rm -rf "$AUDIO_DIR"' EXIT

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
              $MESSAGE_JSON
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
echo "    TEL=$TEL TIPO=$KIND MSG=\"$MSG\" waMessageId=$WA_MESSAGE_ID"

curl -sS -X POST "http://localhost:$PORT/v1/webhook/whatsapp" \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: $SIGNATURE" \
  --data-binary "@$PAYLOAD_FILE" \
  -w '\n→ HTTP %{http_code}\n'
