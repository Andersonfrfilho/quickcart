#!/usr/bin/env bash
#
# Copyright (c) 2026 Ada Technology. All rights reserved.
#
# This source code is proprietary and confidential. Unauthorized copying,
# modification, distribution, or use of this file, via any medium, is
# strictly prohibited without prior written permission from Ada Technology.
#
# Author: Anderson Filho <andersonfrfilho@gmail.com>
#
# Roda SQL no Postgres de um ambiente do Railway, de fora da infra.
#
# A connection string é montada DENTRO do subprocesso do `railway run`, a partir das variáveis
# que o próprio serviço de banco injeta. Nenhum segredo passa pelo terminal, pelo histórico do
# shell ou pelo log — é isso que torna o script seguro de rodar em sessão compartilhada com I.A.
#
# O `DATABASE_URL` dos serviços de aplicação aponta para `*.railway.internal`, que só resolve
# dentro da rede do Railway. De fora, o caminho é o TCP proxy do serviço de banco.
#
#   ./scripts/query-database.sh "SELECT count(*) FROM meta_whatsapp.sessions"
#   ./scripts/query-database.sh -f ./query.sql
#   ./scripts/query-database.sh -e production "SELECT 1"
#   ./scripts/query-database.sh --conversation 5516991042201
#
# Requer `psql` local (brew install libpq) e `railway` atualizado — versão antiga falha com
# "error decoding response body" em tudo que busca variável (`brew upgrade railway`).

set -euo pipefail

readonly DEFAULT_POSTGRES_SERVICE="postgres-Y64j"
readonly DEFAULT_ENVIRONMENT="staging"
readonly CONVERSATION_MESSAGE_LIMIT=40

environmentName="$DEFAULT_ENVIRONMENT"
postgresService="$DEFAULT_POSTGRES_SERVICE"
sqlFile=""
conversationNumber=""

printUsage() {
  sed -n '20,27p' "$0" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -e | --environment)
      environmentName="$2"
      shift 2
      ;;
    -s | --service)
      postgresService="$2"
      shift 2
      ;;
    -f | --file)
      sqlFile="$2"
      shift 2
      ;;
    -c | --conversation)
      conversationNumber="$2"
      shift 2
      ;;
    -h | --help)
      printUsage
      exit 0
      ;;
    *) break ;;
  esac
done

if [[ -n "$conversationNumber" ]]; then
  sqlText="
    SELECT id, whatsapp_number, current_state, mode, last_activity
      FROM meta_whatsapp.sessions
     WHERE whatsapp_number LIKE '%${conversationNumber}%'
     ORDER BY last_activity DESC;

    SELECT created_at, direction, sender, type, status,
           left(replace(content, chr(10), ' / '), 220) AS content
      FROM meta_whatsapp.messages
     WHERE whatsapp_number LIKE '%${conversationNumber}%'
     ORDER BY created_at DESC
     LIMIT ${CONVERSATION_MESSAGE_LIMIT};
  "
elif [[ -n "$sqlFile" ]]; then
  sqlText=$(cat "$sqlFile")
else
  sqlText="${1:-}"
fi

if [[ -z "${sqlText// /}" ]]; then
  echo "query-database: nenhum SQL informado" >&2
  printUsage >&2
  exit 64
fi

if ! command -v psql > /dev/null 2>&1; then
  echo "query-database: psql não encontrado — brew install libpq" >&2
  exit 69
fi

cd "$(dirname "$0")/.."

QUERY_DATABASE_SQL="$sqlText" railway run --service "$postgresService" --environment "$environmentName" -- \
  bash -c 'psql "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${RAILWAY_TCP_PROXY_DOMAIN}:${RAILWAY_TCP_PROXY_PORT}/${POSTGRES_DB}" \
    -X -v ON_ERROR_STOP=1 --pset=pager=off -c "$QUERY_DATABASE_SQL"'
