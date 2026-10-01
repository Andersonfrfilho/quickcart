#!/usr/bin/env bash
#
# Ativa um número de telefone no WhatsApp Cloud API.
#
# O passo que quase sempre falta é o `register`: um número pode estar criado na WABA e já
# verificado por SMS e ainda assim não enviar nada, porque nunca foi ligado ao Cloud API.
# O sintoma é `status: PENDING` + `platform_type: NOT_APPLICABLE`.
#
# Documentação do fluxo completo, incluindo o caminho por tela: docs/WHATSAPP-NUMERO-CLOUD-API.md

set -euo pipefail

GRAPH_VERSION="${GRAPH_VERSION:-v21.0}"
GRAPH_BASE="https://graph.facebook.com/$GRAPH_VERSION"
# Nomes propositalmente fora do prefixo RAILWAY_: a CLI le RAILWAY_SERVICE/RAILWAY_ENVIRONMENT
# do ambiente e espera ID, entao exportar esses nomes aqui faz `railway variables` devolver vazio.
SERVICE_NAME="${SERVICE_NAME:-api}"
ENVIRONMENT_NAME="${ENVIRONMENT_NAME:-staging}"
PIN_VARIABLE="WHATSAPP_TWO_STEP_PIN"

COMMAND="${1:-status}"

readVariable() {
  local name="$1"
  if [[ -n "${!name:-}" ]]; then
    printf '%s' "${!name}"
    return 0
  fi
  railway variables -s "$SERVICE_NAME" -e "$ENVIRONMENT_NAME" --json 2>/dev/null \
    | python3 -c "import json,sys;print(json.load(sys.stdin).get('$name',''))"
}

requireVariable() {
  local name="$1" value
  value="$(readVariable "$name")"
  if [[ -z "$value" ]]; then
    echo "❌ $name não encontrado — defina no ambiente ou em Railway ($SERVICE_NAME/$ENVIRONMENT_NAME)." >&2
    exit 1
  fi
  printf '%s' "$value"
}

# Só o corpo da resposta interessa; o token nunca é ecoado.
graphGet() {
  curl -sf "$GRAPH_BASE/$1?fields=$2&access_token=$3"
}

showStatus() {
  local token phoneNumberId payload
  token="$(requireVariable WHATSAPP_ACCESS_TOKEN)"
  phoneNumberId="$(requireVariable WHATSAPP_PHONE_NUMBER_ID)"

  payload="$(graphGet "$phoneNumberId" \
    "display_phone_number,verified_name,status,platform_type,code_verification_status,name_status,throughput" \
    "$token")"

  echo "$payload" | python3 -m json.tool

  # Comparacao em Python, e nao grep: a resposta crua vem compacta e o json.tool acima so
  # formata a copia impressa — casar por texto aqui erra pelo espaco depois dos dois-pontos.
  echo "$payload" | python3 -c "$(cat <<'PYTHON'
import json, sys
number = json.load(sys.stdin)
platform = number.get('platform_type')
status = number.get('status')
if platform == 'NOT_APPLICABLE':
    sys.exit('\u26a0\ufe0f  Numero nunca registrado no Cloud API — rode: register')
if status != 'CONNECTED':
    sys.exit(f'\u26a0\ufe0f  Numero nao esta CONNECTED (status={status}).')
print('\u2705 Numero conectado ao Cloud API.')
PYTHON
)"
}

subscribeApp() {
  local token businessAccountId
  token="$(requireVariable WHATSAPP_ACCESS_TOKEN)"
  businessAccountId="$(requireVariable WHATSAPP_BUSINESS_ACCOUNT_ID)"

  echo "🔗 Assinando o app na WABA $businessAccountId..."
  curl -sf -X POST "$GRAPH_BASE/$businessAccountId/subscribed_apps" \
    -H "Authorization: Bearer $token" | python3 -m json.tool

  echo "📋 Apps assinados agora:"
  curl -sf "$GRAPH_BASE/$businessAccountId/subscribed_apps?access_token=$token" | python3 -m json.tool
}

# O PIN é senha permanente do número: criado aqui, nunca recuperável depois. Vai do gerador
# direto para o Railway por substituição de comando, para não passar por terminal nem histórico.
ensurePin() {
  if [[ -n "$(readVariable "$PIN_VARIABLE")" ]]; then
    echo "🔐 $PIN_VARIABLE já existe — reaproveitando." >&2
    return 0
  fi

  echo "🔐 Gerando $PIN_VARIABLE e gravando em Railway ($SERVICE_NAME/$ENVIRONMENT_NAME)..." >&2
  railway variables -s "$SERVICE_NAME" -e "$ENVIRONMENT_NAME" --skip-deploys \
    --set "$PIN_VARIABLE=$(python3 -c 'import secrets;print(f"{secrets.randbelow(900000)+100000}")')" >/dev/null
}

registerNumber() {
  local token phoneNumberId pin
  token="$(requireVariable WHATSAPP_ACCESS_TOKEN)"
  phoneNumberId="$(requireVariable WHATSAPP_PHONE_NUMBER_ID)"

  ensurePin
  pin="$(requireVariable "$PIN_VARIABLE")"

  echo "📱 Registrando $phoneNumberId no Cloud API..."
  curl -sf -X POST "$GRAPH_BASE/$phoneNumberId/register" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "{\"messaging_product\":\"whatsapp\",\"pin\":\"$pin\"}" | python3 -m json.tool

  echo "🔍 Conferindo a transição..."
  showStatus
}

case "$COMMAND" in
  status)    showStatus ;;
  subscribe) subscribeApp ;;
  register)  registerNumber ;;
  all)       subscribeApp && registerNumber ;;
  *)
    echo "Uso: $0 [status|subscribe|register|all]" >&2
    echo "  SERVICE_NAME=$SERVICE_NAME  ENVIRONMENT_NAME=$ENVIRONMENT_NAME  GRAPH_VERSION=$GRAPH_VERSION" >&2
    exit 1
    ;;
esac
