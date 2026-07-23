# Deploy — QuickCart no Railway

Padrão copiado de `financiamento-imobiliario-bot` (railway.toml raiz + por app, builder DOCKERFILE).

## Serviços

| Serviço Railway | Origem | Build | Notas |
|---|---|---|---|
| `quickcart-api` | `apps/api-quickcart` | Dockerfile multi-stage Bun (deps/builder/runner, todos `oven/bun:1.3-alpine`) | healthcheck `/v1/health`; `Bun.serve()` nativo |
| `quickcart-worker` | `apps/worker-quickcart` | idem | sem healthcheck HTTP |
| `quickcart-web` | `apps/frontend-web` | build → nginx:alpine (envsubst `${PORT}`) | build arg `VITE_API_URL=https://<quickcart-api>.up.railway.app` (chamadas ficam relativas a `/` se omitido) |
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

## Configuração obrigatória no dashboard Railway (Root Directory x Config File)

Os 3 `Dockerfile.*` vivem na **raiz do repo** (não dentro de cada `apps/*`), pois
fazem `COPY` dos `package.json` dos 3 apps + `COPY . .` (build de monorepo via
Bun workspaces, lockfile único). Cada app também tem seu próprio `railway.toml`
dentro do seu diretório (`apps/api-quickcart/railway.toml`, etc.) — isso exige
2 ajustes manuais por serviço no dashboard, pois a Railway resolve os dois
campos de forma **independente** ([docs](https://docs.railway.com/deployments/monorepo)):

1. **Root Directory = raiz do repo** (deixar vazio/`/`) para os 3 serviços
   (`quickcart-api`, `quickcart-worker`, `quickcart-web`) — nunca apontar para
   `apps/<app>`, senão o build context fica restrito àquela pasta e o `COPY`
   dos `package.json` dos apps irmãos falha.
2. **Config File Path (Settings → um campo separado de Root Directory)**:
   a doc oficial é explícita — *"The Railway Config File does not follow the
   Root Directory path. You have to specify the absolute path"* — então cada
   serviço precisa apontar para o caminho absoluto do seu `railway.toml`:
   - `quickcart-api` → `/apps/api-quickcart/railway.toml`
   - `quickcart-worker` → `/apps/worker-quickcart/railway.toml`
   - `quickcart-web` → `/apps/frontend-web/railway.toml`

Com Root Directory = raiz, o `dockerfilePath = "./Dockerfile.api"` (etc.)
declarado em cada `railway.toml` resolve corretamente para
`<raiz-do-repo>/Dockerfile.api`, que existe.

## Ordem de deploy

Postgres/Redis → api (roda migrations no boot) → worker → web.
