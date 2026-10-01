-- Faixas de taxa por distância (spec §3.1, design.md "Modelo de dados").
--
-- Formato "até X km": a faixa i cobre (X[i-1], X[i]], a primeira começa em 0 — sobreposição e
-- buraco são impossíveis sem uma coluna de início. UNIQUE(max_distance_km) impede duas faixas com
-- o mesmo teto; os CHECKs replicam no banco o que a validação de aplicação já garante, porque o
-- painel substitui a lista inteira (delete + insert) e um bug ali não pode gravar lixo.
CREATE TABLE IF NOT EXISTS "delivery_fee_tiers" (
  "id" uuid PRIMARY KEY,
  "max_distance_km" numeric(5, 2) NOT NULL,
  "fee_in_cents" integer NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "delivery_fee_tiers_max_distance_km_check" CHECK ("max_distance_km" > 0),
  CONSTRAINT "delivery_fee_tiers_fee_in_cents_check" CHECK ("fee_in_cents" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "delivery_fee_tiers_max_distance_km_idx"
  ON "delivery_fee_tiers" ("max_distance_km");
