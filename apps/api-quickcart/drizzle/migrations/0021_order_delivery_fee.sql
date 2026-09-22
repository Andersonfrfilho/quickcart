-- Taxa de entrega (roteiro §7, spec §3.4).
--
-- Fora de `total_in_cents` de propósito: a NFC-e usa o total como valor pago e não admite frete.
-- Aditiva, com default 0: pedidos antigos e retiradas ficam com taxa zero.
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "delivery_fee_in_cents" integer NOT NULL DEFAULT 0;
