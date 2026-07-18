# Fluxo conversacional — QuickCart

Máquina de estados persistida em `conversation_sessions.current_state`.
Tabela completa de estados/handlers: `.specs/features/mvp/spec.md` §4.

```mermaid
stateDiagram-v2
    [*] --> greeting
    greeting --> main_menu : boas-vindas + botões
    main_menu --> awaiting_list : 📝 Enviar lista
    main_menu --> browsing_categories : 🛒 Ver produtos
    main_menu --> cart_review : 🔁 Repetir pedido
    main_menu --> resolving_items : texto já é uma lista (atalho)
    awaiting_list --> resolving_items : itens ambíguos
    awaiting_list --> cart_review : tudo auto-match
    browsing_categories --> awaiting_quantity : produto escolhido
    awaiting_quantity --> browsing_categories : item adicionado
    browsing_categories --> cart_review : ver carrinho
    resolving_items --> resolving_items : próximo item ambíguo
    resolving_items --> cart_review : fila vazia
    cart_review --> awaiting_list : ➕ adicionar mais
    cart_review --> editing_cart : ✏️ editar
    editing_cart --> cart_review
    cart_review --> awaiting_delivery_type : ✅ fechar pedido
    awaiting_delivery_type --> awaiting_address : 🛵 entrega
    awaiting_delivery_type --> awaiting_payment : 🏪 retirada
    awaiting_address --> awaiting_payment
    awaiting_payment --> awaiting_receipt_preference
    awaiting_receipt_preference --> awaiting_email : e-mail sem cadastro
    awaiting_email --> confirming
    awaiting_receipt_preference --> confirming
    confirming --> completed : ✅ confirma (cria pedido)
    completed --> [*]
```

## Regras transversais

- `GlobalHandler` roda antes de qualquer estado: `sair`/`cancelar` → reset p/ `greeting`.
- **Atalho de velocidade**: em `greeting`/`main_menu`, se o texto parseia ≥ 2 itens, pula o
  menu e trata como lista — o cliente que manda a lista de cara nunca vê menu.
- **Áudio** em qualquer estado de captura de lista: job `stt` na fila; bot responde
  "🎧 ouvindo seu áudio..."; transcript reentra pelo `POST /v1/internal/conversation/resume`.
- **Desambiguação**: 1 item por vez (lista interativa Meta, máx 10 rows + "❌ Nenhum desses").
  Ids das rows: `product:<uuid>` e `skip_item`.
- Sessão sem interação por 6h → próximo contato recomeça em `greeting` (contexto limpo,
  carrinho `open` preservado — oferece "continuar de onde parou" se houver itens).
- Toda mensagem (in/out) persiste em `messages`; textos do bot só em `Messages.constant.ts`.

## Exemplo canônico (caso de aceite da Fase 4)

Cliente: `2kg arroz, leite, 6 ovos, sabão`
1. ovos → match único confiante → auto (6 un)
2. arroz → 3 candidatos → lista interativa (Tio João 1kg · Camil 1kg · Integral 1kg)
3. leite → 4 candidatos → lista interativa
4. sabão → 3 candidatos → lista interativa
5. Resumo: itens + subtotal + botões ✅ Fechar pedido / ➕ Adicionar / ✏️ Editar
