# Segurança — achados e proteções

Registro vivo (security.md §10). Cada item tem data, severidade e estado.

## 2026-09-21 — Rota pública `POST /v1/store/checkout-quote` (T4.2, S1/S2)

Rota sem sessão: a loja web cota Subtotal, Taxa e Total antes de o cliente logar. Proteções:

- **Teto de corpo de 64 KB só nesta rota** (`CHECKOUT_QUOTE_MAX_BODY_BYTES`, opção `maxBodyBytes`
  do `Router.post`). `Content-Length` acima do teto responde `413 PAYLOAD_TOO_LARGE` antes de ler
  o corpo; corpo chunked (sem `Content-Length`) é lido contando bytes e abortado ao passar do teto.
  Não é global de propósito: `/v1/admin/conversations/:number/media` e `/v1/preview/media`
  recebem arquivo pelo mesmo leitor de corpo e precisam do teto do `Bun.serve`.
- **Rate limit por IP: 60 requisições por minuto**, janela fixa em Redis
  (`FixedWindowRateLimiter` + `RedisRateLimitStore`, `src/infra/http/rate-limit/`). Excedeu →
  `429 TOO_MANY_REQUESTS` com `Retry-After` (segundos até o fim da janela).
- **IP do cliente**: `X-Real-IP`, que o edge do Railway preenche com o endereço remoto de quem
  conectou (docs.railway.com › Public Networking › Specs & Limits). Sem ele (desenvolvimento local,
  sem edge), cai no último item de `X-Forwarded-For`, e depois numa chave única `unknown`.
  - **Medido em staging em 2026-09-22.** A primeira versão usava o último item de
    `X-Forwarded-For`, assumindo que o edge acrescenta o IP real ao fim da lista. **Não acrescenta:**
    o valor mandado pelo cliente chega intacto ao fim. 65 requisições, cada uma com um IP forjado
    diferente no header, passaram todas; sem forjar, a 53ª já levou `429`. Qualquer um contornava o
    limite trocando um header. Corrigido para `X-Real-IP`.
  - Se um dia houver outro proxy na frente (CDN), reavaliar: aí `X-Real-IP` passa a ser o IP da CDN.
- **Fail-open**: se o Redis falhar, a cotação responde normalmente e só registra
  `rate_limit_store_failed` em `warn` (sem IP no log). Decisão: a cotação é caminho de compra;
  derrubá-la por falha de cache pararia a loja, e o risco residual (sem limite enquanto o Redis
  estiver fora) é aceito.
- **Produto inexistente e inativo respondem igual** (`404 PRODUCT_NOT_FOUND`) nesta rota, para não
  confirmar a um anônimo que um produto despublicado existe. A unificação está na borda
  (`StoreController.priceQuoteItems`); `buildPricedOrderItems` segue distinguindo os dois porque o
  `CreateWebOrder` (cliente logado) precisa do motivo.

## 2026-09-21 — Pré-existentes (estado atualizado em 2026-09-22)

- **M2 (médio) — sem rate limit global na API.** **Corrigido em 2026-09-22** para as rotas públicas:
  - `POST /v1/store/register`: 10/min por IP (`STORE_REGISTER_RATE_LIMIT_*`,
    `src/modules/store/shared/Store.constant.ts`). Teste: `src/modules/store/infra/http/StoreRoutes.test.ts`.
  - `POST /v1/auth/login` (rota do `user-module`): 10/min por IP (`AUTH_LOGIN_RATE_LIMIT_*`,
    `src/modules/user/shared/User.constant.ts`), aplicado na montagem do host por
    `FixedWindowRateLimiter.protectMountedRoute` — o pacote não mudou. O 429 sai pelo filtro de erro
    do router, no ramo de módulo montado. Teste: `src/infra/http/rate-limit/FixedWindowRateLimiter.test.ts`
    (bloco `protectMountedRoute`).
  - Mesmo limitador, mesmo `X-Real-IP` e mesmo fail-open com `warn` da cotação.
  - **Decisão: o webhook do WhatsApp (`/v1/webhook/whatsapp`) fica SEM limite por IP.** As
    requisições vêm da Meta, de poucos IPs compartilhados por todos os clientes; um teto por IP
    derrubaria mensagens reais. A proteção dele é a assinatura HMAC + nonce do meta-whatsapp-module.
    Registrado também em comentário em `src/infra/http/server.ts`.
- **B5 (baixo) — headers de segurança ausentes e CEP em log.** **Corrigido em 2026-09-22.**
  - Headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
    `Referrer-Policy: strict-origin-when-cross-origin` e `Permissions-Policy` restritiva em TODA
    resposta (200, erro, 404, preflight e resposta de módulo montado), no mesmo ponto do router que
    monta o CORS (`src/infra/http/router.ts`, valores em `securityHeaders.constant.ts`).
    `Strict-Transport-Security: max-age=31536000; includeSubDomains` só com `NODE_ENV=production` ou
    requisição por https (`X-Forwarded-Proto`) — em http local o HSTS forçaria https no localhost.
    Teste: `src/infra/http/securityHeaders.test.ts`.
  - CEP: `maskCep` (`src/shared/maskCep.ts`, `140*****`) em `geocode_http_error`, `geocode_failed`,
    `cep_lookup_failed` e `coordinate_not_cached`. Teste: `tests/NominatimGeocodingProvider.test.ts`
    (bloco "log sem CEP em claro") e `src/shared/serializeError.test.ts`.

## 2026-09-22 — PII na mensagem de erro de provedor externo

- **Achado:** `serializeError(error)` gravava a mensagem livre do erro. O fetch do Nominatim falha com
  a URL inteira (com o `postalcode`); erro do Postgres ecoa o valor da chave; erro de e-mail/Meta
  pode trazer destinatário ou telefone.
- **Correção (opção de menor regressão):** o próprio `serializeError` (`src/shared/serializeError.ts`)
  redige e-mail, telefone (10–13 dígitos) e CEP na mensagem (`redactPii`, padrões em
  `src/shared/pii.constant.ts`). Trocar por um serializador só com `name`/`code` exigiria mexer em
  ~40 call sites e apagaria o diagnóstico de todos; redigir no ponto central cobre os provedores de
  hoje e os futuros sem depender de quem escreve o log. Risco residual aceito: número longo que não
  é telefone (ex.: epoch em ms) também é redigido. `registry_mirror_failed` usava `String(error)` cru
  e passou a usar `serializeError`. Teste: `src/shared/serializeError.test.ts`.

## 2026-09-22 — B3 (baixo): pedido de atendente sem limite

- **Corrigido em 2026-09-22.** `requestHumanHandoff` arma um cooldown de 10 minutos por telefone
  (`SET NX` + TTL no Redis, chave `conversation:human-handoff-cooldown:<sha256 do telefone>`,
  constantes em `src/modules/conversation/shared/HumanHandoff.constant.ts`). Em modo bot, um novo
  pedido dentro da janela só responde `MESSAGES.AGENT_ALREADY_NOTIFIED`, sem chamar `requestHuman`.
  Mode `human` mantém o aviso de atendimento em curso. Redis fora do ar: fail-open com `warn`.
  Teste: `src/modules/conversation/application/handlers/support/requestHumanHandoff.test.ts`.

## 2026-09-22 — Recibo/NFC-e emitido com total antigo (corrigido)

O recibo era enfileirado na criação do pedido. Depois dela o pedido ainda muda: item em falta e
substituição reprecificam `total_in_cents`, e cancelamento anula a venda. A NFC-e saía com o total
antigo — documento fiscal errado — e pedido cancelado antes de separar ficava com nota emitida.

Correção: o recibo é enfileirado só quando o pedido sai da loja (`out_for_delivery` ou
`ready_for_pickup`), no `UpdateOrderStatusUseCase`, com `jobId` estável por pedido. O worker também
não emite de novo quando o pedido já tem `fiscal_document_id`.

Se a fila falhar depois de o status ser salvo, a API responde `ORDER_RECEIPT_ENQUEUE_FAILED` (503) e
loga `receipt_enqueue_failed` só com o `orderId`. Marcar o mesmo status de novo reenfileira o recibo
sem regravar nem avisar o cliente; o painel mostra "Reenviar para emissão" com a mensagem da API.

## Pendentes

- **Cancelamento de NFC-e na SEFAZ quando pedido já emitido é cancelado** (registrado em 2026-09-22).
  Entrega que sai, falha (`delivery_failed`) e é cancelada fica com a NFC-e autorizada e sem evento de
  cancelamento. Fora da correção do recibo na saída da loja.

- **Autorização por conversa atribuída (BOLA).** Atendente autenticado ainda alcança conversa que não
  está atribuída a ele; falta checar posse por objeto nas rotas de conversa (security.md §2).
- Rate limit por usuário autenticado (além do por IP) e limite nas demais rotas autenticadas que
  disparam custo externo (envio de WhatsApp pelo painel).
