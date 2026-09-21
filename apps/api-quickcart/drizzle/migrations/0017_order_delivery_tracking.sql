-- O trajeto da entrega e a ocorrência que a interrompe.
--
-- A esteira ia de "saiu para entrega" direto a "concluído", então tudo que acontece na rua era um estado
-- só: a sacola que ia chegar em cinco minutos e a que voltou para a loja sem ser entregue tinham o mesmo
-- status na tela e a mesma mensagem no WhatsApp do cliente.
--
-- Os degraus novos (`in_transit`, `arrived_at_customer`) não precisam de coluna — são valores de `status`,
-- que já é varchar(32) e comporta os 20 caracteres de `arrived_at_customer`.
--
-- `delivery_failure_reason` existe porque a ocorrência é UM status com motivo, e não um status por motivo:
-- para a esteira, "extraviado", "cliente ausente" e "endereço errado" são o mesmo fato — o pedido saiu e
-- voltou sem ser entregue. O que muda é o motivo e se cabe outra tentativa, e isso é dado.
--
-- Nula por definição: só o pedido em `delivery_failed` tem motivo, e todo pedido que existe hoje nasce
-- desta migration sem nenhum. Sem NOT NULL e sem default, então, porque não há valor honesto para os
-- outros — "sem ocorrência" é justamente a ausência.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_failure_reason" varchar(20);
--> statement-breakpoint
-- A lista da loja filtra por ocorrência ("o que voltou hoje?"), e é uma fração pequena dos pedidos:
-- índice parcial cobre exatamente essas linhas e deixa o resto da tabela fora do índice.
CREATE INDEX IF NOT EXISTS "orders_delivery_failure_reason_idx"
  ON "orders" ("delivery_failure_reason")
  WHERE "delivery_failure_reason" IS NOT NULL;
