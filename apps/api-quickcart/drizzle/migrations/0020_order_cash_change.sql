-- Troco no pagamento em dinheiro (roteiro §9, spec §3.1).
--
-- Aditiva e nulável: `null` é a resposta legítima de "não preciso de troco" e de todo pedido
-- que não paga em dinheiro — não existe um "zero" aqui que confunda com troco de R$ 0,00.
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "cash_change_for_in_cents" integer;
