-- Marcador de "as faixas já foram configuradas" (T6.2-B). Sem ele, o seed de boot via a tabela
-- vazia depois que o admin desligou a entrega e recriava as faixas de D4 a cada deploy. Linha única
-- (id = 1): é um fato da loja, não uma lista.
CREATE TABLE IF NOT EXISTS "delivery_fee_settings" (
  "id" smallint PRIMARY KEY DEFAULT 1,
  "tiers_seeded_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "delivery_fee_settings_single_row_check" CHECK ("id" = 1)
);
--> statement-breakpoint

-- Base que já tem faixas foi configurada antes deste marcador existir: marca, para o seed não mexer.
INSERT INTO "delivery_fee_settings" ("id", "tiers_seeded_at")
SELECT 1, now() WHERE EXISTS (SELECT 1 FROM "delivery_fee_tiers")
ON CONFLICT ("id") DO NOTHING;
