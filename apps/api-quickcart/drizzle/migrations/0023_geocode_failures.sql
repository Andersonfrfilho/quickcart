-- Cache negativo de geocodificação (T1.4, spec §3.5): CEP que falhou não é tentado de novo por 24h.
CREATE TABLE IF NOT EXISTS "geocode_failures" (
  "cep" varchar(9) PRIMARY KEY,
  "failed_at" timestamptz NOT NULL DEFAULT now()
);
