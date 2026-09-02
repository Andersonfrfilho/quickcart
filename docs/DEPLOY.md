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

Fonte da verdade são os dois schemas — `apps/api-quickcart/src/infra/config/environment.ts` e
`apps/worker-quickcart/src/infra/config/environment.ts` —, não esta tabela: `environmentSchema.parse`
roda no import, então variável faltando derruba o processo no boot, antes de servir.

A distinção que importa não é "obrigatória x opcional", é **o que derruba o boot** x **o que tem
default que não serve em produção**. A segunda lista é a perigosa: sobe, fica verde, e falha calado.

### Derrubam o boot quando faltam (sem default)

| Variável | api | worker | Nota |
|---|:---:|:---:|---|
| `DATABASE_URL` | ✅ | ✅ | |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | ✅ | — | o valor que a Meta ecoa no handshake do webhook |
| `NOTIFICATION_SUPPRESSION_KEY` | ✅ | ✅ | ≥32 chars, **o mesmo valor nos dois** — chaves diferentes fazem a API gravar a supressão sob um hash e o worker consultar outro, e endereço suprimido volta a receber |
| `USER_REFRESH_COOKIE_SAME_SITE` | ✅ | — | `lax` (padrão) ou `none`. `none` é obrigatório quando a tela e a api não compartilham o **site registrável** (eTLD+1): dois subdomínios de `up.railway.app` são cross-site entre si, porque `railway.app` está na Public Suffix List, e com `lax` o cookie de refresh não é enviado — o login funciona e recarregar a aba desloga. Com `none`, a defesa contra CSRF é só o CORS: `ALLOWED_ORIGINS` deixa de ser conforto e vira a tranca |
| `USER_ACCESS_TOKEN_SECRET` | ✅ | — | ≥32 chars, assina o access token da sessão. Sem default de propósito: um valor de fábrica assinaria tokens que qualquer instalação saberia forjar. Trocar este valor invalida toda sessão aberta |
| `API_BASE_URL` | — | ✅ | URL interna da api; é por onde o worker retoma a conversa |
| `WORKER_SERVICE_EMAIL` / `WORKER_SERVICE_PASSWORD` | — | ✅ | credencial da conta de serviço. Precisam bater com `BOOTSTRAP_SERVICE_*` da api, senão o worker não entra |
| `BOOTSTRAP_SERVICE_EMAIL` / `BOOTSTRAP_SERVICE_PASSWORD` | ✅ | — | criam a conta de papel `servico` que o worker usa. Diferente do bootstrap de admin, estas ficam: é por elas que o worker reautentica a cada reinício |
| `BULL_BOARD_USER` / `BULL_BOARD_PASSWORD` | — | ✅ | o painel de filas sobe junto com o worker; credencial vazia autenticaria requisição sem credencial |

### Primeiro acesso ao painel

O painel autentica por sessão de pessoa — `ADMIN_API_TOKEN` não existe mais. Com o banco vazio não
há por onde entrar, então a api semeia o primeiro administrador quando estas duas variáveis estão
presentes, e só então:

| Variável | Nota |
|---|---|
| `BOOTSTRAP_ADMIN_EMAIL` | e-mail do primeiro administrador |
| `BOOTSTRAP_ADMIN_PASSWORD` | ≥12 chars. Sem default: um default aqui seria a credencial de admin conhecida de toda instalação do produto |
| `BOOTSTRAP_ADMIN_NAME` | opcional, default `Administrador` |

A semeadura é idempotente — do segundo boot em diante ela encontra o usuário e não faz nada. Remova
as duas variáveis depois do primeiro acesso: com a conta criada, elas só guardam uma senha em
variável de ambiente sem servir para mais nada.

⚠️ As migrations do `user-module` são separadas, como as do `notification-module`. Rode
`make user-migrate` (ou `bun run db:migrate-user`) **antes** do primeiro boot com bootstrap
configurado — sem as tabelas, a semeadura derruba o processo.

### Têm default, e o default está errado em produção

| Variável | Default | O que acontece se ficar assim |
|---|---|---|
| `REDIS_URL` | `redis://localhost:6379` | api e worker sobem e não acham a fila |
| `ALLOWED_ORIGINS` | `http://localhost:5183` | o `quickcart-web` toma CORS em toda chamada |
| `WHATSAPP_ACCESS_TOKEN` | `''` | nenhuma mensagem sai |
| `WHATSAPP_PHONE_NUMBER_ID` | `''` | idem |
| `WHATSAPP_APP_SECRET` | `''` | assinatura do webhook sem segredo configurado |
| `STORAGE_ENABLED` | `false` | mídia da conversa não é ingerida e a biblioteca de documentos fica vazia, sem erro |
| `STORAGE_*` (endpoint, bucket, chaves) | MinIO local | com `STORAGE_ENABLED=true` e estes no default, a gravação vai para lugar nenhum. Bucket **privado** — a entrega é só por URL assinada (`STORAGE_DOWNLOAD_URL_TTL_SECONDS`, 300s) |
| `STORE_CEP` | ausente | é o interruptor de distância/ETA: sem ele, nenhum pedido mostra previsão de chegada |
| `STORE_NAME` | `QuickCart` | sai no recibo do cliente |
| `DOCUMENTS_RETENTION_DAYS` | `0` (desligado) | arquivo de conversa fica para sempre; a política de retenção de dado pessoal é decisão do negócio |

### Ficam desligadas até alguém decidir (custo ou PII)

`TRANSCRIPTION_ENABLED` (cota do Groq), `MODERATION_ENABLED`, `FISCAL_ENABLED` (+ todo o bloco
`FISCAL_*` e o certificado), `SMTP_*` / `NOTIFICATION_SMTP_URL` (sem elas o canal de e-mail nem é
montado), `GROQ_API_KEY`, `SENTRY_DSN`.

`PREVIEW_TRANSCRIPT_ENABLED` **não se define em staging nem em produção**: liga rotas de preview que
leem transcript de cliente sem sessão de admin. O default é `false` e é assim que deve ficar.

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
