# ADR 0001 — Não fazer backfill de endereço legado

Status: ✅ Aceita · 2026-08-02 · Revisão da Fase 4 de `.specs/features/delivery-distance/`

## Contexto

A spec de distância/ETA (§6) planejava uma Fase 4 assim: extrair CEP por regex do texto livre
gravado em `orders.address` e `customers.default_address`, geocodificar o que casasse, e preservar o
original em `legacy_address_text` para o que não casasse.

As Fases 1 e 2 já entregaram: `addressSchema` como definição única, migração aditiva (`0010`),
validação real na entrada web, captura CEP-first nos dois canais, e leitura que exibe estruturado
quando existe e cai no texto legado quando não existe.

Esta ADR revisa a Fase 4 **antes** de escrever em dado real, porque backfill é a única etapa da
feature que reescreve o que já está gravado.

## Evidência medida

Inventário (`make address-inventory`, só leitura) em **dev**:

| | pedidos | clientes |
|---|---|---|
| total | 7 | 18 |
| endereço nulo | 5 | **18** |
| estruturado | 1 | 0 |
| texto cru | 1 | 0 |

E o regex `\d{5}-?\d{3}` aplicado a texto livre, testado contra frases que gente escreve num campo
de endereço:

| Texto | Extraiu | Certo? |
|---|---|---|
| `...São Paulo/SP, 03123-000` | `03123-000` | ✅ |
| `...ligar 98888-7777` | `98888-777` | ❌ celular |
| `...meu telefone é 33334444` | `33334444` | ❌ fixo |
| `...CPF 01415000123` | `01415000` | ❌ **e é um CEP real em São Paulo** |
| `...CEP 3123000` | nada | ❌ falso negativo |

## Decisão

**Não há backfill.** A Fase 4 sai do plano. O que fica:

1. `orders.address` e `customers.default_address` **não são reescritos**.
2. `legacy_address_text` continua existindo nas duas tabelas, vazia — custa nada e é o lugar pronto
   caso a decisão mude.
3. `make address-inventory` é a única peça construída desta fase: só leitura, sem PII na saída, roda
   em qualquer ambiente sem plano de rollback.

## Razões, na ordem em que pesam

**1. Um CEP achado por regex em texto livre não é um CEP — é um palpite de 8 dígitos.** O caso do CPF
é o que decide: extrai `01415000`, que existe, geocodifica com sucesso, e produz uma distância
plausível e errada. Erro silencioso, sem nada na tela para desconfiar. Errar aqui é pior que não ter
o dado, e a spec já estabeleceu esse princípio para o caso oposto (§6: "endereço de entrega inventado
por heurística é pior que ausente").

**2. `customers.default_address` é coluna morta.** Nenhum caller passa `defaultAddress` para
`updateContactInfo` (o único uso passa apenas `email`), nada além dos arquivos de schema lê a coluna,
e os 18 clientes de dev têm `null`. Metade do escopo da Fase 4 não tem dado para migrar. *(Se essa
coluna deve passar a ser escrita é outra decisão, fora desta ADR — **resolvida em 2026-08-04, ver
"Desdobramento" abaixo**.)*

**3. O backfill não conseguiria produzir endereço estruturado válido.** `addressSchema` exige
`number`, e número não é recuperável com confiança de texto livre: em `"Travessa 7, casa 2"` o número
é 7 ou 2? Um objeto parcial gravado em `address` seria rejeitado por `isStructuredAddress` (T1.4) e
pela própria validação — ou seja, o backfill escreveria algo que a tela ignora.

**4. Pedido histórico já foi entregue.** Coordenada nele não muda operação nenhuma. O argumento de
calibrar `DISTANCE_DETOUR_FACTOR` (spec §4.4) não se sustenta: calibrar exige comparar a estimativa
com a distância *rodada de fato*, que não é registrada em lugar nenhum.

**5. Nada depende disso.** A Fase 3 já tem a regra certa (spec §5): sem coordenada, não exibe ETA.
Pedido legado simplesmente não mostra distância. E "repetir última compra" continua funcionando,
porque `formatAddressLine` entende os dois formatos. O legado é uma cauda que encurta sozinha — todo
pedido novo já nasce estruturado.

## Limite desta decisão

As contagens são de **dev** (7 pedidos). `docs/DEPLOY.md` descreve deploy na Railway, mas não medi
produção — não tenho acesso a ela nesta análise. A afirmação da spec §6 de que "os dois `jsonb` têm
dado em produção nos dois formatos" **não foi verificada**.

Se produção tiver volume relevante de texto cru, o que muda é a *pergunta*, não esta resposta: rodar
`make address-inventory ENV=<prod>` diz o tamanho do problema, e um volume grande justificaria no
máximo uma tela para a loja **corrigir endereço à mão** — nunca adivinhar por regex.

## Desdobramento — 2026-08-04

**Produção não existe.** O limite acima se resolveu por constatação, não por medição: a conta Railway
tem exatamente dois projetos (`transportada` e `financiamento-imobiliario-bot`) e nenhum `quickcart`;
`envs/` não tem `env.prod`; e `docs/DEPLOY.md` é plano, não registro (o §webhook diz "novo app a
criar"). Não há `ENV=<prod>` para rodar. A afirmação da spec §6 de que "os dois `jsonb` têm dado em
produção nos dois formatos" está **refutada** — não há produção.

**A razão nº 2 fechou removendo a coluna.** Novo inventário em dev, depois de a feature rodar: 13
pedidos (6 estruturados, 1 texto cru) e **24 clientes com 24 nulos**. Seis pedidos estruturados novos
passaram pelos dois canais sem escrever `default_address` uma única vez — a coluna não estava
esperando ser ligada, era inerte por construção. A migração `0012` dropa `customers.default_address` e
`customers.legacy_address_text` (esta existia só para guardar a forma legada daquela).
`orders.legacy_address_text` **fica**: `orders.address` tem dado real e a tela de detalhe lê o campo.

Por que não passar a usá-la, que era a outra saída: no WhatsApp seria duplicata de `lastOrder.address`
— que `toRememberedCheckout` já reaproveita — criando duas fontes de verdade que podem divergir para
endereço de entrega. Na web, onde estaria o ganho real, pré-preencher exigiria resolver o cliente pelo
telefone **antes** do submit (hoje `upsertByPhone` roda no submit, e não existe rota de consulta de
cliente), ou seja um endpoint não autenticado que troca telefone por endereço residencial — BOLA com
exposição de PII (security.md §1 e §2). E o ganho seria pequeno: o checkout web já autocompleta por
CEP via ViaCEP, então só o número da casa é digitação manual.

Com conta de cliente, endereço salvo volta por migração aditiva, desenhado junto com a autorização.
