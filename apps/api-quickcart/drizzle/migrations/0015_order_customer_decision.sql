-- O desvio de "falta item" na esteira do pedido.
--
-- Quando quem separa marca um item em falta e avisa o cliente, o pedido para de andar: ninguém entrega
-- uma sacola faltando item antes de saber se a pessoa ainda quer a compra. Esse estado não existia, e a
-- sacola parada ficava indistinguível de uma sendo separada normalmente — a espera não aparecia na lista.
--
-- `status` sobe de 20 para 32 porque `awaiting_customer_decision` tem 26 caracteres. Aumentar o limite de
-- um varchar no Postgres é mudança só de catálogo, sem reescrever a tabela; o caminho inverso não seria,
-- e é por isso que a folga entra agora e não no próximo status.
ALTER TABLE "orders" ALTER COLUMN "status" TYPE varchar(32);
--> statement-breakpoint
-- Quando a pergunta saiu, e quando ela foi cobrada uma única vez.
--
-- Separados de `updated_at` porque é daqui que sai "esperando o cliente há 40 min" — a informação que
-- decide se alguém pega o telefone. `updated_at` muda a cada item marcado e não responde essa pergunta.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_decision_asked_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_decision_reminded_at" timestamp with time zone;
