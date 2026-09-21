-- O histórico das viagens de um pedido.
--
-- `orders.delivery_failure_reason` é apagado ao sair da ocorrência, para a tela não exibir o motivo de uma
-- viagem encerrada. Com retentativa, isso apaga a primeira falha junto: "saiu duas vezes, voltou por cliente
-- ausente e depois entregou" não existe em lugar nenhum do banco hoje.
--
-- A coluna em `orders` continua onde está, e continua sendo a ocorrência CORRENTE — é dela que a esteira
-- decide se cabe outra viagem. Esta tabela é memória, não estado.
CREATE TABLE IF NOT EXISTS "order_delivery_attempts" (
  "id" uuid PRIMARY KEY,
  "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "attempt" integer NOT NULL,
  "started_at" timestamptz DEFAULT now() NOT NULL,
  -- Nulo é a viagem em andamento, e é o que faz a tentativa aberta ser encontrável sem comparar datas.
  "ended_at" timestamptz,
  "outcome" varchar(12),
  "failure_reason" varchar(20)
, "created_at" timestamptz DEFAULT now() NOT NULL);
--> statement-breakpoint
-- Duas linhas com a mesma numeração seriam duas "2ª tentativa" do mesmo pedido. O número é lido pela tela,
-- então a garantia é do banco: dois cliques simultâneos em "saiu para entrega" perdem um dos dois aqui, e
-- não geram histórico duplicado.
CREATE UNIQUE INDEX IF NOT EXISTS "order_delivery_attempts_order_attempt_idx"
  ON "order_delivery_attempts" ("order_id", "attempt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_delivery_attempts_order_idx"
  ON "order_delivery_attempts" ("order_id", "started_at");
--> statement-breakpoint
-- Backfill do que dá para afirmar, e só isso.
--
-- Pedido que hoje está na rua, entregue ou com ocorrência teve pelo menos UMA viagem — essa é a tentativa 1.
-- Quantas vieram antes é justamente o que se perdeu, e inventar duas linhas para um pedido que talvez tenha
-- saído três vezes seria trocar ausência de dado por dado errado. `started_at` sai de `updated_at` por ser a
-- melhor aproximação existente; não é o instante em que a sacola saiu.
INSERT INTO "order_delivery_attempts" ("id", "order_id", "attempt", "started_at", "ended_at", "outcome", "failure_reason")
SELECT
  gen_random_uuid(),
  "id",
  1,
  "updated_at",
  CASE WHEN "status" IN ('completed', 'delivery_failed') THEN "updated_at" END,
  CASE
    WHEN "status" = 'completed' THEN 'delivered'
    WHEN "status" = 'delivery_failed' THEN 'failed'
  END,
  "delivery_failure_reason"
FROM "orders"
WHERE "delivery_type" = 'delivery'
  AND "status" IN ('out_for_delivery', 'in_transit', 'arrived_at_customer', 'delivery_failed', 'completed');
