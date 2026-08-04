# Spec — Endereço estruturado, distância e previsão de chegada

Status: 🚧 Para revisão · Criada em 2026-08-02

Objetivo: mostrar ao operador **a que distância o cliente está da loja** e **quando o pedido
chega**. O cálculo é a parte fácil; o pré-requisito é que o endereço deixe de ser texto livre.

---

## 1. O que existe hoje (levantado no código, não presumido)

| Pergunta | Resposta |
|---|---|
| Onde o endereço aparece na tela? | Um lugar só: `OrderDetailView.tsx:223`, no detalhe do pedido. Fora da listagem por decisão registrada em comentário |
| Os seeders geram endereço? | **Não.** Seeds cobrem categorias, produtos, grafos de conversa e mídia. Nenhum cliente, pedido ou endereço |
| Existe cálculo de distância/ETA? | **Não.** Busca por distância, haversine, geocoding, ETA, lat/lng: zero ocorrência |
| A loja tem endereço? | `STORE_ADDRESS`, `z.string().optional()`, usado só para imprimir no recibo (`ProcessReceiptJob.use-case.ts:64`). Texto, não coordenada |

### 1.1 O bloqueio real: o endereço é `unknown` na cadeia inteira

| Camada | Tipo |
|---|---|
| `customers.defaultAddress` | `jsonb`, sem tipo |
| `orders.address` | `jsonb`, sem tipo |
| `CreateWebOrder.schema.ts:33` | `z.unknown().optional()` — **nenhuma validação de entrada** |
| Checkout web (`useCheckoutPage.hook.ts:31`) | `{ street: "texto digitado num input único" }` |
| Fluxo WhatsApp (`CheckoutHandler.ts:179`) | `message.body.trim()` — **string crua** do que o cliente escreveu |

Os dois canais gravam **formatos diferentes no mesmo campo**. É por isso que o admin precisa
deste malabarismo para exibir (`OrderDetailView.tsx:58-61`):

```ts
if (typeof address === 'string') return address.trim()
if (address && typeof address === 'object') return Object.values(address).filter(Boolean).join(', ')
```

`Object.values(...).join(', ')` depende da ordem de inserção das chaves para montar a frase — some
o dia em que alguém acrescentar um campo. E não existe caminho a partir de `"manda na rua de trás
do posto"` para uma coordenada.

**Conclusão:** estruturar o endereço não é preparação para a feature, é a feature. Sem isso, não
há o que geocodificar.

---

## 2. Escopo

**Entra:** modelo de endereço estruturado, captura nos dois canais, endereço da loja com
coordenada, geocodificação com cache, distância e previsão de chegada exibidas no admin, e
seeders gerando endereços plausíveis para dar o que ver em desenvolvimento.

**Não entra:** roteirização de múltiplas entregas, rastreamento do entregador em tempo real,
cálculo de taxa de entrega por faixa (o modelo de dados abre caminho, a regra de preço é outra
spec), e mapa na tela.

---

## 3. Modelo de endereço

`shared/address/Address.schema.ts`, zod, usado pelos dois canais e pelas duas tabelas:

```ts
export const addressSchema = z.object({
  cep: z.string().regex(/^\d{5}-?\d{3}$/),
  street: z.string().min(1).max(160),
  number: z.string().min(1).max(20),          // string: "s/n", "123A" existem
  complement: z.string().max(80).optional(),
  neighborhood: z.string().min(1).max(80),
  city: z.string().min(1).max(80),
  state: z.string().length(2),
  reference: z.string().max(160).optional(),  // "portão azul ao lado da padaria"
  // Preenchidas pela geocodificação, não pelo cliente.
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  geocodePrecision: z.enum(['street', 'postal_code', 'city', 'none']).optional(),
})
```

`number` é string de propósito: "s/n" e "123A" são endereços reais, e `integer` os rejeitaria.

`reference` existe porque em entrega de bairro ela costuma valer mais que o número — e hoje o
cliente já escreve isso no meio do texto livre; o campo dá lugar para a informação em vez de
perdê-la.

`geocodePrecision` acompanha a coordenada porque **a precisão varia muito** (§4.3), e uma UI que
mostra "2,3 km" com a mesma confiança para uma coordenada de rua e uma de centroide de cidade está
mentindo para o operador.

---

## 4. Geocodificação — eficiente e grátis

Requisito do usuário: **eficiente e grátis**. As medições abaixo foram feitas contra as APIs
reais em 2026-08-02, não tiradas de documentação.

### 4.1 O que cada opção grátis entrega

| Serviço | Chave? | CEP → endereço | CEP → coordenada | Medição |
|---|---|---|---|---|
| **ViaCEP** | não | ✅ completo (+ IBGE, DDD) | ❌ não tem o campo | `01415-000` → Rua Bela Cintra, Consolação, São Paulo/SP |
| **BrasilAPI** v2 | não | ✅ com cadeia de fallback entre provedores | ⚠️ **campo existe e vem vazio** | 3 capitais testadas (`01310-100`, `20040-030`, `80010-000`): `location.coordinates: {}` em todas |
| **Nominatim** (OSM) | não | ➖ parcial | ✅ **funciona por CEP** | `01310-100` → `-23.5649659, -46.6518144` |

O achado que decide o desenho: **BrasilAPI anuncia coordenada e não entrega**. Confiar nesse campo
daria um sistema que funciona no teste com CEP feliz e devolve `{}` em produção.

### 4.2 Desenho recomendado

```
CEP → [ViaCEP ou BrasilAPI] → logradouro/bairro/cidade/UF
CEP → [Nominatim, cacheado]  → latitude/longitude
distância → haversine (zero chamada externa)
```

**A eficiência vem do cache, não do provedor.** A chave de cache é o **CEP**, não o endereço:

- CEP → coordenada é estável (não muda entre pedidos, nem entre clientes do mesmo prédio).
- Uma loja atende um raio finito; o conjunto de CEPs atendidos converge em semanas.
- Depois do aquecimento, o custo de geocodificação de um pedido novo tende a **zero chamada
  externa**.

Isso é o que torna o Nominatim viável apesar da política de uso dele (1 req/s, `User-Agent`
obrigatório, uso em massa proibido): com cache por CEP, o volume real fica em dezenas de chamadas
por semana, não por pedido.

**Tabela de cache** (`geocoded_addresses`): `cep` (PK), `latitude`, `longitude`, `precision`,
`provider`, `resolvedAt`. Sem dado pessoal — CEP não identifica pessoa, e é por isso que o cache
pode ser global em vez de por cliente.

### 4.3 O limite honesto: CEP não é porta

Medido: CEP `37925-000` (Piumhi/MG) devolve coordenada, mas ela é o **centroide da cidade** —
`logradouro` vazio no ViaCEP, e o Nominatim responde "37925-000, Piumhi, Minas Gerais". CEP
genérico (terminado em `-000`, comum em cidade pequena) cobre o município inteiro.

| Tipo de CEP | Precisão real | `geocodePrecision` |
|---|---|---|
| CEP de logradouro (capital) | ~100–500 m, o trecho da rua | `street` |
| CEP de bairro | ~1 km | `postal_code` |
| CEP genérico `-000` | a cidade inteira — **pode errar quilômetros** | `city` |

**Consequência para a UI:** com `precision: 'city'`, a tela mostra a distância como aproximada e
não promete horário. Prometer "chega 14h35" a partir de um centroide de município é pior que não
prometer nada.

### 4.4 Distância: haversine, com fator de correção

Haversine é linha reta: grátis, instantâneo, zero chamada. Em cidade, subestima o percurso real
porque o carro não atravessa quarteirão.

O fator de correção (`DISTANCE_DETOUR_FACTOR`, começando em `1.35`) é **configurável e precisa ser
calibrado com entrega real** — o número inicial é um ponto de partida da literatura de logística
urbana, não uma medição desta operação. Calibrar é comparar distância estimada com a rodada de
fato, depois de haver histórico.

**Quando isso não bastar:** OpenRouteService tem free tier com distância de rota real. Fica
documentado como caminho de evolução, não entra agora — trocar haversine por rota é mudar uma
função, e a decisão fica melhor com dados de calibração na mão.

---

## 5. Previsão de chegada

```
ETA = preparo + deslocamento
```

- **Preparo** — `STORE_PREPARATION_MINUTES`, configurável, default 20 min. Sem histórico de
  pedido, qualquer coisa mais elaborada seria número inventado com cara de precisão.
- **Deslocamento** — `distância_corrigida / velocidade_média`, com `DELIVERY_AVERAGE_SPEED_KMH`
  configurável (default 25 km/h, ordem de grandeza de moto em cidade).

**A previsão é uma faixa, nunca um horário exato:** `± 30%`, exibida como "35–50 min". Faixa
comunica incerteza; horário cravado promete o que o modelo não sustenta.

Com `geocodePrecision: 'city'` ou coordenada ausente, **não exibe ETA** — mostra só o endereço.

---

## 6. Migração dos dados existentes

Os dois `jsonb` têm dado em produção nos dois formatos (§1.1). Expansão/contração
(`database.md`):

1. **Expandir** — colunas novas nascem opcionais; nada quebra.
2. **Backfill** — script tenta extrair CEP por regex do texto livre. O que casar, geocodifica; o
   que não casar fica com `structured: null` e o texto original preservado em
   `legacyAddressText`.
3. **Conviver** — a UI lê o estruturado quando existe e cai no texto legado quando não existe. O
   `formatAddress` atual continua servindo os pedidos antigos.
4. **Contrair** — só quando não houver pedido ativo em formato antigo. Provavelmente nunca vale a
   pena: manter a coluna de texto legado é barato.

**Nenhum pedido histórico é reescrito com endereço adivinhado.** Se o regex não achou CEP, o campo
fica nulo — endereço de entrega inventado por heurística é pior que ausente.

---

## 7. Seeders

Hoje não criam cliente nem pedido, então não há o que ver na tela em desenvolvimento. Passam a
gerar clientes com endereço estruturado **de CEPs reais**, espalhados por faixas de distância da
loja: alguns a ~1 km, alguns a ~5 km, um fora do raio. É o que permite ver a UI de distância
funcionando, incluindo o caso "fora da área de entrega".

Seed roda os use-cases, nunca `INSERT` bruto (`code-standart.md` §5).

---

## 8. Decisões — fechadas

**✅ Q1. CEP primeiro, com auto-preenchimento.** O cliente digita 8 dígitos, o ViaCEP devolve
rua/bairro/cidade, e ele completa só número e complemento. Menos digitação, endereço estruturado
por construção, e o CEP é a chave de cache. No WhatsApp vira um passo a mais no `CheckoutHandler`,
que hoje aceita uma mensagem só.

CEP que não resolve (genérico de cidade pequena, ou digitado errado) **não trava o cliente**: cai
para os campos manuais. O caminho é um só na estrutura de dados — o que muda é de onde os campos
vêm preenchidos.

**✅ Q2. Fora do raio apenas sinaliza ao operador — não bloqueia a venda.** O pedido é aceito
normalmente e o admin exibe o aviso; quem decide é a pessoa.

O motivo pesa mais do que preferência de produto: a coordenada vem de CEP, e em CEP genérico ela
é o centroide do município (§4.3, medido). Bloquear com base nessa coordenada recusaria venda
legítima de cliente que mora a dois quarteirões da loja numa cidade pequena. **Errar liberando é
recuperável; errar bloqueando é venda perdida sem ninguém ficar sabendo.**

`STORE_DELIVERY_RADIUS_KM` continua existindo — só que alimenta um aviso, não uma trava.

**✅ Q3. Endereço da loja vira tabela.** `STORE_ADDRESS` (hoje `z.string().optional()` usada só no
recibo) passa a ser registro com endereço estruturado e coordenada. O resto do schema já é
multiempresa; custa uma migração pequena agora e evita reescrever na segunda loja. A env var
continua sendo lida no boot para popular a linha inicial, e depois sai.

---

## 9. Critérios de aceite

- [ ] `addressSchema` é a única definição de endereço, usada pelos dois canais e pelas duas tabelas
- [ ] `CreateWebOrder.schema.ts` valida endereço de verdade — `z.unknown()` some
- [ ] WhatsApp captura CEP + número em passos, não uma mensagem de texto livre
- [ ] Coordenada resolvida por CEP e **cacheada**; segundo pedido do mesmo CEP não chama API externa
- [ ] `geocodePrecision` gravado junto da coordenada
- [ ] ETA exibida como faixa, e **omitida** quando a precisão é `city` ou não há coordenada
- [ ] Pedido antigo sem CEP extraível continua exibindo o texto original, sem endereço inventado
- [ ] Seeders geram clientes em faixas variadas de distância, incluindo um fora do raio
- [ ] Nenhuma chave de API nova (requisito de gratuidade cumprido sem billing)
- [ ] `User-Agent` identificando a aplicação nas chamadas ao Nominatim (exigência da política de uso)
- [ ] Distância e ETA não aparecem para `deliveryType: 'pickup'`

---

## 10. Modelos por etapa (`model-economy.md`)

| Etapa | Modelo |
|---|---|
| Esta spec e a decisão de provedor | `opus` 🧠 |
| `addressSchema` + migração expand | `sonnet` |
| Captura nos dois canais (web + WhatsApp) | `sonnet` |
| Geocoding com cache + haversine + ETA | `sonnet` |
| Backfill do legado | `sonnet` 🧠 (dado de produção) |
| Seeders e UI | `haiku` |
| Revisão final | `opus` |
