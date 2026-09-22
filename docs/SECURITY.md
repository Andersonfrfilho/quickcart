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
- **IP do cliente**: último item de `X-Forwarded-For`. O edge do Railway acrescenta o IP de quem
  o conectou ao final da lista; o que vem antes é enviado pelo cliente e pode ser forjado, então
  usar o primeiro permitiria escapar do limite trocando o header. Sem o header, cai em
  `X-Real-IP` e depois numa chave única `unknown`. Se um dia houver mais um proxy na frente
  (CDN), a regra precisa passar a pular esse salto. Pendente: confirmar o formato do header com
  uma requisição real em staging (o comportamento do edge foi assumido, não medido).
- **Fail-open**: se o Redis falhar, a cotação responde normalmente e só registra
  `rate_limit_store_failed` em `warn` (sem IP no log). Decisão: a cotação é caminho de compra;
  derrubá-la por falha de cache pararia a loja, e o risco residual (sem limite enquanto o Redis
  estiver fora) é aceito.
- **Produto inexistente e inativo respondem igual** (`404 PRODUCT_NOT_FOUND`) nesta rota, para não
  confirmar a um anônimo que um produto despublicado existe. A unificação está na borda
  (`StoreController.priceQuoteItems`); `buildPricedOrderItems` segue distinguindo os dois porque o
  `CreateWebOrder` (cliente logado) precisa do motivo.

## 2026-09-21 — Pré-existentes, abertos

- **M2 (médio) — sem rate limit global na API.** Só a cotação tem limite. Rotas públicas sem
  limite: `POST /v1/store/register` (cadastro) e o webhook do WhatsApp. Próximo passo: aplicar o
  mesmo `FixedWindowRateLimiter` com limites próprios (cadastro mais duro; webhook por
  assinatura válida, não por IP da Meta).
- **B5 (baixo) — headers de segurança ausentes e CEP em log.** O router não envia
  `X-Frame-Options`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` nem
  `Strict-Transport-Security`. E `NominatimGeocodingProvider` loga o CEP em claro no evento
  `geocode_failed`.
