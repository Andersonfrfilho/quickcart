# Conversation Preview — testar os fluxos do chatbot em dev sem credencial da Meta

> Escopo: dois modos de preview no SDK (`@adatechnology/conversations-ui`), para exercitar
> em desenvolvimento (a) o bot dirigindo os fluxos, com o dev no papel de cliente, e
> (b) o atendimento humano na inbox, alimentado por conversas mockadas.
> Fase correspondente: `Fase 11` em `.specs/features/mvp/tasks.md`.

## 1. Problema

Hoje, para ver um fluxo do chatbot rodar de ponta a ponta é preciso um app da Meta com
número, token e webhook público. Isso trava o desenvolvimento em dependência externa e
torna impossível iterar em fluxo/copy/handoff localmente.

O preview precisa morar **no SDK**, não no QuickCart: é infraestrutura de desenvolvimento
reusável por qualquer projeto que consome `conversations-ui`, não código de teste
descartável de um app.

## 2. O que já está resolvido (não refazer)

O caminho de **saída** (bot → cliente) já funciona sem credencial, em duas camadas:

- `WhatsAppSender` opera em modo mock quando `WHATSAPP_ACCESS_TOKEN` /
  `WHATSAPP_PHONE_NUMBER_ID` estão ausentes: loga a mensagem, devolve `waMessageId` falso e
  **mantém o transcript persistido** — `apps/api-quickcart/src/modules/webhook/infra/whatsapp/WhatsAppSender.ts:11`
- Wiremock no compose stubba `POST /*/messages` devolvendo wamid fake (T0.3)

O SDK já é **headless**: `ConversationsProvider` recebe `{ api: ConversationsApi, sse: SSEProvider }`
por injeção. O QuickCart implementa esse contrato contra `/v1/admin` em
`apps/frontend-web/src/modules/conversations/shared/conversationsApi.ts`.

**Consequência de arquitetura:** o modo atendente não precisa de backend nenhum — é apenas
uma segunda implementação do mesmo contrato. O modo cliente precisa de uma única peça
faltante: **entrada** (inbound) sem a Meta.

## 3. Modo Cliente — dirigir o fluxo como se fosse o WhatsApp

### 3.1 A fronteira faltante: inbound assinado

`POST /v1/webhook/whatsapp` valida HMAC `x-hub-signature-256` contra `WHATSAPP_APP_SECRET`
(`Webhook.controller.ts:65`, `metaWhatsAppModule.ts:59`).

**Invariante da fase: HMAC nunca é pulado, em nenhum ambiente.** O docker local reproduz
staging e produção byte a byte — mesma rota, mesma validação, mesmo caminho de código. Nada
de rota de dev paralela, flag de bypass ou `if (isDevelopment)` na validação. O preview é só
mais um cliente que assina corretamente; do ponto de vista da API ele é indistinguível da
Meta.

Isso não é aspiracional: `verifyWebhookSignature` no `meta-whatsapp-module` é
**incondicional** — exige header começando com `sha256=` e compara HMAC em tempo constante,
sem nenhum caminho de escape. Não existe bypass a remover, existe assinatura a produzir.

O segredo local já está provisionado: `WHATSAPP_APP_SECRET=dev-app-secret` em
`envs/env.dev:15` (e `test-app-secret` em `envs/env.test:15`). O preview assina com o mesmo
valor que a API valida.

**Onde mora (corrigido na implementação):** os builders ficam em
`@adatechnology/meta-whatsapp-contracts/testing`, não no módulo. Razão de runtime: o preview do
navegador precisa montar payloads, e o módulo depende de `node:crypto` — importá-lo do frontend
quebraria o bundle. O pacote de contratos só depende de zod, então é isomórfico. O módulo
reexporta tudo em `./testing` por conveniência de CLI, somando o signer Node.

A assinatura, por depender do runtime, é dupla e deliberada:

| Runtime | Onde | Como |
|---|---|---|
| Servidor / CLI (`make test-msg`) | `meta-whatsapp-module/testing` | `node:crypto` `createHmac` |
| Navegador (preview cliente) | `conversations-ui/preview` | WebCrypto `subtle.sign` |

As duas produzem o mesmo HMAC — há teste comparando uma com a outra, porque divergência de um
byte transformaria todo envio do preview em 401.

Builders (isomórficos, em `meta-whatsapp-contracts/testing`):

- `buildInboundTextPayload({ from, text, phoneNumberId })` — payload realista no shape de
  `WhatsAppWebhookPayload.types.ts`
- `buildInboundInteractivePayload({ from, buttonReply | listReply })` — para os fluxos que
  usam `InteractiveListBuilders`
- `buildInboundAudioPayload({ from, mediaId })` — para exercitar a fila STT da Fase 6
- `signWebhookPayload({ body, appSecret })` → header `x-hub-signature-256`

### 3.2 Gotcha: a assinatura é a chave de idempotência

`ReceiveWebhookUseCase` chama `claimWebhookDelivery({ nonceStore, signatureHeader })` —
o **próprio header de assinatura é o nonce**, com TTL de 300s no Redis.

Como o HMAC é determinístico sobre o `rawBody`, dois payloads idênticos geram a mesma
assinatura: a segunda entrega é engolida como duplicata dentro da janela de 5 minutos. Numa
conversa isso é comum — mandar "sim" duas vezes, ou "1" em dois passos diferentes do fluxo.

Portanto os builders **precisam gerar `id` (wamid) e `timestamp` novos a cada chamada**, como
a Meta faz. Não é detalhe cosmético: é o que separa um preview que funciona de um que
"engole mensagens" de forma aparentemente aleatória. Fidelidade ao payload real é o que
compra a fidelidade do comportamento.

### 3.3 A superfície de preview

Componente `<ConversationPreview>` em `conversations-ui`: visão lado-cliente (bolhas +
composer), que envia via os builders acima e lê as respostas do bot pelo **stream SSE já
existente** (`conversation/infra/realtime/conversationRealtime.ts`,
`ConversationStream.controller.ts`).

Ou seja: nada de novo no backend do QuickCart além de montar a rota de preview em dev.

## 4. Modo Atendente — inbox alimentada por conversas mockadas

`createMockConversationsApi(fixtures)` e `createMockSSEProvider(script)`, implementando os
mesmos `ConversationsApi` / `SSEProvider`. Sem servidor, sem banco, sem Meta.

### 4.1 Gotcha: `SSEProvider` devolve `EventSource` nativo

```ts
interface SSEProvider {
  connectConversationStream(conversationId: string): EventSource
  connectGlobalStream(): EventSource
}
```

Não existe `EventSource` sem servidor HTTP. **Esta é a única decisão de design real da fase.**

**Decisão: afrouxar o contrato para um tipo estrutural mínimo** (`ConversationEventSource`),
em vez de fabricar uma classe fake que imita `EventSource`. Motivo: o SDK usa exatamente três
membros — `addEventListener('message')`, `removeEventListener` e `close()` — e um fake
completo é frágil, quebrando a cada mudança de runtime. `readyState` ficou **fora** de
propósito: ninguém no pacote o lê, e exigi-lo obrigaria todo mock a implementar superfície
morta. `EventSource` nativo continua satisfazendo o tipo — mudança retrocompatível.

### 4.1.1 Vocabulário real de eventos (descoberto no servidor)

O fio usa eventos **nomeados** (`event: <nome>\ndata: <json>`), e o `SseHub` emite:

| Canal | Eventos |
|---|---|
| `conv:<whatsappNumber>` | `message`, `message-status`, `mode-changed` |
| `global` | `data-changed` (payload vazio — sinal de "refaça a query") |

Os mocks emitem esse mesmo vocabulário; é o que permite trocar mock por servidor real sem
tocar na UI. Daí `addEventListener` aceitar `string` e não só `'message'`.

**Dois defeitos que isso expôs no SDK** (fora do escopo desta fase, candidatos à Fase B):

1. `useGlobalRealtime` assina `'message'` no canal global, que só emite `data-changed` —
   **nunca dispara**.
2. `useConversationRealtime` também só assina `'message'`, então `message-status` e
   `mode-changed` chegam ao navegador e são descartados.

### 4.2 O mock "fica retornando conversas"

Emissor roteirizado por timer, cobrindo as transições que o atendente precisa ver:

- inbound novo chegando em conversa existente (`unread` incrementando)
- `waitingHuman: false → true` (bot pediu ajuda) — dispara `useWaitingNotifications`
- `mode: 'bot' → 'human'` (handoff assumido) e devolução para o bot
- `assignedUserId` mudando (conversa assumida por outro atendente)

### 4.3 Fixtures

Cobrir o espaço de estados de `ConversationSummary` (`mode`, `waitingHuman`, `unread`,
`currentState`, `assignedUserId`) e os tipos de mensagem que a UI renderiza: texto, áudio
(`AudioPlayer`), mídia (`MediaRenderer`), interativa e documento.

## 5. Onde cada coisa mora

| Peça | Repo / pacote | Export |
|---|---|---|
| Builders de payload inbound (isomórficos) | `adatechnology-packages/packages/backend/meta-whatsapp-contracts` | `./testing` |
| Signer Node + reexport dos builders | `adatechnology-packages/packages/backend/meta-whatsapp-module` | `./testing` |
| Cliente de webhook assinado com WebCrypto | `adatechnology-packages/packages/frontend/conversations-ui` | `./preview` |
| `ConversationPreview`, mock api, mock sse, fixtures | `adatechnology-packages/packages/frontend/conversations-ui` | `./preview` |
| Rota de preview montada em dev | `quickcart/apps/frontend-web` | — |

Export separado (`./preview`), nunca no `.` — fixtures não podem entrar no bundle de
produção de quem consome o SDK. O `build` do `conversations-ui` já lista as entradas
explicitamente no script `tsup`, então a entrada nova precisa ser adicionada lá.

## 6. Aceite

1. Com `WHATSAPP_ACCESS_TOKEN` / `PHONE_NUMBER_ID` **ausentes** e só `APP_SECRET` local:
   abrir o preview cliente, mandar "quero 2kg de arroz" e ver o bot responder — passando por
   webhook real, parser, matcher e `FlowDriver`.
2. Fluxo completo de compra concluído inteiramente pelo preview, gerando pedido no banco.
3. Preview atendente aberto **sem API rodando**: inbox lista conversas, chegam mensagens
   novas sozinhas, `waitingHuman` acende, handoff bot→humano e volta.
4. `tsc --noEmit` limpo nos pacotes tocados; `.` export do `conversations-ui` sem fixtures.

## 7. Fora de escopo

- Credenciamento do app na Meta (é o que a fase existe para não bloquear)
- Editor de fluxo (`./flows`) — já entregue, o preview apenas exercita o grafo que ele produz
