# Ativar um número no WhatsApp Cloud API

Guia de como ligar um número de telefone ao Cloud API, pelos dois caminhos: API (o que o
`scripts/register-whatsapp-number.sh` automatiza) e painel da Meta.

O defeito que motivou este documento: o número recebia mensagem e não respondia nenhuma. O
erro que a Meta devolvia culpava o número, e a causa estava em outro lugar — duas vezes
seguidas, por motivos diferentes.

## Os três estados que precisam estar certos

Um número só envia quando **as três coisas** valem ao mesmo tempo. Elas falham de forma
independente, e cada uma produz um sintoma que parece ser das outras.

| O que | Como conferir | Estado correto |
|---|---|---|
| Token com escopo de envio | `GET /debug_token` | contém `whatsapp_business_messaging` |
| Número ligado ao Cloud API | `GET /{phone_number_id}` | `CONNECTED` + `CLOUD_API` |
| App assinado na WABA | `GET /{waba_id}/subscribed_apps` | o app aparece na lista |

```bash
make whatsapp-status
```

## Leitura dos campos de `GET /{phone_number_id}`

```json
{
  "status": "PENDING",
  "platform_type": "NOT_APPLICABLE",
  "code_verification_status": "VERIFIED",
  "name_status": "PENDING_REVIEW"
}
```

- **`platform_type: NOT_APPLICABLE`** é o achado que importa: o número existe e foi verificado,
  mas **nunca foi registrado no Cloud API**. É o que o `register` conserta.
- **`code_verification_status: VERIFIED` não basta.** Ele diz só que o SMS de posse do número
  foi confirmado — um passo anterior e diferente.
- **`name_status: PENDING_REVIEW`** é o nome de exibição em análise da Meta. Não impede envio.
- Número saudável: `CONNECTED` + `CLOUD_API`.

## Código de verificação ≠ PIN de duas etapas

A Meta chama as duas coisas de "6 dígitos", e confundi-las custa tempo:

| | O que é | De onde vem |
|---|---|---|
| **Código de verificação** | prova que o número é seu | a Meta **envia** por SMS/voz — `request_code` → `verify_code` |
| **PIN de duas etapas** | trava o número contra registro por terceiros | **você escolhe** na hora do `register`. Nada envia, nada recupera |

O PIN é senha permanente. Se o número já tiver um, o `register` exige o valor certo, e **errar
seis vezes bloqueia o registro por horas**. Perder o valor significa não conseguir re-registrar
o número em outro ambiente sem passar pelo suporte da Meta.

Por isso o script grava o PIN em `WHATSAPP_TWO_STEP_PIN` no Railway **antes** de usá-lo, por
substituição de comando — o valor vai do gerador direto para a variável, sem passar por terminal
nem por histórico de shell.

## Caminho por API (recomendado)

```bash
make whatsapp-subscribe   # assina o app na WABA
make whatsapp-register    # gera o PIN, registra, confere a transição
make whatsapp-status      # CONNECTED + CLOUD_API
```

Variáveis lidas do ambiente ou do Railway: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
`WHATSAPP_BUSINESS_ACCOUNT_ID`. Ajuste alvo com `SERVICE_NAME=` e `ENVIRONMENT_NAME=`.

O token precisa de **`whatsapp_business_management`** para `register` e `subscribed_apps`.
`whatsapp_business_messaging` sozinho só envia mensagem — e essa assimetria é exatamente o que
produz o quadro "chega mas não sai".

As variáveis gravadas com `--skip-deploys` **não valem até o redeploy**:

```bash
railway redeploy -s api -e staging -y
```

## Caminho por tela

**Registrar o número** — Gerenciador do WhatsApp:

1. `business.facebook.com` → **Gerenciador do WhatsApp**
2. Barra lateral: **Ferramentas da conta → Números de telefone**
3. Confira que o seletor **Selecione uma conta do WhatsApp Business** está na WABA certa
4. A lista mostra `Número de telefone · Nome · Status · Classificação de qualidade`. O número
   ativo aparece como **Conectado**; o que falta registrar, não
5. Número novo entra por **Adicionar telefone** — o fluxo pede o código por SMS e, no fim, o
   **PIN de duas etapas**. É o mesmo PIN do `register` da API
6. Para um número já criado, a engrenagem **Configurações** da linha guarda a verificação em
   duas etapas

**Webhook e assinatura do app** — painel de desenvolvedor:

1. `developers.facebook.com` → seu app → **WhatsApp → Configuração da API**
2. **Etapa 3: Configure webhooks** → URL de callback, token de verificação, campo `messages`

⚠️ **O console de API do painel de desenvolvedor não registra número de outra WABA.** Ele fica
amarrado à WABA vinculada ao caso de uso do app: se o número novo está em outra WABA, a tela
continua mostrando o número antigo, inclusive no cURL de exemplo. Foi o que travou a primeira
tentativa aqui. Nesse caso, ou o Gerenciador do WhatsApp, ou a API.

## Erros e o que eles realmente significam

| Erro | Texto | Causa real |
|---|---|---|
| `100` / subcode `33` | `Object with ID '<id>' does not exist, cannot be loaded due to missing permissions` | **Token sem escopo.** O erro nomeia o número, mas o número está lá — quem está cego é o token |
| `130497` | `Business account is restricted from messaging users in this country` | Restrição **da WABA**, não do número. O mesmo prefixo `+1 555` que falhava numa WABA de teste passou a entregar dentro de uma WABA verificada própria |

O `130497` chega como **status de entrega no webhook**, não como erro da chamada de envio: a
API responde 200, a mensagem simplesmente não chega. Sem log do callback de status, o sintoma é
silêncio.

## Prova de que funcionou

Log de um ciclo completo, já com o número ativo:

```
webhook_processed  messages:1   ← cliente escreveu
webhook_processed  statuses:1   ← saiu
webhook_processed  statuses:1   ← entregue
```

Os callbacks de status só existem para mensagem que a Meta **aceitou**. Eles são a prova de
envio; ausência deles, com `messages:1` presente, é o quadro "chega mas não sai".
