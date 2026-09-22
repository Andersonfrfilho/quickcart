-- Snapshot da cotação no pedido (spec §3.7).
--
-- Sem FK para `delivery_fee_tiers`: a lista de faixas é substituída inteira a cada PUT do painel
-- (T1.2), então a faixa que gerou esta cotação pode não existir mais amanhã. O pedido guarda o
-- retrato do momento — distância, teto e taxa da faixa aplicada, e a fonte da localização.
-- Nullable e aditiva: retirada e pedidos antigos ficam nulos nas quatro colunas.
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "delivery_distance_km" numeric(6, 2),
  ADD COLUMN IF NOT EXISTS "delivery_tier_max_km" numeric(5, 2),
  ADD COLUMN IF NOT EXISTS "delivery_tier_fee_in_cents" integer,
  ADD COLUMN IF NOT EXISTS "delivery_location_source" varchar(20);
