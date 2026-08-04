-- Quando o cliente foi avisado de que um item faltou.
--
-- Separado de `unavailable_at` porque marcar e avisar são momentos diferentes: quem separa marca três
-- itens andando pelo corredor, e o cliente deve receber UM recado com os três. Antes disto, cada marcação
-- disparava uma mensagem na hora — quatro itens faltando eram quatro mensagens, e a loja não tinha como
-- revisar o que ia ser dito antes de dizer.
--
-- `null` com `unavailable_at` preenchido é o estado "falta registrada, cliente ainda não sabe", que é o
-- que a tela mostra para alguém decidir avisar.
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "unavailable_notified_at" timestamp with time zone;
