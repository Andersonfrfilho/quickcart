-- A troca de um item em falta por um parecido de outra marca (ADR 0003).
--
-- Aditiva e nulável: toda linha existente segue sendo o que o cliente pediu, e é isso que `null` diz.
-- `restrict` porque apagar a linha de origem deixaria a substituta órfã de sentido — ela existe
-- justamente para contar que houve uma troca, e sem a origem não conta mais nada.
ALTER TABLE "order_items"
  ADD COLUMN "substitutes_order_item_id" uuid;

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_substitutes_order_item_id_fk"
  FOREIGN KEY ("substitutes_order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT;

-- Uma origem é substituída no máximo uma vez: o segundo aceite do mesmo botão (toque duplo, cobrança
-- respondida depois) esbarra aqui em vez de duplicar a linha e cobrar duas vezes pelo mesmo item.
CREATE UNIQUE INDEX "order_items_substitutes_unique_idx"
  ON "order_items" ("substitutes_order_item_id")
  WHERE "substitutes_order_item_id" IS NOT NULL;
