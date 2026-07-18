# Deploy — QuickCart no Railway

Padrão copiado de `financiamento-imobiliario-bot` (railway.toml raiz + por app, builder DOCKERFILE).

## Serviços

| Serviço Railway | Origem | Build | Notas |
|---|---|---|---|
| `quickcart-api` | `apps/api-quickcart` | Dockerfile multi-stage Bun→node:22-slim | healthcheck `/v1/health`; externals `uWebSockets.js` no `bun build` |
| `quickcart-worker` | `apps/worker-quickcart` | idem | sem healthcheck HTTP |
| `quickcart-web` | `apps/frontend-web` | build → nginx:alpine (envsubst `${PORT}`) | injeta `VITE_API_URL` como build arg |
| Postgres | plugin Railway | — | habilitar `pg_trgm`/`unaccent` (migration faz `CREATE EXTENSION`) |
| Redis | plugin Railway | — | compartilhado api + worker (conexões BullMQ dedicadas) |

## Variáveis (dashboard Railway)

Todas de `.specs/features/mvp/spec.md` §9. Mínimo para subir:
`DATABASE_URL`, `REDIS_URL`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
`WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `ADMIN_API_TOKEN`,
`INTERNAL_API_TOKEN`, `ALLOWED_ORIGINS`, `STORE_NAME`. Opcionais: `GROQ_API_KEY`,
`SMTP_*`, `FISCAL_*`, `SENTRY_DSN`.

## Registro do webhook no app Meta (novo app a criar)

1. developers.facebook.com → criar app Business → adicionar produto WhatsApp
2. Copiar `ACCESS_TOKEN` (gerar permanente via system user), `PHONE_NUMBER_ID`, `WABA_ID`, `APP_SECRET`
3. Webhook URL: `https://<quickcart-api>.up.railway.app/v1/webhook/whatsapp`
   · Verify token: valor de `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
4. Assinar o campo `messages`
5. Testar: enviar "oi" ao número → conferir logs do serviço api

## Ordem de deploy

Postgres/Redis → api (roda migrations no boot) → worker → web.
