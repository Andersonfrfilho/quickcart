# ADR 0002 — Adoção do `@adatechnology/catalog-module` no QuickCart

Status: ✅ Aceita · 2026-08-14 · passo 2 do plano de migração do catálogo

## Contexto

O QuickCart tem catálogo próprio em `apps/api-quickcart/src/modules/catalog`: 7 use cases, 2
repositórios Drizzle, 2 tabelas (`products`, `categories`) no schema `public`. O mesmo domínio
existe hoje em `@adatechnology/catalog-module`, já consumido por outro produto, com os campos de
varejo que o QuickCart precisa (`brand`, `unitSize`, `aisle`, `aliases`) adicionados na branch
`feat/catalog-retail-fields`.

Manter os dois é manter duas verdades sobre o que é um produto. A decisão de adotar o módulo
compartilhado já estava tomada; este ADR registra **como**, porque quatro pontos de atrito reais
apareceram na leitura do código dos dois lados, e cada um deles tem mais de uma saída defensável.

## Evidência medida

| Ponto | QuickCart hoje | Módulo compartilhado |
|---|---|---|
| Tenant | nenhuma tabela de catálogo tem `company_id`; `WHATSAPP_COMPANY_ID` só aparece em seed de conversa | `company_id uuid NOT NULL` em `catalogs`, `sections`, `products`, e em **todo** índice único (`idx_products_company_barcode`, `idx_catalogs_company_name`) |
| Schema Postgres | `public` | `pgSchema('catalog')`, criado pela primeira migration do próprio módulo, com journal separado |
| Baixa de estoque | `DrizzleOrderRepository.createWithStockDecrement` roda `UPDATE ... stock_quantity - qty WHERE stock_quantity - qty >= 0` dentro de `db.transaction`, junto do `INSERT` do pedido (3 transações no arquivo, linhas 90, 349, 435) | `ConsumeInventoryUseCase.execute({ companyId, productId, quantity })` — sem parâmetro de transação; repositórios recebem `db: CatalogDatabase` no construtor e não expõem `withTransaction` |
| Agrupamento | `categories` (nome único global, `sortOrder`, `emoji`); `products.category_id NOT NULL` | `catalogs` + `sections`, ambos por empresa; `products.catalogId` e `sectionId` opcionais |
| Referências | `cart_items.product_id` e `order_items.product_id` com `references(() => products.id, { onDelete: 'restrict' })` | tabela alvo passa a viver em outro schema Postgres |

Não medido: volume de produtos em produção, e se alguma query de relatório fora do módulo lê
`products` direto. Ambos precisam ser checados antes de rodar a migration de dados.

## Decisão

1. **`companyId` fixo, vindo da configuração.** O QuickCart continua mono-loja. Uma constante
   `QUICKCART_COMPANY_ID`, lida do env e validada no boot, é passada em toda chamada ao módulo.
   Nada de `companyId` opcional no módulo.
2. **Baixa de estoque continua no QuickCart, por enquanto.** `createWithStockDecrement` mantém o
   `UPDATE` condicional na mesma transação do pedido, agora apontando para `catalog.products`.
   `ConsumeInventoryUseCase` não é usado no caminho de criação de pedido enquanto o módulo não
   aceitar um handle de transação.
3. **`categories` vira `catalogs`.** Um catálogo por categoria atual, mesmo `id`, mesmo `name`,
   mesmo `sortOrder`. `sections` fica sem uso no QuickCart. `emoji` não tem par no módulo e sai —
   ou volta como campo do módulo, se a UI ainda depender dele.
4. **FKs cruzam o schema.** `cart_items` e `order_items` passam a referenciar
   `catalog.products.id`, mantendo `onDelete: 'restrict'`.

## Razões, na ordem em que pesam

**1. `companyId` opcional no módulo custaria caro e resolveria pouco.** Ele está em todos os
índices únicos: torná-lo anulável obrigaria índices parciais e uma segunda forma de unicidade —
e a próxima instalação multiempresa reencontraria o problema. Um UUID fixo no env é uma linha de
configuração e zero mudança de schema.

**2. Estoque e pedido precisam falhar juntos.** O código atual usa a própria condição do `UPDATE`
(`stock - qty >= 0`) como trava de concorrência dentro da transação do pedido. Chamar um use case
que abre a própria conexão quebraria isso: dois pedidos simultâneos poderiam baixar o mesmo item
e um pedido poderia ficar gravado com estoque não baixado. Enquanto o módulo não receber `tx`, a
escrita fica onde a transação está.

**3. Categoria e catálogo são a mesma coisa aqui.** Um mercado pequeno tem um nível de
agrupamento, não dois. Mapear 1:1 mantendo o `id` torna a migration de dados um `INSERT ...
SELECT` e dispensa reescrever `cart_items`/`order_items`.

**4. FK entre schemas é barata no Postgres.** Não há restrição; o custo é operacional — dump,
restore e ordem de migration precisam considerar os dois schemas. Menor que o custo de largar a
integridade referencial de item de pedido.

## Limite desta decisão

- Não decide **quando** o módulo ganha suporte a transação. Ele é a condição para a baixa de
  estoque migrar para `ConsumeInventoryUseCase`; até lá, o QuickCart escreve em
  `catalog.products` por fora do módulo, e isso é dívida consciente, não padrão.
- Não decide o destino de `categories.emoji`.
- Não cobre a migration de dados em si (ordem, janela, rollback), que é o passo 3.
- Vale para o QuickCart mono-loja. Se o produto virar multiempresa, o item 1 é o primeiro a cair.
