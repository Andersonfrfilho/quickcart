-- Endereço estruturado: expand, não contract.
--
-- `orders.address` e `customers.default_address` são jsonb sem tipo, com dois formatos gravados em
-- produção (um objeto do checkout web, texto crú do WhatsApp). Esta migração só ADICIONA — nenhuma
-- coluna existente muda de tipo nem ganha NOT NULL retroativo, e nenhum dado é reescrito aqui. O
-- backfill que lê o texto legado e tenta extrair CEP é outra etapa, deliberadamente.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "legacy_address_text" text;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "legacy_address_text" text;

-- Cache de geocodificação por CEP. BrasilAPI anuncia campo de coordenada e devolve `{}` (medido,
-- spec §4.1) — por isso o cache existe como tabela própria alimentada pelo Nominatim, não um campo
-- otimista lido de qualquer provedor.
CREATE TABLE IF NOT EXISTS "geocoded_addresses" (
  "cep" varchar(9) PRIMARY KEY NOT NULL,
  "latitude" numeric(10, 7) NOT NULL,
  "longitude" numeric(10, 7) NOT NULL,
  -- 'street' | 'postal_code' | 'city' | 'none' — ver GEOCODE_PRECISION em Address.schema.ts.
  "precision" varchar(20) NOT NULL,
  "provider" varchar(40) NOT NULL,
  "resolved_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Endereço da loja, com coordenada. Substitui STORE_ADDRESS (env var, texto livre, usada só no
-- recibo) — sem coordenada da própria loja não há de onde medir distância até o cliente.
--
-- Sem company_id: nenhuma outra tabela deste schema tem tenant, e o projeto é uma loja por
-- deployment, a mesma premissa da env var que esta tabela substitui.
CREATE TABLE IF NOT EXISTS "stores" (
  "id" uuid PRIMARY KEY NOT NULL,
  "name" varchar(120) NOT NULL,
  "cep" varchar(9) NOT NULL,
  "street" varchar(160) NOT NULL,
  "number" varchar(20) NOT NULL,
  "complement" varchar(80),
  "neighborhood" varchar(80) NOT NULL,
  "city" varchar(80) NOT NULL,
  "state" varchar(2) NOT NULL,
  "reference" varchar(160),
  "latitude" numeric(10, 7),
  "longitude" numeric(10, 7),
  "geocode_precision" varchar(20),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
